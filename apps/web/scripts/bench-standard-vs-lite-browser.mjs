/**
 * Browser STANDARD vs LITE bench — loads ORT WASM + MobileNet INT8 in Chromium.
 */
import { createServer } from "node:http";
import {
  readFileSync,
  existsSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const pub = join(root, "public");
const dist = join(root, "dist");
const fixtures = join(root, "scripts/fixtures");
const outPath = join(repo, "proofs/spe_v1_launch/standard_vs_lite_browser_bench.json");

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".txt": "text/plain",
  ".json": "application/json",
  ".md": "text/markdown",
};

function resolve(urlPath) {
  const path = urlPath.replace(/^\//, "");
  for (const base of [fixtures, pub, dist]) {
    const c = join(base, path);
    if (existsSync(c) && !statSync(c).isDirectory()) return c;
  }
  return null;
}

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/vision-bench.html";
    const file = resolve(path);
    if (!file) {
      res.writeHead(404);
      res.end("missing " + path);
      return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4188, "127.0.0.1", () => r(server)));
}

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
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("console:", msg.text());
  });
  await page.goto("http://127.0.0.1:4188/vision-bench.html", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(
    () => window.__SPE_VISION_BENCH__ && typeof window.__SPE_VISION_BENCH__.ok === "boolean",
    null,
    { timeout: 180000 },
  );
  payload = await page.evaluate(() => window.__SPE_VISION_BENCH__);
} catch (e) {
  payload = {
    ok: false,
    mode: "browser-onnx-bench",
    onnxRuntimeInvoked: false,
    error: String(e && e.message ? e.message : e),
    rows: [],
  };
} finally {
  await browser.close();
  server.close();
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(
  JSON.stringify(
    {
      wrote: outPath,
      onnxRuntimeInvoked: payload?.onnxRuntimeInvoked ?? false,
      improvedCount: payload?.improvedCount,
      noGainCount: payload?.noGainCount,
      ok: payload?.ok,
      error: payload?.error || payload?.onnxError || null,
    },
    null,
    2,
  ),
);
if (!payload?.ok) process.exitCode = 1;
