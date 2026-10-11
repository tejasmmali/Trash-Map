import "server-only";
import { ConfigError } from "@/lib/env";
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

/** Maps unknown errors to a safe response; logs the original server-side only. */
export function handleUnknownError(error: unknown): Response {
  if (error instanceof ConfigError) {
    return apiError("CONFIG_MISSING", "Server is missing required configuration", 503, {
      missing: error.missing,
    });
  }
  console.error(error);
  return apiError("INTERNAL_ERROR", "Something went wrong", 500);
}
