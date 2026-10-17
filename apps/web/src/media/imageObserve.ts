import {
  assertImageFileBounds,
  assertMegapixelCap,
  MAX_ANALYSIS_SIDE,
} from "./limits";
import { wrapUntrustedData } from "./untrusted";
import type { ColorSwatch, ImageObservation } from "./types";

const LICENSE_NOTE =
  "Image analysis runs in your browser with pixel sampling only. No cloud vision API. Models are not downloaded unless you opt into an optional local pack (none required for V1).";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clampByte(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a),
    y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function aspectRatioLabel(w: number, h: number): string {
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

/** Quantize RGB into a coarse bucket key for dominant-color voting. */
function bucketKey(r: number, g: number, b: number): string {
  const q = (v: number) => Math.round(v / 32) * 32;
  return `${q(r)},${q(g)},${q(b)}`;
}

/**
 * Pure observation over ImageData — testable without DOM.
 * Samples up to ~12k pixels for color/brightness; scans for simple edges.
 * Alpha < 16 pixels are skipped for color, brightness, and 3×3 grid (consistent).
 */
export function observeImageData(
  data: ImageData,
  meta: {
    fileName?: string | null;
    fileBytes?: number | null;
    mimeType?: string | null;
    sourceWidth?: number;
    sourceHeight?: number;
  } = {},
): ImageObservation {
  const { width, height } = data;
  const sourceWidth = meta.sourceWidth ?? width;
  const sourceHeight = meta.sourceHeight ?? height;
  const pixels = data.data;
  const total = width * height;
  const step = Math.max(1, Math.floor(Math.sqrt(total / 12000)));
  const votes = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();
  let sum = 0;
  let dark = 0;
  let light = 0;
  let samples = 0;
  let transparentHits = 0;
  let opaqueChecks = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2],
        a = pixels[i + 3];
      opaqueChecks++;
      if (a < 16) {
        transparentHits++;
        continue;
      }
      const bright = (r * 299 + g * 587 + b * 114) / 1000;
      sum += bright;
      if (bright < 64) dark++;
      if (bright > 200) light++;
      samples++;
      const key = bucketKey(r, g, b);
      const cur = votes.get(key);
      if (cur) {
        cur.count++;
        cur.r += r;
        cur.g += g;
        cur.b += b;
      } else votes.set(key, { count: 1, r, g, b });
    }
  }

  const dominantColors: ColorSwatch[] = [...votes.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((v) => ({
      hex: toHex(v.r / v.count, v.g / v.count, v.b / v.count),
      share: samples ? v.count / samples : 0,
    }));

  let edgeHits = 0;
  let edgeChecks = 0;
  const edgeStep = Math.max(2, step);
  for (let y = 1; y < height - 1; y += edgeStep) {
    for (let x = 1; x < width - 1; x += edgeStep) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 16) continue;
      const right = (y * width + (x + 1)) * 4;
      const down = ((y + 1) * width + x) * 4;
      const c = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      const cr =
        (pixels[right] + pixels[right + 1] + pixels[right + 2]) / 3;
      const cd = (pixels[down] + pixels[down + 1] + pixels[down + 2]) / 3;
      const mag = Math.abs(c - cr) + Math.abs(c - cd);
      edgeChecks++;
      if (mag > 48) edgeHits++;
    }
  }
  const edgeDensity = edgeChecks ? edgeHits / edgeChecks : 0;

  const grid: ImageObservation["grid"] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = Math.floor((col * width) / 3);
      const x1 = Math.floor(((col + 1) * width) / 3);
      const y0 = Math.floor((row * height) / 3);
      const y1 = Math.floor(((row + 1) * height) / 3);
      let gSum = 0,
        gN = 0;
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = (y * width + x) * 4;
          if (pixels[i + 3] < 16) continue;
          gSum +=
            (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) /
            1000;
          gN++;
        }
      }
      grid.push({ row, col, meanBrightness: gN ? gSum / gN : 0 });
    }
  }

  const mean = samples ? sum / samples : 0;
  const notes: string[] = [];
  const uncertainty: string[] = [
    "Object identity, text OCR, faces, and brand logos are not detected in V1.",
    "Colors are quantized samples, not a calibrated color profile.",
  ];
  if (edgeDensity > 0.35)
    notes.push("Busy visual structure (higher edge density).");
  else if (edgeDensity < 0.08)
    notes.push("Mostly flat or soft regions (low edge density).");
  if (mean < 70) notes.push("Overall dark frame.");
  if (mean > 180) notes.push("Overall bright frame.");
  if (sourceWidth >= 1800 || sourceHeight >= 1800)
    notes.push("High-resolution source.");
  const transparentShare = opaqueChecks ? transparentHits / opaqueChecks : 0;
  if (transparentShare > 0.4)
    notes.push(
      `Large transparent regions (~${Math.round(transparentShare * 100)}% of samples).`,
    );
  if (sourceWidth !== width || sourceHeight !== height) {
    notes.push(
      `Analyzed at ${width}×${height} (source ${sourceWidth}×${sourceHeight}).`,
    );
  }

  return {
    kind: "image",
    width,
    height,
    sourceWidth,
    sourceHeight,
    aspectRatio: aspectRatioLabel(sourceWidth, sourceHeight),
    megapixels:
      Math.round(((sourceWidth * sourceHeight) / 1_000_000) * 100) / 100,
    fileName: meta.fileName ?? null,
    fileBytes: meta.fileBytes ?? null,
    mimeType: meta.mimeType ?? null,
    dominantColors,
    brightness: {
      mean: Math.round(mean * 10) / 10,
      darkShare: samples ? dark / samples : 0,
      lightShare: samples ? light / samples : 0,
    },
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
    grid,
    notes,
    uncertainty,
    licenseNote: LICENSE_NOTE,
  };
}

