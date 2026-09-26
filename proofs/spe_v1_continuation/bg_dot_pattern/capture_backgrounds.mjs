#!/usr/bin/env node
import assert from "node:assert/strict";
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
const artifacts = "/opt/cursor/artifacts";
const baseUrl = "http://127.0.0.1:4193";
const tip = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repo,
  encoding: "utf8",
}).trim();
const mime = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
};

mkdirSync(here, { recursive: true });
mkdirSync(artifacts, { recursive: true });

const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  let file = join(dist, relativePath);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(dist, "index.html");
  }
  response.writeHead(200, {
    "Content-Type": mime[extname(file)] || "application/octet-stream",
  });
  response.end(readFileSync(file));
});
await new Promise((resolve) =>
  server.listen(4193, "127.0.0.1", resolve),
);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

async function openPage({
  path,
  theme,
  viewport,
  reducedMotion = "no-preference",
}) {
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    reducedMotion,
    serviceWorkers: "block",
  });
  await context.addInitScript((selectedTheme) => {
    localStorage.setItem("spe-theme", selectedTheme);
  }, theme);
  const page = await context.newPage();
  await page.goto(`${baseUrl}${path}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector(".spe-dot-pattern");
  const mechanics = await page.locator(".spe-dot-pattern").first().evaluate(
    (pattern) => ({
      ariaHidden: pattern.getAttribute("aria-hidden"),
      pointerEvents: getComputedStyle(pattern).pointerEvents,
      layers: pattern.querySelectorAll("svg").length,
    }),
  );
  assert.deepEqual(mechanics, {
    ariaHidden: "true",
    pointerEvents: "none",
    layers: 3,
  });
  return { context, page };
}

async function capture(page, fileName, artifactName) {
  await page.screenshot({ path: join(here, fileName) });
  await page.screenshot({ path: join(artifacts, artifactName) });
}

const captures = [];
for (const theme of ["dark", "light"]) {
  const { context, page } = await openPage({
    path: "/",
    theme,
    viewport: { width: 1440, height: 900 },
  });
  const name = `home-${theme}-bg.png`;
  const artifactName = `spe_bg_home_${theme}_reviewed.png`;
  await capture(page, name, artifactName);
  captures.push({ name, artifactName, theme, route: "/" });
  await context.close();
}

for (const theme of ["dark", "light"]) {
  const { context, page } = await openPage({
    path: "/create",
    theme,
    viewport: { width: 1440, height: 1000 },
  });
  const name = `create-${theme}-bg.png`;
  const artifactName = `spe_bg_create_${theme}_reviewed.png`;
  await capture(page, name, artifactName);
  captures.push({ name, artifactName, theme, route: "/create" });
  await context.close();
}

{
  const { context, page } = await openPage({
    path: "/",
    theme: "dark",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const animations = await page
    .locator(".spe-dot-pattern__layer")
    .evaluateAll((layers) =>
      layers.map((layer) => getComputedStyle(layer).animationName),
    );
  assert.ok(animations.every((name) => name === "none"));
  await capture(
    page,
    "reduced-motion-bg.png",
    "spe_bg_reduced_motion_reviewed.png",
  );
  captures.push({
    name: "reduced-motion-bg.png",
    artifactName: "spe_bg_reduced_motion_reviewed.png",
    reducedMotion: true,
  });
  await context.close();
}

{
  const { context, page } = await openPage({
    path: "/create",
    theme: "dark",
    viewport: { width: 390, height: 844 },
  });
  const opacity = await page
    .locator(".spe-dot-pattern")
    .first()
    .evaluate((pattern) => Number(getComputedStyle(pattern).opacity));
  assert.ok(opacity <= 0.4);
  await capture(page, "mobile-bg.png", "spe_bg_mobile_reviewed.png");
  captures.push({
    name: "mobile-bg.png",
    artifactName: "spe_bg_mobile_reviewed.png",
    viewport: "390x844",
    opacity,
  });
  await context.close();
}

await browser.close();
await new Promise((resolve) => server.close(resolve));

writeFileSync(
  join(here, "screenshot-manifest.json"),
  `${JSON.stringify(
    {
      baseSha: "c337cc28783665d1ceb891f01b9da6022f0174bb",
      testedTipSha: tip,
      HOSTING: "FORBIDDEN",
      WORLD_NUMBER_1: "NOT_PROVEN",
      tailwindIntroduced: false,
      shadcnIntroduced: false,
      captures,
    },
    null,
    2,
  )}\n`,
);

console.log(`PASS captured atmospheric backgrounds at ${tip}`);
