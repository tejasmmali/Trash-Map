import "server-only";
import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api-error";
import { detectImageType, type AcceptedImageType } from "@/lib/image-type";
import { MAX_IMAGE_BYTES, imageFileSchema } from "@/lib/validation/reports";

// Room for multipart boundaries, part headers, and small text fields around a max-size image.
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

export type ImageUpload = { form: FormData; bytes: Uint8Array; mimeType: AcceptedImageType };

/**
 * Parses a multipart body with an `image` field and checks size, declared type,
 * and magic bytes. Oversized bodies are rejected from Content-Length before reading.
 */
export async function readImageUpload(
  request: NextRequest,
): Promise<{ ok: true; upload: ImageUpload } | { ok: false; response: Response }> {
  const fail = (response: Response) => ({ ok: false as const, response });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return fail(apiError("VALIDATION_ERROR", "Request must be multipart/form-data with an image field", 415));
  }

  const declaredLength = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    return fail(apiError("VALIDATION_ERROR", "Content-Length header is required", 411));
  }
  if (declaredLength > MAX_BODY_BYTES) {
    return fail(apiError("VALIDATION_ERROR", "Image must be 4 MB or smaller", 413));
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(apiError("VALIDATION_ERROR", "Request body is not valid multipart form data", 400));
  }

  const image = form.get("image");
  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return fail(apiError("VALIDATION_ERROR", "Image must be 4 MB or smaller", 413));
  }
  const parsed = imageFileSchema.safeParse(image);
  if (!parsed.success) {
    return fail(validationError("A JPEG, PNG, or WebP image is required in the image field", parsed.error));
  }

  const bytes = new Uint8Array(await parsed.data.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType || detectedType !== parsed.data.type) {
    return fail(apiError("VALIDATION_ERROR", "File content is not a valid JPEG, PNG, or WebP image", 400));
  }

  return { ok: true, upload: { form, bytes, mimeType: detectedType } };
}
