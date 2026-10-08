/**
 * Chrome qualification for default AI Assistant Create, C01–C12.
 * Fault injection wraps Worker.postMessage in this test only.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { qualifyRepairedBrowserObservation } from "./repaired-browser-qualification.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const reportPath = join(root, "..", "..", "proofs", "task57_quality_reconstruction_20260929", "r1v-chrome.json");

const CASES = [
  ["C01", "Decide whether to launch the checklist in four weeks."],
  ["C02", "Research current accessibility evidence for public websites."],
  ["C03", "Write an executive brief about the launch."],
  ["C04", "Translate the launch note into Spanish."],
  ["C05", "Teach the concept of indexes with three check questions."],
  ["C06", "Analyze the permit dataset for anomalies."],
  ["C07", "Execute the release checklist and record each postcondition."],
  ["C08", "Business offer for a writing app with pricing and channels."],
  ["C09", "Code a PostgreSQL query for monthly active users."],
  ["C10", "Storyboard a 15-second product video."],
  ["C11", "Career plan for a product designer interview."],
  ["C12", "Roleplay a coastal dawn scene with two characters."],
];

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

async function resetTrace(page) {
  await page.evaluate(() => {
    window.__speF2.posts = 0;
    window.__speF2.observations = [];
    window.__speF2.pending = null;
  });
}

async function compileIdea(page, text) {
  await page.getByRole("textbox", { name: "Your idea" }).fill(text);
  await page.getByRole("button", { name: "Build my prompt" }).click();
  await page.getByRole("region", { name: "Your prompt" }).waitFor({ timeout: 60000 });
  const visible = (await page.locator(".spe-create-result pre").first().innerText()).trim();
  return { visible };
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
    artifact: history[0] && history[0].artifact ? history[0].artifact.rendered_prompt : null,
  };
}

function activeCategory(output) {
  return output && output.subject && output.subject.xcat && output.subject.xcat.active_category;
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("browser: dist missing; build the web app first");
  process.exit(2);
}

const report = {
  normal: {},
  repair: {},
  surface_mismatches: [],
  core_b: "HOLD",
  holds: [],
};
const { server, base } = await startStatic();
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch (err) {
  report.holds.push(`CHROME_LAUNCH:${String(err && err.message ? err.message : err)}`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  server.close();
  process.exit(2);
}

try {
  const normalContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await installHarness(normalContext, { arm: false });
  const normalPage = await normalContext.newPage();
  await normalPage.goto(`${base}/create`, { waitUntil: "networkidle" });
  const category = normalPage.getByLabel("Category");
  await category.waitFor({ state: "attached" });
  assert.equal(await category.inputValue(), "AI Assistant");

  for (const [id, goal] of CASES) {
    await resetTrace(normalPage);
    assert.equal(await category.inputValue(), "AI Assistant");
    const built = await compileIdea(normalPage, goal);
    const surfaces = await readSurfaces(normalPage, built.visible);
    const trace = await normalPage.evaluate(() => window.__speF2);
    const observation = trace.observations[0];
    const output = observation && observation.output;
    const reconstruction = output && output.reconstruction;
    const plan = reconstruction && reconstruction.plan;
    const actual = activeCategory(output);
    const kept = reconstruction && reconstruction.kept_subject && reconstruction.kept_subject.compiled_prompt;
    const row = {
      expected: id,
      actual: actual || null,
      posts: trace.posts,
      kept: reconstruction && reconstruction.kept,
      plan: plan && plan.disposition,
      effect: output && output.subject && output.subject.effect_plan && output.subject.effect_plan.disposition,
      verdict: output && output.receipt && output.receipt.verdict,
    };
    const surfacesMatch =
      surfaces.visible === kept &&
      surfaces.artifact === kept &&
      surfaces.history === kept &&
      surfaces.copy === kept &&
      surfaces.json === kept &&
      surfaces.spe === kept;
    if (!surfacesMatch) report.surface_mismatches.push({ id, mode: "normal" });
    const lawful =
      actual === id &&
      trace.posts === 1 &&
      reconstruction &&
      reconstruction.kept === "original" &&
      plan &&
      plan.disposition === "NOT_TRIGGERED" &&
      output.receipt &&
      output.receipt.verdict === "PASS" &&
      surfacesMatch;
    row.pass = Boolean(lawful);
    if (!row.pass) report.holds.push(`NORMAL_${id}`);
    report.normal[id] = row;
  }
  await normalContext.close();

  const repairContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await installHarness(repairContext, { arm: true });
  const repairPage = await repairContext.newPage();
  await repairPage.goto(`${base}/create`, { waitUntil: "networkidle" });
  const repairCategory = repairPage.getByLabel("Category");
  assert.equal(await repairCategory.inputValue(), "AI Assistant");

  for (const [id, goal] of CASES) {
    await resetTrace(repairPage);
    assert.equal(await repairCategory.inputValue(), "AI Assistant");
    const built = await compileIdea(repairPage, goal);
    const surfaces = await readSurfaces(repairPage, built.visible);
    const trace = await repairPage.evaluate(() => window.__speF2);
    const observation = trace.observations[0];
    const output = observation && observation.output;
    const reconstruction = output && output.reconstruction;
    if (!observation || !observation.removed) {
      report.repair[id] = { hold: "NO_PROTECTED_HARD_CONSTRAINT_TO_REMOVE" };
      report.holds.push(`REPAIR_${id}:NO_PROTECTED_HARD_CONSTRAINT_TO_REMOVE`);
      continue;
    }
    const qualification = qualifyRepairedBrowserObservation({
      canonical: observation.canonical,
      corrupted: observation.corrupted,
      removed: observation.removed,
      qualityPosts: trace.posts,
      reconstruction,
      receipt: output && output.receipt,
      visible: surfaces.visible,
      artifact: surfaces.artifact,
      history: surfaces.history,
      copy: surfaces.copy,
      json: surfaces.json,
      spe: surfaces.spe,
      receiptText: "",
    });
    const actual = activeCategory(output);
    const kept = reconstruction && reconstruction.kept_subject && reconstruction.kept_subject.compiled_prompt;
    const row = {
      expected: id,
      actual,
      posts: trace.posts,
      attempts: reconstruction && reconstruction.plan && reconstruction.plan.attempt_index,
      kept: reconstruction && reconstruction.kept,
      plan: reconstruction && reconstruction.plan && reconstruction.plan.disposition,
      delta: reconstruction && reconstruction.quality_delta && reconstruction.quality_delta.disposition,
      regressions: reconstruction && reconstruction.quality_delta && reconstruction.quality_delta.protected_regressions,
      verdict: output && output.receipt && output.receipt.verdict,
      removed_restored: Boolean(kept && kept.includes(observation.removed)),
      visible_equals_kept: surfaces.visible === kept,
      visible_equals_corrupted: surfaces.visible === observation.corrupted,
      qualification_errors: qualification.errors,
      pass: qualification.pass && actual === id,
    };
    if (!row.pass) report.holds.push(`REPAIR_${id}:${qualification.errors.join(",")}`);
    const mismatch =
      surfaces.visible !== kept ||
      surfaces.artifact !== kept ||
      surfaces.history !== kept ||
      surfaces.copy !== kept ||
      surfaces.json !== kept ||
      surfaces.spe !== kept;
    if (mismatch) report.surface_mismatches.push({ id, mode: "repair" });
    report.repair[id] = row;
  }
  await repairContext.close();

  const blockedContext = await browser.newContext({ serviceWorkers: "block" });
  const blocked = await blockedContext.newPage();
  await blocked.route("**/spe_wasm.wasm", (route) => route.abort());
  await blocked.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await blocked.getByRole("textbox", { name: "Your idea" }).fill(CASES[2][1]);
  await blocked.getByRole("button", { name: "Build my prompt" }).click();
  await blocked.getByRole("region", { name: "Safe fallback" }).waitFor({ timeout: 30000 });
  const fallback = (await blocked.locator(".spe-create-result pre").innerText()).trim();
  const speCount = await blocked.getByRole("button", { name: ".spe" }).count();
  const successArtifact = await blocked.getByRole("region", { name: "Your prompt" }).count();
  report.core_b = {
    fallback_includes_request: fallback.includes(CASES[2][1]),
    claims_verified: fallback.toLowerCase().includes("verified"),
    spe_export_count: speCount,
    success_artifact: successArtifact,
    pass:
      fallback.includes(CASES[2][1]) &&
      !fallback.toLowerCase().includes("verified") &&
      speCount === 0 &&
      successArtifact === 0,
  };
  if (!report.core_b.pass) report.holds.push("CORE_B");
  await blockedContext.close();
} catch (err) {
  report.holds.push(`EXCEPTION:${String(err && err.message ? err.message : err)}`);
  throw err;
} finally {
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  server.close();
}

if (report.holds.length) process.exit(2);
