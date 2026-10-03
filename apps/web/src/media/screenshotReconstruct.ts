/**
 * Screenshot reconstruction as a measured rectangle partition.
 * Every source pixel belongs to one axis-aligned run of its exact RGB.
 * The HTML replays those runs with canvas fillRect. That exact-RGB partition
 * is a bitmap replay. isExactRgbPartitionReplay must fail it closed. It is not
 * a passable reconstruction.
 */
export const RECONSTRUCTION_METHOD = "measured-rectangle-partition-v1";

export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | ArrayLike<number>;
};

export type MeasuredRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  hex: string;
};

function rgbKey(data: ArrayLike<number>, i: number): number {
  return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
}

function hexOf(key: number): string {
  return "#" + key.toString(16).padStart(6, "0");
}

/** Exact-color horizontal runs, stacked vertically when the run repeats. */
export function measureRectangles(image: RgbaImage): MeasuredRect[] {
  const w = image.width;
  const h = image.height;
  const data = image.data;
  if (w < 1 || h < 1) return [];
  const rows: { x: number; x2: number; c: number }[][] = new Array(h);
  for (let y = 0; y < h; y++) {
    const runs: { x: number; x2: number; c: number }[] = [];
    let x = 0;
    const row = y * w;
    while (x < w) {
      const c = rgbKey(data, (row + x) << 2);
      let x2 = x + 1;
      while (x2 < w && rgbKey(data, (row + x2) << 2) === c) x2 += 1;
      runs.push({ x, x2, c });
      x = x2;
    }
    rows[y] = runs;
  }
  type Active = { x: number; x2: number; c: number; y0: number; y1: number };
  let active: Active[] = [];
  const out: MeasuredRect[] = [];
  const flush = (a: Active) => {
    out.push({ x: a.x, y: a.y0, w: a.x2 - a.x, h: a.y1 - a.y0, hex: hexOf(a.c) });
  };
  for (let y = 0; y < h; y++) {
    const runs = rows[y];
    const used = new Uint8Array(runs.length);
    const next: Active[] = [];
    for (const a of active) {
      let found = -1;
      for (let k = 0; k < runs.length; k++) {
        if (used[k]) continue;
        const r = runs[k];
        if (r.x === a.x && r.x2 === a.x2 && r.c === a.c) {
          found = k;
          break;
        }
      }
      if (found >= 0) {
        used[found] = 1;
        a.y1 = y + 1;
        next.push(a);
      } else flush(a);
    }
    for (let k = 0; k < runs.length; k++) {
      if (used[k]) continue;
      const r = runs[k];
      next.push({ x: r.x, x2: r.x2, c: r.c, y0: y, y1: y + 1 });
    }
    active = next;
  }
  for (const a of active) flush(a);
  return out;
}

