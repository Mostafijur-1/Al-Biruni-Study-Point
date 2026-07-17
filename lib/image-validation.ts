export const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function validateImageFile(
  file: File,
  maxSizeBytes = MAX_IMAGE_SIZE_BYTES,
): Promise<ImageValidationResult> {
  if (file.size > maxSizeBytes) {
    return { ok: false, error: "The image must be 4 MB or smaller.", status: 413 };
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Unsupported image type. Please upload a JPEG, PNG, or WebP image.",
      status: 415,
    };
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasValidImageSignature(file.type, header)) {
    return { ok: false, error: "The uploaded file is not a valid image.", status: 415 };
  }

  return { ok: true };
}

function hasValidImageSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}
