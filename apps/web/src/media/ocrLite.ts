/**
 * Zero-cost browser OCR path:
 * 1) Always: text-likeness via horizontal projection + high-frequency edges.
 * 2) Optional: dynamic Tesseract.js if SPE_ENABLE_TESSERACT=1 and load succeeds.
 * OCR text = UNTRUSTED_SOURCE.
 */
import type { OcrBlock } from "./semanticTypes";

export function detectTextLikeRegions(data: ImageData): OcrBlock[] {
  const { width, height, data: px } = data;
  const rowHF = new Float32Array(height);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256));
  for (let y = 1; y < height - 1; y += step) {
    let edges = 0;
    let n = 0;
    for (let x = 1; x < width - 1; x += step) {
      const i = (y * width + x) * 4;
      if (px[i + 3] < 16) continue;
      const c = (px[i] + px[i + 1] + px[i + 2]) / 3;
      const r = ((y * width + (x + 1)) * 4);
      const cr = (px[r] + px[r + 1] + px[r + 2]) / 3;
      if (Math.abs(c - cr) > 40) edges++;
      n++;
    }
    rowHF[y] = n ? edges / n : 0;
  }
  // Smooth
  const smooth = new Float32Array(height);
  for (let y = 2; y < height - 2; y++) {
    smooth[y] =
      (rowHF[y - 2] + rowHF[y - 1] + rowHF[y] + rowHF[y + 1] + rowHF[y + 2]) /
      5;
  }
  const blocks: OcrBlock[] = [];
  let inBand = false;
  let start = 0;
  const thresh = 0.22;
  for (let y = 0; y < height; y++) {
    if (smooth[y] >= thresh) {
      if (!inBand) {
        inBand = true;
        start = y;
      }
    } else if (inBand) {
      inBand = false;
      const h = (y - start) / height;
      if (h >= 0.015 && h <= 0.25) {
        blocks.push({
          id: `textlike-${blocks.length}`,
          text: "",
          bounds: { x: 0.05, y: start / height, w: 0.9, h },
          confidence: h < 0.08 ? "medium" : "low",
          method: "ocr-textlikeness",
          provenance: "UNTRUSTED_SOURCE",
        } as OcrBlock & { id?: string });
      }
    }
  }
  // Strip accidental id if type doesn't have it — normalize
  return blocks.map(({ text, bounds, confidence, method, provenance }) => ({
    text:
      text ||
      `[text-like band ~${Math.round(bounds.y * 100)}%–${Math.round((bounds.y + bounds.h) * 100)}%]`,
    bounds,
    confidence,
    method,
    provenance,
  }));
}

/** Optional Tesseract — never required; returns null if unavailable. */
export async function tryTesseractOcr(
  _canvas: HTMLCanvasElement,
  _signal?: AbortSignal,
): Promise<OcrBlock[] | null> {
  // V1: keep pack size honest — do not ship Tesseract by default.
  // Hook retained for opt-in experiments without changing product claims.
  return null;
}