export function rectangleCoverage(rects: MeasuredRect[]): number {
  return rects.reduce((sum, r) => sum + r.w * r.h, 0);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function pixelHex(data: ArrayLike<number>, width: number, x: number, y: number): string {
  const i = (y * width + x) << 2;
  const r = data[i].toString(16).padStart(2, "0");
  const g = data[i + 1].toString(16).padStart(2, "0");
  const b = data[i + 2].toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function parseTupleRects(html: string): MeasuredRect[] {
  const rects: MeasuredRect[] = [];
  const tuples = /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*["']#?([0-9a-fA-F]{6})["']\s*\]/g;
  for (const match of html.matchAll(tuples)) {
    rects.push({
      x: Number(match[1]),
      y: Number(match[2]),
      w: Number(match[3]),
      h: Number(match[4]),
      hex: `#${match[5].toLowerCase()}`,
    });
  }
  return rects;
}

function parseLiteralFillRects(html: string): MeasuredRect[] {
  const rects: MeasuredRect[] = [];
  const paints = /fillStyle\s*=\s*["']#?([0-9a-fA-F]{6})["'][\s\S]{0,80}?fillRect\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  for (const match of html.matchAll(paints)) {
    rects.push({
      x: Number(match[2]),
      y: Number(match[3]),
      w: Number(match[4]),
      h: Number(match[5]),
      hex: `#${match[1].toLowerCase()}`,
    });
  }
  return rects;
}

function hexFromToken(raw: string): string | null {
  const text = raw.trim().replace(/^['"]|['"]$/g, "");
  const plain = text.match(/^#?([0-9a-fA-F]{6})$/);
  if (plain) return `#${plain[1].toLowerCase()}`;
  const prefixed = text.match(/^0x([0-9a-fA-F]{6})$/i);
  if (prefixed) return `#${prefixed[1].toLowerCase()}`;
  return null;
}

function splitObjectFields(body: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of body) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ",") {
      if (current.trim()) fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

/** Object records. Key order does not matter. The paint binding is not consulted. */
function parseObjectRects(html: string): MeasuredRect[] {
  const rects: MeasuredRect[] = [];
  for (const match of html.matchAll(/\{[^{}]*\}/g)) {
    const fields = splitObjectFields(match[0].slice(1, -1));
    const numbers = new Map<string, number>();
    const hexes: { key: string; hex: string }[] = [];
    for (const field of fields) {
      const colon = field.indexOf(":");
      if (colon < 0) continue;
      const key = field.slice(0, colon).trim().replace(/^['"]|['"]$/g, "").toLowerCase();
      const raw = field.slice(colon + 1).trim();
      if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
        numbers.set(key, Number(raw));
        continue;
      }
      const hex = hexFromToken(raw);
      if (hex) hexes.push({ key, hex });
    }
    const x = numbers.get("x") ?? numbers.get("left");
    const y = numbers.get("y") ?? numbers.get("top");
    const w = numbers.get("w") ?? numbers.get("width");
    const h = numbers.get("h") ?? numbers.get("height");
    if (x == null || y == null || w == null || h == null || !hexes.length) continue;
    const preferred = hexes.find((item) => /hex|color|fill|background|^bg$/.test(item.key));
    rects.push({ x, y, w, h, hex: (preferred ?? hexes[0]).hex });
  }
  return rects;
}

function exactRgbCover(rects: MeasuredRect[], image: RgbaImage): boolean {
  if (!rects.length || image.width < 1 || image.height < 1) return false;
  const area = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
  if (area !== image.width * image.height) return false;
  const seen = new Uint8Array(image.width * image.height);
  for (const rect of rects) {
    if (!Number.isInteger(rect.x) || !Number.isInteger(rect.y) || !Number.isInteger(rect.w) || !Number.isInteger(rect.h)) {
      return false;
    }
    if (rect.w < 1 || rect.h < 1) return false;
    const x1 = rect.x + rect.w;
    const y1 = rect.y + rect.h;
    if (rect.x < 0 || rect.y < 0 || x1 > image.width || y1 > image.height) return false;
    for (let y = rect.y; y < y1; y++) {
      for (let x = rect.x; x < x1; x++) {
        const p = y * image.width + x;
        if (seen[p]) return false;
        seen[p] = 1;
        if (pixelHex(image.data, image.width, x, y) !== rect.hex) return false;
      }
    }
  }
  for (let i = 0; i < seen.length; i++) if (!seen[i]) return false;
  return true;
}

/**
 * True when any one encoding in the HTML is an exact-RGB partition of the
 * source bitmap. Tuple lists, object records, and literal fillStyle/fillRect
 * are checked separately so a second syntax cannot hide a covering partition.
 * Paint-site names (r.hex, block.hex, or another local binding) are ignored.
 */
function cssColor(style: unknown): [number, number, number] | null {
  if (typeof style !== "string") return null;
  const text = style.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    return [
      parseInt(hex[1].slice(0, 2), 16),
      parseInt(hex[1].slice(2, 4), 16),
      parseInt(hex[1].slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(text);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

function scriptSources(html: string): string[] {
  const sources: string[] = [];
  const lower = html.toLowerCase();
  let from = 0;
  while (from < html.length) {
    const open = lower.indexOf("<script", from);
    if (open < 0) break;
    const start = html.indexOf(">", open);
    if (start < 0) break;
    const close = lower.indexOf("</script>", start);
    if (close < 0) break;
    sources.push(html.slice(start + 1, close));
    from = close + 9;
  }
  return sources;
}

/**
 * Run the page scripts against a canvas mock and rasterize fillRect.
 * This does not inspect how the color was spelled in the source.
 */
function executeCanvasRaster(html: string, width: number, height: number): { data: Uint8ClampedArray; painted: Uint8Array } | null {
  if (width < 1 || height < 1) return null;
  const data = new Uint8ClampedArray(width * height * 4);
  const painted = new Uint8Array(width * height);
  const ctx = {
    fillStyle: "#000000" as string,
    imageSmoothingEnabled: false,
    fillRect(x: number, y: number, w: number, h: number) {
      const rgb = cssColor(this.fillStyle);
      if (!rgb || !(w > 0) || !(h > 0)) return;
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(width, (x + w) | 0);
      const y1 = Math.min(height, (y + h) | 0);
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const p = yy * width + xx;
          const i = p << 2;
          data[i] = rgb[0];
          data[i + 1] = rgb[1];
          data[i + 2] = rgb[2];
          data[i + 3] = 255;
          painted[p] = 1;
        }
      }
    },
  };
  const canvas = {
    width,
    height,
    getContext() {
      return ctx;
    },
  };
  const documentStub = {
    getElementById() {
      return canvas;
    },
  };
  try {
    for (const source of scriptSources(html)) {
      if (!source.trim()) continue;
      const run = new Function("document", "window", `"use strict";\n${source}`);
      run(documentStub, { document: documentStub });
    }
  } catch {
    return null;
  }
  return { data, painted };
}

function rasterMatchesFixture(html: string, image: RgbaImage): boolean {
  const raster = executeCanvasRaster(html, image.width, image.height);
  if (!raster) return false;
  const pixels = image.width * image.height;
  for (let p = 0; p < pixels; p++) {
    if (!raster.painted[p]) return false;
    const i = p << 2;
    if (
      raster.data[i] !== image.data[i] ||
      raster.data[i + 1] !== image.data[i + 1] ||
      raster.data[i + 2] !== image.data[i + 2]
    ) {
      return false;
    }
  }
  return pixels > 0;
}

export function isExactRgbPartitionReplay(html: string, image: RgbaImage): boolean {
  if (rasterMatchesFixture(html, image)) return true;
  return (
    exactRgbCover(parseTupleRects(html), image) ||
    exactRgbCover(parseObjectRects(html), image) ||
    exactRgbCover(parseLiteralFillRects(html), image)
  );
}

/**
 * True for a fixture file embed, or for an exact-RGB rectangle partition of
 * the source bitmap when the pixels are supplied.
 */
export function isCopiedFixture(
  html: string,
  fixture: Uint8Array,
  fileName?: string,
  image?: RgbaImage,
): boolean {
  if (image && isExactRgbPartitionReplay(html, image)) return true;
  if (/data:image\//i.test(html)) return true;
  if (/<img\b/i.test(html)) return true;
  if (fileName) {
    const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`src\\s*=\\s*["'][^"']*${escaped}`, "i").test(html)) return true;
  }
  const prefix = bytesToBase64(fixture.subarray(0, 24)).slice(0, 16);
  return prefix.length >= 12 && html.includes(prefix);
}

/** Mutant: the fixture PNG embedded as an image. Must be rejected. */
export function fixtureCopyMutant(fixture: Uint8Array): string {
  const b64 = bytesToBase64(fixture);
  return `<!doctype html><html><body><img alt="fixture" src="data:image/png;base64,${b64}"/></body></html>`;
}

export function reconstructionHtml(image: RgbaImage): {
  html: string;
  rectCount: number;
  coverage: number;
  method: typeof RECONSTRUCTION_METHOD;
  viewport: { width: number; height: number };
} {
  const rects = measureRectangles(image);
  const coverage = rectangleCoverage(rects);
  const payload = rects.map((r) => [r.x, r.y, r.w, r.h, r.hex]);
  const w = image.width;
  const h = image.height;
  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=${w},initial-scale=1">` +
    `<title data-reconstruction="${RECONSTRUCTION_METHOD}">measured rectangle replay</title>` +
    `<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#000}canvas{display:block}</style>` +
    `</head><body>` +
    `<canvas id="c" width="${w}" height="${h}" data-rect-count="${rects.length}"></canvas>` +
    `<script>const rects=${JSON.stringify(payload)};` +
    `const ctx=document.getElementById("c").getContext("2d",{alpha:false});` +
    `ctx.imageSmoothingEnabled=false;` +
    `for (const [x,y,w,h,fill] of rects){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);}` +
    `</script></body></html>`;
  return {
    html,
    rectCount: rects.length,
    coverage,
    method: RECONSTRUCTION_METHOD,
    viewport: { width: w, height: h },
  };
}
