/**
 * Upload limits shared by the server validation and the UI copy, so the number
 * users read is always the number the API enforces. Dependency-free so client
 * components can import it.
 *
 * 3MB of raw image: base64 adds ~33%, keeping the request under Vercel's 4.5MB
 * body limit.
 */

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_LABEL = "3 MB";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ACCEPTED_IMAGE_LABEL = "PNG, JPEG or WebP";

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
