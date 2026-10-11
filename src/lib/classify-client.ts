import { apiErrorSchema } from "@/lib/validation/api";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  classifyResponseSchema,
} from "@/lib/validation/reports";
import type { ClassifyResponse } from "@/types/reports";

// Browser-side helper for POST /api/classify. The server re-validates everything;
// these checks only give faster feedback before uploading.

export type ClassifyResult = { ok: true; result: ClassifyResponse } | { ok: false; message: string };

export function checkImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 4 MB or smaller.";
  return null;
}

export async function classifyPhoto(file: File, signal?: AbortSignal): Promise<ClassifyResult> {
  const problem = checkImageFile(file);
  if (problem) return { ok: false, message: problem };

  const form = new FormData();
  form.append("image", file);

  let res: Response;
  try {
    res = await fetch("/api/classify", { method: "POST", body: form, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, message: "Could not reach the server." };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    return {
      ok: false,
      message: parsed.success ? parsed.data.error.message : `Request failed (HTTP ${res.status}).`,
    };
  }

  const parsed = classifyResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: "The server returned data in an unexpected format." };
  return { ok: true, result: parsed.data };
}
