/**
 * Fit painted OCR text to ink measured inside each OCR box.
 * Font size is the size whose own glyph ink matches that measured height.
 * Family and weight are the installed face whose stem width is closest.
 * No preset pixel size, no fixture table, and no embedded font file.
 */
import type { ObservedFontInk } from "./types";

export type InkWord = {
  text?: string;
  bounds: { x: number; y: number; w: number; h: number };
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[index];
}

function byteHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function measureBlock(image: ImageData, bounds: InkWord["bounds"]): ObservedFontInk | null {
  const { width, height, data } = image;
  if (!(width > 0) || !(height > 0)) return null;
  const x0 = Math.max(0, Math.floor(bounds.x * width));
  const y0 = Math.max(0, Math.floor(bounds.y * height));
  const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((bounds.x + bounds.w) * width)));
  const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((bounds.y + bounds.h) * height)));
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const pixels: { x: number; y: number; r: number; g: number; b: number }[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      reds.push(r);
      greens.push(g);
      blues.push(b);
      pixels.push({ x, y, r, g, b });
    }
  }
  if (pixels.length < 8) return null;
  const bg = { r: median(reds), g: median(greens), b: median(blues) };
  const distances = pixels.map((px) => Math.hypot(px.r - bg.r, px.g - bg.g, px.b - bg.b));
  const sorted = distances.slice().sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const threshold = Math.max(28, p50 + 0.55 * (p95 - p50));
  const ink = pixels.filter((_, index) => distances[index] > threshold);
  if (ink.length < 6) return null;
  let minX = ink[0].x;
  let minY = ink[0].y;
  let maxX = ink[0].x;
  let maxY = ink[0].y;
  for (const px of ink) {
    if (px.x < minX) minX = px.x;
    if (px.y < minY) minY = px.y;
    if (px.x > maxX) maxX = px.x;
    if (px.y > maxY) maxY = px.y;
  }
  const inkW = maxX - minX + 1;
  const inkH = maxY - minY + 1;
  if (inkW < 1 || inkH < 2) return null;
  const maxDist = sorted[sorted.length - 1];
  const coreThreshold = Math.max(threshold, (p95 + maxDist) / 2);
  const core = pixels.filter((_, index) => distances[index] >= coreThreshold);
  const colored = core.length >= 4 ? core : ink;
  const color = `#${byteHex(median(colored.map((px) => px.r)))}${byteHex(median(colored.map((px) => px.g)))}${byteHex(median(colored.map((px) => px.b)))}`;
  const rows = new Map<number, number[]>();
  for (const px of ink) {
    const row = rows.get(px.y);
    if (row) row.push(px.x);
    else rows.set(px.y, [px.x]);
  }
  const runs: number[] = [];
  for (const xs of rows.values()) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i === xs.length || xs[i] > prev + 1) {
        runs.push(prev - start + 1);
        if (i < xs.length) start = xs[i];
      }
      if (i < xs.length) prev = xs[i];
    }
  }
  runs.sort((a, b) => a - b);
  const stroke = runs.length ? percentile(runs, 0.25) : 1;
  return { x: minX, y: minY, w: inkW, h: inkH, stroke: Math.max(1, stroke), color };
}

/** One ink record per block, or null when the box has no measurable glyph ink. */
export function measureObservedInk(image: ImageData, blocks: InkWord[]): (ObservedFontInk | null)[] {
  return blocks.map((block) => {
    const text = block.text?.trim() ?? "";
    if (!text || !block.bounds) return null;
    return measureBlock(image, block.bounds);
  });
}

