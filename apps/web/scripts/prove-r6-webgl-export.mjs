#!/usr/bin/env node
/**
 * Headless Chrome proof of the exported SceneIR page.
 * Serves the materialized export over static HTTP. Does not start Vite.
 * Does not set a product PASS constant.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { chromium } from "playwright";
import { materializeSceneExport } from "../src/engine/multimodal/materializeSceneExport.mjs";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");
const proofDir = join(repoRoot, "proofs/r6-webgl-20261004");
const exportDir = join(tmpdir(), "spe-r6-webgl-export");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const scene = {
  sceneVersion: "scene-ir/1",
  title: "Quantum Accelerator Landing",
  theme: "dark",
  camera: {
    type: "perspective",
    fov: 60,
    position: [0, 2, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 1000,
  },
  environment: {
    backgroundColor: "#05070a",
    fogColor: "#05070a",
    fogDensity: 0.04,
  },
  lighting: [
    { id: "ambient", type: "ambient", color: "#ffffff", intensity: 0.6 },
    {
      id: "key",
      type: "directional",
      color: "#818cf8",
      intensity: 1.2,
      position: [5, 10, 5],
      castShadow: false,
    },
  ],
  objects: [
    {
      id: "hero-orb",
      name: "Central Core",
      geometry: { type: "sphere", parameters: { radius: 1.5 } },
      material: { type: "standard", color: "#6366f1", roughness: 0.2, metalness: 0.8 },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1.6, 1.6, 1.6],
    },
  ],
  scrollTracks: [
    {
      objectId: "hero-orb",
      property: "rotation.y",
      startScrollRatio: 0,
      endScrollRatio: 1,
      fromValue: 0,
      toValue: 6.28,
    },
  ],
  performanceBudget: { maxDpr: 1, maxDrawCalls: 50, maxTriangles: 10000, targetFps: 60 },
  accessibilityFallback: {
    hero2dSvg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='18' fill='#6366f1'/></svg>",
    textDescription: "A central quantum orb that rotates as you scroll.",
    ariaRegionLabel: "Interactive 3D Quantum Scene",
  },
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(sig)) throw new Error("not a png");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png ${bitDepth}/${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4);
  let inPos = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[inPos++];
    const row = Buffer.from(raw.subarray(inPos, inPos + stride));
    inPos += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i];
      const upLeft = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`bad png filter ${filter}`);
    }
    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      out[dst] = row[src];
      out[dst + 1] = row[src + 1];
      out[dst + 2] = row[src + 2];
      out[dst + 3] = channels === 4 ? row[src + 3] : 255;
    }
    prev = row;
  }
  return { width, height, rgba: out };
}

function analyzeRgba(rgba, width, height) {
  let nonClear = 0;
  let nearBackground = 0;
  let nearIndigo = 0;
  let minLum = 255;
  let maxLum = 0;
  const buckets = new Set();
  const sampled = width * height;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const dBg = Math.abs(r - 5) + Math.abs(g - 7) + Math.abs(b - 10);
    const dInd = Math.abs(r - 99) + Math.abs(g - 102) + Math.abs(b - 241);
    if (dBg > 18) nonClear += 1;
    if (dBg <= 30) nearBackground += 1;
    if (dInd <= 140) nearIndigo += 1;
    const lum = (r + g + b) / 3;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4}`);
  }
  return {
    width,
    height,
    sampled,
    nonClearPixels: nonClear,
    nearBackground,
    nearIndigo,
    uniqueColorBuckets: buckets.size,
    minLum,
    maxLum,
    notClearOnly: nonClear >= 50 && nearIndigo >= 50 && nearBackground >= 50 && buckets.size >= 4,
  };
}

function startServer(rootDir) {
  const root = resolve(rootDir);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel == "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(root, rel));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    let body;
    try {
      body = readFileSync(file);
    } catch {
      console.error("STATIC_404", rel);
      res.writeHead(404);
      res.end("missing");
      return;
    }
    const type = extname(file) === ".js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

function watch(page, bucket) {
  page.on("console", (msg) => bucket.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (error) => bucket.push({ type: "pageerror", text: String(error) }));
}

async function readExport(page) {
  await page.waitForSelector("html[data-scene-settled='1']", { timeout: 20000 });
  return page.evaluate(() => {
    const root = document.documentElement;
    const canvas = document.querySelector("canvas");
    const attr = (name) => root.getAttribute(name);
    return {
      webglExecution: attr("data-webgl-execution"),
      exportExecution: window.__SPE_EXPORT_EXECUTION ?? null,
      threeVersion: attr("data-three-version"),
      threeSha256: attr("data-three-sha256"),
      threeRevision: attr("data-three-revision"),
      contextCreated: attr("data-context-created"),
      sceneCreated: attr("data-scene-created"),
      nonClearPixels: Number(attr("data-non-clear-pixels") || 0),
      sampledPixels: Number(attr("data-sampled-pixels") || 0),
      reducedMotion: attr("data-reduced-motion"),
      fallbackShown: attr("data-fallback-shown"),
      unavailableHonest: attr("data-unavailable-honest"),
      threeMissing: attr("data-three-missing"),
      canvasCount: document.querySelectorAll("canvas").length,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      getContextCalls: window.__SPE_GET_CONTEXT_CALLS || {},
      importError: window.__SPE_THREE_IMPORT_ERROR || null,
      webglError: window.__SPE_WEBGL_ERROR || null,
      dataUrl: canvas ? canvas.toDataURL("image/png") : null,
    };
  });
}

async function withContextCounter(page) {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, attrs) {
      const bag = (window.__SPE_GET_CONTEXT_CALLS = window.__SPE_GET_CONTEXT_CALLS || {});
      const key = String(kind);
      bag[key] = (bag[key] || 0) + 1;
      return orig.call(this, kind, attrs);
    };
  });
}

const flow = readFileSync(join(webRoot, "src/website/productFlow.ts"), "utf8");
const compiler = readFileSync(join(webRoot, "src/engine/multimodal/sceneCompiler.ts"), "utf8");
const ledger = readFileSync(join(webRoot, "src/shell/mountStatus.ts"), "utf8");
const gates = {
  productWebglExecution: /export const WEBGL_EXECUTION = "NOT_RUN"/.test(flow) ? "NOT_RUN" : "MOVED",
  productNotPass: !/WEBGL_EXECUTION = "PASS"/.test(flow) && !/SCENE_3D = "PASS"/.test(flow),
  compilerWebglExecution: /webglExecution:\s*"NOT_RUN"/.test(compiler) ? "NOT_RUN" : "MOVED",
  compilerThreeVersion: /EXPORT_THREE_VERSION = "0\.170\.0"/.test(compiler) ? "0.170.0" : "MOVED",
  ledgerWebglExecution: /WEBGL_EXECUTION:\s*"NOT_RUN"/.test(ledger) ? "NOT_RUN" : "MOVED",
  ledgerNotPass: !/WEBGL_EXECUTION:\s*"PASS"/.test(ledger) && !/SCENE3D:\s*"PASS"/.test(ledger),
};

const evidence = {
  surface: "export-page",
  server: "static-http-not-vite",
  gates,
  pin: null,
  executed: null,
  pixels: null,
  reducedMotion: null,
  unavailable: null,
  consoleErrors: {},
  framePng: null,
  frameSha256: null,
  exportExecution: "NOT_RUN",
};

let exitCode = 1;
let server;
try {
  const materialized = materializeSceneExport(exportDir, scene);
  evidence.pin = materialized.pin;
  if (materialized.manifest.webglExecution !== "NOT_RUN") {
    throw new Error("export manifest claimed execution before Chrome");
  }
  server = await startServer(exportDir);
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/index.html`;
  evidence.urlShape = "static index.html";

  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--use-angle=metal"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs = [];
  watch(page, logs);
  await withContextCounter(page);
  await page.goto(url, { waitUntil: "networkidle" });
  const executed = await readExport(page);
  const pngBytes = executed.dataUrl
    ? Buffer.from(executed.dataUrl.split(",")[1], "base64")
    : null;
  delete executed.dataUrl;
  evidence.executed = executed;
  evidence.consoleErrors.executed = logs.filter((entry) => entry.type === "error" || entry.type === "pageerror");
  if (pngBytes) {
    const framePath = join(proofDir, "export-frame.png");
    writeFileSync(framePath, pngBytes);
    evidence.framePng = "proofs/r6-webgl-20261004/export-frame.png";
    evidence.frameSha256 = sha256(pngBytes);
    const decoded = decodePng(pngBytes);
    evidence.pixels = analyzeRgba(decoded.rgba, decoded.width, decoded.height);
  }
  await browser.close();

  const reducedBrowser = await chromium.launch({ executablePath: chrome, headless: true });
  const reduced = await reducedBrowser.newPage({ viewport: { width: 1280, height: 900 } });
  const reducedLogs = [];
  watch(reduced, reducedLogs);
  await withContextCounter(reduced);
  await reduced.emulateMedia({ reducedMotion: "reduce" });
  await reduced.goto(url, { waitUntil: "networkidle" });
  const reducedScene = await readExport(reduced);
  delete reducedScene.dataUrl;
  evidence.reducedMotion = {
    scene: reducedScene,
    consoleErrors: reducedLogs.filter((entry) => entry.type === "error" || entry.type === "pageerror"),
  };
  await reducedBrowser.close();

  const blocked = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-webgl",
      "--disable-webgl2",
      "--disable-3d-apis",
    ],
  });
  const blockedPage = await blocked.newPage({ viewport: { width: 1280, height: 900 } });
  const blockedLogs = [];
  watch(blockedPage, blockedLogs);
  await withContextCounter(blockedPage);
  await blockedPage.goto(url, { waitUntil: "domcontentloaded" });
  const blockedScene = await readExport(blockedPage);
  delete blockedScene.dataUrl;
  evidence.unavailable = {
    scene: blockedScene,
    consoleErrors: blockedLogs.filter((entry) => entry.type === "error" || entry.type === "pageerror"),
  };
  await blocked.close();

  const frameOk =
    evidence.pixels?.notClearOnly === true &&
    evidence.executed.contextCreated === "1" &&
    evidence.executed.sceneCreated === "1" &&
    evidence.executed.threeVersion === "0.170.0" &&
    evidence.executed.threeRevision === "170" &&
    evidence.executed.canvasCount === 1 &&
    Number(evidence.executed.getContextCalls.webgl || evidence.executed.getContextCalls.webgl2 || 0) > 0 &&
    !materialized.compiled.standaloneHtml.includes("putImageData");
  const fallbackOk =
    evidence.reducedMotion.scene.reducedMotion === "1" &&
    evidence.reducedMotion.scene.fallbackShown === "1" &&
    evidence.reducedMotion.scene.webglExecution === "NOT_RUN" &&
    evidence.reducedMotion.scene.contextCreated === "0" &&
    evidence.reducedMotion.scene.canvasCount === 0 &&
    Object.keys(evidence.reducedMotion.scene.getContextCalls).length === 0;
  const unavailableOk =
    evidence.unavailable.scene.webglExecution === "UNAVAILABLE" &&
    evidence.unavailable.scene.contextCreated === "0" &&
    evidence.unavailable.scene.unavailableHonest === "1" &&
    evidence.unavailable.scene.sceneCreated === "0";
  const gatesOk = Object.values(gates).every((value) => value === true || value === "NOT_RUN" || value === "0.170.0");
  evidence.checks = { frameOk, fallbackOk, unavailableOk, gatesOk };
  evidence.exportExecution = frameOk ? "EXECUTED_WITHIN_TESTED_SCOPE" : "NOT_RUN";
  writeFileSync(join(proofDir, "export-execution.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ checks: evidence.checks, pixels: evidence.pixels, exportExecution: evidence.exportExecution, frameSha256: evidence.frameSha256 }, null, 2));
  exitCode = frameOk && fallbackOk && unavailableOk && gatesOk ? 0 : 1;
} catch (error) {
  evidence.fatal = String(error?.stack || error);
  evidence.exportExecution = "NOT_RUN";
  mkdirSync(proofDir, { recursive: true });
  writeFileSync(join(proofDir, "export-execution.json"), JSON.stringify(evidence, null, 2));
  console.error(evidence.fatal);
  exitCode = 1;
} finally {
  if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
}
process.exit(exitCode);
