/**
 * Image upload validation and encoding — pure, server-safe helpers.
 *
 * Everything here is deliberately free of framework imports so it can be unit
 * tested directly and used by the API route, the server action, and the
 * multimodal provider call alike.
 *
 * Two independent checks are applied to every upload:
 *   1. the declared MIME type and byte length (cheap, reject early), and
 *   2. the file's magic bytes (the bytes themselves, so a renamed .exe or a
 *      truncated file cannot slip through dressed as a .png).
 *
 * The bytes are only ever read to compute a base64 data URL for the provider
 * request. Draftly never writes an uploaded image to disk: nothing about an
 * upload survives the request unless the user's own draft does.
 */

/** Formats Draftly accepts. Deliberately small — these are what the
 *  configured provider accepts inline and what social platforms use. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** 5 MB. Large enough for a phone photo, small enough to keep the request
 *  inside provider inline-image limits and to fail fast on a wrong pick. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageValidation =
  | { ok: true; mimeType: AllowedImageType; bytes: number }
  | { ok: false; error: string };

const MB = (n: number) => `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;

/**
 * Sniff a real image type from the first bytes of a file.
 *
 * Signatures: JPEG starts with FF D8 FF; PNG with the 8-byte \x89PNG\r\n\x1a\n
 * header; WebP with "RIFF" at 0 and "WEBP" at 8. Returns null for anything
 * else, including an empty buffer.
 */
export function sniffImageType(head: Uint8Array): AllowedImageType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 && // P
    head[2] === 0x4e && // N
    head[3] === 0x47 && // G
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 && // R
    head[1] === 0x49 && // I
    head[2] === 0x46 && // F
    head[3] === 0x46 && // F
    head[8] === 0x57 && // W
    head[9] === 0x45 && // E
    head[10] === 0x42 && // B
    head[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Validate an uploaded image.
 *
 * `declaredType` is what the browser claimed; `head`/`bytes` are the real
 * content. A mismatch between the two is rejected rather than trusted, so an
 * upload can never be accepted on the strength of a filename alone.
 */
export function validateImage(input: {
  declaredType: string;
  bytes: Uint8Array;
}): ImageValidation {
  const { declaredType, bytes } = input;

  if (bytes.length === 0) {
    return { ok: false, error: "That file is empty. Choose an image and try again." };
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is ${MB(bytes.length)} — the limit is ${MB(MAX_IMAGE_BYTES)}. Try a smaller version.`,
    };
  }

  const declared = declaredType.trim().toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    return {
      ok: false,
      error: "Unsupported file type. Upload a JPEG, PNG, or WebP image.",
    };
  }

  const actual = sniffImageType(bytes);
  if (!actual) {
    return {
      ok: false,
      error: "That file does not look like a real image. JPEG, PNG, and WebP are supported.",
    };
  }

  // A file whose bytes say PNG but whose type says JPEG is almost always a
  // mistake or tampering; use the sniffed type, which is the trustworthy one.
  if (actual !== declared) {
    return {
      ok: false,
      error: "The file's contents do not match its type. Re-export the image and try again.",
    };
  }

  return { ok: true, mimeType: actual, bytes: bytes.length };
}

/** Base64-encode bytes for a provider request. Chunked so a multi-MB image
 *  does not blow the argument limit of String.fromCharCode. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // Buffer is available in Node (this only ever runs server-side).
  return Buffer.from(binary, "binary").toString("base64");
}

/** Build the data URL form the provider's image field expects. */
export function toDataUrl(bytes: Uint8Array, mimeType: AllowedImageType): string {
  return `data:${mimeType};base64,${toBase64(bytes)}`;
}
