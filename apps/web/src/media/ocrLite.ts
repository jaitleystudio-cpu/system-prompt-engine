/**
 * Text proposals from screenshot pixels, then the canonical OCR owner.
 * detectTextLikeRegions does not read characters and does not invent labels.
 * recognizeImageFile posts the actual image bytes to /api/ocr/recognize.
 * That route is spe_runtime.ocr_product.route_host (LocalOcrSession).
 * This module does not embed a second OCR engine. If the route is not
 * mounted, the call returns UNAVAILABLE and text stays empty.
 * OCR text is untrusted data. Provenance "observed-ocr" means the
 * production route returned the string.
 */
import type { OcrBlock } from "./semanticTypes";

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
  const language =
    typeof row.language === "string"
      ? row.language
      : typeof row.script === "string"
        ? row.script
        : null;
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
    if (!textValue.trim() || score <= 0) continue;
    const regionLanguage =
      typeof region.language === "string"
        ? region.language
        : typeof region.script === "string"
          ? region.script
          : language;
    regions.push({
      text: textValue,
      bounds: { x: box.x, y: box.y, w: box.w, h: box.h },
      confidence: confidenceLabel(score),
      method: "ocr-tesseract",
      provenance: "observed-ocr",
      language: regionLanguage,
      confidenceScore: score,
    });
  }
  const textValue = typeof row.text === "string" ? row.text : "";
  if (!textValue.trim() && regions.length === 0 && row.engineRan !== true) {
    return unavailable(typeof row.errorCode === "string" ? row.errorCode : "ENGINE_FAILED");
  }
  if (!regions.length && textValue.trim()) {
    regions.push({
      text: textValue,
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      confidence: "low",
      method: "ocr-tesseract",
      provenance: "observed-ocr",
      language,
      confidenceScore: 0,
    });
  }
  return {
    mode: "LOCAL_OCR",
    text: textValue,
    regions,
    errorCode: null,
    egressAttempts: egress,
  };
}

/** Decode check, then the pinned loopback OCR route. No second engine. */
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

/** Pinned route. Null unless that call actually returned LOCAL_OCR. */
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

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a += data[i];
    if (a >= 65521) a -= 65521;
    b += a;
    if (b >= 65521) b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function zlibStore(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.from([0x78, 0x01])];
  let offset = 0;
  while (offset < raw.length) {
    const n = Math.min(65535, raw.length - offset);
    const last = offset + n >= raw.length ? 1 : 0;
    const header = new Uint8Array(5);
    header[0] = last;
    header[1] = n & 255;
    header[2] = (n >> 8) & 255;
    const nlen = n ^ 0xffff;
    header[3] = nlen & 255;
    header[4] = (nlen >> 8) & 255;
    parts.push(header, raw.subarray(offset, offset + n));
    offset += n;
  }
  const sum = adler32(raw);
  parts.push(Uint8Array.from([(sum >>> 24) & 255, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255]));
  const size = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function encodeScreenshotPng(data: ImageData): Uint8Array {
  const { width, height, data: px } = data;
  const stride = width * 4 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    raw[row] = 0;
    raw.set(px.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [pngChunk("IHDR", ihdr), pngChunk("IDAT", zlibStore(raw)), pngChunk("IEND", new Uint8Array(0))];
  const size = signature.length + chunks.reduce((n, chunk) => n + chunk.length, 0);
  const out = new Uint8Array(size);
  out.set(signature, 0);
  let at = signature.length;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

function oddWindow(side: number, divisor: number): number {
  let win = Math.round(side / divisor);
  if (win % 2 === 0) win += 1;
  if (win < 5) win = 5;
  if (win > 31) win = 31;
  return win;
}

function integrate(src: Float32Array, w: number, h: number): Float64Array {
  const grid = new Float64Array((w + 1) * (h + 1));
  const stride = w + 1;
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      grid[(y + 1) * stride + (x + 1)] = grid[y * stride + (x + 1)] + row;
    }
  }
  return grid;
}

function rectSum(grid: Float64Array, w: number, x0: number, y0: number, x1: number, y1: number): number {
  const stride = w + 1;
  return (
    grid[y1 * stride + x1] -
    grid[y0 * stride + x1] -
    grid[y1 * stride + x0] +
    grid[y0 * stride + x0]
  );
}

