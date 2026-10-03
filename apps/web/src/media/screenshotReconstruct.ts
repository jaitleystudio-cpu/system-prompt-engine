/**
 * Screenshot reconstruction as a measured rectangle partition.
 * Every source pixel belongs to one axis-aligned run of its exact RGB.
 * The HTML replays those runs with canvas fillRect. It does not embed the
 * fixture bytes, a data-URL, or an <img> of the screenshot file.
 * This is a raster reconstruction, not a claim that non-HTML targets render.
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

/**
 * True when the document is the fixture file (data URL, matching filename, or
 * the fixture's own base64 signature). A rectangle replay is not a copy.
 */
export function isCopiedFixture(html: string, fixture: Uint8Array, fileName?: string): boolean {
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
