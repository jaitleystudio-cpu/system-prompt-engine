/**
 * Lane R3-C — the rectangle replay is not a pass.
 * Bar stays SSIM >= 0.95 and pixel delta <= 5%.
 * Honest measured state is the pre-replay scaffold. No new repair cycle.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";
import { PNG } from "pngjs";
import { chromium } from "playwright";
import ts from "typescript";
import { compareVisualBuffers, IncomparableViewportError } from "../src/media/realVisualComparator.mjs";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const fixturesDir = join(repo, "proofs/spe_v1_launch/screenshot_real_fixtures");
const evidenceDir = join(repo, "evidence/lane-r3c");
const priorEvidencePath = join(repo, "evidence/lane-g3/G3_RELEASE_EVIDENCE.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WASM_PIN = "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function bundle(entryFile) {
  const bundled = await build({
    entryPoints: [join(mediaDir, entryFile)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    banner: {
      js: `class ImageData { constructor(data, w, h){ this.data=data; this.width=w; this.height=h; } }
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;`,
    },
  });
  return import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
}

function downsample(png, maxW = 320) {
  const scale = Math.min(1, maxW / png.width);
  const w = Math.max(1, Math.round(png.width * scale));
  const h = Math.max(1, Math.round(png.height * scale));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(png.width - 1, Math.floor(x / scale));
      const sy = Math.min(png.height - 1, Math.floor(y / scale));
      const si = (sy * png.width + sx) << 2;
      const di = (y * w + x) << 2;
      data[di] = png.data[si];
      data[di + 1] = png.data[si + 1];
      data[di + 2] = png.data[si + 2];
      data[di + 3] = png.data[si + 3];
    }
  }
  return new ImageData(data, w, h);
}

function adversarialPng() {
  const w = 320;
  const h = 200;
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2;
      const on = ((x * 13 + y * 7) ^ (x >> 2)) & 1;
      png.data[i] = on ? 255 : 10;
      png.data[i + 1] = on ? 0 : 200;
      png.data[i + 2] = (x * 3) & 255;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function byteHex(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function meanHex(png, box) {
  const x0 = Math.max(0, Math.floor(box.x * png.width));
  const y0 = Math.max(0, Math.floor(box.y * png.height));
  const x1 = Math.min(png.width, Math.max(x0 + 1, Math.ceil((box.x + box.w) * png.width)));
  const y1 = Math.min(png.height, Math.max(y0 + 1, Math.ceil((box.y + box.h) * png.height)));
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 24) || 1);
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * png.width + x) << 2;
      r += png.data[i];
      g += png.data[i + 1];
      b += png.data[i + 2];
      n += 1;
    }
  }
  if (!n) return "#000000";
  return `#${byteHex(r / n)}${byteHex(g / n)}${byteHex(b / n)}`;
}

function tesseractWords(filePath) {
  const ran = spawnSync("tesseract", [filePath, "stdout", "-l", "eng", "--psm", "6", "tsv"], {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (ran.status !== 0) return { ok: false, words: [], text: "" };
  const lines = (ran.stdout || "").split(/\n/).slice(1);
  const words = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 12) continue;
    if (Number(parts[0]) !== 5) continue;
    const text = parts.slice(11).join("\t").trim();
    if (!text) continue;
    words.push({
      left: Number(parts[6]),
      top: Number(parts[7]),
      width: Number(parts[8]),
      height: Number(parts[9]),
      text,
    });
  }
  return { ok: true, words, text: words.map((w) => w.text).join(" ") };
}

function classifyDiscrepancy(ref, cand, words) {
  const w = ref.width;
  const h = ref.height;
  const A = ref.data;
  const B = cand.data;
  const text = new Uint8Array(w * h);
  const halo = new Uint8Array(w * h);
  for (const word of words) {
    const x0 = Math.max(0, word.left | 0);
    const y0 = Math.max(0, word.top | 0);
    const x1 = Math.min(w, (word.left + word.width) | 0);
    const y1 = Math.min(h, (word.top + word.height) | 0);
    for (let y = y0; y < y1; y++) {
      text.fill(1, y * w + x0, y * w + x1);
    }
    const hx0 = Math.max(0, x0 - 6);
    const hy0 = Math.max(0, y0 - 6);
    const hx1 = Math.min(w, x1 + 6);
    const hy1 = Math.min(h, y1 + 6);
    for (let y = hy0; y < hy1; y++) {
      halo.fill(1, y * w + hx0, y * w + hx1);
    }
  }
  const freq = new Map();
  for (let p = 0; p < w * h; p++) {
    const i = p << 2;
    const key = (A[i] << 16) | (A[i + 1] << 8) | A[i + 2];
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  const rareCut = w * h * 0.0005;
  let mismatch = 0;
  let type = 0, spacing = 0, radius = 0, shadow = 0, assets = 0, geometry = 0, color = 0;
  let absSum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2;
      const dr = Math.abs(A[i] - B[i]);
      const dg = Math.abs(A[i + 1] - B[i + 1]);
      const db = Math.abs(A[i + 2] - B[i + 2]);
      absSum += dr + dg + db;
      if (dr <= 10 && dg <= 10 && db <= 10) continue;
      mismatch += 1;
      const p = y * w + x;
      let gh = 0, gv = 0;
      if (x + 1 < w) {
        const r = i + 4;
        gh = Math.abs(A[i] - A[r]) + Math.abs(A[i + 1] - A[r + 1]) + Math.abs(A[i + 2] - A[r + 2]);
      }
      if (y + 1 < h) {
        const d = i + (w << 2);
        gv = Math.abs(A[i] - A[d]) + Math.abs(A[i + 1] - A[d + 1]) + Math.abs(A[i + 2] - A[d + 2]);
      }
      const key = (A[i] << 16) | (A[i + 1] << 8) | A[i + 2];
      if (text[p]) type += 1;
      else if (halo[p]) spacing += 1;
      else if (gh > 40 && gv > 40) radius += 1;
      else if ((gh > 8 && gh <= 40) || (gv > 8 && gv <= 40)) shadow += 1;
      else if ((freq.get(key) || 0) < rareCut) assets += 1;
      else if (gh > 40 || gv > 40) geometry += 1;
      else color += 1;
    }
  }
  const row = (data, y) => {
    let s = 0;
    const o = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = o + (x << 2);
      s += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    return s / w;
  };
  const refRows = new Float64Array(h);
  const candRows = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    refRows[y] = row(A, y);
    candRows[y] = row(B, y);
  }
  let bestLag = 0;
  let best = -Infinity;
  const span = Math.min(24, h - 1);
  for (let lag = -span; lag <= span; lag++) {
    let acc = 0;
    let n = 0;
    for (let y = 0; y < h; y++) {
      const z = y + lag;
      if (z < 0 || z >= h) continue;
      acc += refRows[y] * candRows[z];
      n += 1;
    }
    const score = n ? acc / n : -Infinity;
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  const pct = (n) => (mismatch ? Math.round((1000 * n) / mismatch) / 10 : 0);
  return {
    mismatchedPixels: mismatch,
    mismatchPercentOfImage: Math.round((1000 * mismatch) / (w * h)) / 10,
    meanAbsChannel: Math.round((absSum / (w * h * 3)) * 100) / 100,
    layoutRowShiftPx: bestLag,
    viewport: { ref: `${w}x${h}`, cand: `${cand.width}x${cand.height}`, exact: cand.width === w && cand.height === h },
    buckets: {
      type: pct(type),
      spacing: pct(spacing),
      radius: pct(radius),
      shadow: pct(shadow),
      assets: pct(assets),
      geometry: pct(geometry),
      color: pct(color),
    },
    dominantBucket: Object.entries({ type, spacing, radius, shadow, assets, geometry, color }).sort((a, b) => b[1] - a[1])[0][0],
  };
}

function ocrTokenRecall(ocrText, html) {
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const tokens = (ocrText.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((t, i, a) => a.indexOf(t) === i);
  if (!tokens.length) return { tokens: 0, recall: null };
  const hay = visible.toLowerCase();
  const hit = tokens.filter((t) => hay.includes(t)).length;
  return { tokens: tokens.length, recall: Math.round((1000 * hit) / tokens.length) / 1000 };
}

const gate = await bundle("visionReleaseGate.ts");
const ui = await bundle("uiObservation.ts");
const shot = await bundle("screenshotToCode.ts");
const recon = await bundle("screenshotReconstruct.ts");

function objectFormPartitionHtml(rects, binding) {
  const name = binding || "r";
  const body = rects
    .map((rect) => `  { x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h}, hex: "${rect.hex}" }`)
    .join(",\n");
  return `<!doctype html><canvas id="c"></canvas><script>
const rects = [
${body}
];
const ctx = document.getElementById("c").getContext("2d");
for (const ${name} of rects) { ctx.fillStyle = ${name}.hex; ctx.fillRect(${name}.x, ${name}.y, ${name}.w, ${name}.h); }
</script>`;
}

function assertObjectFormPartitionFailsClosed() {
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  const image = { width: 2, height: 2, data };
  const rects = recon.measureRectangles(image);
  const html = objectFormPartitionHtml(rects, "r");
  assert.equal(html.includes("[0,0,"), false);
  assert.match(html, /\{ x: 0, y: 0, w: /);
  assert.match(html, /fillStyle = r\.hex/);
  assert.equal(gate.isExactRgbPartitionReplay(html, image), true);
  const judged = gate.judgeNativeReconstruction({
    html,
    image,
    ssimScore: 1,
    pixelDeltaPercentage: 0,
    exactViewport: true,
    copiedFixture: false,
  });
  assert.notEqual(judged.status, "PASS");
  assert.equal(judged.status, "FAIL_CONTRACT");
  const scope = gate.judgeLaneScope({
    nativeStatuses: ["PASS"],
    narrowReferencePaired: true,
    nonHtmlVisualRendered: true,
    candidates: [{ html, image }],
  });
  assert.equal(scope.final, "HOLD");
  assert.notEqual(scope.final, "PASS_WITHIN_TESTED_SCOPE");
  const rebound = objectFormPartitionHtml(rects, "block");
  assert.match(rebound, /fillStyle = block\.hex/);
  assert.equal(gate.isExactRgbPartitionReplay(rebound, image), true);
  const reboundScope = gate.judgeLaneScope({
    nativeStatuses: ["PASS"],
    narrowReferencePaired: true,
    nonHtmlVisualRendered: true,
    candidates: [{ html: rebound, image }],
  });
  assert.equal(reboundScope.final, "HOLD");
  assert.notEqual(reboundScope.final, "PASS_WITHIN_TESTED_SCOPE");
}

assertObjectFormPartitionFailsClosed();

function parallelChannelPartitionHtml(rects) {
  const xs = rects.map((rect) => rect.x);
  const ys = rects.map((rect) => rect.y);
  const ws = rects.map((rect) => rect.w);
  const hs = rects.map((rect) => rect.h);
  const rs = rects.map((rect) => parseInt(rect.hex.slice(1, 3), 16));
  const gs = rects.map((rect) => parseInt(rect.hex.slice(3, 5), 16));
  const bs = rects.map((rect) => parseInt(rect.hex.slice(5, 7), 16));
  return `<!doctype html><canvas id="c"></canvas><script>
const xs = ${JSON.stringify(xs)};
const ys = ${JSON.stringify(ys)};
const ws = ${JSON.stringify(ws)};
const hs = ${JSON.stringify(hs)};
const rs = ${JSON.stringify(rs)};
const gs = ${JSON.stringify(gs)};
const bs = ${JSON.stringify(bs)};
const ctx = document.getElementById("c").getContext("2d");
for (let i = 0; i < xs.length; i++) {
  const red = rs[i].toString(16).padStart(2, "0");
  const green = gs[i].toString(16).padStart(2, "0");
  const blue = bs[i].toString(16).padStart(2, "0");
  ctx.fillStyle = "#" + red + green + blue;
  ctx.fillRect(xs[i], ys[i], ws[i], hs[i]);
}
</script>`;
}

function assertParallelChannelPartitionFailsClosed() {
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  const image = { width: 2, height: 2, data };
  const rects = recon.measureRectangles(image);
  const html = parallelChannelPartitionHtml(rects);
  assert.match(html, /const xs = /);
  assert.match(html, /const rs = /);
  assert.match(html, /toString\(16\)\.padStart\(2, "0"\)/);
  assert.match(html, /fillStyle = "#" \+ red \+ green \+ blue/);
  assert.equal(html.includes('"#ff0000"'), false);
  const judged = gate.judgeNativeReconstruction({
    html,
    image,
    ssimScore: 1,
    pixelDeltaPercentage: 0,
    exactViewport: true,
    copiedFixture: false,
  });
  assert.notEqual(judged.status, "PASS");
  assert.equal(judged.status, "FAIL_CONTRACT");
  const scope = gate.judgeLaneScope({
    nativeStatuses: ["PASS"],
    narrowReferencePaired: true,
    nonHtmlVisualRendered: true,
    candidates: [{ html, image }],
  });
  assert.equal(scope.final, "HOLD");
  assert.notEqual(scope.final, "PASS_WITHIN_TESTED_SCOPE");
}

assertParallelChannelPartitionFailsClosed();

function assertPutImageDataPartitionFailsClosed() {
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  const image = { width: 2, height: 2, data };
  const html = `<!doctype html><canvas id="c"></canvas><script>
const px = new Uint8ClampedArray(${JSON.stringify(Array.from(data))});
const ctx = document.getElementById("c").getContext("2d");
ctx.putImageData({ data: px, width: 2, height: 2 }, 0, 0);
</script>`;
  assert.match(html, /putImageData\(\{ data: px, width: 2, height: 2 \}, 0, 0\)/);
  assert.equal(html.includes("fillRect"), false);
  const mismatched = `<!doctype html><canvas id="c"></canvas><script>
const px = new Uint8ClampedArray(${JSON.stringify(Array.from(data).map((v) => (v === 255 ? 1 : 0)))});
const ctx = document.getElementById("c").getContext("2d");
ctx.putImageData({ data: px, width: 2, height: 2 }, 0, 0);
</script>`;
  assert.equal(gate.isExactRgbPartitionReplay(mismatched, image), false);
  const judged = gate.judgeNativeReconstruction({
    html,
    image,
    ssimScore: 1,
    pixelDeltaPercentage: 0,
    exactViewport: true,
    copiedFixture: false,
  });
  assert.notEqual(judged.status, "PASS");
  assert.equal(judged.status, "FAIL_CONTRACT");
  const scope = gate.judgeLaneScope({
    nativeStatuses: ["PASS"],
    narrowReferencePaired: true,
    nonHtmlVisualRendered: true,
    candidates: [{ html, image }],
  });
  assert.equal(scope.final, "HOLD");
  assert.notEqual(scope.final, "PASS_WITHIN_TESTED_SCOPE");

  const skipped = `<!doctype html><canvas id="c"></canvas><script>
const ctx = document.getElementById("c").getContext("2d");
ctx.drawImage({}, 0, 0);
</script>`;
  const skippedScope = gate.judgeLaneScope({
    nativeStatuses: ["PASS"],
    narrowReferencePaired: true,
    nonHtmlVisualRendered: true,
    candidates: [{ html: skipped, image }],
  });
  assert.equal(skippedScope.final, "HOLD");
  assert.notEqual(skippedScope.final, "PASS_WITHIN_TESTED_SCOPE");
  const thrown = gate.judgeNativeReconstruction({
    html: `<script>throw new Error("draw skipped");</script>`,
    image,
    ssimScore: 1,
    pixelDeltaPercentage: 0,
    exactViewport: true,
    copiedFixture: false,
  });
  assert.notEqual(thrown.status, "PASS");
  assert.equal(thrown.status, "FAIL_CONTRACT");
}

assertPutImageDataPartitionFailsClosed();




assert.equal(gate.PASS_MIN_SSIM, 0.95);
assert.equal(gate.PASS_MAX_PIXEL_DELTA_PERCENT, 5);
assert.equal(gate.MAX_REPAIR_ATTEMPTS, 3);
const wasm = JSON.parse(readFileSync(join(repo, "apps/web/public/spe_wasm.sha256.json"), "utf8"));
assert.equal(wasm.sha256, WASM_PIN);

const prior = JSON.parse(readFileSync(priorEvidencePath, "utf8"));
const priorById = Object.fromEntries(prior.rows.map((row) => [row.id, row]));

assert.equal(gate.classifyTarget("vue").status, "UNSUPPORTED_TARGET");
const capped = gate.applyVisualRepair("<html></html>", 3, { backgroundHex: "#000000", foregroundHex: "#ffffff", regions: [] });
assert.equal(capped.applied, false);
assert.equal(capped.refused, "REPAIR_CAP");

if (!existsSync(CHROME)) throw new Error("BLOCKER: Google Chrome missing");
const tess = spawnSync("tesseract", ["--version"], { encoding: "utf8" });
assert.equal(tess.status, 0, "tesseract required for this lane");
assert.match(tess.stdout || tess.stderr || "", /5\.5\.3/);

const manifest = JSON.parse(readFileSync(join(fixturesDir, "manifest.json"), "utf8"));
assert.ok(manifest.fixtures.length >= 6);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--disable-gpu", "--hide-scrollbars", "--font-render-hinting=none"],
});
const browserVersion = browser.version();

async function renderHtml(html, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  return buf;
}

function repairSpecFrom(png, ir) {
  const backgroundHex = meanHex(png, { x: 0, y: 0, w: 1, h: 1 });
  const luma = parseInt(backgroundHex.slice(1, 3), 16) * 0.299
    + parseInt(backgroundHex.slice(3, 5), 16) * 0.587
    + parseInt(backgroundHex.slice(5, 7), 16) * 0.114;
  return {
    backgroundHex,
    foregroundHex: luma > 140 ? "#111111" : "#f5f5f5",
    regions: (ir.regions || []).map((region) => ({ id: region.id, hex: meanHex(png, region.bounds) })),
  };
}

async function legacyBest(html, png, ir) {
  let current = html;
  const spec = repairSpecFrom(png, ir);
  for (let attempt = 0; attempt < 3; attempt++) {
    const step = gate.applyVisualRepair(current, attempt, spec);
    assert.equal(step.applied, true);
    current = step.html;
  }
  return current;
}

const rows = [];
const replayCandidates = [];
const nonHtml = {
  react: { toolchain: "typescript", visual: "HOLD_UNPROVEN", qualified: false },
  swiftui: { toolchain: "swiftc", visual: "HOLD_UNPROVEN", qualified: false },
  compose: { toolchain: "absent", visual: "HOLD_UNPROVEN", qualified: false, note: "kotlinc not on PATH" },
  flutter: { toolchain: "absent", visual: "HOLD_UNPROVEN", qualified: false, note: "dart/flutter not on PATH" },
  "react-native": { toolchain: "absent", visual: "HOLD_UNPROVEN", qualified: false, note: "react-native package and simulator absent; string markers are not qualification" },
};

let swiftChecked = 0;
let reactChecked = 0;

for (const fix of manifest.fixtures) {
  const filePath = join(fixturesDir, fix.file);
  const raw = readFileSync(filePath);
  const decoded = PNG.sync.read(raw);
  assert.equal(decoded.width, fix.width);
  assert.equal(decoded.height, fix.height);
  assert.equal(sha256(raw), priorById[fix.id].referenceSha256, `${fix.id} frozen fixture bytes changed`);

  const img = downsample(decoded);
  const ir = ui.observeScreenshotIRLite(img);
  const pkg = shot.screenshotIRToCodePackage(ir);
  const htmlScaffold = pkg.scaffolds.find((s) => s.target === "html-css-js").code;
  const legacyHtml = await legacyBest(htmlScaffold, decoded, ir);
  const legacyShot = await renderHtml(legacyHtml, decoded.width, decoded.height);
  const legacyCmp = compareVisualBuffers(raw, legacyShot, {
    viewport: { width: decoded.width, height: decoded.height, devicePixelRatio: 1 },
    browserVersion,
  });
  const ocr = tesseractWords(filePath);
  assert.equal(ocr.ok, true, `${fix.id} tesseract`);
  const legacyPng = PNG.sync.read(legacyShot);
  const decomposition = classifyDiscrepancy(decoded, legacyPng, ocr.words);
  const recall = ocrTokenRecall(ocr.text, legacyHtml);

  const image = { width: decoded.width, height: decoded.height, data: decoded.data };
  const built = recon.reconstructionHtml(image);
  assert.equal(built.coverage, decoded.width * decoded.height, `${fix.id} partition`);
  assert.equal(gate.isExactRgbPartitionReplay(built.html, image), true, fix.id);
  assert.equal(recon.isCopiedFixture(built.html, raw, fix.file, image), true, `${fix.id} rectangle replay is a copy`);
  assert.equal(recon.isCopiedFixture(legacyHtml, raw, fix.file, image), false, `${fix.id} scaffold is not a bitmap partition`);
  replayCandidates.push({ html: built.html, image });
  const judged = gate.judgeNativeReconstruction({
    html: built.html,
    image,
    ssimScore: 1,
    pixelDeltaPercentage: 0,
    exactViewport: true,
    copiedFixture: false,
  });
  assert.equal(judged.bar.minSsim, 0.95);
  assert.equal(judged.status, "FAIL_CONTRACT", fix.id);
  assert.notEqual(judged.status, "PASS", fix.id);
  assert.ok(judged.reasons.includes("rectangle partition replay of source bitmap"), fix.id);

  const narrowW = 360;
  const narrowH = Math.min(decoded.height, 800);
  const narrowShot = await renderHtml(legacyHtml, narrowW, narrowH);
  const narrowPng = PNG.sync.read(narrowShot);
  let narrowRefused = false;
  try {
    compareVisualBuffers(raw, narrowShot, {
      viewport: { width: decoded.width, height: decoded.height, devicePixelRatio: 1 },
      candidateViewport: { width: narrowPng.width, height: narrowPng.height, devicePixelRatio: 1 },
      browserVersion,
    });
  } catch (err) {
    narrowRefused = err instanceof IncomparableViewportError || /INCOMPARABLE_VIEWPORT/.test(String(err && err.message));
  }
  assert.equal(narrowRefused, true, `${fix.id} second viewport must not be scored against the native fixture`);

  for (const scaffold of pkg.scaffolds) {
    if (scaffold.target === "react" && reactChecked < 1) {
      const transpiled = ts.transpileModule(scaffold.code, {
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
        reportDiagnostics: true,
      });
      const diags = (transpiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
      nonHtml.react.syntax = diags.length === 0 ? "TYPESCRIPT_PARSE_OK" : "TYPESCRIPT_PARSE_FAIL";
      nonHtml.react.diagnostics = diags.length;
      reactChecked += 1;
    }
    if (scaffold.target === "swiftui" && swiftChecked < 1) {
      const file = join(tmpdir(), "spe-r3c-screen.swift");
      writeFileSync(file, scaffold.code);
      const sdk = spawnSync("xcrun", ["--show-sdk-path"], { encoding: "utf8" });
      const checked = spawnSync("swiftc", ["-typecheck", "-sdk", (sdk.stdout || "").trim(), file], { encoding: "utf8" });
      nonHtml.swiftui.syntax = checked.status === 0 ? "SWIFTC_TYPECHECK_OK" : "SWIFTC_TYPECHECK_FAIL";
      nonHtml.swiftui.exit = checked.status;
      if (checked.status !== 0) nonHtml.swiftui.stderr = (checked.stderr || "").slice(0, 400);
      swiftChecked += 1;
    }
    const visual = gate.judgeRelease({
      target: scaffold.target,
      ocrMode: "REAL_OCR",
      layoutRegionCount: ir.regions.length,
      designTokenCount: 1,
      promptNonEmpty: true,
      syntaxOk: true,
      repairAttempts: 0,
      responsive: { nativeCompared: false, narrowRenderProduced: false, narrowSsim: null },
      ssimScore: null,
      pixelDeltaPercentage: null,
      rendered: false,
    });
    if (scaffold.target !== "html-css-js") {
      assert.equal(visual.status, "HOLD_UNPROVEN", scaffold.target);
      assert.equal(visual.pixelPerfect, false);
    }
  }

  rows.push({
    id: fix.id,
    file: fix.file,
    referenceSha256: sha256(raw),
    viewport: { width: decoded.width, height: decoded.height, devicePixelRatio: 1 },
    before: {
      method: "legacy-scaffold-plus-3-css-repairs",
      ssimScore: legacyCmp.ssimScore,
      pixelDeltaPercentage: legacyCmp.pixelDeltaPercentage,
      decomposition,
      ocrTokenRecallInLegacyHtml: recall,
      ocrWordCount: ocr.words.length,
      priorRecordedBestSsim: priorById[fix.id].nativeComparison.ssimScore,
    },
    measured: {
      method: "legacy-scaffold-plus-3-css-repairs",
      ssimScore: legacyCmp.ssimScore,
      pixelDeltaPercentage: legacyCmp.pixelDeltaPercentage,
      status: "MEASURED_BELOW_BAR",
    },
    rejectedReplay: {
      method: built.method,
      rectCount: built.rectCount,
      scored: false,
      status: judged.status,
      reasons: judged.reasons,
    },
    secondViewport: {
      width: narrowPng.width,
      height: narrowPng.height,
      scoredAgainstNativeFixture: false,
      ssim: null,
      status: "HOLD_UNPROVEN",
      note: "No paired 360px frozen reference. Comparator refuses the native fixture as the reference.",
    },
  });
}

const advRaw = adversarialPng();
mkdirSync(evidenceDir, { recursive: true });
const advPath = join(evidenceDir, "adversarial-noise.png");
writeFileSync(advPath, advRaw);
const advDecoded = PNG.sync.read(advRaw);
const advImage = { width: advDecoded.width, height: advDecoded.height, data: advDecoded.data };
const advBuilt = recon.reconstructionHtml(advImage);
assert.equal(gate.isExactRgbPartitionReplay(advBuilt.html, advImage), true);
assert.equal(recon.isCopiedFixture(advBuilt.html, advRaw, "adversarial-noise.png", advImage), true);
const advJudge = gate.judgeNativeReconstruction({
  html: advBuilt.html,
  image: advImage,
  ssimScore: 1,
  pixelDeltaPercentage: 0,
  exactViewport: true,
  copiedFixture: false,
});
assert.equal(advJudge.status, "FAIL_CONTRACT");
assert.notEqual(advJudge.status, "PASS");
replayCandidates.push({ html: advBuilt.html, image: advImage });

const mutant = recon.fixtureCopyMutant(readFileSync(join(fixturesDir, "mobile-app.png")));
const mutantBytes = readFileSync(join(fixturesDir, "mobile-app.png"));
assert.equal(recon.isCopiedFixture(mutant, mutantBytes, "mobile-app.png"), true);
const mutantShot = await renderHtml(mutant, 390, 844);
const mutantCmp = compareVisualBuffers(mutantBytes, mutantShot, {
  viewport: { width: 390, height: 844, devicePixelRatio: 1 },
  browserVersion,
});
const mutantJudge = gate.judgeNativeReconstruction({
  html: mutant,
  image: { width: 390, height: 844, data: PNG.sync.read(mutantBytes).data },
  ssimScore: mutantCmp.ssimScore,
  pixelDeltaPercentage: mutantCmp.pixelDeltaPercentage,
  exactViewport: true,
  copiedFixture: true,
});
assert.notEqual(mutantJudge.status, "PASS");
assert.ok(mutantJudge.reasons.includes("fixture-output cheat"));

await browser.close();

for (const target of ["react", "swiftui", "compose", "flutter", "react-native"]) {
  assert.equal(nonHtml[target].qualified, false, target);
  assert.equal(nonHtml[target].visual, "HOLD_UNPROVEN", target);
}

const viewports = new Set(rows.map((r) => `${r.viewport.width}x${r.viewport.height}`));
assert.ok(viewports.size >= 2, "at least two frozen viewports");

const spoofedReplayScope = gate.judgeLaneScope({
  nativeStatuses: replayCandidates.map(() => "PASS"),
  narrowReferencePaired: true,
  nonHtmlVisualRendered: true,
  candidates: replayCandidates,
});
assert.equal(spoofedReplayScope.final, "HOLD");
assert.notEqual(spoofedReplayScope.final, "PASS_WITHIN_TESTED_SCOPE");
assert.ok(spoofedReplayScope.killed.includes("rectangle partition replay of source bitmap"));
const omittedScope = gate.judgeLaneScope({
  nativeStatuses: ["PASS"],
  narrowReferencePaired: true,
  nonHtmlVisualRendered: true,
});
assert.equal(omittedScope.final, "HOLD");
const scope = gate.judgeLaneScope({
  nativeStatuses: rows.map((r) => r.measured.status),
  narrowReferencePaired: false,
  nonHtmlVisualRendered: false,
  candidates: rows.map((r, i) => ({ html: "legacy scaffold", image: replayCandidates[i].image })),
});
assert.equal(scope.final, "HOLD");
assert.notEqual(scope.final, "PASS_WITHIN_TESTED_SCOPE");

const desktop = rows.find((r) => r.id === "desktop-landing");
assert.equal(desktop.measured.ssimScore, 0.9153);
assert.ok(desktop.measured.ssimScore < gate.PASS_MIN_SSIM);
assert.equal(gate.PASS_MIN_SSIM, 0.95);
const evidence = {
  lane: "R3-C",
  startSha: "f331dc9c89c3d911ab8abc7d3e0d87b10396f37c",
  killedTip: "4cb762ee921ed47c5436bc6752eb0b1cae610449",
  bar: { minSsim: 0.95, maxPixelDeltaPercent: 5, lowered: false },
  wasmSha256: wasm.sha256,
  tesseract: "5.5.3",
  chrome: browserVersion,
  comparator: "SPE_WINDOWED_SSIM_PIXELMATCH_V1",
  discrepancyDecomposition: rows.map((r) => ({
    id: r.id,
    viewport: r.viewport,
    legacySsim: r.before.ssimScore,
    legacyDelta: r.before.pixelDeltaPercentage,
    ...r.before.decomposition,
    ocrTokenRecallInLegacyHtml: r.before.ocrTokenRecallInLegacyHtml,
    ocrWordCount: r.before.ocrWordCount,
  })),
  repairCycleStarted: false,
  rejectedReplay: {
    test: "exact-RGB rectangle partition replay fails closed",
    disposition: "KILLED",
    cause: "fillRect of an exact-RGB run-length partition is a pixel replay of the fixture PNG",
    change: "The gate fails closed when the HTML is that partition, even if copiedFixture is false. judgeLaneScope cannot emit PASS_WITHIN_TESTED_SCOPE for it.",
    expected: "HOLD. Measured SSIM stays the pre-replay scaffold (desktop-landing 0.9153).",
    measured: {
      desktopLanding: { ssim: desktop.measured.ssimScore, delta: desktop.measured.pixelDeltaPercentage, viewport: "1280x800" },
      rows: rows.map((r) => ({
        id: r.id,
        ssim: r.measured.ssimScore,
        delta: r.measured.pixelDeltaPercentage,
        viewport: `${r.viewport.width}x${r.viewport.height}`,
        replay: r.rejectedReplay.status,
      })),
    },
  },
  rows,
  adversarial: {
    viewport: { width: 320, height: 200 },
    scored: false,
    status: advJudge.status,
    reasons: advJudge.reasons,
  },
  mutant: {
    kind: "data-url copy of mobile-app.png",
    detected: true,
    ssimIfScored: mutantCmp.ssimScore,
    pixelDeltaIfScored: mutantCmp.pixelDeltaPercentage,
    status: mutantJudge.status,
    reasons: mutantJudge.reasons,
  },
  nonHtml,
  pixelPerfectClaim: false,
  releasePass: false,
  final: "HOLD",
  outsideScope: scope.outsideScope,
  laneScope: scope.final,
  spoofedReplayScope: spoofedReplayScope.final,
};
assert.equal(evidence.final, "HOLD");
assert.equal(evidence.pixelPerfectClaim, false);
writeFileSync(join(evidenceDir, "R3C_VISION_EVIDENCE.json"), JSON.stringify(evidence, null, 2));
test("putImageData fixture pixels fail closed", () => {
  assertPutImageDataPartitionFailsClosed();
});
test("parallel-channel exact-RGB partition fails closed", () => {
  assertParallelChannelPartitionFailsClosed();
});
test("object-form exact-RGB partition fillStyle=r.hex fails closed", () => {
  assertObjectFormPartitionFailsClosed();
});
test("exact-RGB rectangle partition replay fails closed", () => {
  assert.equal(evidence.final, "HOLD");
  assert.equal(desktop.measured.ssimScore, 0.9153);
  assert.equal(spoofedReplayScope.final, "HOLD");
  assert.notEqual(spoofedReplayScope.final, "PASS_WITHIN_TESTED_SCOPE");
  assert.equal(evidence.pixelPerfectClaim, false);
  for (const target of ["react", "swiftui", "compose", "flutter", "react-native"]) {
    assert.equal(nonHtml[target].visual, "HOLD_UNPROVEN");
    assert.equal(nonHtml[target].qualified, false);
  }
});
console.log(JSON.stringify({
  ok: true,
  test: "exact-RGB rectangle partition replay fails closed",
  final: evidence.final,
  desktopSsim: desktop.measured.ssimScore,
  rows: evidence.rejectedReplay.measured.rows,
  adversarial: evidence.adversarial,
  nonHtml,
  mutant: evidence.mutant.status,
}, null, 2));
