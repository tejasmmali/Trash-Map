import type { ACCEPTED_IMAGE_TYPES } from "@/lib/validation/reports";

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/** Detects JPEG, PNG, or WebP from magic bytes; null for anything else. */
export function detectImageType(bytes: Uint8Array): AcceptedImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" <4-byte size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}
