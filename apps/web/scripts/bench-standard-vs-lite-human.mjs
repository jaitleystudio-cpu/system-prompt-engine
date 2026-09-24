/**
 * Human-grounded STANDARD vs LITE vision bench on REAL photos.
 * DROPS invalid prior metric (MobileNet conf>=0.05 AND STANDARD chars > LITE+40).
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const pub = join(root, "public");
const dist = join(root, "dist");
const fixturesDir = join(repo, "proofs/spe_v1_launch/vision_fixtures");
const expected = JSON.parse(readFileSync(join(fixturesDir, "expected_labels.json"), "utf8"));
const outPath = join(repo, "proofs/spe_v1_launch/standard_vs_lite_human_bench.json");
const harnessPath = join(root, "scripts/fixtures/vision-human-bench.html");

const mime = {
  ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".wasm": "application/wasm", ".onnx": "application/octet-stream",
  ".txt": "text/plain", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".md": "text/markdown",
};

function resolve(urlPath) {
  const path = urlPath.replace(/^\//, "");
  for (const base of [fixturesDir, join(root, "scripts/fixtures"), pub, dist]) {
    const c = join(base, path);
    if (existsSync(c) && !statSync(c).isDirectory()) return c;
  }
  return null;
}

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/vision-human-bench.html";
    const file = resolve(path);
    if (!file) { res.writeHead(404); res.end("missing " + path); return; }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4189, "127.0.0.1", () => r(server)));
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s) { return new Set(norm(s).split(" ").filter((t) => t.length > 2)); }
function labelMatches(subject, candidates) {
  const subj = norm(subject);
  const st = tokens(subject);
  for (const c of candidates) {
    const cn = norm(c);
    if (!cn) continue;
    if (subj === cn || subj.includes(cn) || cn.includes(subj)) return true;
    const ct = tokens(c);
    let overlap = 0;
    for (const t of ct) if (st.has(t)) overlap++;
    if (overlap > 0 && overlap >= Math.min(2, ct.size)) return true;
  }
  return false;
}

function scoreRow(fixture, subjects, litePrompt, standardPrompt) {
  const important = fixture.important || [];
  const acceptable = fixture.acceptable || [];
  const tolerated = fixture.tolerated_imagenet_near_misses || [];
  const forbid = fixture.forbid_confident || [];
  const pool = [...important, ...acceptable, ...tolerated];
  const list = (subjects || []).map((s) => (typeof s === "string" ? { label: s, score: 0 } : s));
  const correct = [], hallucinated = [];
  for (const s of list) {
    if (labelMatches(s.label, pool)) correct.push(s);
    else hallucinated.push(s);
  }
  const missedImportant = important.filter((lab) => !list.some((s) => labelMatches(s.label, [lab])));
  const forbiddenHits = list.filter((s) => (s.score || 0) >= 0.08 && labelMatches(s.label, forbid));
  const top = list[0];
  const confidenceCalibration = {
    topLabel: top?.label || null,
    topScore: top?.score || 0,
    topIsCorrect: top ? labelMatches(top.label, pool) : false,
    overconfidentWrong: !!(top && (top.score || 0) >= 0.15 && !labelMatches(top.label, pool)),
  };
  const promptUseful = correct.length >= 1 && hallucinated.length <= correct.length && forbiddenHits.length === 0;
  let verdict = "LITE_PREFERRED_OR_EQUAL";
  if (promptUseful && correct.length > hallucinated.length) verdict = "STANDARD_MORE_USEFUL";
  else if (hallucinated.length > correct.length || forbiddenHits.length) verdict = "STANDARD_HARMFUL_OR_NOISY";
  else if (!list.length) verdict = "STANDARD_EMPTY_LITE_OK";
  const invalidLengthHeuristic =
    list.some((s) => (s.score || 0) >= 0.05) && (standardPrompt || "").length > (litePrompt || "").length + 40;
  return {
    id: fixture.id,
    correctLabels: correct.map((s) => s.label),
    missedImportant,
    hallucinatedLabels: hallucinated.map((s) => s.label),
    forbiddenHits: forbiddenHits.map((s) => s.label),
    confidenceCalibration,
    promptUseful,
    verdict,
    liteChars: (litePrompt || "").length,
    standardChars: (standardPrompt || "").length,
    invalidLengthHeuristicWouldHaveClaimedImprove: invalidLengthHeuristic,
  };
}

const fixtureMeta = expected.fixtures.map((f) => ({ id: f.id, file: f.file }));
mkdirSync(dirname(harnessPath), { recursive: true });
writeFileSync(
  harnessPath,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>SPE human vision bench</title></head>
<body><pre id="out">boot…</pre>
<script src="/vendor/ort.wasm.min.js"></script>
<script>
const out = document.getElementById("out");
const log = (x) => { out.textContent = typeof x === "string" ? x : JSON.stringify(x, null, 2); };
const FIXTURES = ${JSON.stringify(fixtureMeta)};

function liteSummary(img) {
  const { data, width, height } = img;
  let sum = 0, dark = 0, light = 0, n = 0;
  for (let y = 0; y < height; y += 8) for (let x = 0; x < width; x += 8) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 16) continue;
    const b = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    sum += b; n++; if (b < 64) dark++; if (b > 200) light++;
  }
  const mean = n ? sum / n : 0;
  return {
    prompt: "LITE observation: brightness≈" + mean.toFixed(0) +
      ", darkShare=" + (n ? dark / n : 0).toFixed(2) +
      ", lightShare=" + (n ? light / n : 0).toFixed(2) +
      ". Subjects: (none — structure/pixel only). Observation only, not verified fact.",
  };
}

async function loadImageData(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const c = document.createElement("canvas");
  c.width = 224; c.height = 224;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 224, 224);
  return ctx.getImageData(0, 0, 224, 224);
}

async function runStandard(img) {
  const ort = globalThis.ort;
  if (!ort) throw new Error("ort global missing");
  if (ort.env?.wasm) { ort.env.wasm.wasmPaths = "/ort/"; ort.env.wasm.numThreads = 1; }
  const modelBuf = await fetch("/models/mobilenetv2-12-int8.onnx").then((r) => {
    if (!r.ok) throw new Error("model HTTP " + r.status);
    return r.arrayBuffer();
  });
  const labels = (await fetch("/models/imagenet_classes.txt").then((r) => r.text())).split("\\n").map((l) => l.trim()).filter(Boolean);
  const session = await ort.InferenceSession.create(modelBuf, { executionProviders: ["wasm"] });
  const size = 224, mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const tensor = new Float32Array(1 * 3 * size * size);
  const px = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.min(img.width - 1, Math.floor((x * img.width) / size));
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / size));
    const i = (sy * img.width + sx) * 4;
    const a = px[i + 3] / 255;
    const r = (px[i] / 255) * a + (1 - a);
    const g = (px[i + 1] / 255) * a + (1 - a);
    const b = (px[i + 2] / 255) * a + (1 - a);
    const idx = y * size + x;
    tensor[0 * size * size + idx] = (r - mean[0]) / std[0];
    tensor[1 * size * size + idx] = (g - mean[1]) / std[1];
    tensor[2 * size * size + idx] = (b - mean[2]) / std[2];
  }
  const feeds = {}; feeds[session.inputNames[0]] = new ort.Tensor("float32", tensor, [1, 3, 224, 224]);
  const result = await session.run(feeds);
  const logits = result[session.outputNames[0]].data;
  let max = -Infinity; for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]);
  const exps = new Float32Array(logits.length); let sum = 0;
  for (let i = 0; i < logits.length; i++) { const v = Math.exp(logits[i] - max); exps[i] = v; sum += v; }
  const scored = []; for (let i = 0; i < exps.length; i++) scored.push({ i, p: exps[i] / sum });
  scored.sort((a, b) => b.p - a.p);
  const top = scored.slice(0, 5).map((s) => ({ label: labels[s.i] || ("class_" + s.i), score: Math.round(s.p * 1000) / 1000 }));
  return {
    subjects: top,
    prompt: "STANDARD observation (on-device classifier judgment): subjects=" +
      top.map((t) => t.label + "(" + t.score + ")").join(", ") +
      ". Use as observation only — never verified fact.",
  };
}

(async () => {
  const rows = [];
  let onnxRuntimeInvoked = false, onnxError = null;
  try {
    await runStandard(await loadImageData("/" + FIXTURES[0].file));
    onnxRuntimeInvoked = true;
  } catch (e) { onnxError = String(e && e.message ? e.message : e); }
  for (const fix of FIXTURES) {
    const img = await loadImageData("/" + fix.file);
    const lite = liteSummary(img);
    let standard = { prompt: lite.prompt, subjects: [] };
    if (onnxRuntimeInvoked) {
      try { standard = await runStandard(img); }
      catch (e) { standard = { prompt: lite.prompt, subjects: [], error: String(e && e.message ? e.message : e) }; }
    }
    rows.push({ id: fix.id, file: fix.file, litePrompt: lite.prompt, standardPrompt: standard.prompt, standardSubjects: standard.subjects || [], error: standard.error || null });
  }
  window.__SPE_HUMAN_VISION_BENCH__ = { ok: true, mode: "human-grounded-real-images", onnxRuntimeInvoked, onnxError, rows };
  log(window.__SPE_HUMAN_VISION_BENCH__);
})().catch((e) => {
  window.__SPE_HUMAN_VISION_BENCH__ = { ok: false, mode: "human-grounded-real-images", onnxRuntimeInvoked: false, error: String(e && e.message ? e.message : e), rows: [] };
  log(window.__SPE_HUMAN_VISION_BENCH__);
});
</script></body></html>`,
);

const server = await startServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
let payload = null;
try {
  page.on("pageerror", (err) => console.error("pageerror:", err.message));
  await page.goto("http://127.0.0.1:4189/vision-human-bench.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__SPE_HUMAN_VISION_BENCH__ && typeof window.__SPE_HUMAN_VISION_BENCH__.ok === "boolean", null, { timeout: 180000 });
  payload = await page.evaluate(() => window.__SPE_HUMAN_VISION_BENCH__);
} catch (e) {
  payload = { ok: false, mode: "human-grounded-real-images", onnxRuntimeInvoked: false, error: String(e && e.message ? e.message : e), rows: [] };
} finally {
  await browser.close();
  server.close();
}

const scored = [];
let standardMoreUseful = 0, standardHarmful = 0, litePreferred = 0, invalidHeuristicTrueCount = 0;
for (const raw of payload.rows || []) {
  const fixture = expected.fixtures.find((f) => f.id === raw.id);
  if (!fixture) continue;
  const row = scoreRow(fixture, raw.standardSubjects, raw.litePrompt, raw.standardPrompt);
  row.standardSubjects = raw.standardSubjects;
  scored.push(row);
  if (row.verdict === "STANDARD_MORE_USEFUL") standardMoreUseful++;
  else if (row.verdict === "STANDARD_HARMFUL_OR_NOISY") standardHarmful++;
  else litePreferred++;
  if (row.invalidLengthHeuristicWouldHaveClaimedImprove) invalidHeuristicTrueCount++;
}

const report = {
  ok: Boolean(payload.ok) && scored.length === expected.fixtures.length,
  mode: "human-grounded-real-images",
  onnxRuntimeInvoked: payload.onnxRuntimeInvoked || false,
  onnxError: payload.onnxError || payload.error || null,
  invalidPriorMetric: "DROPPED: MobileNet conf>=0.05 AND STANDARD chars > LITE+40 (counted nonsense as improved)",
  invalidHeuristicWouldHaveClaimedImproveCount: invalidHeuristicTrueCount,
  summary: {
    fixtureCount: scored.length,
    standardMoreUseful,
    standardHarmfulOrNoisy: standardHarmful,
    litePreferredOrEqual: litePreferred,
    honestClaim:
      standardMoreUseful > standardHarmful
        ? "STANDARD helps on some fixtures — see rows; never claim blanket improve from length"
        : "STANDARD does not reliably beat LITE on human-grounded labels for this fixture set",
  },
  rows: scored,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ wrote: outPath, ok: report.ok, onnxRuntimeInvoked: report.onnxRuntimeInvoked, summary: report.summary, invalidHeuristicWouldHaveClaimedImproveCount: invalidHeuristicTrueCount }, null, 2));
if (!report.ok) process.exitCode = 1;