function percentile(samples: number[], p: number): number {
  if (!samples.length) return 0;
  const copy = samples.slice().sort((a, b) => a - b);
  const index = Math.min(copy.length - 1, Math.max(0, Math.floor(p * (copy.length - 1))));
  return copy[index];
}

type Stroke = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  polarity: 1 | -1;
  contrast: boolean;
  strokeOk: boolean;
  edgeOk: boolean;
};

function collectStrokes(
  gray: Float32Array,
  grad: Float32Array,
  w: number,
  h: number,
  win: number,
): Stroke[] {
  const sum = integrate(gray, w, h);
  const sq = new Float32Array(w * h);
  for (let i = 0; i < sq.length; i++) sq[i] = gray[i] * gray[i];
  const sumSq = integrate(sq, w, h);
  const r = (win - 1) >> 1;
  const std = new Float32Array(w * h);
  const stdSamples: number[] = [];
  const gradSamples: number[] = [];
  const step = w * h > 400000 ? 3 : w * h > 120000 ? 2 : 1;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(w, x + r + 1);
      const y1 = Math.min(h, y + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      if (n <= 1) continue;
      const mean = rectSum(sum, w, x0, y0, x1, y1) / n;
      const meanSq = rectSum(sumSq, w, x0, y0, x1, y1) / n;
      const variance = Math.max(0, meanSq - mean * mean);
      const local = Math.sqrt(variance);
      std[y * w + x] = local;
      stdSamples.push(local);
      gradSamples.push(grad[y * w + x]);
    }
  }
  const contrastGate = percentile(stdSamples, 0.4);
  const edgeGate = percentile(gradSamples, 0.9);
  let strongEdges = 0;
  let gradCount = 0;
  for (let i = 0; i < grad.length; i += step) {
    gradCount++;
    if (grad[i] > edgeGate) strongEdges++;
  }
  const imageEdgeRate = gradCount ? strongEdges / gradCount : 0;
  const mask = new Int8Array(w * h);
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      const x0 = x - r;
      const y0 = y - r;
      const x1 = x + r + 1;
      const y1 = y + r + 1;
      const n = win * win;
      const mean = rectSum(sum, w, x0, y0, x1, y1) / n;
      const meanSq = rectSum(sumSq, w, x0, y0, x1, y1) / n;
      const local = Math.sqrt(Math.max(0, meanSq - mean * mean));
      std[y * w + x] = local;
      if (!(local > contrastGate)) continue;
      const z = (gray[y * w + x] - mean) / local;
      if (z <= -1) mask[y * w + x] = 1;
      else if (z >= 1) mask[y * w + x] = -1;
    }
  }
  const strokes: Stroke[] = [];
  for (const polarity of [1, -1] as const) {
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let start = 0; start < w * h; start++) {
      if (seen[start] || mask[start] !== polarity) continue;
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      let area = 0;
      let contrastPixels = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const here = stack.pop() as number;
        const x = here % w;
        const y = (here / w) | 0;
        area++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (std[here] > contrastGate) contrastPixels++;
        if (x > 0 && !seen[here - 1] && mask[here - 1] === polarity) {
          seen[here - 1] = 1;
          stack.push(here - 1);
        }
        if (x + 1 < w && !seen[here + 1] && mask[here + 1] === polarity) {
          seen[here + 1] = 1;
          stack.push(here + 1);
        }
        if (y > 0 && !seen[here - w] && mask[here - w] === polarity) {
          seen[here - w] = 1;
          stack.push(here - w);
        }
        if (y + 1 < h && !seen[here + w] && mask[here + w] === polarity) {
          seen[here + w] = 1;
          stack.push(here + w);
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (area < 8 || bh < 4 || bw < 1) continue;
      if (bh > h * 0.5 || bw > w * 0.95) continue;
      const fill = area / (bw * bh);
      const aspect = bw / bh;
      const solidBlob = fill > 0.85 && aspect > 0.45 && bw > 6 && bh > 6;
      const geometry =
        !solidBlob &&
        fill >= 0.08 &&
        fill <= 1 &&
        aspect >= 0.05 &&
        aspect <= 40 &&
        bh <= h * 0.45;
      if (!geometry) continue;
      const runs: number[] = [];
      for (let y = minY; y <= maxY; y++) {
        let x = minX;
        while (x <= maxX) {
          if (mask[y * w + x] === polarity) {
            const x0 = x;
            while (x <= maxX && mask[y * w + x] === polarity) x++;
            runs.push(x - x0);
          } else {
            x++;
          }
        }
      }
      let strokeOk = false;
      if (runs.length) {
        let mean = 0;
        for (const run of runs) mean += run;
        mean /= runs.length;
        let variance = 0;
        for (const run of runs) {
          const d = run - mean;
          variance += d * d;
        }
        const cv = mean > 0 ? Math.sqrt(variance / runs.length) / mean : 99;
        strokeOk = mean >= 1 && mean <= bh * 1.4 && cv <= 0.7;
      }
      let edgePixels = 0;
      const boxArea = bw * bh;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (grad[y * w + x] > edgeGate) edgePixels++;
        }
      }
      const edgeFrac = boxArea ? edgePixels / boxArea : 0;
      const edgeOk = edgeFrac >= Math.max(imageEdgeRate * 2, imageEdgeRate + 0.02) && edgeFrac > imageEdgeRate;
      const contrast = area > 0 && contrastPixels / area >= 0.5;
      if (!((contrast && strokeOk) || (edgeOk && geometry))) continue;
      strokes.push({
        minX,
        minY,
        maxX,
        maxY,
        area,
        polarity,
        contrast,
        strokeOk,
        edgeOk,
      });
      if (strokes.length > 800) return strokes;
    }
  }
  return strokes;
}

