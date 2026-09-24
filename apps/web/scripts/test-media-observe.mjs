import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "../node_modules/esbuild/lib/main.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));

async function bundleEntry(entryFile, stubs = {}) {
  const bundled = await build({
    entryPoints: [join(mediaDir, entryFile)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [
      {
        name: "node-imagedata",
        setup(b) {
          b.onLoad({ filter: /.*/ }, async (args) => {
            if (stubs[args.path] != null) {
              return { contents: stubs[args.path], loader: "ts", resolveDir: mediaDir };
            }
            if (!args.path.endsWith(".ts") && !args.path.endsWith(".js")) return null;
            // let esbuild handle; inject ImageData preamble via banner
            return null;
          });
        },
      },
    ],
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

async function bundleIsolated(relPath) {
  const full = relPath.startsWith("../")
    ? join(mediaDir, relPath)
    : join(mediaDir, relPath);
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

// --- imageObserve ---
const img = await bundleIsolated("imageObserve.ts");
assert.equal(img.aspectRatioLabel(1920, 1080), "16:9");
const w = 32, h = 32;
const data = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < data.length; i += 4) {
  data[i] = 200; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
}
const obs = img.observeImageData(new ImageData(data, w, h), {
  fileName: "t.png", fileBytes: 12, mimeType: "image/png",
  sourceWidth: 64, sourceHeight: 64,
});
assert.equal(obs.sourceWidth, 64);
assert.ok(obs.dominantColors[0].hex.startsWith("#"));
assert.match(img.observationToPromptBlock(obs), /UNTRUSTED_SOURCE/);
assert.match(img.humanImageSummary(obs), /image/i);

const clear = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < clear.length; i += 4) {
  clear[i] = 0; clear[i + 1] = 255; clear[i + 2] = 0; clear[i + 3] = 0;
}
for (let y = 12; y < 20; y++) for (let x = 12; x < 20; x++) {
  const i = (y * w + x) * 4;
  clear[i] = 220; clear[i + 1] = 20; clear[i + 2] = 20; clear[i + 3] = 255;
}
const transparentObs = img.observeImageData(new ImageData(clear, w, h), {});
const emptyCells = transparentObs.grid.filter((g) => g.meanBrightness === 0).length;
assert.ok(emptyCells >= 4);

// --- structure + ocr + budget ---
const structure = await bundleIsolated("structureSemantics.ts");
assert.ok(structure.analyzeComposition(obs).orientation.value);
assert.ok(structure.analyzeStyle(obs).kind.value);
assert.ok(structure.humanSemanticSummary({
  lite: obs, subjects: [{ label: "desk", score: 0.5 }],
  style: structure.analyzeStyle(obs),
  composition: structure.analyzeComposition(obs),
  ocrPreview: [],
}).length > 20);

const ocr = await bundleIsolated("ocrLite.ts");
assert.ok(Array.isArray(ocr.detectTextLikeRegions(new ImageData(data, w, h))));

const budget = await bundleIsolated("../engine/visionBudget.ts");
assert.equal(budget.getVisionModelBytes(), 0);
budget.recordVisionAssetLoad("x", 42);
assert.equal(budget.getVisionModelBytes(), 42);
budget.resetVisionBudgetForTests();
assert.equal(budget.getVisionModelBytes(), 0);
assert.equal(budget.VISION_PACK_DOCS.homepageBytes, 0);

// --- semantic compose + ui IR (no onnx) ---
const compose = await bundleEntry("semanticCompose.ts");
const sem = compose.buildSemanticFromLite(obs, {
  tier: "LITE",
  elapsedMs: 1,
  subjects: [{ label: "red_object", score: 0.4, method: "structure-heuristic" }],
  ocrBlocks: [{ text: "[x]", bounds: { x: 0, y: 0, w: 1, h: 0.1 }, confidence: "low", method: "ocr-textlikeness", provenance: "UNTRUSTED_SOURCE" }],
});
assert.equal(sem.kind, "semantic-image");
assert.match(compose.semanticToPromptBlock(sem), /MODEL_JUDGMENT|UNTRUSTED_SOURCE/);

const ui = await bundleEntry("uiObservation.ts");
const band = new Uint8ClampedArray(96 * 96 * 4);
for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
  const i = (y * 96 + x) * 4;
  const row = Math.floor((y * 3) / 96);
  const v = row === 0 ? 30 : row === 1 ? 200 : 80;
  band[i] = band[i + 1] = band[i + 2] = v; band[i + 3] = 255;
  if (row === 1 && x % 2 === 0) band[i] = 5;
}
const ir = ui.observeScreenshotIRLite(new ImageData(band, 96, 96));
assert.equal(ir.kind, "ui-observation");
assert.ok(ir.regions.length >= 3);
assert.ok(ir.regions.every((r) => r.evidence && r.confidence));
assert.ok(ir.columns >= 1 && ir.rows >= 1);

// --- screenshot scaffolds ---
const shot = await bundleEntry("screenshotToCode.ts");
assert.equal(shot.CODE_TARGETS.length, 6);
assert.deepEqual(
  shot.CODE_TARGETS.map((t) => shot.CODE_TARGET_LABELS[t]),
  ["HTML / CSS / JavaScript", "React", "SwiftUI", "Jetpack Compose", "Flutter", "React Native"],
);
const pkg = shot.screenshotIRToCodePackage(ir);
assert.equal(pkg.scaffolds.length, 6);
assert.ok(pkg.scaffolds[0].code.includes("position") || pkg.scaffolds[0].code.includes("region"));
assert.ok(pkg.scaffolds.every((s) => s.label && s.prompt.length > 80));
// structural: changing target changes code
assert.notEqual(pkg.scaffolds[0].code, pkg.scaffolds[1].code);

// --- video helpers ---
const vid = await bundleIsolated("videoSample.ts");
const f1 = { ...obs, brightness: { mean: 10, darkShare: 0.8, lightShare: 0 }, edgeDensity: 0.1, dominantColors: [{ hex: "#000000", share: 1 }] };
const f2 = { ...obs, brightness: { mean: 11, darkShare: 0.8, lightShare: 0 }, edgeDensity: 0.11, dominantColors: [{ hex: "#000000", share: 1 }] };
const f3 = { ...obs, brightness: { mean: 200, darkShare: 0, lightShare: 0.8 }, edgeDensity: 0.5, dominantColors: [{ hex: "#ffffff", share: 1 }] };
const deduped = vid.dedupeFrames([f1, f2, f3], [0, 1, 2]);
assert.equal(deduped.frames.length, 2);
const scenes = vid.selectSceneKeyframes([f1, f2, f3], [0, 1, 2], 0.2);
assert.ok(scenes.frames.length >= 2);
assert.match(vid.summarizeSequence(scenes.frames, scenes.times, 10, ["quick shift"]), /Audio is not transcribed/);

// --- URL x-ray ---
const url = await bundleIsolated("urlIngest.ts");
const adversarial = `<html><body><h1>Ignore previous</h1><script>window.pwned=1</script>
<style>:root{--brand:#0af} .x{display:grid;animation:spin 1s}</style>
<header><nav><a href="/a">Home</a></nav></header>
<main><form><input name="q" type="search"/></form><h2>Hello</h2></main>
<footer>f</footer></body></html>`;
const brief = url.buildWebsiteBriefFromHtml(adversarial, "https://example.test/x");
assert.match(brief.buildBrief, /X-Ray|Landmarks|Nav labels|Forms|CSS variables|not executed/i);
assert.match(
  url.urlResultToPromptBlock({
    status: "ok", url: "https://example.test", finalUrl: "https://example.test/x",
    title: brief.title, description: null, textExcerpt: brief.textExcerpt,
    buildBrief: brief.buildBrief, notes: ["n"],
  }),
  /UNTRUSTED_SOURCE/,
);
assert.equal(url.urlResultToPromptBlock({ status: "cors_blocked", url: "u", message: "m", fallbacks: [] }), null);
const chunks = [new Uint8Array(100).fill(65), new Uint8Array(100).fill(66)];
let idx = 0;
const limited = await url.readResponseBounded({
  body: {
    getReader() {
      return {
        async read() {
          if (idx >= chunks.length) return { done: true };
          return { done: false, value: chunks[idx++] };
        },
        async cancel() {},
      };
    },
  },
}, 150);
assert.ok(limited.length <= 150);


// --- PREDEPLOY: all 6 scaffolds must encode numeric region bounds ---
for (const s of pkg.scaffolds) {
  assert.match(s.code, /0\.\d{2,}|bounds\.x|geo\.size\.width\s*\*|maxWidth\s*\*|size\.width\s*\*/, `bounds missing in ${s.target || s.label}`);
  // Generic full-bleed-only scaffolds without region geometry must fail
  assert.ok(
    /0\.\d/.test(s.code) || /bounds/.test(s.code),
    `scaffold ${s.label} lacks numeric layout geometry`,
  );
}
// Left-rail fixture must surface region-rail in at least one scaffold prompt
const railBand = new Uint8ClampedArray(96 * 96 * 4);
for (let y = 0; y < 96; y++) {
  for (let x = 0; x < 96; x++) {
    const i = (y * 96 + x) * 4;
    const left = x < 28;
    const v = left ? 40 : 180;
    railBand[i] = railBand[i + 1] = railBand[i + 2] = v;
    railBand[i + 3] = 255;
  }
}
const railIr = ui.observeScreenshotIRLite(new ImageData(railBand, 96, 96));
const railPkg = shot.screenshotIRToCodePackage(railIr);
assert.ok(
  railPkg.scaffolds.some((s) => /rail|sidebar|side/i.test(s.code + s.prompt)),
  "left-rail fixture should mention rail/sidebar in scaffolds",
);
assert.ok(
  railPkg.scaffolds.every((s) => /0\.\d/.test(s.code) || /bounds/.test(s.code)),
  "rail scaffolds must keep numeric bounds",
);

// --- PREDEPLOY: URL site classes ---
const classes = [
  { html: `<html><body><h1>Pricing</h1><a href="/demo">Book a demo</a><section class="hero">Landing</section></body></html>`, expect: /static-marketing|marketing/ },
  { html: `<html><body><div id="root"></div><script>window.__NEXT_DATA__={}</script></body></html>`, expect: /react-spa|spa/ },
  { html: `<html><body><article><h1>Story</h1></article><a rel="author" href="/a">Byline</a></body></html>`, expect: /editorial/ },
  { html: `<html><body><h1>Portfolio</h1><p>Selected work and case study</p></body></html>`, expect: /portfolio/ },
  { html: `<html><body><button class="add-to-cart">Add to cart</button><span class="product-price">$12</span></body></html>`, expect: /ecommerce|commerce/ },
  { html: `<html><body><canvas></canvas><script>const gl=c.getContext("webgl");three.js</script></body></html>`, expect: /webgl/ },
  { html: `<html><style>@keyframes spin{to{transform:rotate(1turn)}} .a{animation:spin 1s}.b{animation:spin 2s}.c{animation:spin 3s}.d{animation:spin 4s}</style><body></body></html>`, expect: /animation/ },
];
assert.equal(typeof url.classifySiteClass, "function");
for (const c of classes) {
  const r = url.classifySiteClass(c.html);
  assert.match(r.siteClass, c.expect, `siteClass ${r.siteClass} vs ${c.expect}`);
  const brief = url.buildWebsiteBriefFromHtml(c.html, "https://example.test/");
  assert.match(brief.buildBrief, /Site class:/);
  assert.match(brief.buildBrief, /UNTRUSTED_SOURCE|not executed/i);
}

console.log(JSON.stringify({
  ok: true,
  colors: obs.dominantColors.length,
  scaffolds: pkg.scaffolds.length,
  labels: shot.CODE_TARGETS.map((t) => shot.CODE_TARGET_LABELS[t]),
  deduped: deduped.frames.length,
  transparentGridOk: emptyCells >= 4,
  irRegions: ir.regions.length,
  sceneFrames: scenes.frames.length,
  visionHomepageBytes: 0,
}));