/** Human-readable summary (not a diagnostic dump). */
export function humanImageSummary(obs: ImageObservation): string {
  const colors = obs.dominantColors
    .slice(0, 3)
    .map((c) => c.hex)
    .join(", ");
  const tone =
    obs.brightness.mean < 70
      ? "dark"
      : obs.brightness.mean > 180
        ? "bright"
        : "balanced";
  const structure =
    obs.edgeDensity > 0.35
      ? "busy detail"
      : obs.edgeDensity < 0.08
        ? "soft / flat areas"
        : "moderate structure";
  return [
    `A ${obs.sourceWidth}×${obs.sourceHeight} ${obs.aspectRatio} image (${obs.megapixels} MP).`,
    colors ? `Palette leans ${colors}.` : "Palette unclear (sparse opaque pixels).",
    `Overall ${tone} lighting with ${structure}.`,
    obs.notes.length ? obs.notes.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function observationToPromptBlock(obs: ImageObservation): string {
  const colors = obs.dominantColors
    .map((c) => `${c.hex} (${Math.round(c.share * 100)}%)`)
    .join(", ");
  const grid = obs.grid
    .map((g) => `r${g.row}c${g.col}:${Math.round(g.meanBrightness)}`)
    .join(" ");
  const summary = humanImageSummary(obs);
  const diagnostics = [
    `Size: source ${obs.sourceWidth}×${obs.sourceHeight}px; analysis ${obs.width}×${obs.height}px (${obs.aspectRatio}, ${obs.megapixels} MP)`,
    obs.fileName
      ? `File: ${obs.fileName}${obs.fileBytes != null ? ` (${obs.fileBytes} bytes)` : ""}`
      : null,
    `Dominant colors: ${colors || "n/a"}`,
    `Brightness mean: ${obs.brightness.mean} (dark ${(obs.brightness.darkShare * 100).toFixed(0)}% / light ${(obs.brightness.lightShare * 100).toFixed(0)}%)`,
    `Edge density: ${obs.edgeDensity}`,
    `3×3 brightness grid: ${grid}`,
    obs.notes.length ? `Notes: ${obs.notes.join(" ")}` : null,
    `Uncertainty: ${obs.uncertainty.join(" ")}`,
    `Method: ${obs.licenseNote}`,
  ]
    .filter(Boolean)
    .join("\n");

  return wrapUntrustedData(
    "local-image-observation",
    [
      "USER-FACING SUMMARY:",
      summary,
      "",
      "OBSERVATIONS (grounded pixel samples — not a vision model):",
      diagnostics,
    ].join("\n"),
  );
}

export async function observeImageFile(
  file: File,
  signal?: AbortSignal,
): Promise<ImageObservation> {
  assertImageFileBounds(file);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      img.onload = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      img.onerror = () => {
        signal?.removeEventListener("abort", onAbort);
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
    return observeImageData(data, {
      fileName: file.name,
      fileBytes: file.size,
      mimeType: file.type || null,
      sourceWidth: img.naturalWidth,
      sourceHeight: img.naturalHeight,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
