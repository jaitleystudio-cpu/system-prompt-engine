/**
 * Chrome desktop speech API probe (headless). Does NOT claim QUALIFIED.
 * Records API presence, permission probe, and UI honesty — mic hardware absent on box.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

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
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/index.html";
    let file = join(dist, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "public", path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404); res.end("missing"); return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(4176, "127.0.0.1", () => resolve(server)));
}

const server = await startServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({
  permissions: [], // start denied
});
const page = await context.newPage();
const evidence = {
  platform: "Linux box (agent)",
  browser: "Chromium headless (Chrome channel)",
  apiPresent: "UNKNOWN",
  micPermission: "NOT_TESTED",
  dictationSmoke: "NOT_TESTED",
  uiHonesty: "UNKNOWN",
  notes: [],
  status: "NOT_TESTED",
};

try {
  await page.goto("http://127.0.0.1:4176/", { waitUntil: "networkidle", timeout: 60000 });
  // Navigate to Create / Speech if possible
  const burger = page.locator(".spe-nav-burger");
  if (await burger.isVisible().catch(() => false)) {
    const expanded = await burger.getAttribute("aria-expanded");
    if (expanded !== "true") await burger.click();
  }
  const createBtn = page.locator("#spe-primary-nav").getByRole("button", { name: /Create|Compose/i });
  if (await createBtn.count()) await createBtn.first().click();
  await page.waitForTimeout(400);
  const speechTab = page.locator(".spe-composer-modes").getByRole("tab", { name: /Speech/i });
  if (await speechTab.count()) await speechTab.click();
  await page.waitForTimeout(300);

  const api = await page.evaluate(() => {
    const w = window;
    return {
      speechRecognition: typeof w.SpeechRecognition === "function",
      webkitSpeechRecognition: typeof w.webkitSpeechRecognition === "function",
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    };
  });
  evidence.apiPresent =
    api.speechRecognition || api.webkitSpeechRecognition ? "YES" : "NO";
  evidence.notes.push(`SpeechRecognition=${api.speechRecognition} webkit=${api.webkitSpeechRecognition} mediaDevices=${api.mediaDevices}`);

  // Permission deny path
  try {
    await context.clearPermissions();
    const denied = await page.evaluate(async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return "granted";
      } catch (e) {
        return e && e.name ? e.name : String(e);
      }
    });
    evidence.notes.push(`mic_deny_probe=${denied}`);
    evidence.micPermission = denied === "granted" ? "YES" : "NO";
  } catch (e) {
    evidence.notes.push(`mic_deny_error=${String(e)}`);
    evidence.micPermission = "NOT_TESTED";
  }

  // Permission allow with fake device
  await context.grantPermissions(["microphone"], { origin: "http://127.0.0.1:4176" });
  const allowed = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks().length;
      stream.getTracks().forEach((t) => t.stop());
      return { ok: true, tracks };
    } catch (e) {
      return { ok: false, err: e && e.name ? e.name : String(e) };
    }
  });
  evidence.notes.push(`mic_allow_fake=${JSON.stringify(allowed)}`);
  if (allowed.ok) evidence.micPermission = "YES";

  // Dictation: Web Speech in headless usually fails — record honestly
  const dictation = await page.evaluate(async () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return { started: false, reason: "no-ctor" };
    try {
      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      return await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try { rec.abort(); } catch {}
          resolve({ started: true, reason: "timeout-no-result", result: null });
        }, 2500);
        rec.onerror = (ev) => {
          clearTimeout(timer);
          resolve({ started: true, reason: "error:" + (ev.error || "unknown"), result: null });
        };
        rec.onresult = (ev) => {
          clearTimeout(timer);
          const t = ev.results?.[0]?.[0]?.transcript || "";
          try { rec.stop(); } catch {}
          resolve({ started: true, reason: "result", result: t });
        };
        try {
          rec.start();
        } catch (e) {
          clearTimeout(timer);
          resolve({ started: false, reason: "start-throw:" + String(e) });
        }
      });
    } catch (e) {
      return { started: false, reason: "ctor-throw:" + String(e) };
    }
  });
  evidence.notes.push(`dictation=${JSON.stringify(dictation)}`);
  if (dictation.reason === "result" && dictation.result) {
    evidence.dictationSmoke = "PASS";
  } else if (dictation.started) {
    evidence.dictationSmoke = "FAIL";
    evidence.notes.push("Recognition started but no usable transcript on this headless box");
  } else {
    evidence.dictationSmoke = "NOT_TESTED";
  }

  // UI honesty
  // Prefer structured qualification markers; fall back to visible copy.
  const markers = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll("[data-speech-qualification],[data-capability-status]"),
    ];
    return {
      attrs: nodes.map((n) => n.getAttribute("data-speech-qualification") || n.getAttribute("data-capability-status")),
      text: document.body.innerText.slice(0, 8000),
    };
  });
  evidence.notes.push("ui_markers=" + JSON.stringify(markers.attrs));
  evidence.uiHonesty =
    markers.attrs.some((a) => /QUALIFICATION|NOT_TESTED|PENDING/i.test(a || "")) ||
    /NOT_TESTED|device qualification|DEVICE_QUALIFICATION|varies by device/i.test(markers.text)
      ? "PASS"
      : "FAIL";

  evidence.status =
    evidence.dictationSmoke === "PASS" && evidence.uiHonesty === "PASS"
      ? "IMPLEMENTATION_PRESENT"
      : "NOT_TESTED";
  if (evidence.apiPresent === "YES") {
    evidence.status = "IMPLEMENTATION_PRESENT";
  }
} catch (e) {
  evidence.notes.push("probe_error=" + String(e));
  evidence.status = "NOT_TESTED";
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({ ok: true, chromeDesktopProbe: evidence }, null, 2));
