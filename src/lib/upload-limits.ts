export const MAX_UPLOAD_REQUEST_BYTES = 101 * 1024 * 1024;
export const MAX_PHOTO_BATCH_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BATCH_BYTES = 100 * 1024 * 1024;

export type UploadLengthCheck = "ok" | "missing" | "invalid" | "too-large";

export function checkUploadContentLength(contentLength: string | null): UploadLengthCheck {
  if (contentLength === null) return "missing";
  const bytes = Number(contentLength);
  if (!Number.isSafeInteger(bytes) || bytes < 1) return "invalid";
  return bytes > MAX_UPLOAD_REQUEST_BYTES ? "too-large" : "ok";
}

export function totalFileBytes(files: ArrayLike<{ size: number }>) {
  return Array.from(files).reduce((total, file) => total + file.size, 0);
}
