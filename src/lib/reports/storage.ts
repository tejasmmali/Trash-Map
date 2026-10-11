import "server-only";
import { getSupabaseEnv } from "@/lib/env";
import type { AcceptedImageType } from "@/lib/image-type";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
  }
}

const EXTENSIONS: Record<AcceptedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function reportImagePath(reportId: string, mimeType: AcceptedImageType): string {
  return `reports/${reportId}.${EXTENSIONS[mimeType]}`;
}

function bucket() {
  return getSupabaseAdmin().storage.from(getSupabaseEnv().SUPABASE_STORAGE_BUCKET);
}

/** Uploads without overwriting and returns the public URL of the new object. */
export async function uploadReportImage(
  path: string,
  bytes: Uint8Array,
  mimeType: AcceptedImageType,
): Promise<string> {
  const { error } = await bucket().upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new StorageError("Failed to upload report image", { cause: error });
  return bucket().getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of an object this request uploaded. Never throws. */
export async function removeReportImage(path: string): Promise<void> {
  try {
    const { error } = await bucket().remove([path]);
    if (error) console.error(new StorageError(`Failed to remove orphaned image ${path}`, { cause: error }));
  } catch (error) {
    console.error(new StorageError(`Failed to remove orphaned image ${path}`, { cause: error }));
  }
}
