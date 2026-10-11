import type { NextRequest } from "next/server";
import { classifyImage } from "@/lib/ai/classify-image";
import { apiError, handleUnknownError, validationError } from "@/lib/api-error";
import { detectImageType } from "@/lib/image-type";
import { MAX_IMAGE_BYTES, imageFileSchema } from "@/lib/validation/reports";

// Room for multipart boundaries and part headers around a max-size image.
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return apiError("VALIDATION_ERROR", "Request must be multipart/form-data with an image field", 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    return apiError("VALIDATION_ERROR", "Content-Length header is required", 411);
  }
  if (declaredLength > MAX_BODY_BYTES) {
    return apiError("VALIDATION_ERROR", "Image must be 4 MB or smaller", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Request body is not valid multipart form data", 400);
  }

  const image = form.get("image");
  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return apiError("VALIDATION_ERROR", "Image must be 4 MB or smaller", 413);
  }
  const parsed = imageFileSchema.safeParse(image);
  if (!parsed.success) {
    return validationError("A JPEG, PNG, or WebP image is required in the image field", parsed.error);
  }

  const bytes = new Uint8Array(await parsed.data.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType || detectedType !== parsed.data.type) {
    return apiError("VALIDATION_ERROR", "File content is not a valid JPEG, PNG, or WebP image", 400);
  }

  try {
    return Response.json(await classifyImage({ bytes, mimeType: detectedType }));
  } catch (error) {
    return handleUnknownError(error);
  }
}
