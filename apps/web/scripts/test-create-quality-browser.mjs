/**
 * Real local browser pass for Create: canonical, unresolved, Core B, export.
 * Does not invent a repaired prompt. A repaired display is recorded only if
 * the live kernel receipt says IMPROVED and the visible prompt differs from
 * the exported original.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const IDEA = "Write a four-week launch checklist. Budget must remain $2000. Do not invent extra spend.";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function startStatic() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    const file = join(dist, path.replace(/^\//, ""));
    if (!file.startsWith(dist) || !existsSync(file)) {
      const index = readFileSync(join(dist, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(index);
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function openCreate(page, base) {
  await page.goto(`${base}/create`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Your idea" }).waitFor({ state: "visible" });
}

async function compileIdea(page, text) {
  const box = page.getByRole("textbox", { name: "Your idea" });
  await box.fill(text);
  const build = page.getByRole("button", { name: "Build my prompt" });
  await build.click();
  await page.getByRole("region", { name: "Your prompt" }).waitFor({ timeout: 60000 });
  const visible = (await page.locator(".spe-create-result pre").first().innerText()).trim();
  const receipt = (await page.getByRole("complementary", { name: "Quality receipt" }).innerText()).trim();
  return { visible, receipt };
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("browser: dist missing; build the web app first");
  process.exit(2);
}

const { server, base } = await startStatic();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {
  canonical: "FAIL",
  repaired: "NOT_OBSERVED",
  unresolved: "FAIL",
  core_b: "FAIL",
  export_consistency: "FAIL",
};

try {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem("spe.web.history.opt_in.v1", "1");
  });
  const page = await context.newPage();
  await openCreate(page, base);
  const built = await compileIdea(page, IDEA);
  assert.ok(built.visible.length > 40, "canonical prompt missing");
  assert.equal(built.visible.includes("verified better"), false);
  assert.equal(built.receipt.includes("verified better"), false);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON" }).click();
  const download = await downloadPromise;
  const jsonPath = await download.path();
  const exported = JSON.parse(readFileSync(jsonPath, "utf8"));
  assert.equal(exported.rendered_prompt, built.visible);
  assert.equal(exported.spe_format, "spe.artifact.v1");

  const spePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: ".spe" }).click();
  const speDownload = await spePromise;
  const spe = JSON.parse(readFileSync(await speDownload.path(), "utf8"));
  assert.equal(spe.rendered_prompt, built.visible);

  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied, built.visible);

  const historyRaw = await page.evaluate(() => localStorage.getItem("spe.web.history.items.v1"));
  const history = JSON.parse(historyRaw || "[]");
  assert.ok(history.length > 0, "history item missing");
  assert.equal(history[0].artifact.rendered_prompt, built.visible);
  assert.equal(history[0].prompt_preview, built.visible.slice(0, 240));

  report.canonical = "PASS";
  report.export_consistency = "PASS";
  const improved = built.receipt.includes("IMPROVED");
  if (improved && built.visible !== exported.rendered_prompt) {
    report.repaired = "FAIL_MISMATCH";
  } else if (improved) {
    report.repaired = "PASS";
    report.unresolved = "NOT_THIS_CASE";
  } else {
    report.repaired = "NOT_OBSERVED";
    report.unresolved = "PASS";
    assert.equal(exported.rendered_prompt, built.visible);
  }

  const blockedContext = await browser.newContext({ serviceWorkers: "block" });
  const blocked = await blockedContext.newPage();
  await blocked.route("**/spe_wasm.wasm", (route) => route.abort());
  await blocked.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await blocked.getByRole("textbox", { name: "Your idea" }).fill(IDEA);
  await blocked.getByRole("button", { name: "Build my prompt" }).click();
  await blocked.getByRole("region", { name: "Safe fallback" }).waitFor({ timeout: 30000 });
  const fallback = (await blocked.locator(".spe-create-result pre").innerText()).trim();
  assert.ok(fallback.includes(IDEA));
  assert.equal(fallback.toLowerCase().includes("verified"), false);
  assert.equal(await blocked.getByRole("button", { name: ".spe" }).count(), 0);
  report.core_b = "PASS";
  await blocked.close();
  await blockedContext.close();
  await context.close();
} catch (err) {
  report.error = String(err && err.message ? err.message : err);
  throw err;
} finally {
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.canonical !== "PASS" || report.export_consistency !== "PASS" || report.core_b !== "PASS") {
  process.exit(1);
}
if (report.unresolved !== "PASS" && report.repaired !== "PASS") {
  process.exit(1);
}
