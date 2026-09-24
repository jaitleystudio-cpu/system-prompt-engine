/** Hard caps applied before heavy decode (₹0 local path). */

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 120 * 1024 * 1024;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_URL_BYTES = 200_000;
export const MAX_IMAGE_MEGAPIXELS = 40;
export const MAX_ANALYSIS_SIDE = 1280;
export const MAX_VIDEO_DURATION_SEC = 180;
export const MAX_VIDEO_FRAMES = 8;
export const SEEK_TIMEOUT_MS = 8_000;
export const URL_FETCH_TIMEOUT_MS = 12_000;

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const VIDEO_MIME_PREFIX = "video/";

export function assertImageFileBounds(file: File): void {
  if (file.size <= 0) throw new Error("This image file is empty.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))} MB before decode).`,
    );
  }
  if (file.type && !IMAGE_MIME.has(file.type) && !file.type.startsWith("image/")) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }
}

export function assertVideoFileBounds(file: File): void {
  if (file.size <= 0) throw new Error("This video file is empty.");
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is too large (max ${Math.floor(MAX_VIDEO_BYTES / (1024 * 1024))} MB before decode).`,
    );
  }
  if (file.type && !file.type.startsWith(VIDEO_MIME_PREFIX)) {
    throw new Error(`Unsupported video type: ${file.type}`);
  }
}

export function assertHtmlFileBounds(file: File): void {
  if (file.size <= 0) throw new Error("This HTML file is empty.");
  if (file.size > MAX_HTML_BYTES) {
    throw new Error(
      `HTML file is too large (max ${Math.floor(MAX_HTML_BYTES / (1024 * 1024))} MB).`,
    );
  }
}

export function assertMegapixelCap(width: number, height: number): void {
  const mp = (width * height) / 1_000_000;
  if (mp > MAX_IMAGE_MEGAPIXELS) {
    throw new Error(
      `Image resolution is too high (${mp.toFixed(1)} MP; max ${MAX_IMAGE_MEGAPIXELS} MP).`,
    );
  }
}
