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
const web = join(repo, "apps/web");
const dist = join(web, "dist");
const artifacts = "/opt/cursor/artifacts";
const baseUrl = "http://127.0.0.1:4191";
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
  server.listen(4191, "127.0.0.1", resolve),
);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

async function openCreate(theme, viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.addInitScript((selectedTheme) => {
    localStorage.setItem("spe-theme", selectedTheme);
  }, theme);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/create`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector(".spe-composer");
  return { context, page };
}

async function capturePage(page, fileName, artifactName) {
  await page.screenshot({ path: join(here, fileName) });
  await page.screenshot({ path: join(artifacts, artifactName) });
}

const captures = [];

{
  const { context, page } = await openCreate("dark", {
    width: 1440,
    height: 1000,
  });
  assert.equal(await page.getByRole("tab").count(), 7);
  assert.equal(
    await page.getByRole("textbox", { name: "Desired output" }).count(),
    1,
  );
  await capturePage(
    page,
    "create-dark.png",
    "spe_batch_b_create_dark.png",
  );
  captures.push({
    name: "create-dark.png",
    artifactName: "spe_batch_b_create_dark.png",
    viewport: "1440x1000",
    theme: "dark",
  });

  const desiredOutput = page.getByRole("textbox", {
    name: "Desired output",
  });
  await desiredOutput.fill(
    "A concise launch checklist with owners, dates, and measurable success criteria.",
  );
  await page.getByRole("textbox", { name: "Your idea" }).fill(
    "Plan a careful launch for a small offline writing app.",
  );
  await capturePage(
    page,
    "create-desired-output.png",
    "spe_batch_b_create_desired_output.png",
  );
  captures.push({
    name: "create-desired-output.png",
    artifactName: "spe_batch_b_create_desired_output.png",
    field: "Desired output",
  });

  const textTab = page.getByRole("tab", { name: "Text", exact: true });
  await textTab.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "Speech", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("tab", { name: "Image", exact: true }).click();
  assert.equal(
    await page.locator('input[type="file"][aria-label="Choose image file"]').count(),
    1,
  );
  await page.getByRole("tab", { name: "Example", exact: true }).click();
  const example = page.getByRole("textbox", {
    name: "Example / user supplied",
  });
  await example.fill(
    "Week 1 — Owner: Product — Outcome: approved launch brief.",
  );
  assert.match(
    await page.locator(".spe-example-note").innerText(),
    /not treated as verified truth/i,
  );
  assert.match(await desiredOutput.inputValue(), /launch checklist/);
  await capturePage(
    page,
    "create-example-mode.png",
    "spe_batch_b_create_example_mode.png",
  );
  captures.push({
    name: "create-example-mode.png",
    artifactName: "spe_batch_b_create_example_mode.png",
    field: "Example / user supplied",
  });
  await context.close();
}

{
  const { context, page } = await openCreate("light", {
    width: 1440,
    height: 1000,
  });
  await page
    .getByRole("textbox", { name: "Desired output" })
    .fill("A usable plan with clear success criteria.");
  await capturePage(
    page,
    "create-light.png",
    "spe_batch_b_create_light.png",
  );
  captures.push({
    name: "create-light.png",
    artifactName: "spe_batch_b_create_light.png",
    viewport: "1440x1000",
    theme: "light",
  });
  await context.close();
}

{
  const { context, page } = await openCreate("dark", {
    width: 390,
    height: 844,
  });
  const modeGrid = page.locator(".spe-composer-modes");
  const gridColumns = await modeGrid.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  );
  assert.ok(gridColumns.split(" ").length >= 3);
  await page.getByRole("tab", { name: "Example", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", {
      name: "Example / user supplied",
    }).count(),
    1,
  );
  await capturePage(
    page,
    "create-mobile.png",
    "spe_batch_b_create_mobile.png",
  );
  captures.push({
    name: "create-mobile.png",
    artifactName: "spe_batch_b_create_mobile.png",
    viewport: "390x844",
    gridColumns,
  });
  await context.close();
}

await browser.close();
await new Promise((resolve) => server.close(resolve));

writeFileSync(
  join(here, "screenshot-manifest.json"),
  `${JSON.stringify(
    {
      baseSha: "e4db0f41623c773fcdc23d2d94370a826470b2b4",
      testedTipSha: tip,
      HOSTING: "FORBIDDEN",
      WORLD_NUMBER_1: "NOT_PROVEN",
      captures,
    },
    null,
    2,
  )}\n`,
);

console.log(`PASS captured Batch B Create at ${tip}`);
