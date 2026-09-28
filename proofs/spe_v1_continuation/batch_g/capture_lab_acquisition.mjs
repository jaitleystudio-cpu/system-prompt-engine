#!/usr/bin/env node
/** Batch G: capture /daily-lab + Create provenance after Open in SPE. */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../../..");
const dist = join(repo, "apps/web/dist");
const tip = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repo,
  encoding: "utf8",
}).trim();
const chrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mime = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
};

mkdirSync(here, { recursive: true });

const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath =
    pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  let file = join(dist, relativePath);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(dist, "index.html");
  }
  response.writeHead(200, {
    "Content-Type": mime[extname(file)] || "application/octet-stream",
  });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(4197, "127.0.0.1", resolve));

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

const shots = [];
async function shot(page, name) {
  const path = join(here, name);
  await page.screenshot({ path, fullPage: true });
  const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
  shots.push({ name, sha256, bytes: statSync(path).size });
}

async function openLab(context, { width, height, colorScheme, url }) {
  await context.addInitScript((theme) => {
    localStorage.setItem("spe-theme", theme);
  }, colorScheme === "light" ? "light" : "dark");
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#lab-title", { timeout: 20000 });
  // Give lazy LabStage a moment; don't fail if canvas slow
  await page.waitForTimeout(2500);
  return page;
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    serviceWorkers: "block",
  });
  const page = await openLab(context, {
    width: 1440,
    height: 1000,
    colorScheme: "dark",
    url: "http://127.0.0.1:4197/daily-lab?specimen=d3d-01",
  });
  await shot(page, "daily-lab-dark.png");
  await page.getByRole("button", { name: /Open in SPE/i }).first().click();
  await page.waitForSelector(".spe-acquisition-chip", { timeout: 15000 });
  await page.waitForSelector("#create-title", { timeout: 10000 });
  await page.waitForTimeout(800);
  await shot(page, "create-from-lab-provenance.png");
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
    serviceWorkers: "block",
  });
  const page = await openLab(context, {
    width: 1440,
    height: 1000,
    colorScheme: "light",
    url: "http://127.0.0.1:4197/daily-lab",
  });
  await shot(page, "daily-lab-light.png");
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    colorScheme: "dark",
    serviceWorkers: "block",
  });
  const page = await openLab(context, {
    width: 393,
    height: 852,
    colorScheme: "dark",
    url: "http://127.0.0.1:4197/daily-lab",
  });
  await shot(page, "daily-lab-mobile.png");
  await context.close();
}

await browser.close();
server.close();

const manifest = {
  tipAtCapture: tip,
  route: "/daily-lab",
  shots,
  notes: [
    "daily-lab dark/light/mobile",
    "create-from-lab-provenance shows From Daily Lab chip after Open in SPE",
  ],
};
writeFileSync(join(here, "screenshot-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
