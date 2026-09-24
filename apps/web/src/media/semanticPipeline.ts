/**
 * Semantic observe pipeline: LITE always, STANDARD lazy ONNX + structure + OCR-likeness.
 * Vision output = OBSERVATION / MODEL_JUDGMENT only.
 */
import {
  observeImageData,
  observeImageFile,
} from "./imageObserve";
import { detectTextLikeRegions } from "./ocrLite";
import {
  classifySubjectsMobileNet,
  currentVisionBytes,
  getOnnxLastError,
} from "../engine/onnxSemantic";
import type { SemanticObservation, VisionTier } from "./semanticTypes";
import { getVisionModelBytes } from "../engine/visionBudget";
import { buildSemanticFromLite } from "./semanticCompose";
export { buildSemanticFromLite, semanticToPromptBlock } from "./semanticCompose";

export type SemanticObserveOptions = {
  tier?: VisionTier;
  signal?: AbortSignal;
  /** Progress 0..1 for UI. */
  onProgress?: (p: number, label: string) => void;
};

export async function observeImageSemanticFromData(
  data: ImageData,
  meta: Parameters<typeof observeImageData>[1] = {},
  opts: SemanticObserveOptions = {},
): Promise<SemanticObservation> {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const want: VisionTier = opts.tier ?? "STANDARD";
  opts.onProgress?.(0.05, "LITE pixel pass");
  const lite = observeImageData(data, meta);
  const ocrBlocks = detectTextLikeRegions(data);
  opts.onProgress?.(0.35, "Structure semantics");

  let subjects: SemanticObservation["subjects"] = [];
  let tier: VisionTier = "LITE";
  const notes: string[] = ["structure-heuristic composition/style"];

  if (want === "STANDARD" && typeof window !== "undefined") {
    opts.onProgress?.(0.45, "Loading STANDARD model pack (lazy)");
    const classified = await classifySubjectsMobileNet(data, opts.signal);
    if (classified && classified.length) {
      subjects = classified;
      tier = "STANDARD";
      notes.push("mobilenet-v2-int8 subjects");
    } else {
      notes.push(
        `STANDARD model unavailable — LITE fallback (${getOnnxLastError() ?? "no session"})`,
      );
    }
  } else {
    notes.push("STANDARD skipped (requested LITE or non-browser)");
  }

  opts.onProgress?.(0.95, "Summarizing");
  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const sem = buildSemanticFromLite(lite, {
    subjects,
    ocrBlocks,
    tier,
    elapsedMs: Math.round(t1 - t0),
    methodNotes: notes,
    imageData: data,
  });
  opts.onProgress?.(1, "Done");
  return sem;
}

export async function observeImageFileSemantic(
  file: File,
  opts: SemanticObserveOptions = {},
): Promise<SemanticObservation> {
  // Decode via existing LITE path for bounds/cancel, then re-observe with semantic.
  // We re-decode once more for ImageData access in browser.
  const lite = await observeImageFile(file, opts.signal);
  if (typeof document === "undefined") {
    return buildSemanticFromLite(lite, {
      tier: "LITE",
      elapsedMs: 0,
      methodNotes: ["no DOM — LITE only"],
    });
  }
  // Re-read pixels for STANDARD (observeImageFile already revoked URL — decode again)
  opts.onProgress?.(0.02, "Decoding");
  const { assertImageFileBounds, assertMegapixelCap, MAX_ANALYSIS_SIDE } =
    await import("./limits");
  assertImageFileBounds(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (opts.signal) {
        if (opts.signal.aborted) return onAbort();
        opts.signal.addEventListener("abort", onAbort, { once: true });
      }
      img.onload = () => {
        opts.signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      img.onerror = () => {
        opts.signal?.removeEventListener("abort", onAbort);
        reject(new Error("Could not decode this image."));
      };
      img.src = url;
    });
    assertMegapixelCap(img.naturalWidth, img.naturalHeight);
    const scale = Math.min(
      1,
      MAX_ANALYSIS_SIDE / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return observeImageSemanticFromData(
      data,
      {
        fileName: file.name,
        fileBytes: file.size,
        mimeType: file.type || null,
        sourceWidth: img.naturalWidth,
        sourceHeight: img.naturalHeight,
      },
      opts,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}


export { currentVisionBytes, getVisionModelBytes };
