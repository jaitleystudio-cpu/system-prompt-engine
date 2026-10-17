#!/usr/bin/env node
/**
 * Hero rethink continuous composition captures.
 * HOSTING FORBIDDEN. WORLD#1 NOT_PROVEN.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
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
const PORT = Number(process.env.SPE_CAPTURE_PORT || 4217);
const baseUrl = `http://127.0.0.1:${PORT}`;
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

if (!existsSync(join(dist, "index.html"))) {
  throw new Error(`Missing ${dist}/index.html — build apps/web first`);
}
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
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

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

async function openPage({ theme, width, height, reducedMotion = "no-preference" }) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion,
    colorScheme: theme,
    deviceScaleFactor: 1,
  });
  await context.addInitScript((selectedTheme) => {
    localStorage.setItem("spe-theme", selectedTheme);
  }, theme);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".hero-story");
  await page.evaluate((m) => {
    document.documentElement.dataset.theme = m;
  }, theme);
  await page.waitForTimeout(400);
  return { context, page };
}

async function capture(name, opts) {
  const { context, page } = await openPage(opts);
  const path = join(here, name);
  await page.screenshot({ path, fullPage: false });
  const st = statSync(path);
  shots.push({
    name,
    bytes: st.size,
    viewport: `${opts.width}x${opts.height}`,
    theme: opts.theme,
    reducedMotion: opts.reducedMotion || "no-preference",
  });
  console.log("SHOT", name, st.size);
  await context.close();
}

await capture("home-hero-dark-desktop.png", {
  theme: "dark",
  width: 1440,
  height: 900,
});
await capture("home-hero-light-desktop.png", {
  theme: "light",
  width: 1440,
  height: 900,
});
await capture("home-hero-dark-mobile.png", {
  theme: "dark",
  width: 390,
  height: 844,
});
await capture("home-hero-light-mobile.png", {
  theme: "light",
  width: 390,
  height: 844,
});

{
  const { context, page } = await openPage({
    theme: "dark",
    width: 1440,
    height: 900,
    reducedMotion: "reduce",
  });
  const control = (await page.locator(".motion-button").innerText()).trim();
  if (control !== "Reduced motion") {
    throw new Error(`Reduced-motion control mismatch: ${control}`);
  }
  const path = join(here, "home-hero-dark-desktop-reduced-motion.png");
  await page.screenshot({ path, fullPage: false });
  const st = statSync(path);
  shots.push({
    name: "home-hero-dark-desktop-reduced-motion.png",
    bytes: st.size,
    viewport: "1440x900",
    theme: "dark",
    reducedMotion: "reduce",
    motionControl: control,
  });
  console.log("SHOT reduced-motion", st.size, control);
  await context.close();
}

const manifest = {
  tipShaAtCapture: tip,
  note: "Bound after commit via re-run or SHA rewrite in report tip.",
  captures: shots,
  story: "IDEA → MEANING → SPE → STRUCTURE → PROMPT",
  motion:
    "CSS/SVG motion present; reduced-motion verified via control label and capture. Do not claim 10/10 craft from motion alone.",
};
writeFileSync(
  join(here, "screenshot-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

await browser.close();
server.close();
console.log("DONE", tip);
