#!/usr/bin/env node
/**
 * FINAL CRAFT acceptance captures — presentation only.
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
const PORT = Number(process.env.SPE_CAPTURE_PORT || 4211);
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
const failures = [];

async function shot(name, run) {
  const path = join(here, name);
  try {
    await run(path);
    const st = statSync(path);
    shots.push({ name, bytes: st.size, path });
    console.log("SHOT", name, st.size);
  } catch (error) {
    failures.push({ name, error: String(error) });
    console.error("FAIL", name, error);
  }
}

async function theme(page, mode) {
  await page.emulateMedia({ colorScheme: mode });
  await page.evaluate((m) => {
    document.documentElement.dataset.theme = m;
    try {
      localStorage.setItem("spe-theme", m);
    } catch {}
  }, mode);
  await page.waitForTimeout(200);
}

async function withPage(viewport, fn) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  });
  try {
    await fn(page);
  } finally {
    await page.close();
  }
}

// HOME
await withPage({ width: 1440, height: 900 }, async (page) => {
  await page.goto(baseUrl + "/", { waitUntil: "networkidle", timeout: 60000 });
  await theme(page, "dark");
  await shot("home-dark-desktop.png", (p) => page.screenshot({ path: p, fullPage: false }));
  await theme(page, "light");
  await shot("home-light-desktop.png", (p) => page.screenshot({ path: p, fullPage: false }));
});
await withPage({ width: 390, height: 844 }, async (page) => {
  await page.goto(baseUrl + "/", { waitUntil: "networkidle", timeout: 60000 });
  await theme(page, "dark");
  await shot("home-dark-mobile.png", (p) => page.screenshot({ path: p, fullPage: true }));
  await theme(page, "light");
  await shot("home-light-mobile.png", (p) => page.screenshot({ path: p, fullPage: true }));
});

// CREATE
await withPage({ width: 1440, height: 900 }, async (page) => {
  await page.goto(baseUrl + "/create", { waitUntil: "networkidle", timeout: 60000 });
  await theme(page, "dark");
  await shot("create-dark-desktop.png", (p) => page.screenshot({ path: p, fullPage: true }));
  await theme(page, "light");
  await shot("create-light-desktop.png", (p) => page.screenshot({ path: p, fullPage: true }));
});
await withPage({ width: 390, height: 844 }, async (page) => {
  await page.goto(baseUrl + "/create", { waitUntil: "networkidle", timeout: 60000 });
  await theme(page, "dark");
  const details = page.locator(".spe-create-sources-depth");
  // collapsed
  await page.evaluate(() => {
    const d = document.querySelector(".spe-create-sources-depth");
    if (d) d.open = false;
  });
  await shot("create-mobile-collapsed.png", (p) => page.screenshot({ path: p, fullPage: true }));
  // expanded
  await page.evaluate(() => {
    const d = document.querySelector(".spe-create-sources-depth");
    if (d) d.open = true;
  });
  await shot("create-mobile-advanced-expanded.png", (p) =>
    page.screenshot({ path: p, fullPage: true }),
  );
  // focus state on summary
  await page.evaluate(() => {
    const d = document.querySelector(".spe-create-sources-depth");
    if (d) d.open = false;
  });
  await page.locator(".spe-create-sources-summary").focus();
  await shot("create-mobile-focus.png", (p) => page.screenshot({ path: p, fullPage: true }));
});

// CAPABILITIES
await withPage({ width: 1440, height: 900 }, async (page) => {
  await page.goto(baseUrl + "/capabilities", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await theme(page, "dark");
  await shot("capabilities-dark-desktop.png", (p) =>
    page.screenshot({ path: p, fullPage: true }),
  );
  await theme(page, "light");
  await shot("capabilities-light-desktop.png", (p) =>
    page.screenshot({ path: p, fullPage: true }),
  );
});
await withPage({ width: 390, height: 844 }, async (page) => {
  await page.goto(baseUrl + "/capabilities", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await theme(page, "dark");
  await shot("capabilities-dark-mobile.png", (p) =>
    page.screenshot({ path: p, fullPage: true }),
  );
  await theme(page, "light");
  await shot("capabilities-light-mobile.png", (p) =>
    page.screenshot({ path: p, fullPage: true }),
  );
});

// EXECUTION CONTRACT — seed via localStorage/history is hard; inject fixture DOM-less:
// Navigate create, fill brief, compile if worker available; else capture panel via evaluate fixture mount.
await withPage({ width: 1440, height: 900 }, async (page) => {
  await page.goto(baseUrl + "/create", { waitUntil: "networkidle", timeout: 60000 });
  await theme(page, "dark");
  await page.fill("#spe-one-line, textarea", "Plan a careful product launch with owners and success criteria.");
  // Desired output if present
  const desired = page.locator("#desired-output-title");
  if (await desired.count()) {
    await page.locator(".spe-output-controls textarea").first().fill(
      "A launch checklist with owners and measurable success criteria.",
    );
  }
  const build = page.locator("button.spe-build").first();
  await build.click();
  // Wait for contract panel or timeout soft
  try {
    await page.waitForSelector(".spe-execution-contract", { timeout: 45000 });
  } catch {
    // soft — still screenshot create state
  }
  if (await page.locator(".spe-execution-contract").count()) {
    await page.locator('button.spe-contract-presentation-btn[aria-pressed], button:has-text("Simple")').first().click().catch(() => {});
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".spe-contract-presentation-btn")];
      const simple = btns.find((b) => b.textContent?.includes("Simple"));
      simple?.click();
    });
    await shot("contract-simple-desktop.png", (p) =>
      page.locator(".spe-execution-contract").screenshot({ path: p }),
    );
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".spe-contract-presentation-btn")];
      const inspect = btns.find((b) => b.textContent?.includes("Inspect"));
      inspect?.click();
    });
    await shot("contract-inspect-desktop.png", (p) =>
      page.locator(".spe-execution-contract").screenshot({ path: p }),
    );
    // UNKNOWN conformance styling present if dry-run done
    const dry = page.locator("button.spe-build", { hasText: /dry-run/i });
    if (await dry.count()) {
      await dry.first().click();
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll(".spe-contract-presentation-btn")];
        btns.find((b) => b.textContent?.includes("Simple"))?.click();
      });
      await shot("contract-unknown-desktop.png", (p) =>
        page.locator(".spe-execution-contract").screenshot({ path: p }),
      );
    }
  } else {
    failures.push({
      name: "contract-desktop",
      error: "Execution contract panel not present after compile wait",
    });
  }
});

await withPage({ width: 390, height: 844 }, async (page) => {
  await page.goto(baseUrl + "/create", { waitUntil: "networkidle", timeout: 60000 });
  await theme(page, "dark");
  await page.fill("textarea", "Plan a careful product launch with owners and success criteria.");
  await page.locator("button.spe-build").first().click();
  try {
    await page.waitForSelector(".spe-execution-contract", { timeout: 45000 });
  } catch {}
  if (await page.locator(".spe-execution-contract").count()) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".spe-contract-presentation-btn")];
      btns.find((b) => b.textContent?.includes("Simple"))?.click();
    });
    await shot("contract-simple-mobile.png", (p) =>
      page.locator(".spe-execution-contract").screenshot({ path: p }),
    );
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".spe-contract-presentation-btn")];
      btns.find((b) => b.textContent?.includes("Inspect"))?.click();
    });
    await shot("contract-inspect-mobile.png", (p) =>
      page.locator(".spe-execution-contract").screenshot({ path: p }),
    );
  } else {
    failures.push({
      name: "contract-mobile",
      error: "Execution contract panel not present after compile wait",
    });
  }
});

await browser.close();
server.close();

const manifest = {
  tip_sha: tip,
  captured_at_local: new Date().toISOString(),
  HOSTING: "FORBIDDEN",
  WORLD_1: "NOT_PROVEN",
  shots,
  failures,
};
writeFileSync(join(here, "screenshot-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
if (failures.length) process.exitCode = 1;
