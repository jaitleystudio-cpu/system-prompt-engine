#!/usr/bin/env node
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
const PORT = Number(process.env.SPE_CAPTURE_PORT || 4212);
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
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--use-angle=swiftshader"],
});
const shots = [];
const failures = [];
const base = `http://127.0.0.1:${PORT}`;

async function capture(viewport, prefix) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    await page.goto(base + "/create", { waitUntil: "networkidle", timeout: 60000 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await page.locator("#composer-panel-text textarea").fill(
      "Plan a careful product launch with owners and measurable success criteria.",
    );
    const desired = page.locator(".spe-output-controls textarea");
    if (await desired.count()) {
      await desired.first().fill(
        "A launch checklist with owners and measurable success criteria.",
      );
    }
    await page.locator('.spe-create-rail > .compile-row button.spe-build').click({ force: true });
    await page.waitForSelector(".spe-execution-contract", { timeout: 90000 });
    await page.evaluate(() => {
      [...document.querySelectorAll(".spe-contract-presentation-btn")]
        .find((b) => b.textContent?.includes("Simple"))
        ?.click();
    });
    const simplePath = join(here, `${prefix}-simple.png`);
    await page.locator(".spe-execution-contract").screenshot({ path: simplePath });
    shots.push({ name: `${prefix}-simple.png`, bytes: statSync(simplePath).size });
    await page.evaluate(() => {
      [...document.querySelectorAll(".spe-contract-presentation-btn")]
        .find((b) => b.textContent?.includes("Inspect"))
        ?.click();
    });
    const inspectPath = join(here, `${prefix}-inspect.png`);
    await page.locator(".spe-execution-contract").screenshot({ path: inspectPath });
    shots.push({ name: `${prefix}-inspect.png`, bytes: statSync(inspectPath).size });
    const dry = page.getByRole("button", { name: /local dry-run/i });
    if (await dry.count()) {
      await dry.first().click();
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        [...document.querySelectorAll(".spe-contract-presentation-btn")]
          .find((b) => b.textContent?.includes("Simple"))
          ?.click();
      });
      const unk = join(here, `${prefix}-unknown.png`);
      await page.locator(".spe-execution-contract").screenshot({ path: unk });
      shots.push({ name: `${prefix}-unknown.png`, bytes: statSync(unk).size });
      // Inspect after dry-run for blocked/failure fixture if FAIL present
      const overall = await page.locator(".spe-conformance, .spe-contract-simple").getAttribute("data-overall").catch(() => null)
        || await page.locator(".spe-contract-simple").getAttribute("data-conformance").catch(() => null);
      shots.push({ note: "conformance_attr", overall });
    }
  } catch (error) {
    failures.push({ prefix, error: String(error) });
  } finally {
    await page.close();
  }
}

await capture({ width: 1440, height: 900 }, "contract-desktop");
await capture({ width: 390, height: 844 }, "contract-mobile");
await browser.close();
server.close();

const prevPath = join(here, "screenshot-manifest.json");
const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : { shots: [], failures: [] };
const merged = {
  tip_sha: tip,
  captured_at_local: new Date().toISOString(),
  HOSTING: "FORBIDDEN",
  WORLD_1: "NOT_PROVEN",
  shots: [...(prev.shots || []).filter((s) => !String(s.name || "").startsWith("contract-")), ...shots],
  failures: [...(prev.failures || []).filter((f) => !String(f.name || "").includes("contract")), ...failures],
};
writeFileSync(prevPath, JSON.stringify(merged, null, 2) + "\n");
console.log(JSON.stringify(merged, null, 2));
if (failures.length) process.exitCode = 1;
