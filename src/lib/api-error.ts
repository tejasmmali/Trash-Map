import "server-only";
import { z } from "zod";
import { ConfigError } from "@/lib/env";
import { DatabaseError } from "@/lib/reports/repository";
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
  return apiError("INTERNAL_ERROR", "Something went wrong", 500);
}
