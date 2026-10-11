import "server-only";
import { z } from "zod";
import { AiInvalidResponseError, AiProviderError, type AiProviderErrorReason } from "@/lib/ai/errors";
import { ConfigError } from "@/lib/env";
import { DatabaseError } from "@/lib/reports/repository";
import { StorageError } from "@/lib/reports/storage";
import type { ApiError, ApiErrorCode } from "@/types/reports";

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const body: ApiError = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return Response.json(body, { status });
}

/** 400 response listing which fields failed and why. */
export function validationError(message: string, error: z.ZodError): Response {
  return apiError("VALIDATION_ERROR", message, 400, z.flattenError(error));
}

const AI_PROVIDER_RESPONSES: Record<AiProviderErrorReason, { status: number; message: string }> = {
  unsupported_model: {
    status: 502,
    message: "The configured AI model cannot read images. Set GEMINI_MODEL to an image-capable model.",
  },
  model_not_found: { status: 502, message: "The configured AI model was not found. Check GEMINI_MODEL." },
  auth: { status: 502, message: "The AI provider rejected the server's credentials." },
  rate_limited: { status: 503, message: "The AI service is busy. Try again shortly." },
  timeout: { status: 504, message: "The AI service took too long to respond. Try again." },
  unavailable: { status: 502, message: "The AI service is unavailable. Try again later." },
};

/** Maps unknown errors to a safe response; logs the original server-side only. */
export function handleUnknownError(error: unknown): Response {
  if (error instanceof ConfigError) {
    return apiError("CONFIG_MISSING", "Server is missing required configuration", 503, {
      missing: error.missing,
    });
  }
  console.error(error);
  if (error instanceof DatabaseError) {
    return apiError("DATABASE_ERROR", "Database request failed", 500);
  }
  if (error instanceof StorageError) {
    return apiError("STORAGE_ERROR", "Image upload failed", 500);
  }
  if (error instanceof AiProviderError) {
    const { status, message } = AI_PROVIDER_RESPONSES[error.reason];
    return apiError("AI_UNAVAILABLE", message, status);
  }
  if (error instanceof AiInvalidResponseError) {
    return apiError(
      "AI_INVALID_RESPONSE",
      "The AI returned an unusable result. Try again or use a different photo.",
      502,
    );
  }
  return apiError("INTERNAL_ERROR", "Something went wrong", 500);
}
