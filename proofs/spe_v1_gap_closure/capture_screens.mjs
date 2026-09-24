#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("playwright");
import { createServer } from "node:http";
import {
  readFileSync,
  existsSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");
const dist = join(repo, "apps/web/dist");
const pub = join(repo, "apps/web/public");
const outDir = join(here, "screenshots");
mkdirSync(outDir, { recursive: true });

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/index.html";
    let file = join(dist, path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const fromPub = join(pub, path.replace(/^\//, ""));
      if (existsSync(fromPub) && !statSync(fromPub).isDirectory()) file = fromPub;
      else file = join(dist, "index.html");
    }
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4189, "127.0.0.1", () => r(server)));
}

const shots = [];
const server = await startServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4189/", {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: join(outDir, "home-dark.png"),
    fullPage: false,
  });
  shots.push("home-dark.png");

  // Theme → light (cycle: dark→light)
  await page.locator(".spe-theme-toggle").click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(outDir, "home-light.png"),
    fullPage: false,
  });
  shots.push("home-light.png");
  await page.screenshot({
    path: join(outDir, "theme-control.png"),
    fullPage: false,
    clip: { x: 900, y: 0, width: 540, height: 120 },
  });
  shots.push("theme-control.png");

  // Routed URLs
  await page.goto("http://127.0.0.1:4189/create", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.screenshot({
    path: join(outDir, "route-create.png"),
    fullPage: false,
  });
  shots.push("route-create.png");

  await page.goto("http://127.0.0.1:4189/daily-lab", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.screenshot({
    path: join(outDir, "route-daily-lab.png"),
    fullPage: false,
  });
  shots.push("route-daily-lab.png");

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4189/", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: join(outDir, "mobile-home.png"),
    fullPage: false,
  });
  shots.push("mobile-home.png");

  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify({ shots, at: new Date().toISOString() }, null, 2),
  );
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({ ok: true, outDir, shots }));
