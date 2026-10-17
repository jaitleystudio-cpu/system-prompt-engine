#!/usr/bin/env node
/** Batch F: capture /capabilities dark+light desktop + mobile. */
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
await new Promise((resolve) => server.listen(4196, "127.0.0.1", resolve));

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const shots = [];
async function capture(name, { width, height, colorScheme }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    serviceWorkers: "block",
  });
  await context.addInitScript((theme) => {
    localStorage.setItem("spe-theme", theme);
  }, colorScheme === "light" ? "light" : "dark");
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4196/capabilities", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector("#capabilities-title", { timeout: 15000 });
  const path = join(here, name);
  await page.screenshot({ path, fullPage: true });
  const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
  shots.push({ name, width, height, colorScheme, sha256, bytes: statSync(path).size });
  await context.close();
}

await capture("capabilities-dark.png", {
  width: 1440,
  height: 1000,
  colorScheme: "dark",
});
await capture("capabilities-light.png", {
  width: 1440,
  height: 1000,
  colorScheme: "light",
});
await capture("capabilities-mobile.png", {
  width: 393,
  height: 852,
  colorScheme: "dark",
});

await browser.close();
server.close();

const manifest = {
  tip_at_capture_note:
    "Tip recorded at capture time; final report tip is post-commit HEAD.",
  tip,
  route: "/capabilities",
  shots,
  capturedAt: new Date().toISOString(),
};
writeFileSync(
  join(here, "screenshot-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(manifest, null, 2));
