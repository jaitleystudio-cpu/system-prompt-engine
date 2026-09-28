/**
 * Browser contract: Home quick-start must not silently lose overflow paste.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function ensureBuild() {
  if (existsSync(join(dist, "index.html"))) return;
  await new Promise((resolve, reject) => {
    const p = spawn("npm", ["run", "build"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
  });
}

function startStatic() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let path = url.pathname;
    if (path === "/") path = "/index.html";
    const file = join(dist, path.replace(/^\//, ""));
    if (!file.startsWith(dist) || !existsSync(file)) {
      // SPA fallback
      const index = readFileSync(join(dist, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(index);
      return;
    }
    const body = readFileSync(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] || "application/octet-stream",
    });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function record(cases, name, data) {
  cases.push({ name, ...data });
}

await ensureBuild();
const { server, base } = await startStatic();
const browser = await chromium.launch({ headless: true });
const cases = [];

try {
  const page = await browser.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("#spe-one-line").waitFor({ state: "visible" });

  // Confirm no silent HTML maxLength attribute
  const maxLengthAttr = await page.locator("#spe-one-line").getAttribute("maxLength");
  assert.equal(maxLengthAttr, null);

  async function setBrief(chars) {
    const text = "a".repeat(chars);
    await page.locator("#spe-one-line").fill("");
    await page.locator("#spe-one-line").evaluate((el, value) => {
      const proto = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      );
      proto.set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, text);
    await page.waitForTimeout(50);
    const accepted = await page.locator("#spe-one-line").inputValue();
    const meter = await page.locator("#spe-one-line-meter").innerText();
    const noticeCount = await page.locator(".spe-bound-notice").count();
    const notice =
      noticeCount > 0 ? await page.locator(".spe-bound-notice").innerText() : "";
    return {
      attempted: chars,
      accepted: accepted.length,
      meter,
      notice,
      silentLoss: chars > 20000 && accepted.length < chars && !notice,
    };
  }

  const r19999 = await setBrief(19999);
  assert.equal(r19999.accepted, 19999);
  assert.equal(r19999.silentLoss, false);
  record(cases, "home_19999", r19999);

  const r20000 = await setBrief(20000);
  assert.equal(r20000.accepted, 20000);
  assert.equal(r20000.silentLoss, false);
  record(cases, "home_20000", r20000);

  const r20001 = await setBrief(20001);
  assert.equal(r20001.accepted, 20000);
  assert.ok(r20001.notice.length > 0, "overflow must show a notice");
  assert.equal(r20001.silentLoss, false);
  record(cases, "home_20001", r20001);

  const r100k = await setBrief(100000);
  assert.equal(r100k.accepted, 20000);
  assert.ok(r100k.notice.length > 0);
  assert.equal(r100k.silentLoss, false);
  assert.match(r100k.notice, /Create|100,?000|20,?000/i);
  record(cases, "home_100000", r100k);

  console.log(JSON.stringify({ ok: true, silent_loss: "NO", cases }, null, 2));
} finally {
  await browser.close();
  server.close();
}