function groupLines(strokes: Stroke[], scale: number): OcrBlock[] {
  const ordered = strokes.slice().sort((a, b) => a.minX - b.minX || a.minY - b.minY);
  const lines: Stroke[][] = [];
  for (const stroke of ordered) {
    let placed = false;
    for (const line of lines) {
      const host = line[line.length - 1];
      if (host.polarity !== stroke.polarity) continue;
      const overlap =
        Math.min(host.maxY, stroke.maxY) - Math.max(host.minY, stroke.minY) + 1;
      const minH = Math.min(host.maxY - host.minY + 1, stroke.maxY - stroke.minY + 1);
      const gap = stroke.minX - host.maxX;
      const height = Math.max(host.maxY - host.minY + 1, stroke.maxY - stroke.minY + 1);
      if (overlap >= minH * 0.45 && gap >= -2 && gap <= Math.max(8, height * 1.6)) {
        line.push(stroke);
        placed = true;
        break;
      }
    }
    if (!placed) lines.push([stroke]);
  }
  const blocks: OcrBlock[] = [];
  for (const line of lines) {
    const wide = line.length === 1 && line[0].maxX - line[0].minX + 1 >= (line[0].maxY - line[0].minY + 1) * 1.2;
    if (line.length < 2 && !wide) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;
    for (const stroke of line) {
      if (stroke.minX < minX) minX = stroke.minX;
      if (stroke.minY < minY) minY = stroke.minY;
      if (stroke.maxX > maxX) maxX = stroke.maxX;
      if (stroke.maxY > maxY) maxY = stroke.maxY;
    }
    blocks.push({
      text: "",
      bounds: {
        x: (minX * scale) / 1,
        y: (minY * scale) / 1,
        w: ((maxX - minX + 1) * scale) / 1,
        h: ((maxY - minY + 1) * scale) / 1,
      },
      confidence: line.some((stroke) => stroke.contrast && stroke.strokeOk) ? "medium" : "low",
      method: "ocr-textlikeness",
      provenance: "UNTRUSTED_SOURCE",
    });
  }
  return blocks;
}

function grayOf(data: ImageData): { gray: Float32Array; grad: Float32Array } {
  const { width, height, data: px } = data;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (px[i + 3] < 16) continue;
      gray[y * width + x] = px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
    }
  }
  const grad = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx = Math.abs(gray[y * width + x + 1] - gray[y * width + x - 1]);
      const gy = Math.abs(gray[(y + 1) * width + x] - gray[(y - 1) * width + x]);
      grad[y * width + x] = gx + gy;
    }
  }
  return { gray, grad };
}

