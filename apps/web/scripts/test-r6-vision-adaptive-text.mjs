/**
 * Metamorphic text-proposal checks on synthetic images.
 * No fixture filename, fixture SHA, expected-text table, or font metric.
 * OCR text is accepted only from the production /api/ocr/recognize call.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalOcrHost } from "./local-ocr-host.mjs";
import { build } from "../node_modules/esbuild/lib/main.js";
import { PNG } from "pngjs";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));

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
  return import(
    "data:text/javascript;base64," +
      Buffer.from(bundled.outputFiles[0].text).toString("base64")
  );
}

function paintBars(originX, darkOnLight, y0 = 28) {
  const w = 220;
  const h = 80;
  const data = new Uint8ClampedArray(w * h * 4);
  const bg = darkOnLight ? 245 : 12;
  const fg = darkOnLight ? 10 : 245;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = bg;
    data[i + 3] = 255;
  }
  const bh = 18;
  const bw = 3;
  const gap = 3;
  for (let n = 0; n < 8; n++) {
    const x0 = originX + n * (bw + gap);
    for (let y = y0; y < y0 + bh; y++) {
      for (let x = x0; x < x0 + bw; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = fg;
      }
    }
  }
  return new ImageData(data, w, h);
}


function renderPhrase(text) {
  const dir = mkdtempSync(join(tmpdir(), "spe-ocr-phrase-"));
  const file = join(dir, "phrase.png");
  const rendered = spawnSync(
    "magick",
    [
      "-background", "white",
      "-fill", "black",
      "-font", "/System/Library/Fonts/Supplemental/Arial.ttf",
      "-pointsize", "64",
      `label:${text}`,
      "-bordercolor", "white",
      "-border", "40",
      `PNG32:${file}`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(rendered.status, 0, rendered.stderr || rendered.stdout);
  const decoded = PNG.sync.read(readFileSync(file));
  assert.equal(decoded.data.length, decoded.width * decoded.height * 4);
  return new ImageData(Uint8ClampedArray.from(decoded.data), decoded.width, decoded.height);
}

function unionBox(blocks, w, h) {
  assert.ok(blocks.length > 0);
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const block of blocks) {
    x0 = Math.min(x0, block.bounds.x);
    y0 = Math.min(y0, block.bounds.y);
    x1 = Math.max(x1, block.bounds.x + block.bounds.w);
    y1 = Math.max(y1, block.bounds.y + block.bounds.h);
  }
  return { x: x0 * w, y: y0 * h, w: (x1 - x0) * w, h: (y1 - y0) * h };
}

const ocr = await bundle("ocrLite.ts");
const shot = await bundle("screenshotToCode.ts");
const gate = await bundle("visionReleaseGate.ts");
const ui = await bundle("uiObservation.ts");

const sources = [
  "ocrLite.ts",
  "screenshotToCode.ts",
  "visionReleaseGate.ts",
  "uiObservation.ts",
  "semanticPipeline.ts",
  "semanticTypes.ts",
].map((name) => readFileSync(join(mediaDir, name), "utf8")).join("\n");

const ocrSource = readFileSync(join(mediaDir, "ocrLite.ts"), "utf8");
assert.equal(ocrSource.includes("0.22"), false);
assert.equal(ocrSource.includes("0.20"), false);
assert.equal(sources.includes("mobile-app.png"), false);
assert.equal(sources.includes("screenshot_real_fixtures"), false);
assert.equal(sources.includes("SYSTEM PROMPT ENGINE"), false);
assert.equal(sources.includes("HELLO MAJOR"), false);
assert.equal(sources.includes("[text-like band"), false);
assert.equal(/spawnSync\(\s*["']tesseract["']/.test(sources), false);
assert.equal(sources.includes("VISION_PRODUCT"), false);
assert.equal(gate.PASS_MIN_SSIM, 0.95);

const flat = new ImageData(new Uint8ClampedArray(220 * 80 * 4).map((_, i) => (i % 4 === 3 ? 255 : 30)), 220, 80);
assert.equal(ocr.detectTextLikeRegions(flat).length, 0);

const at20 = ocr.detectTextLikeRegions(paintBars(20, true));
const at60 = ocr.detectTextLikeRegions(paintBars(60, true));
const inverted = ocr.detectTextLikeRegions(paintBars(20, false));
const box20 = unionBox(at20, 220, 80);
const box60 = unionBox(at60, 220, 80);
const boxInv = unionBox(inverted, 220, 80);
assert.ok(Math.abs(box60.x - box20.x - 40) <= 4, `moved ${box60.x - box20.x}`);
assert.ok(Math.abs(boxInv.x - box20.x) <= 4, "inverted polarity missed the band");
assert.ok(at20.every((block) => block.text === ""));
assert.ok(at20.every((block) => block.provenance !== "observed-ocr"));
assert.equal(at20.some((block) => block.text === "Main content"), false);

const ocrHost = createLocalOcrHost({ repoRoot: root });
const ocrServer = createServer((req, res) => {
  if (ocrHost.isApi(req.url || "")) {
    void ocrHost.handleApi(req, res);
    return;
  }
  res.statusCode = 404;
  res.end();
});
await new Promise((resolve) => ocrServer.listen(0, "127.0.0.1", resolve));
const ocrPort = ocrServer.address().port;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("/api/ocr/")) return nativeFetch(`http://127.0.0.1:${ocrPort}${url}`, init);
  return nativeFetch(input, init);
};
process.on("exit", () => {
  ocrHost.stop();
  ocrServer.close();
});

const sourceA = "SYSTEM PROMPT ENGINE";
const sourceB = "HELLO MAJOR";
const imageA = renderPhrase(sourceA);
const imageB = renderPhrase(sourceB);
const seenA = await ocr.observeText(imageA);
const seenB = await ocr.observeText(imageB);
assert.equal(seenA.execution.egressAttempts, 0);
assert.equal(seenB.execution.egressAttempts, 0);
assert.equal(seenA.execution.mode, "LOCAL_OCR");
assert.equal(seenB.execution.mode, "LOCAL_OCR");
assert.equal(seenA.execution.text.replace(/\s+/g, " ").trim(), sourceA);
assert.equal(seenB.execution.text.replace(/\s+/g, " ").trim(), sourceB);
assert.notEqual(seenA.execution.text, seenB.execution.text);
assert.ok(seenA.regions.every((region) => region.provenance === "observed-ocr"));
assert.ok(seenB.regions.every((region) => region.provenance === "observed-ocr"));

const blankSeen = await ocr.observeText(flat);
assert.equal(blankSeen.execution.text.replace(/\s+/g, " ").trim(), "");
assert.equal(blankSeen.regions.some((region) => String(region.text || "").trim().length > 0), false);

const heldOut = await ocr.observeText(paintBars(15, true, 40));
assert.ok(heldOut.proposals > 0);
assert.equal(typeof ocr.observeText, "function");
assert.equal(typeof ocr.recognizeImageFile, "function");

const pngBytes = ocr.encodeScreenshotPng(paintBars(20, true));
const decoded = PNG.sync.read(Buffer.from(pngBytes));
assert.equal(decoded.width, 220);
assert.equal(decoded.height, 80);
assert.equal(decoded.data[3], 255);

const ir = ui.observeScreenshotIRLite(paintBars(20, true));
assert.ok(ir.textBlocks.every((block) => block.textGuess == null));
assert.ok(ir.textBlocks.every((block) => block.provenance !== "observed-ocr"));
const plain = shot.screenshotIRToCodePackage(ir).scaffolds[0].code;
assert.equal(plain.includes("[text-like band"), false);
assert.equal(plain.includes('data-provenance="observed-ocr"'), false);

const carried = shot.screenshotIRToCodePackage({
  ...ir,
  textBlocks: [
    {
      id: "text-observed",
      textGuess: "ZONE ALPHA",
      bounds: { x: 0.1, y: 0.2, w: 0.3, h: 0.08 },
      confidence: "high",
      evidence: "observed OCR (ocr-tesseract)",
      method: "ocr-tesseract",
      provenance: "observed-ocr",
    },
  ],
}).scaffolds[0].code;
assert.match(carried, /<p class="spe-ocr-text" data-provenance="observed-ocr"[^>]*>ZONE ALPHA<\/p>/);
assert.equal(/spe-ocr-text"[^>]*font-size|spe-ocr-text"[^>]*font-family|spe-ocr-text"[^>]*line-height|spe-ocr-text"[^>]*letter-spacing|spe-ocr-text"[^>]*font-weight/.test(carried), false);
const missing = shot.screenshotIRToCodePackage({
  ...ir,
  textBlocks: [
    {
      id: "text-missing",
      textGuess: null,
      bounds: { x: 0.1, y: 0.2, w: 0.3, h: 0.08 },
      confidence: "low",
      evidence: "text proposal (ocr-textlikeness)",
      method: "ocr-textlikeness",
      provenance: "proposal",
    },
  ],
}).scaffolds[0].code;
assert.equal(missing.includes("spe-ocr-text"), false);
assert.equal(missing.includes("[text-like band"), false);

const repaired = gate.applyVisualRepair(carried, 2, {
  backgroundHex: "#111111",
  foregroundHex: "#eeeeee",
  regions: [],
});
assert.equal(repaired.name, "hide-invented-chrome");
assert.match(repaired.html, /:not\(\[data-provenance="observed-ocr"\]\)/);
const style = repaired.html.match(/<style id="spe-repair">([\s\S]*?)<\/style>/)[1];
assert.equal(style.includes("font-size:0"), true);
assert.equal(/p\{font-size:0/.test(style), false);
assert.equal((style.match(/font-size:0/g) || []).length, 1);

const receipt = {
  headBefore: "f2aa9960f9e93057788d76b1abe95076d4506d67",
  proposals: { at20: at20.length, at60: at60.length, inverted: inverted.length, heldOut: heldOut.proposals, flat: 0 },
  movePx: box60.x - box20.x,
  boxes: { at20: box20, at60: box60, inverted: boxInv },
  ocr: {
    mode: seenA.execution.mode,
    errorCode: seenA.execution.errorCode,
    text: seenA.execution.text,
    textB: seenB.execution.text,
    blank: blankSeen.execution.text,
    provenance: seenA.regions.map((region) => region.provenance),
    confidence: seenA.regions.map((region) => region.confidence),
    blocker:
      seenA.execution.mode === "LOCAL_OCR"
        ? null
        : "spe_runtime.ocr_product.route_host POST /api/ocr/recognize LocalOcrSession.recognize is not mounted on grok/r6-vision-20261004",
  },
  textBlocksFromDetector: ir.textBlocks.length,
  genuineTextBlocksRendered: seenA.execution.mode === "LOCAL_OCR",
  domGeometry: null,
  ssim: null,
  note: "Frozen desktop fixture was not rendered and was not scored. 0.9153 was not recomputed. PASS bar remains 0.95.",
  antiCheat: "no fixture filename, fixture SHA, expected-text table, or font metric",
};
const dir = "/tmp/spe-vision-r6d";
mkdirSync(dir, { recursive: true });
const body = JSON.stringify(receipt, null, 2);
const digest = createHash("sha256").update(body).digest("hex");
writeFileSync(join(dir, "receipt.json"), body);
writeFileSync(join(dir, "receipt.sha256"), `${digest}  receipt.json\n`);
ocrHost.stop();
await new Promise((resolve) => ocrServer.close(resolve));
console.log(JSON.stringify({ ok: true, sha256: digest, proposals: receipt.proposals, ocr: receipt.ocr.mode, errorCode: receipt.ocr.errorCode, movePx: receipt.movePx, textA: receipt.ocr.text, textB: receipt.ocr.textB, blank: receipt.ocr.blank }, null, 2));
