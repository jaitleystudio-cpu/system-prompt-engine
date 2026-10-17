/**
 * STANDARD vs LITE prompt-quality benchmark on synthetic diverse ImageData.
 * Honest: Node has no window — STANDARD ONNX is not invoked; MobileNet-like
 * subjects are simulated to measure prompt enrichment vs LITE-only.
 */
import assert from "node:assert/strict";
import { build } from "../node_modules/esbuild/lib/main.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));

async function bundleIsolated(relPath) {
  const { readFileSync } = await import("node:fs");
  const full = join(mediaDir, relPath);
  const source = readFileSync(full, "utf8");
  const bundled = await build({
    stdin: {
      contents: `
class ImageData { constructor(data, w, h){ this.data=data; this.width=w; this.height=h; } }
globalThis.ImageData = ImageData;
${source}
`,
      resolveDir: dirname(full),
      sourcefile: relPath,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(bundled.outputFiles[0].text).toString("base64")
  );
}

async function bundleEntry(entryFile) {
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
  return import(
    "data:text/javascript;base64," +
      Buffer.from(bundled.outputFiles[0].text).toString("base64")
  );
}

function makeImage(kind) {
  const w = 128, h = 128;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = 30, g = 30, b = 30;
      if (kind === "people") {
        const cx = 64, cy = 50, dx = (x - cx) / 28, dy = (y - cy) / 36;
        if (dx * dx + dy * dy < 1) { r = 210; g = 160; b = 130; }
        if (y < 28 && Math.abs(x - 64) < 30) { r = g = b = 20; }
        if (y > 90) { r = 40; g = 50; b = 90; }
      } else if (kind === "product") {
        if (x > 40 && x < 90 && y > 30 && y < 100) { r = 240; g = 240; b = 245; }
        if (x > 50 && x < 80 && y > 45 && y < 55) { r = 20; g = 20; b = 20; }
      } else if (kind === "interior") {
        r = 180 + (x % 20); g = 160; b = 140;
        if (y < 40) { r = 220; g = 230; b = 240; }
        if (x < 20 || x > 108) { r = g = b = 90; }
      } else if (kind === "nature") {
        r = 40; g = 120 + (y % 40); b = 50;
        if (y < 50) { r = 120; g = 180; b = 230; }
      } else if (kind === "screenshot") {
        if (y < 18) { r = 30; g = 30; b = 35; }
        else if (x < 24) { r = 45; g = 45; b = 55; }
        else { r = 245; g = 245; b = 248; }
        if (y > 20 && y < 28 && x > 30) { r = g = b = 20; }
      } else if (kind === "diagram") {
        r = g = b = 250;
        if (Math.abs(x - 64) < 2 || Math.abs(y - 64) < 2) { r = 20; g = 80; b = 200; }
        if ((x - 64) ** 2 + (y - 64) ** 2 < 100) { r = 200; g = 40; b = 40; }
      } else if (kind === "text-heavy") {
        r = g = b = 250;
        if (y % 10 < 3 && x > 10 && x < 118) { r = g = b = 15; }
      } else if (kind === "complex") {
        r = (x * 3) % 255; g = (y * 5) % 255; b = (x * y) % 255;
      } else if (kind === "dark") {
        r = g = b = 12;
        if ((x - 64) ** 2 + (y - 64) ** 2 < 400) { r = 80; g = 20; b = 20; }
      } else if (kind === "bright") {
        r = g = b = 245;
        if (x > 60 && y > 60) { r = 255; g = 220; b = 40; }
      } else if (kind === "wide") {
        r = y < 40 ? 200 : 50; g = 100; b = y < 40 ? 50 : 180;
      } else if (kind === "ambiguous") {
        r = 128; g = 128; b = 128;
        if ((x + y) % 17 === 0) { r = 200; g = 200; b = 50; }
      }
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

class ImageData {
  constructor(data, w, h) {
    this.data = data;
    this.width = w;
    this.height = h;
  }
}
globalThis.ImageData = ImageData;

const kinds = [
  "people","product","interior","nature","screenshot","diagram",
  "text-heavy","complex","dark","bright","wide","ambiguous",
];

const imgMod = await bundleIsolated("imageObserve.ts");
const compose = await bundleEntry("semanticCompose.ts");

const subjectMap = {
  people: [{ label: "person", score: 0.72, method: "mobilenet-v2-int8" }],
  product: [{ label: "loudspeaker", score: 0.55, method: "mobilenet-v2-int8" }],
  nature: [{ label: "seashore", score: 0.48, method: "mobilenet-v2-int8" }],
  screenshot: [{ label: "web site", score: 0.41, method: "mobilenet-v2-int8" }],
  diagram: [{ label: "envelope", score: 0.22, method: "mobilenet-v2-int8" }],
  interior: [{ label: "dining table", score: 0.33, method: "mobilenet-v2-int8" }],
};

const rows = [];
for (const kind of kinds) {
  const img = makeImage(kind);
  const liteObs = imgMod.observeImageData(img, {
    fileName: `${kind}.png`,
    fileBytes: 1000,
    mimeType: "image/png",
    sourceWidth: 128,
    sourceHeight: 128,
  });
  const liteSem = compose.buildSemanticFromLite(liteObs, {
    subjects: [],
    ocrBlocks: [],
    tier: "LITE",
    elapsedMs: 1,
    methodNotes: ["lite-only"],
  });
  const subjects = subjectMap[kind] || [];
  const stdSem = compose.buildSemanticFromLite(liteObs, {
    subjects,
    ocrBlocks: [],
    tier: subjects.length ? "STANDARD" : "LITE",
    elapsedMs: 5,
    methodNotes: subjects.length
      ? ["simulated-standard-subjects-for-benchmark"]
      : ["no-confident-standard-subjects"],
  });
  const liteBlock = compose.semanticToPromptBlock(liteSem);
  const stdBlock = compose.semanticToPromptBlock(stdSem);
  const improved =
    subjects.length > 0 &&
    stdBlock.length >= liteBlock.length &&
    subjects.some((s) => stdBlock.toLowerCase().includes(s.label.split(" ")[0].toLowerCase()));
  const noGain = !improved;
  rows.push({
    kind,
    liteChars: liteBlock.length,
    standardChars: stdBlock.length,
    standardSubjects: subjects.map((s) => s.label),
    improved,
    noGain,
    note: subjects.length
      ? improved
        ? "STANDARD subjects enrich final prompt block"
        : "STANDARD subjects present but weak prompt delta"
      : "No confident STANDARD subjects — LITE remains appropriate",
  });
}

const improvedCount = rows.filter((r) => r.improved).length;
const noGainCount = rows.filter((r) => r.noGain).length;
assert.ok(improvedCount >= 3, "expected STANDARD to help on several subject-rich cases");
assert.ok(noGainCount >= 2, "expected honest no-gain cases");

console.log(JSON.stringify({
  ok: true,
  mode: "synthetic-benchmark",
  onnxRuntimeInvoked: false,
  note: "Node has no window — STANDARD ONNX not invoked; subjects simulated. Browser path remains lazy ONNX with LITE fallback.",
  improvedCount,
  noGainCount,
  rows,
}, null, 2));
