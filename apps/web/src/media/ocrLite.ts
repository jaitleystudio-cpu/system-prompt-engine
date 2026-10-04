/**
 * Canonical OCR owner.
 * detectTextLikeRegions is text-band detection, not OCR.
 * tryTesseractOcr runs only the pinned local Tesseract route (/api/ocr).
 * It returns null unless that execution mode was LOCAL_OCR.
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

export type OcrExecutionMode =
  | "LOCAL_NEURAL"
  | "LOCAL_OCR"
  | "HEURISTIC"
  | "UNAVAILABLE";

export type OcrExecution = {
  mode: OcrExecutionMode;
  text: string;
  regions: OcrBlock[];
  errorCode: string | null;
  egressAttempts: number;
};

const EXECUTION_MODES = new Set<OcrExecutionMode>([
  "LOCAL_NEURAL",
  "LOCAL_OCR",
  "HEURISTIC",
  "UNAVAILABLE",
]);

function unavailable(errorCode: string): OcrExecution {
  return {
    mode: "UNAVAILABLE",
    text: "",
    regions: [],
    errorCode,
    egressAttempts: 0,
  };
}

function confidenceLabel(score: number): OcrBlock["confidence"] {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function readExecution(value: unknown): OcrExecution {
  if (!value || typeof value !== "object") return unavailable("HOST_ERROR");
  const row = value as Record<string, unknown>;
  const mode = row.mode;
  if (typeof mode !== "string" || !EXECUTION_MODES.has(mode as OcrExecutionMode)) {
    return unavailable("FALSE_MODE");
  }
  const egress = typeof row.egressAttempts === "number" ? row.egressAttempts : 0;
  if (mode !== "LOCAL_OCR") {
    return {
      mode: mode as OcrExecutionMode,
      text: "",
      regions: [],
      errorCode: typeof row.errorCode === "string" ? row.errorCode : null,
      egressAttempts: egress,
    };
  }
  const regionsIn = Array.isArray(row.regions) ? row.regions : [];
  const regions: OcrBlock[] = [];
  for (const item of regionsIn) {
    if (!item || typeof item !== "object") continue;
    const region = item as Record<string, unknown>;
    const bounds = region.bounds;
    if (!bounds || typeof bounds !== "object") continue;
    const box = bounds as Record<string, unknown>;
    const textValue = typeof region.text === "string" ? region.text : "";
    const score = typeof region.confidence === "number" ? region.confidence : 0;
    if (
      typeof box.x !== "number" ||
      typeof box.y !== "number" ||
      typeof box.w !== "number" ||
      typeof box.h !== "number"
    ) {
      continue;
    }
    regions.push({
      text: textValue,
      bounds: { x: box.x, y: box.y, w: box.w, h: box.h },
      confidence: confidenceLabel(score),
      method: "ocr-tesseract",
      provenance: "UNTRUSTED_SOURCE",
    });
  }
  const textValue = typeof row.text === "string" ? row.text : "";
  if (!textValue.trim() && regions.length === 0 && row.engineRan !== true) {
    return unavailable(typeof row.errorCode === "string" ? row.errorCode : "ENGINE_FAILED");
  }
  return {
    mode: "LOCAL_OCR",
    text: textValue,
    regions,
    errorCode: null,
    egressAttempts: egress,
  };
}

/** Decode the file locally, then ask the pinned loopback OCR route. */
export async function recognizeImageFile(
  file: Blob,
  signal?: AbortSignal,
): Promise<OcrExecution> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
    } catch {
      return unavailable("DECODE");
    }
  }
  try {
    const bytes = await file.arrayBuffer();
    const response = await fetch("/api/ocr/recognize", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: bytes,
      signal,
    });
    if (!response.ok) return unavailable("NOT_MOUNTED");
    return readExecution(await response.json());
  } catch {
    if (signal?.aborted) return unavailable("CANCELLED");
    return unavailable("NOT_MOUNTED");
  }
}

/** Pinned Tesseract. Null unless the loopback route actually ran LOCAL_OCR. */
export async function tryTesseractOcr(
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<OcrBlock[] | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/png");
  });
  if (!blob) return null;
  const execution = await recognizeImageFile(blob, signal);
  if (execution.mode !== "LOCAL_OCR") return null;
  return execution.regions;
}
