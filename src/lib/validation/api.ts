import { z } from "zod";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFIG_MISSING",
  "AI_UNAVAILABLE",
  "AI_INVALID_RESPONSE",
  "STORAGE_ERROR",
  "DATABASE_ERROR",
  "INTERNAL_ERROR",
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

/** Every non-2xx API response uses this body. Never include secrets or stacks. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
