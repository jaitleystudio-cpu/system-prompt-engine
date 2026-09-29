/**
 * Local Chrome proof for Create.
 * The repaired case corrupts the quality request inside this test only,
 * by wrapping Worker.postMessage. Production bundles do not contain that wrap.
 * Receipt text cannot make the repaired case pass.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  killedRepairedBrowserMutants,
  qualifyRepairedBrowserObservation,
} from "./repaired-browser-qualification.mjs";

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

async function installHarness(context, { arm }) {
  await context.addInitScript((armed) => {
    localStorage.setItem("spe.web.history.opt_in.v1", "1");
    const nativeWorker = window.Worker;
    window.__speF2 = { arm: armed, posts: 0, observations: [], pending: null };
    window.__speF2Drop = (prompt) => {
      const marker = "## Hard constraints\n";
      const start = prompt.indexOf(marker);
      if (start < 0) return null;
      const bodyStart = start + marker.length;
      const end = prompt.indexOf("\n\n", bodyStart);
      const body = end < 0 ? prompt.slice(bodyStart) : prompt.slice(bodyStart, end);
      const lines = body.split("\n");
      const index = lines.findIndex((line) => line.startsWith("- "));
      if (index < 0) return null;
      const removed = lines[index].slice(2);
      const keptLines = lines.filter((_, lineIndex) => lineIndex !== index);
      const nextBody = keptLines.length > 0 ? keptLines.join("\n") : "none";
      const corrupted = prompt.slice(0, bodyStart) + nextBody + (end < 0 ? "" : prompt.slice(end));
      if (corrupted === prompt) return null;
      return { corrupted, removed };
    };
    window.Worker = function (url, options) {
      const worker = new nativeWorker(url, options);
      const post = worker.postMessage.bind(worker);
      worker.postMessage = (message, transfer) => {
        let next = message;
        if (message && message.type === "quality" && message.request && typeof message.request.compiled_prompt === "string") {
          window.__speF2.posts += 1;
          const original = message.request.compiled_prompt;
          if (window.__speF2.arm) {
            const fault = window.__speF2Drop(original);
            if (fault) {
              next = { ...message, request: { ...message.request, compiled_prompt: fault.corrupted } };
              window.__speF2.pending = {
                id: message.id,
                canonical: original,
                corrupted: fault.corrupted,
                removed: fault.removed,
              };
            }
          } else {
            window.__speF2.pending = { id: message.id, canonical: original, corrupted: null, removed: null };
          }
        }
        return post(next, transfer);
      };
      worker.addEventListener("message", (event) => {
        const data = event.data;
        const pending = window.__speF2.pending;
        if (!pending || !data || data.id !== pending.id || data.type !== "done") return;
        window.__speF2.observations.push({
          ...pending,
          output: data.result && data.result.output ? data.result.output : null,
          error: data.error || null,
        });
        window.__speF2.pending = null;
      });
      return worker;
    };
  }, arm);
}

async function openCreate(page, base) {
  await page.goto(`${base}/create`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Your idea" }).waitFor({ state: "visible" });
}

async function compileIdea(page, text) {
  await page.getByRole("textbox", { name: "Your idea" }).fill(text);
  await page.getByRole("button", { name: "Build my prompt" }).click();
  await page.getByRole("region", { name: "Your prompt" }).waitFor({ timeout: 60000 });
  const visible = (await page.locator(".spe-create-result pre").first().innerText()).trim();
  const receipt = (await page.getByRole("complementary", { name: "Quality receipt" }).innerText()).trim();
  return { visible, receipt };
}

async function readSurfaces(page, visible) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON" }).click();
  const jsonDownload = await downloadPromise;
  const exported = JSON.parse(readFileSync(await jsonDownload.path(), "utf8"));
  const spePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: ".spe" }).click();
  const speDownload = await spePromise;
  const spe = JSON.parse(readFileSync(await speDownload.path(), "utf8"));
  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem("spe.web.history.items.v1") || "[]"));
  return {
    visible,
    json: exported.rendered_prompt,
    spe: spe.rendered_prompt,
    copy: copied,
    history: history[0] && history[0].artifact ? history[0].artifact.rendered_prompt : null,
    historyPreview: history[0] ? history[0].prompt_preview : null,
  };
}

const mutants = killedRepairedBrowserMutants();
assert.deepEqual(mutants, ["F2-01", "F2-02", "F2-03", "F2-04", "F2-05", "F2-06", "F2-07", "F2-08", "F2-09", "F2-10"]);

if (!existsSync(join(dist, "index.html"))) {
  console.error("browser: dist missing; build the web app first");
  process.exit(2);
}

const { server, base } = await startStatic();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {
  mutants_killed: mutants.length,
  canonical: "FAIL",
  repaired: "FAIL",
  unresolved: "FAIL",
  core_b: "FAIL",
  export_consistency: "FAIL",
  hold: null,
};

try {
  const canonicalContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await installHarness(canonicalContext, { arm: false });
  const canonicalPage = await canonicalContext.newPage();
  await openCreate(canonicalPage, base);
  const canonicalBuilt = await compileIdea(canonicalPage, IDEA);
  const canonicalSurfaces = await readSurfaces(canonicalPage, canonicalBuilt.visible);
  const canonicalTrace = await canonicalPage.evaluate(() => window.__speF2);
  assert.equal(canonicalTrace.arm, false);
  assert.equal(canonicalTrace.posts, 1);
  assert.equal(canonicalSurfaces.visible, canonicalSurfaces.json);
  assert.equal(canonicalSurfaces.visible, canonicalSurfaces.spe);
  assert.equal(canonicalSurfaces.visible, canonicalSurfaces.copy);
  assert.equal(canonicalSurfaces.history, canonicalSurfaces.json);
  assert.equal(canonicalSurfaces.historyPreview, canonicalSurfaces.visible.slice(0, 240));
  assert.equal(canonicalBuilt.visible.includes("verified better"), false);
  const canonicalOutput = canonicalTrace.observations[0] && canonicalTrace.observations[0].output;
  const canonicalPlan = canonicalOutput && canonicalOutput.reconstruction && canonicalOutput.reconstruction.plan;
  report.canonical_plan = canonicalPlan ? canonicalPlan.disposition : null;
  if (canonicalOutput && canonicalOutput.reconstruction && canonicalOutput.reconstruction.kept === "repaired") {
    throw new Error("unarmed Create rewrote the prompt");
  }
  assert.equal(canonicalTrace.observations[0].canonical, canonicalSurfaces.json);
  report.canonical = "PASS";
  report.export_consistency = "PASS";
  report.unresolved = "PASS";

  const repairContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await installHarness(repairContext, { arm: true });
  const repairPage = await repairContext.newPage();
  await openCreate(repairPage, base);
  const repairBuilt = await compileIdea(repairPage, IDEA);
  const repairSurfaces = await readSurfaces(repairPage, repairBuilt.visible);
  const repairTrace = await repairPage.evaluate(() => window.__speF2);
  const observation = repairTrace.observations[0];
  const output = observation && observation.output;
  const reconstruction = output && output.reconstruction;
  const qualification = qualifyRepairedBrowserObservation({
    canonical: observation && observation.canonical,
    corrupted: observation && observation.corrupted,
    removed: observation && observation.removed,
    qualityPosts: repairTrace.posts,
    reconstruction,
    receipt: output && output.receipt,
    visible: repairSurfaces.visible,
    artifact: repairSurfaces.history,
    history: repairSurfaces.history,
    copy: repairSurfaces.copy,
    json: repairSurfaces.json,
    spe: repairSurfaces.spe,
    receiptText: repairBuilt.receipt,
  });
  report.fault = {
    posts: repairTrace.posts,
    removed: observation && observation.removed,
    kept: reconstruction && reconstruction.kept,
    plan: reconstruction && reconstruction.plan && reconstruction.plan.disposition,
    delta: reconstruction && reconstruction.quality_delta && reconstruction.quality_delta.disposition,
    attempt_index: reconstruction && reconstruction.plan && reconstruction.plan.attempt_index,
    max_attempts: reconstruction && reconstruction.plan && reconstruction.plan.max_attempts,
    verdict: output && output.receipt && output.receipt.verdict,
    reason_codes: reconstruction && reconstruction.plan && reconstruction.plan.reason_codes,
    visible_equals_kernel: Boolean(reconstruction && repairSurfaces.visible === reconstruction.kept_subject.compiled_prompt),
    visible_equals_corrupted: Boolean(observation && repairSurfaces.visible === observation.corrupted),
    qualification_errors: qualification.errors,
  };
  if (qualification.pass) {
    report.repaired = "PASS";
    report.export_consistency = "PASS";
  } else {
    report.repaired = "HOLD";
    report.hold = "HOLD_LIVE_CREATE_REPAIR_NOT_ACCEPTED";
    assert.notEqual(repairSurfaces.visible, observation.corrupted);
    assert.equal(repairSurfaces.visible, repairSurfaces.json);
    assert.equal(repairSurfaces.visible, repairSurfaces.spe);
    assert.equal(repairSurfaces.visible, repairSurfaces.copy);
    assert.equal(repairSurfaces.history, repairSurfaces.json);
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
  await repairContext.close();
  await canonicalContext.close();
} catch (err) {
  report.error = String(err && err.message ? err.message : err);
  throw err;
} finally {
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}

if (report.repaired !== "PASS") process.exit(2);
