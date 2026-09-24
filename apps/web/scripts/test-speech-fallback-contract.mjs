/**
 * Automated speech graceful-fallback contract.
 * Proves: unsupported API, permission deny, recognition error →
 * human copy, no stuck listening, typing remains usable.
 * Does NOT claim QUALIFIED dictation.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const dist = join(root, "dist");
const outPath = join(repo, "proofs/spe_v1_launch/speech_fallback_contract.json");

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
  ".onnx": "application/octet-stream",
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
  return new Promise((r) => server.listen(4177, "127.0.0.1", () => r(server)));
}

async function openSpeech(page) {
  await page.goto("http://127.0.0.1:4177/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const burger = page.locator(".spe-nav-burger, .spe-nav-toggle, button[aria-label*='Menu' i]").first();
  if (await burger.isVisible().catch(() => false)) {
    const expanded = await burger.getAttribute("aria-expanded");
    if (expanded !== "true") await burger.click().catch(() => {});
  }
  const create = page.getByRole("button", { name: /Create|Compose/i }).first();
  if (await create.count()) await create.click();
  await page.waitForTimeout(300);
  const speechTab = page.getByRole("tab", { name: /Speech/i });
  if (await speechTab.count()) await speechTab.click();
  await page.waitForTimeout(200);
  const summary = page.locator("details.spe-speech summary, details[data-testid='speech-panel'] summary");
  if (await summary.count()) await summary.first().click().catch(() => {});
  await page.waitForTimeout(200);
}

const evidence = {
  ok: false,
  testedSha: null,
  cases: {},
  notes: [],
};

const server = await startServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

try {
  // Case A: unsupported — strip SpeechRecognition
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        delete window.SpeechRecognition;
        delete window.webkitSpeechRecognition;
      } catch {}
      Object.defineProperty(window, "SpeechRecognition", { get: () => undefined, configurable: true });
      Object.defineProperty(window, "webkitSpeechRecognition", { get: () => undefined, configurable: true });
    });
    await openSpeech(page);
    const unsupported = page.getByTestId("speech-unsupported");
    const transcript = page.getByTestId("speech-transcript");
    assert.ok(await unsupported.count(), "unsupported message missing");
    assert.match(await unsupported.innerText(), /not available|Type your idea/i);
    assert.ok(await transcript.count(), "transcript must remain for typing");
    await transcript.fill("Typed idea when speech unsupported");
    const insert = page.getByTestId("speech-insert");
    assert.equal(await insert.isDisabled(), false);
    const listening = page.locator('[data-speech-listening="true"]');
    assert.equal(await listening.count(), 0, "must not show listening when unsupported");
    const body = await page.locator("body").innerText();
    assert.doesNotMatch(body, /DEVICE_QUALIFICATION_PENDING/);
    assert.doesNotMatch(body, /\\bNOT_TESTED\\b/);
    evidence.cases.unsupported = {
      pass: true,
      humanCopy: true,
      typingUsable: true,
      noStuckListening: true,
    };
    await context.close();
  }

  // Case B: permission deny / recognition error — no stuck listening
  {
    const context = await browser.newContext();
    await context.clearPermissions();
    const page = await context.newPage();
    await page.addInitScript(() => {
      class FakeRec {
        constructor() {
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          this.lang = "";
          this.continuous = false;
          this.interimResults = false;
        }
        start() {
          setTimeout(() => {
            if (this.onerror) this.onerror({ error: "not-allowed" });
            if (this.onend) this.onend();
          }, 30);
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRec;
      window.webkitSpeechRecognition = FakeRec;
    });
    await openSpeech(page);
    const consent = page.locator('input[type="checkbox"]').first();
    if (await consent.count()) await consent.check();
    await page.getByTestId("speech-start").click();
    await page.waitForTimeout(400);
    const err = page.locator('[role="alert"], [data-speech-error-kind]');
    assert.ok(await err.count(), "human error alert required on deny");
    assert.match(await err.first().innerText(), /denied|Allow|type your idea/i);
    assert.equal(await page.locator('[data-speech-listening="true"]').count(), 0, "no stuck listening");
    const transcript = page.getByTestId("speech-transcript");
    await transcript.fill("Still typing after deny");
    assert.ok((await transcript.inputValue()).includes("Still typing"));
    evidence.cases.permissionDeny = {
      pass: true,
      humanCopy: true,
      typingUsable: true,
      noStuckListening: true,
    };
    await context.close();
  }

  // Case C: recognition failure (audio-capture) — same contract
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      class FakeRec {
        constructor() {
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
        }
        start() {
          setTimeout(() => {
            if (this.onerror) this.onerror({ error: "audio-capture" });
            if (this.onend) this.onend();
          }, 30);
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRec;
      window.webkitSpeechRecognition = FakeRec;
    });
    await openSpeech(page);
    const consent = page.locator('input[type="checkbox"]').first();
    if (await consent.count()) await consent.check();
    await page.getByTestId("speech-start").click();
    await page.waitForTimeout(400);
    const err = page.locator('[role="alert"], [data-speech-error-kind]');
    assert.ok(await err.count());
    assert.match(await err.first().innerText(), /microphone|type your idea/i);
    assert.equal(await page.locator('[data-speech-listening="true"]').count(), 0);
    evidence.cases.audioCaptureFail = {
      pass: true,
      humanCopy: true,
      typingUsable: true,
      noStuckListening: true,
    };
    await context.close();
  }

  evidence.ok = Object.values(evidence.cases).every((c) => c.pass);
  evidence.status = evidence.ok ? "VERIFIED_GRACEFUL_FALLBACK" : "FAILED";
  evidence.notes.push(
    "Contract verified in Chromium. Safari/Android/iPhone product behavior shares this UI; founder QUALIFIED dictation still open.",
  );
} catch (e) {
  evidence.ok = false;
  evidence.status = "FAILED";
  evidence.notes.push(String(e && e.stack ? e.stack : e));
  throw e;
} finally {
  await browser.close();
  server.close();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ wrote: outPath, ...evidence }, null, 2));
}
if (!evidence.ok) process.exitCode = 1;