/** Browser fitter. Size comes from matching this face's ink height to the measured ink. */
export function fontFitRuntimeSource(): string {
  return `(() => {
  const nodes = [...document.querySelectorAll(".spe-ocr-text[data-ink-h]")];
  if (!nodes.length) return;
  const canvas = document.createElement("canvas");
  const families = ["system-ui", "Helvetica Neue", "Helvetica", "Arial", "SF Pro Text", "SF Pro Display"];
  const weights = [400, 500, 600, 700];
  const installed = families.filter((name) => name === "system-ui" || document.fonts.check('16px "' + name + '"'));
  const faces = (installed.length ? installed : ["system-ui"]).flatMap((family) => weights.map((weight) => ({ family, weight })));
  function raster(text, family, weight, size, spacing) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.font = weight + " " + size + "px " + (family.includes(" ") ? '"' + family + '"' : family);
    ctx.letterSpacing = spacing + "px";
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || 0;
    const descent = metrics.actualBoundingBoxDescent || 0;
    const fontAscent = metrics.fontBoundingBoxAscent || ascent;
    const fontDescent = metrics.fontBoundingBoxDescent || descent;
    const left = metrics.actualBoundingBoxLeft || 0;
    const inkH = ascent + descent;
    const width = metrics.width;
    if (!(inkH > 0) || !(width > 0)) return null;
    const pad = 2;
    const cw = Math.max(2, Math.ceil(width) + pad * 2);
    const ch = Math.max(2, Math.ceil(inkH) + pad * 2);
    canvas.width = cw;
    canvas.height = ch;
    const paint = canvas.getContext("2d");
    if (!paint) return null;
    paint.font = weight + " " + size + "px " + (family.includes(" ") ? '"' + family + '"' : family);
    paint.letterSpacing = spacing + "px";
    paint.fillStyle = "#000";
    paint.textBaseline = "alphabetic";
    paint.fillText(text, pad, pad + ascent);
    const img = paint.getImageData(0, 0, cw, ch).data;
    const runs = [];
    for (let y = 0; y < ch; y++) {
      let run = 0;
      for (let x = 0; x < cw; x++) {
        const a = img[(y * cw + x) * 4 + 3];
        if (a > 160) run += 1;
        else if (run) { runs.push(run); run = 0; }
      }
      if (run) runs.push(run);
    }
    runs.sort((a, b) => a - b);
    const stroke = runs.length ? runs[Math.min(runs.length - 1, Math.floor(runs.length * 0.25))] : 0;
    return { inkH, width, stroke, ascent, fontAscent, fontDescent, left };
  }
  function fitSize(text, family, weight, targetH) {
    let lo = Math.max(1, targetH * 0.45);
    let hi = Math.max(lo + 1, targetH * 4);
    let best = lo;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const got = raster(text, family, weight, mid, 0);
      if (!got) { hi = mid; continue; }
      best = mid;
      if (got.inkH < targetH) lo = mid;
      else hi = mid;
    }
    return best;
  }
  for (const el of nodes) {
    const text = el.textContent || "";
    const inkH = Number(el.getAttribute("data-ink-h"));
    const inkW = Number(el.getAttribute("data-ink-w"));
    const inkX = Number(el.getAttribute("data-ink-x"));
    const inkY = Number(el.getAttribute("data-ink-y"));
    const stroke = Number(el.getAttribute("data-stroke"));
    const color = el.getAttribute("data-ink-color") || "";
    if (!text.trim() || !(inkH > 0) || !(inkW > 0)) continue;
    let best = null;
    for (const face of faces) {
      const size = fitSize(text, face.family, face.weight, inkH);
      const painted = raster(text, face.family, face.weight, size, 0);
      if (!painted) continue;
      const strokeErr = stroke > 0 ? Math.abs(painted.stroke - stroke) / stroke : 0;
      const widthErr = Math.abs(painted.width - inkW) / inkW;
      const heightErr = Math.abs(painted.inkH - inkH) / inkH;
      const score = strokeErr + widthErr * 0.35 + heightErr * 0.5;
      if (!best || score < best.score) best = { ...face, size, score };
    }
    if (!best) continue;
    const family = best.family.includes(" ") ? '"' + best.family + '"' : best.family;
    el.style.fontFamily = family;
    el.style.fontWeight = String(best.weight);
    el.style.fontSize = best.size + "px";
    el.style.lineHeight = inkH + "px";
    el.style.fontSynthesis = "none";
    el.style.fontKerning = "normal";
    el.style.whiteSpace = "pre";
    el.style.margin = "0";
    el.style.padding = "0";
    if (/^#[0-9a-fA-F]{6}$/.test(color)) el.style.color = color;
    let lo = -0.08 * best.size;
    let hi = 0.25 * best.size;
    let spacing = 0;
    if (text.length > 1) {
      for (let i = 0; i < 10; i++) {
        spacing = (lo + hi) / 2;
        const painted = raster(text, best.family, best.weight, best.size, spacing);
        if (!painted) break;
        if (painted.width < inkW) lo = spacing;
        else hi = spacing;
      }
      spacing = (lo + hi) / 2;
    }
    el.style.letterSpacing = spacing + "px";
    const placed = raster(text, best.family, best.weight, best.size, spacing);
    if (!placed) continue;
    const content = placed.fontAscent + placed.fontDescent;
    const halfLeading = (inkH - content) / 2;
    const inkOffset = halfLeading + (placed.fontAscent - placed.ascent);
    el.style.left = (inkX + placed.left) + "px";
    el.style.top = (inkY - inkOffset) + "px";
  }
})();`;
}
