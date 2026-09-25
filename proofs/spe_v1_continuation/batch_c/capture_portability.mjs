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
const baseUrl = "http://127.0.0.1:4192";
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
  server.listen(4192, "127.0.0.1", resolve),
);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  serviceWorkers: "block",
  acceptDownloads: true,
});
await context.addInitScript(() => {
  localStorage.setItem("spe-theme", "dark");
  window.print = () => {};
});
const page = await context.newPage();
await page.goto(`${baseUrl}/create`, {
  waitUntil: "networkidle",
  timeout: 60000,
});

await page
  .getByRole("textbox", { name: "Desired output" })
  .fill("A concise plan with owners, dates, and success criteria.");
await page
  .getByRole("textbox", { name: "Your idea" })
  .fill("Plan a careful product launch.");
await page.getByRole("tab", { name: "Example", exact: true }).click();
await page
  .getByRole("textbox", { name: "Example / user supplied" })
  .fill("Week 1 — Owner: Product — Outcome: approved brief.");
await page.getByRole("tab", { name: "Text", exact: true }).click();
await page.getByRole("button", { name: "Build my prompt" }).last().click();
await page.waitForSelector(".spe-create-result", { timeout: 90000 });
await page.getByRole("button", { name: "Open workspace" }).click();
await page.waitForSelector(".spe-reveal-card");

async function captureLocator(locator, fileName, artifactName) {
  await locator.screenshot({ path: join(here, fileName) });
  await locator.screenshot({ path: join(artifacts, artifactName) });
}

const captures = [];
const exportPanel = page.locator(".spe-reveal-card");
await captureLocator(
  exportPanel,
  "export-panel-dark.png",
  "spe_batch_c_export_panel_dark_evidence_final.png",
);
captures.push({
  name: "export-panel-dark.png",
  artifactName: "spe_batch_c_export_panel_dark_evidence_final.png",
  theme: "dark",
});

const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Download .spe" }).click();
const download = await downloadPromise;
const downloadPath = await download.path();
assert.ok(downloadPath);

const popupPromise = page.waitForEvent("popup");
await page.getByRole("button", { name: "Print / Save PDF" }).click();
const popup = await popupPromise;
await popup.waitForLoadState("domcontentloaded");
await popup.screenshot({
  path: join(here, "export-pdf.png"),
  fullPage: true,
});
await popup.screenshot({
  path: join(artifacts, "spe_batch_c_export_pdf_evidence_final.png"),
  fullPage: true,
});
assert.match(await popup.locator("body").innerText(), /Not a verification receipt/);
captures.push({
  name: "export-pdf.png",
  artifactName: "spe_batch_c_export_pdf_evidence_final.png",
  surface: "browser print view",
});
await popup.close();
const toastDismiss = page.getByLabel("Dismiss notification");
if (await toastDismiss.isVisible().catch(() => false)) {
  await toastDismiss.click();
}

await page.getByRole("button", { name: /Dark/ }).click();
await page.waitForTimeout(150);
await captureLocator(
  exportPanel,
  "export-panel-light.png",
  "spe_batch_c_export_panel_light_evidence_final.png",
);
captures.push({
  name: "export-panel-light.png",
  artifactName: "spe_batch_c_export_panel_light_evidence_final.png",
  theme: "light",
});

const importInput = page.getByLabel("Import .spe or JSON file");
await importInput.setInputFiles(downloadPath);
await page.waitForSelector(
  '.spe-reconstruction[data-status="restored"]',
);
const successSummary = page.locator(
  '.spe-reconstruction[data-status="restored"]',
);
assert.match(await successSummary.innerText(), /Desired Output/);
assert.match(await successSummary.innerText(), /NON-AUTHORITATIVE/);
await captureLocator(
  successSummary,
  "reconstruct-success.png",
  "spe_batch_c_reconstruct_success_evidence_final.png",
);
captures.push({
  name: "reconstruct-success.png",
  artifactName: "spe_batch_c_reconstruct_success_evidence_final.png",
  result: "restored with explicit limits",
});

await page.getByRole("button", { name: "Your prompt" }).click();
await page.getByLabel("Import .spe or JSON file").setInputFiles({
  name: "truncated.spe",
  mimeType: "application/json",
  buffer: Buffer.from('{"spe_format":"spe.artifact.v1"'),
});
await page.waitForSelector('.spe-reconstruction[data-status="error"]');
const failureSummary = page.locator(
  '.spe-reconstruction[data-status="error"]',
);
assert.match(await failureSummary.innerText(), /incomplete or truncated/i);
assert.match(await failureSummary.innerText(), /Nothing was restored/i);
await captureLocator(
  failureSummary,
  "reconstruct-partial-or-fail.png",
  "spe_batch_c_reconstruct_fail_evidence_final.png",
);
captures.push({
  name: "reconstruct-partial-or-fail.png",
  artifactName: "spe_batch_c_reconstruct_fail_evidence_final.png",
  result: "fail closed on truncated file",
});

await page.getByRole("button", { name: "Dismiss", exact: true }).click();
const failureToastDismiss = page.getByLabel("Dismiss notification");
if (await failureToastDismiss.isVisible().catch(() => false)) {
  await failureToastDismiss.click();
}
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(150);
await captureLocator(
  exportPanel,
  "workspace-mobile.png",
  "spe_batch_c_workspace_mobile_evidence_final.png",
);
captures.push({
  name: "workspace-mobile.png",
  artifactName: "spe_batch_c_workspace_mobile_evidence_final.png",
  viewport: "390x844",
});

await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));

writeFileSync(
  join(here, "screenshot-manifest.json"),
  `${JSON.stringify(
    {
      baseSha: "d50aaeca62c510c083223c461032a1471745cd46",
      testedTipSha: tip,
      HOSTING: "FORBIDDEN",
      WORLD_NUMBER_1: "NOT_PROVEN",
      captures,
    },
    null,
    2,
  )}\n`,
);

console.log(`PASS captured Batch C portability at ${tip}`);
