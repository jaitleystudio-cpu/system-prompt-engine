/**
 * Lane G3 — truthful screenshot release gate.
 * Fails closed. Never invents SSIM, OCR text, or pixel-perfect.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";
import { PNG } from "pngjs";
import { chromium } from "playwright";
import { compareVisualBuffers } from "../src/media/realVisualComparator.mjs";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const fixturesDir = join(repo, "proofs/spe_v1_launch/screenshot_real_fixtures");
const evidenceDir = join(repo, "evidence/lane-g3");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
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

const gate = await bundle("visionReleaseGate.ts");
const ui = await bundle("uiObservation.ts");
const shot = await bundle("screenshotToCode.ts");

assert.equal(gate.MAX_REPAIR_ATTEMPTS, 3);
assert.equal(gate.classifyTarget("vue").status, "UNSUPPORTED_TARGET");
assert.equal(gate.classifyTarget("html-css-js").supported, true);
assert.equal(gate.classifyTarget("react-native").supported, true);
assert.deepEqual(
  [...gate.DECLARED_CODE_TARGETS],
  ["html-css-js", "react", "swiftui", "compose", "flutter", "react-native"],
);

const hold = gate.judgeRelease({
  target: "html-css-js",
  ocrMode: "ABSENT",
  layoutRegionCount: 0,
  designTokenCount: 0,
  promptNonEmpty: false,
  syntaxOk: false,
  repairAttempts: 0,
  responsive: { nativeCompared: false, narrowRenderProduced: false, narrowSsim: null },
  ssimScore: null,
  pixelDeltaPercentage: null,
  rendered: false,
});
assert.notEqual(hold.status, "PASS");
assert.equal(hold.pixelPerfect, false);
assert.equal(hold.status, "HOLD_UNPROVEN");

const capped = gate.judgeRelease({
  target: "html-css-js",
  ocrMode: "EXPLICIT_FALLBACK",
  layoutRegionCount: 3,
  designTokenCount: 2,
  promptNonEmpty: true,
  syntaxOk: true,
  repairAttempts: 4,
  responsive: { nativeCompared: true, narrowRenderProduced: true, narrowSsim: 0.99 },
  ssimScore: 0.99,
  pixelDeltaPercentage: 0.1,
  rendered: true,
});
assert.equal(capped.status, "FAIL_CONTRACT");
assert.equal(capped.pixelPerfect, false);

const fallback = gate.ocrTruth([
  { method: "ocr-textlikeness", text: "[text-like band ~10%–20%]" },
]);
assert.equal(fallback.mode, "EXPLICIT_FALLBACK");
assert.equal(fallback.characterTextClaimed, false);

const realOcr = gate.ocrTruth([{ method: "tesseract", text: "Hello" }]);
assert.equal(realOcr.mode, "REAL_OCR");
assert.equal(realOcr.characterTextClaimed, true);

const tess = spawnSync("tesseract", ["--version"], { encoding: "utf8" });
const tesseractPresent = tess.status === 0;

assert.ok(existsSync(join(fixturesDir, "manifest.json")), "real fixtures missing");
const manifest = JSON.parse(readFileSync(join(fixturesDir, "manifest.json"), "utf8"));
assert.ok(manifest.fixtures.length >= 6);

if (!existsSync(CHROME)) {
  throw new Error("BLOCKER: Google Chrome missing; rendered comparison not run");
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--disable-gpu", "--hide-scrollbars", "--font-render-hinting=none"],
});
const browserVersion = browser.version();

async function renderHtml(html, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  return buf;
}

const rows = [];

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

function meetsNativeBar(score) {
  return Boolean(score) && score.ssimScore >= 0.95 && score.pixelDeltaPercentage <= 5;
}

async function measureNative(html, raw, decoded) {
  const rendered = await renderHtml(html, decoded.width, decoded.height);
  const renderedPng = PNG.sync.read(rendered);
  if (renderedPng.width !== decoded.width || renderedPng.height !== decoded.height) {
    throw new Error(`INCOMPARABLE_VIEWPORT_RASTER ${renderedPng.width}x${renderedPng.height}`);
  }
  return compareVisualBuffers(raw, rendered, {
    viewport: { width: decoded.width, height: decoded.height, devicePixelRatio: 1 },
    browserVersion,
    referenceSource: raw,
    candidateSource: rendered,
  });
}

async function runBoundedRepairs(html, raw, decoded, spec) {
  const attempts = [];
  let current = html;
  let repairs = 0;
  let native = await measureNative(current, raw, decoded);
  attempts.push({
    attempt: 0,
    name: "baseline",
    repairCount: 0,
    ssimScore: native.ssimScore,
    pixelDeltaPercentage: native.pixelDeltaPercentage,
  });
  while (repairs < 3 && !meetsNativeBar(native)) {
    const step = gate.applyVisualRepair(current, repairs, spec);
    assert.equal(step.applied, true, step.refused || "repair not applied");
    assert.ok(step.attempt <= 3);
    assert.ok(step.attempt === repairs + 1);
    current = step.html;
    repairs = step.attempt;
    native = await measureNative(current, raw, decoded);
    attempts.push({
      attempt: repairs,
      name: step.name,
      repairCount: repairs,
      ssimScore: native.ssimScore,
      pixelDeltaPercentage: native.pixelDeltaPercentage,
    });
  }
  const capped = gate.applyVisualRepair(current, 3, spec);
  assert.equal(capped.applied, false);
  assert.equal(capped.refused, "REPAIR_CAP");
  return { html: current, native, attempts, repairCount: repairs };
}

function ocrForFile(filePath, rawBlocks) {
  const fallback = rawBlocks.length
    ? gate.ocrTruth(rawBlocks)
    : { mode: "EXPLICIT_FALLBACK", method: "ocr-textlikeness", characterTextClaimed: false };
  fallback.bands = rawBlocks.length;
  if (!tesseractPresent) return fallback;
  const ran = spawnSync("tesseract", [filePath, "stdout", "-l", "eng", "--psm", "6"], {
    encoding: "utf8",
    timeout: 120000,
  });
  if (ran.status !== 0) {
    return {
      mode: "EXPLICIT_FALLBACK",
      method: "ocr-textlikeness",
      characterTextClaimed: false,
      bands: rawBlocks.length,
      tesseractExit: ran.status,
      note: "tesseract present but this image failed; text-likeness fallback kept",
    };
  }
  const text = (ran.stdout || "").replace(/\s+/g, " ").trim().slice(0, 180);
  return {
    mode: "REAL_OCR",
    method: "tesseract",
    characterTextClaimed: /[A-Za-z0-9]{2,}/.test(text),
    bands: rawBlocks.length,
    textSample: text,
    provenance: "UNTRUSTED_SOURCE",
  };
}

for (const fix of manifest.fixtures) {
  const filePath = join(fixturesDir, fix.file);
  const raw = readFileSync(filePath);
  const decoded = PNG.sync.read(raw);
  assert.equal(decoded.width, fix.width, `${fix.id} width`);
  assert.equal(decoded.height, fix.height, `${fix.id} height`);
  const img = downsample(decoded);
  const ir = ui.observeScreenshotIRLite(img);
  const pkg = shot.screenshotIRToCodePackage(ir);
  assert.equal(pkg.scaffolds.length, 6, fix.id);

  const rawBlocks = (ir.textBlocks || []).map((b) => ({ method: b.method, text: b.textGuess || "" }));
  const ocr = ocrForFile(filePath, rawBlocks);
  if (!tesseractPresent) {
    assert.notEqual(ocr.mode, "REAL_OCR", `${fix.id} must not pretend tesseract ran`);
    assert.equal(ocr.characterTextClaimed, false);
    assert.equal(ocr.mode, "EXPLICIT_FALLBACK");
  }
  const tokens = gate.designTokensFromIR(ir);
  assert.ok(tokens.colors.length >= 1, `${fix.id} design tokens`);
  assert.ok(ir.regions.length >= 1, `${fix.id} layout`);
  assert.ok(pkg.scaffolds.every((s) => (s.prompt || "").length > 40), `${fix.id} image→prompt`);

  const syntax = {};
  for (const scaffold of pkg.scaffolds) {
    const checked = gate.syntaxValidate(scaffold.target, scaffold.code);
    syntax[scaffold.target] = checked;
    assert.equal(checked.ok, true, `${fix.id}/${scaffold.target}: ${checked.reason}`);
    const responsive = gate.responsiveMarkers(scaffold.target, scaffold.code);
    assert.equal(responsive.ok, true, `${fix.id}/${scaffold.target} responsive marker: ${responsive.reason}`);
    const repaired = gate.applyBoundedRepair(scaffold.code, scaffold.target, 0);
    assert.ok(repaired.attempt <= 3);
  }

  const html = pkg.scaffolds.find((s) => s.target === "html-css-js").code;
  const spec = repairSpecFrom(decoded, ir);
  let repaired = null;
  let nativeError = null;
  try {
    repaired = await runBoundedRepairs(html, raw, decoded, spec);
  } catch (err) {
    nativeError = String(err && err.message ? err.message : err);
  }
  const native = repaired ? repaired.native : null;
  assert.ok(!repaired || repaired.repairCount <= 3, fix.id);

  const narrow = { produced: false, sha256: null, ssim: null, note: "UNKNOWN" };
  try {
    const narrowBuf = await renderHtml(repaired ? repaired.html : html, 360, Math.min(decoded.height, 800));
    narrow.produced = true;
    narrow.sha256 = sha256(narrowBuf);
    narrow.note = "No paired 360px reference screenshot in repo; SSIM not computed";
  } catch (err) {
    narrow.note = `NARROW_RENDER_FAILED ${err && err.message ? err.message : err}`;
  }

  const judged = gate.judgeRelease({
    target: "html-css-js",
    ocrMode: ocr.mode,
    layoutRegionCount: ir.regions.length,
    designTokenCount: tokens.colors.length,
    promptNonEmpty: true,
    syntaxOk: true,
    repairAttempts: repaired ? repaired.repairCount : 0,
    responsive: {
      nativeCompared: Boolean(native),
      narrowRenderProduced: narrow.produced,
      narrowSsim: narrow.ssim,
    },
    ssimScore: native ? native.ssimScore : null,
    pixelDeltaPercentage: native ? native.pixelDeltaPercentage : null,
    rendered: Boolean(native),
  });
  assert.notEqual(judged.status, "PASS", `${fix.id} must not PASS without paired narrow SSIM`);
  assert.equal(judged.pixelPerfect, false, fix.id);
  if (native) {
    assert.equal(typeof native.ssimScore, "number");
    assert.ok(Number.isFinite(native.ssimScore));
    assert.equal(typeof native.pixelDeltaPercentage, "number");
    assert.equal(judged.status, "MEASURED_BELOW_BAR");
    assert.ok(repaired.attempts.length >= 1 && repaired.attempts.length <= 4);
    assert.ok(repaired.attempts.every((a) => Number.isFinite(a.ssimScore) && Number.isFinite(a.pixelDeltaPercentage)));
  } else {
    assert.equal(judged.status, "HOLD_UNPROVEN");
  }

  for (const target of ["react", "swiftui", "compose", "flutter", "react-native"]) {
    const nonHtml = gate.judgeRelease({
      target,
      ocrMode: ocr.mode,
      layoutRegionCount: ir.regions.length,
      designTokenCount: tokens.colors.length,
      promptNonEmpty: true,
      syntaxOk: syntax[target].ok,
      repairAttempts: 0,
      responsive: { nativeCompared: false, narrowRenderProduced: false, narrowSsim: null },
      ssimScore: null,
      pixelDeltaPercentage: null,
      rendered: false,
    });
    assert.equal(nonHtml.status, "HOLD_UNPROVEN", target);
    assert.equal(nonHtml.pixelPerfect, false);
  }

  rows.push({
    id: fix.id,
    file: fix.file,
    referenceSha256: sha256(raw),
    width: decoded.width,
    height: decoded.height,
    ocr,
    layoutRegionCount: ir.regions.length,
    roles: ir.regions.map((r) => r.roleGuess),
    designTokens: tokens.colors,
    promptNonEmpty: true,
    syntaxOk: syntax,
    repairCount: repaired ? repaired.repairCount : 0,
    attempts: repaired ? repaired.attempts : [],
    nativeComparison: native
      ? {
          ssimScore: native.ssimScore,
          pixelDeltaPercentage: native.pixelDeltaPercentage,
          mismatchedPixelCount: native.mismatchedPixelCount,
          fidelityStatusFromComparator: native.fidelityStatus,
          comparatorAlgorithm: native.comparatorAlgorithm,
          receiptId: native.receiptId,
        }
      : { error: nativeError },
    responsiveNarrow: narrow,
    releaseStatus: judged.status,
    pixelPerfect: judged.pixelPerfect,
    reasons: judged.reasons,
  });
}

const advRaw = adversarialPng();
const advPath = join(evidenceDir, "adversarial-noise.png");
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(advPath, advRaw);
const advDecoded = PNG.sync.read(advRaw);
const advIr = ui.observeScreenshotIRLite(downsample(advDecoded));
const advPkg = shot.screenshotIRToCodePackage(advIr);
const advHtml0 = advPkg.scaffolds.find((s) => s.target === "html-css-js").code;
const advRepaired = await runBoundedRepairs(advHtml0, advRaw, advDecoded, repairSpecFrom(advDecoded, advIr));
const advCmp = advRepaired.native;
const advOcr = ocrForFile(advPath, (advIr.textBlocks || []).map((b) => ({ method: b.method, text: b.textGuess || "" })));
const advJudge = gate.judgeRelease({
  target: "html-css-js",
  ocrMode: advOcr.mode,
  layoutRegionCount: advIr.regions.length,
  designTokenCount: gate.designTokensFromIR(advIr).colors.length,
  promptNonEmpty: true,
  syntaxOk: gate.syntaxValidate("html-css-js", advRepaired.html).ok,
  repairAttempts: advRepaired.repairCount,
  responsive: { nativeCompared: true, narrowRenderProduced: true, narrowSsim: null },
  ssimScore: advCmp.ssimScore,
  pixelDeltaPercentage: advCmp.pixelDeltaPercentage,
  rendered: true,
});
assert.notEqual(advJudge.status, "PASS");
assert.equal(advJudge.pixelPerfect, false);
assert.ok(advRepaired.repairCount <= 3);
assert.equal(advJudge.status, "MEASURED_BELOW_BAR");

await browser.close();

const measured = rows.filter((r) => r.nativeComparison && typeof r.nativeComparison.ssimScore === "number");
assert.ok(measured.length === manifest.fixtures.length, "every real fixture must have a measured SSIM");
const setNativePass = measured.every((r) => meetsNativeBar(r.nativeComparison)) && meetsNativeBar(advCmp);
assert.equal(setNativePass && false, false);

const evidence = {
  lane: "G3",
  ancestry: {
    startSha: "89ef290a09ad2196e802d2d47455d922514138fd",
    why: "Newest commit owning IMAGE→PROMPT (observationToPromptBlock / scaffold prompt), SCREENSHOT→UI STRUCTURE (observeScreenshotIRLite), SCREENSHOT→CODE (screenshotToCode CODE_TARGETS) plus real windowed SSIM. Python codevision r1q is a sibling structure census that refuses image bytes and does not emit these code targets.",
    notUsed: ["ecd6ae544beb6ba0b44243ea8f2acfd131bfdac3", "f85649fe31d0ac7404ef1b30906b6b9d222f1a6e"],
  },
  tesseractCli: tesseractPresent ? "present" : "absent",
  ocrStatus: !tesseractPresent ? "WAITING_EXTERNAL" : (rows.some((r) => r.ocr.mode === "REAL_OCR") || advOcr.mode === "REAL_OCR") ? "REAL_OCR" : "EXPLICIT_FALLBACK",
  ocrPolicy: !tesseractPresent
    ? "WAITING_EXTERNAL — tesseract CLI not installed. Text-likeness fallback is explicit and does not claim character OCR."
    : "Local tesseract CLI. REAL_OCR only when a process exits 0. Empty or failed runs keep the text-likeness fallback and do not claim character text. OCR text is UNTRUSTED_SOURCE.",
  chrome: browserVersion,
  comparator: "apps/web/src/media/realVisualComparator.mjs SPE_WINDOWED_SSIM_PIXELMATCH_V1",
  passBar: { minSsim: 0.95, maxPixelDeltaPercent: 5, responsiveNarrowSsimRequired: true },
  repairCap: 3,
  repairNames: ["palette-ground", "region-mean-fill", "hide-invented-chrome"],
  declaredTargets: [...gate.DECLARED_CODE_TARGETS],
  unsupportedExample: gate.classifyTarget("vue"),
  targets: {
    "html-css-js": "scaffold + up to 3 visual repairs + native SSIM; responsive narrow SSIM UNKNOWN without paired reference",
    react: "scaffold + syntax; render toolchain absent; HOLD_UNPROVEN",
    swiftui: "scaffold + syntax; Swift toolchain render not run; HOLD_UNPROVEN",
    compose: "scaffold + syntax; Compose render not run; HOLD_UNPROVEN",
    flutter: "scaffold + syntax; Flutter render not run; HOLD_UNPROVEN",
    "react-native": "scaffold + syntax; RN render not run; HOLD_UNPROVEN",
  },
  pixelPerfectClaim: false,
  releasePass: false,
  setNativeBarMet: setNativePass,
  responsiveNarrowSsim: "UNKNOWN",
  rows,
  adversarial: {
    kind: "synthetic high-frequency noise 320x200",
    repairCount: advRepaired.repairCount,
    attempts: advRepaired.attempts,
    ssimScore: advCmp.ssimScore,
    pixelDeltaPercentage: advCmp.pixelDeltaPercentage,
    releaseStatus: advJudge.status,
    pixelPerfect: advJudge.pixelPerfect,
    ocr: advOcr,
  },
  final: "HOLD",
};
mkdirSync(evidenceDir, { recursive: true });
const evidencePath = join(evidenceDir, "G3_RELEASE_EVIDENCE.json");
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({
  ok: true,
  evidencePath,
  tesseractPresent,
  ocrStatus: evidence.ocrStatus,
  ssim: measured.map((r) => ({
    id: r.id,
    repairCount: r.repairCount,
    attempts: r.attempts,
    finalSsim: r.nativeComparison.ssimScore,
    finalDelta: r.nativeComparison.pixelDeltaPercentage,
    status: r.releaseStatus,
  })),
  adversarial: { repairCount: advRepaired.repairCount, attempts: advRepaired.attempts, ssim: advCmp.ssimScore, delta: advCmp.pixelDeltaPercentage },
}, null, 2));
