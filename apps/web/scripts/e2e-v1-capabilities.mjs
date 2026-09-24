/**
 * Playwright E2E — SPE V1 seven capabilities (behavioral).
 */
import { createServer } from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".onnx": "application/octet-stream",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
  ".mjs": "application/javascript",
};

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/index.html";
    let file = join(dist, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "public", path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(4175, "127.0.0.1", () => resolve(server)));
}

const results = [];
const pass = (name, detail = "") => results.push({ name, ok: true, detail });
const fail = (name, detail) => results.push({ name, ok: false, detail });

async function nav(page, label) {
  const burger = page.locator(".spe-nav-burger");
  if (await burger.isVisible().catch(() => false)) {
    const expanded = await burger.getAttribute("aria-expanded");
    if (expanded !== "true") await burger.click();
  }
  await page.locator("#spe-primary-nav").getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function modeTab(page, label) {
  await page.locator(".spe-composer-modes").getByRole("tab", { name: label }).click();
  await page.waitForTimeout(250);
}

const server = await startServer();
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 60000 });

  const vision0 = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource").map((e) => e.name);
    return {
      ortFetched: entries.some((u) => u.includes("/ort/") || u.includes("ort-wasm") || u.includes(".onnx")),
    };
  });
  if (!vision0.ortFetched) pass("homepage_vision_bytes_zero", "no ort/onnx fetch on home");
  else fail("homepage_vision_bytes_zero", "ort/onnx fetched on homepage");

  await nav(page, "Create");
  const idea = page.locator("textarea").first();
  await idea.fill("Write a polite two-day leave email. Keep under 120 words.");
  await page.locator("button.spe-build").first().click();
  await page.waitForSelector("text=/Ready to use|Your idea|Your prompt is ready/i", { timeout: 90000 });
  pass("text_prompt_wasm", "compile surfaced result");

  await modeTab(page, "Speech");
  const summary = page.locator("details.spe-speech summary");
  if (await summary.count()) await summary.click();
  await page.waitForTimeout(200);
  const speech = await page.locator("details.spe-speech").innerText();
  if (/DEVICE_QUALIFICATION_PENDING|\bNOT_TESTED\b|IMPLEMENTATION_PRESENT/i.test(speech))
    fail("speech_honesty", "engineering tokens leaked to visitor: " + speech.slice(0, 200));
  else if (/typing|optional|Dictation|browser/i.test(speech))
    pass("speech_honesty", "visitor-safe speech copy");
  else fail("speech_honesty", speech.slice(0, 200));

  await modeTab(page, "Image");
  if (await page.locator('input[type="file"]').count()) pass("image_input_present", "file input");
  else fail("image_input_present", "no file input");

  await nav(page, "Code");
  const codeBody = await page.locator(".spe-create").innerText();
  if (/Screenshot|Code target|HTML|React|SwiftUI/i.test(codeBody))
    pass("code_screenshot_mode", "Code opens screenshot path");
  else fail("code_screenshot_mode", codeBody.slice(0, 180));

  await nav(page, "Create");
  await modeTab(page, "Video");
  if (await page.locator('input[type="file"]').count()) pass("video_input_present", "file input");
  else fail("video_input_present", "missing");

  await modeTab(page, "URL");
  const urlCopy = await page.locator(".spe-create").innerText();
  if (/CORS|proxy|Paste|screenshot|HTML/i.test(urlCopy)) pass("url_cors_honesty", "fallbacks");
  else fail("url_cors_honesty", "missing");

  await nav(page, "Daily Lab");
  const lab = await page.locator(".spe-lab").innerText();
  if (/Daily 3D Lab|Curated queue of 14|Open in SPE/i.test(lab)) pass("daily_3d_lab", "premium lab");
  else fail("daily_3d_lab", lab.slice(0, 220));
  if (/Prompt Gallery/i.test(lab)) pass("prompt_gallery_separated", "gallery present");
  else fail("prompt_gallery_separated", "missing gallery");

  const openBtn = page.locator(".spe-lab-actions .spe-build").first();
  await openBtn.click();
  await page.waitForTimeout(500);
  const createText = await page.locator("textarea").first().inputValue();
  if (createText.trim().length > 10) pass("lab_open_in_spe", `seeded ${createText.length} chars`);
  else fail("lab_open_in_spe", "empty composer");
} catch (err) {
  fail("e2e_crash", String(err));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ passed: failed.length === 0, results }, null, 2));
process.exit(failed.length ? 1 : 0);