function downsample(gray: Float32Array, w: number, h: number): { gray: Float32Array; w: number; h: number } {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const out = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x0 = x * 2;
      const y0 = y * 2;
      let s = 0;
      let n = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const xx = x0 + dx;
          const yy = y0 + dy;
          if (xx < w && yy < h) {
            s += gray[yy * w + xx];
            n++;
          }
        }
      }
      out[y * nw + x] = n ? s / n : 0;
    }
  }
  return { gray: out, w: nw, h: nh };
}

function gradOf(gray: Float32Array, w: number, h: number): Float32Array {
  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      grad[y * w + x] =
        Math.abs(gray[y * w + x + 1] - gray[y * w + x - 1]) +
        Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
    }
  }
  return grad;
}

function normalizeBlocks(blocks: OcrBlock[], width: number, height: number): OcrBlock[] {
  return blocks.map((block) => ({
    ...block,
    text: "",
    bounds: {
      x: Math.max(0, Math.min(1, block.bounds.x / width)),
      y: Math.max(0, Math.min(1, block.bounds.y / height)),
      w: Math.max(0, Math.min(1, block.bounds.w / width)),
      h: Math.max(0, Math.min(1, block.bounds.h / height)),
    },
  }));
}

function iou(a: OcrBlock["bounds"], b: OcrBlock["bounds"]): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const iw = x1 - x0;
  const ih = y1 - y0;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Multi-scale local text proposals.
 * A box survives only when local contrast and stroke consistency agree,
 * or strong local edge density and text-like geometry agree.
 * Thresholds are percentiles of this image, not a fixed global cutoff.
 * Text is empty until observeText receives a LOCAL_OCR response.
 */
export function detectTextLikeRegions(data: ImageData): OcrBlock[] {
  const { width, height } = data;
  if (width < 8 || height < 8) return [];
  const full = grayOf(data);
  const side = Math.min(width, height);
  const fine = collectStrokes(full.gray, full.grad, width, height, oddWindow(side, 28));
  const coarseWin = oddWindow(side, 12);
  const coarse =
    coarseWin === oddWindow(side, 28)
      ? []
      : collectStrokes(full.gray, full.grad, width, height, coarseWin);
  let scaled: Stroke[] = [];
  if (width >= 32 && height >= 32) {
    const half = downsample(full.gray, width, height);
    const halfGrad = gradOf(half.gray, half.w, half.h);
    scaled = collectStrokes(half.gray, halfGrad, half.w, half.h, oddWindow(Math.min(half.w, half.h), 20)).map(
      (stroke) => ({
        ...stroke,
        minX: stroke.minX * 2,
        minY: stroke.minY * 2,
        maxX: stroke.maxX * 2 + 1,
        maxY: stroke.maxY * 2 + 1,
      }),
    );
  }
  const pixelBlocks = [
    ...groupLines(fine, 1),
    ...groupLines(coarse, 1),
    ...groupLines(scaled, 1),
  ];
  const normalized = normalizeBlocks(pixelBlocks, width, height).filter(
    (block) => block.bounds.w > 0 && block.bounds.h > 0 && !block.text,
  );
  const kept: OcrBlock[] = [];
  for (const block of normalized) {
    if (kept.some((other) => iou(other.bounds, block.bounds) >= 0.45)) continue;
    kept.push(block);
  }
  return kept.map(({ bounds, confidence, method, provenance }) => ({
    text: "",
    bounds,
    confidence,
    method,
    provenance,
  }));
}

export async function observeText(
  data: ImageData,
  signal?: AbortSignal,
): Promise<{ execution: OcrExecution; regions: OcrBlock[]; proposals: number }> {
  const proposals = detectTextLikeRegions(data);
  const png = encodeScreenshotPng(data);
  const blob = new Blob([Uint8Array.from(png)], { type: "image/png" });
  const execution = await recognizeImageFile(blob, signal);
  if (execution.mode !== "LOCAL_OCR") {
    return { execution, regions: proposals, proposals: proposals.length };
  }
  return { execution, regions: execution.regions, proposals: proposals.length };
}
