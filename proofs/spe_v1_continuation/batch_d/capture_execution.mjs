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
const baseUrl = "http://127.0.0.1:4194";
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
  server.listen(4194, "127.0.0.1", resolve),
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
});
const page = await context.newPage();
await page.goto(`${baseUrl}/create`, {
  waitUntil: "networkidle",
  timeout: 60000,
});

await page
  .getByRole("textbox", { name: "Desired output" })
  .fill("A launch checklist with owners and measurable success criteria.");
await page
  .getByRole("textbox", { name: "Your idea" })
  .fill("Plan a careful product launch.");
await page.getByRole("tab", { name: "Example", exact: true }).click();
await page
  .getByRole("textbox", { name: "Example / user supplied" })
  .fill("Week 1 — Owner: Product — Outcome: approved brief.");
await page.getByRole("tab", { name: "Text", exact: true }).click();
await page.getByRole("button", { name: "Build my prompt" }).last().click();
await page.waitForSelector(".spe-execution-contract", { timeout: 90000 });

async function captureLocator(locator, fileName, artifactName) {
  await locator.screenshot({ path: join(here, fileName) });
  await locator.screenshot({ path: join(artifacts, artifactName) });
}

const captures = [];
const contractPanel = page.locator(".spe-execution-contract");
assert.match(await contractPanel.innerText(), /recommend ≠ authorize ≠ execute/);
assert.match(await contractPanel.innerText(), /NON-AUTHORITATIVE/);
assert.match(await contractPanel.innerText(), /success criteria/);
await captureLocator(
  contractPanel,
  "create-contract-dark.png",
  "spe_batch_d_create_contract_dark_final.png",
);
captures.push({
  name: "create-contract-dark.png",
  artifactName: "spe_batch_d_create_contract_dark_final.png",
  theme: "dark",
});

await page.getByRole("button", { name: /Dark/ }).click();
await page.waitForTimeout(150);
await captureLocator(
  contractPanel,
  "create-contract-light.png",
  "spe_batch_d_create_contract_light_final.png",
);
captures.push({
  name: "create-contract-light.png",
  artifactName: "spe_batch_d_create_contract_light_final.png",
  theme: "light",
});
await page.getByRole("button", { name: /Light/ }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Run local dry-run" }).click();
await page.waitForSelector(".spe-run-record");
const toastDismiss = page.getByLabel("Dismiss notification");
if (await toastDismiss.isVisible().catch(() => false)) {
  await toastDismiss.click();
}
const recordPanel = page.locator(".spe-run-record");
assert.match(await recordPanel.innerText(), /NOT EXECUTED/);
assert.match(await recordPanel.innerText(), /EXECUTED\s+NO/i);
assert.match(await recordPanel.innerText(), /SIDE EFFECTS\s+NONE/i);
await captureLocator(
  recordPanel,
  "receipt-after-run.png",
  "spe_batch_d_local_run_record_final.png",
);
captures.push({
  name: "receipt-after-run.png",
  artifactName: "spe_batch_d_local_run_record_final.png",
  surface: "local run record; no serialized receipt key",
});

const conformance = page.locator(".spe-conformance");
assert.match(await conformance.innerText(), /Overall: UNKNOWN/);
assert.match(await conformance.innerText(), /UNKNOWN is not PASS/);
const firstPass = conformance.locator('[data-status="pass"]').first();
await captureLocator(
  firstPass,
  "conformance-pass.png",
  "spe_batch_d_conformance_pass_final.png",
);
captures.push({
  name: "conformance-pass.png",
  artifactName: "spe_batch_d_conformance_pass_final.png",
  status: "PASS for one listed local check only",
});
const unknown = conformance.locator('[data-status="unknown"]').first();
await captureLocator(
  unknown,
  "conformance-blocked-or-unknown.png",
  "spe_batch_d_conformance_unknown_final.png",
);
captures.push({
  name: "conformance-blocked-or-unknown.png",
  artifactName: "spe_batch_d_conformance_unknown_final.png",
  status: "UNKNOWN; not PASS",
});

const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Download .spe" }).click();
const download = await downloadPromise;
const downloadPath = await download.path();
assert.ok(downloadPath);
const savedArtifact = JSON.parse(readFileSync(downloadPath, "utf8"));
assert.equal(
  savedArtifact.execution_record.record_format,
  "spe.local-execution-record.v1",
);
assert.equal(savedArtifact.execution_record.executed, false);
assert.equal(savedArtifact.execution_record.conformance.overall, "UNKNOWN");
assert.equal(
  Object.hasOwn(savedArtifact.execution_record, "receipt"),
  false,
);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(150);
await captureLocator(
  contractPanel,
  "mobile-contract.png",
  "spe_batch_d_mobile_contract_final.png",
);
captures.push({
  name: "mobile-contract.png",
  artifactName: "spe_batch_d_mobile_contract_final.png",
  viewport: "390x844",
});

await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));

writeFileSync(
  join(here, "screenshot-manifest.json"),
  `${JSON.stringify(
    {
      baseSha: "709e75c57e706b6991521ba733d22a10be033316",
      testedTipSha: tip,
      HOSTING: "FORBIDDEN",
      WORLD_NUMBER_1: "NOT_PROVEN",
      proofReceiptImplemented: false,
      serializedReceiptKey: false,
      captures,
    },
    null,
    2,
  )}\n`,
);

console.log(`PASS captured Batch D execution surfaces at ${tip}`);
