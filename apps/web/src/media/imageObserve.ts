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
 */
export function observeImageData(
  data: ImageData,
  meta: {
    fileName?: string | null;
    fileBytes?: number | null;
    mimeType?: string | null;
  } = {},
): ImageObservation {
  const { width, height } = data;
  const pixels = data.data;
  const total = width * height;
  const step = Math.max(1, Math.floor(Math.sqrt(total / 12000)));
  const votes = new Map<string, { count: number; r: number; g: number; b: number }>();
  let sum = 0;
  let dark = 0;
  let light = 0;
  let samples = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2],
        a = pixels[i + 3];
      if (a < 16) continue;
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

  // Simple horizontal/vertical gradient magnitude as edge proxy (sparse).
  let edgeHits = 0;
  let edgeChecks = 0;
  const edgeStep = Math.max(2, step);
  for (let y = 1; y < height - 1; y += edgeStep) {
    for (let x = 1; x < width - 1; x += edgeStep) {
      const i = (y * width + x) * 4;
      const right = ((y * width + (x + 1)) * 4);
      const down = (((y + 1) * width + x) * 4);
      const c =
        (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      const cr =
        (pixels[right] + pixels[right + 1] + pixels[right + 2]) / 3;
      const cd =
        (pixels[down] + pixels[down + 1] + pixels[down + 2]) / 3;
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
          gSum += (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
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
  if (edgeDensity > 0.35) notes.push("Busy visual structure (higher edge density).");
  else if (edgeDensity < 0.08) notes.push("Mostly flat or soft regions (low edge density).");
  if (mean < 70) notes.push("Overall dark frame.");
  if (mean > 180) notes.push("Overall bright frame.");
  if (width >= 1800 || height >= 1800) notes.push("High-resolution source.");

  return {
    kind: "image",
    width,
    height,
    aspectRatio: aspectRatioLabel(width, height),
    megapixels: Math.round((total / 1_000_000) * 100) / 100,
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

export function observationToPromptBlock(obs: ImageObservation): string {
  const colors = obs.dominantColors
    .map((c) => `${c.hex} (${Math.round(c.share * 100)}%)`)
    .join(", ");
  const grid = obs.grid
    .map((g) => `r${g.row}c${g.col}:${Math.round(g.meanBrightness)}`)
    .join(" ");
  return [
    "Image observations (browser-local, not a vision model):",
    `- Size: ${obs.width}×${obs.height}px (${obs.aspectRatio}, ${obs.megapixels} MP)`,
    obs.fileName ? `- File: ${obs.fileName}${obs.fileBytes != null ? ` (${obs.fileBytes} bytes)` : ""}` : null,
    `- Dominant colors: ${colors || "n/a"}`,
    `- Brightness mean: ${obs.brightness.mean} (dark ${(obs.brightness.darkShare * 100).toFixed(0)}% / light ${(obs.brightness.lightShare * 100).toFixed(0)}%)`,
    `- Edge density: ${obs.edgeDensity}`,
    `- 3×3 brightness grid: ${grid}`,
    obs.notes.length ? `- Notes: ${obs.notes.join(" ")}` : null,
    `- Uncertainty: ${obs.uncertainty.join(" ")}`,
    `- Method: ${obs.licenseNote}`,
  ]
    .filter(Boolean)
    .join("\n");
}


export async function observeImageFile(file: File): Promise<ImageObservation> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode this image."));
      img.src = url;
    });
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
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
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
