import type { NextRequest } from "next/server";
import { classifyImage } from "@/lib/ai/classify-image";
import { handleUnknownError } from "@/lib/api-error";
import { readImageUpload } from "@/lib/image-upload";

export async function POST(request: NextRequest) {
  const result = await readImageUpload(request);
  if (!result.ok) return result.response;

  const { bytes, mimeType } = result.upload;
  try {
    return Response.json(await classifyImage({ bytes, mimeType }));
  } catch (error) {
    return handleUnknownError(error);
  }
}
