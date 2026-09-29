/**
 * Task57R-F3E-R1V Chrome qualification.
 * Local static dist only. One AUTO Create case per CAT:C01–CAT:C12,
 * unarmed and one-shot repaired. Production bundles do not contain the fault wrap.
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
const outPath = process.env.SPE_R1V_OUT || "/tmp/r1v-chrome.json";

const GOALS = {
  "CAT:C01": "Decide whether to launch the checklist in four weeks.",
  "CAT:C02": "Research current accessibility evidence for public websites.",
  "CAT:C03": "Write an executive brief about the launch.",
  "CAT:C04": "Translate the launch note into Spanish.",
  "CAT:C05": "Teach the concept of indexes with three check questions.",
  "CAT:C06": "Analyze the permit dataset for anomalies.",
  "CAT:C07": "Execute the release checklist and record each postcondition.",
  "CAT:C08": "Business offer for a writing app with pricing and channels.",
  "CAT:C09": "Code a PostgreSQL query for monthly active users.",
  "CAT:C10": "Storyboard a 15-second product video.",
  "CAT:C11": "Career plan for a product designer interview.",
  "CAT:C12": "Roleplay a coastal dawn scene with two characters.",
};

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
    window.__speR1V = {
      arm: armed,
      posts: 0,
      observations: [],
      k3: [],
      pending: null,
      externalHosts: [],
    };
    window.__speR1VDrop = (prompt) => {
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
          window.__speR1V.posts += 1;
          const original = message.request.compiled_prompt;
          if (window.__speR1V.arm) {
            const fault = window.__speR1VDrop(original);
            if (fault) {
              next = { ...message, request: { ...message.request, compiled_prompt: fault.corrupted } };
              window.__speR1V.pending = {
                id: message.id,
                canonical: original,
                corrupted: fault.corrupted,
                removed: fault.removed,
              };
            }
          } else {
            window.__speR1V.pending = { id: message.id, canonical: original, corrupted: null, removed: null };
          }
        }
        if (message && message.type === "evaluate" && typeof message.jsonText === "string" && message.jsonText.includes('"spe_api":"k3"')) {
          window.__speR1V.pendingK3 = message.id;
        }
        return post(next, transfer);
      };
      worker.addEventListener("message", (event) => {
        const data = event.data;
        const pending = window.__speR1V.pending;
        if (pending && data && data.id === pending.id && data.type === "done") {
          window.__speR1V.observations.push({
            ...pending,
            output: data.result && data.result.output ? data.result.output : null,
            error: data.error || null,
          });
          window.__speR1V.pending = null;
        }
        if (window.__speR1V.pendingK3 && data && data.id === window.__speR1V.pendingK3 && data.type === "done") {
          window.__speR1V.k3.push(data.result && data.result.output ? data.result.output : null);
          window.__speR1V.pendingK3 = null;
        }
      });
      return worker;
    };
  }, arm);
}

function watchHosts(page, sink) {
  page.on("request", (request) => {
    try {
      const host = new URL(request.url()).hostname;
      if (host !== "127.0.0.1" && host !== "localhost") sink.add(host);
    } catch {
      sink.add(request.url());
    }
  });
}

async function openCreate(page, base) {
  await page.goto(`${base}/create`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Your idea" }).waitFor({ state: "visible" });
}

async function resetTrace(page) {
  await page.evaluate(() => {
    localStorage.setItem("spe.web.history.items.v1", "[]");
    const trace = window.__speR1V;
    trace.posts = 0;
    trace.observations = [];
    trace.k3 = [];
    trace.pending = null;
    trace.pendingK3 = null;
  });
}

async function compileIdea(page, text) {
  await resetTrace(page);
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
  const item = history[0] || null;
  return {
    visible,
    json: exported.rendered_prompt,
    spe: spe.rendered_prompt,
    copy: copied,
    history: item && item.artifact ? item.artifact.rendered_prompt : null,
    uiCategory: spe.category || null,
    historyCategory: item ? item.category : null,
  };
}

function presentationLabel(visible) {
  const marker = "## Category presentation\n";
  const start = visible.indexOf(marker);
  if (start < 0) return null;
  const rest = visible.slice(start + marker.length);
  const end = rest.indexOf("\n");
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

async function readDisplayLabel(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find((node) => (node.textContent || "").includes("Category"));
    const select = label ? label.querySelector("select") : null;
    return select ? select.value : null;
  });
}

function shortId(categoryId) {
  return categoryId.replace("CAT:", "");
}

function recordCase(kind, categoryId, goal, displayLabel, trace, surfaces, receiptText) {
  const observation = trace.observations[0] || null;
  const output = observation && observation.output;
  const reconstruction = output && output.reconstruction;
  const plan = reconstruction && reconstruction.plan;
  const receipt = output && output.receipt;
  const subject = output && output.subject;
  const effect = subject && subject.effect_plan;
  const k3 = trace.k3[0] || null;
  const route = k3 && k3.category_route;
  const compiled = effect && effect.compiled_prompt;
  const active = subject && subject.xcat && subject.xcat.active_category;
  const shown = presentationLabel(surfaces.visible);
  const kernelLabel = k3 && k3.category_context && k3.category_context.display_label;
  const errors = [];
  if (shown !== "AI Assistant") errors.push(`presentation:${shown || "missing"}`);
  if (kernelLabel !== "AI Assistant") errors.push(`kernel_label:${kernelLabel || "missing"}`);
  if (surfaces.uiCategory !== "AI Assistant") errors.push(`artifact_category:${surfaces.uiCategory || "missing"}`);
  if (surfaces.historyCategory !== "AI Assistant") errors.push(`history_category:${surfaces.historyCategory || "missing"}`);
  if (displayLabel && displayLabel !== "AI Assistant") errors.push(`select:${displayLabel}`);
  if (shown === shortId(categoryId) || shown === categoryId) errors.push("display_drives_category");
  if (active !== shortId(categoryId)) errors.push(`category:${active || "missing"}`);
  if (!route || route.primary_category !== categoryId) errors.push("route");
  if (!k3 || k3.claims_pass !== false) errors.push("claims_pass");
  if (!k3 || k3.execution_authorized !== false) errors.push("k3_execution");
  if (!receipt || receipt.execution_authorized !== false) errors.push("receipt_execution");
  if (receipt && receipt.verdict === "UNKNOWN") errors.push("unknown_as_pass");
  if (compiled === "NO_EFFECT_PLAN" || (typeof compiled === "string" && compiled === surfaces.visible && compiled === "NO_EFFECT_PLAN")) {
    errors.push("no_effect_plan_rendered");
  }
  if (typeof compiled !== "string" || compiled === "NO_EFFECT_PLAN" || !compiled.startsWith("## ")) {
    errors.push("effect_plan_prompt");
  }
  if (surfaces.visible === "NO_EFFECT_PLAN") errors.push("visible_sentinel");
  if (trace.posts !== 1) errors.push(`posts:${trace.posts}`);
  const base = {
    category_id: categoryId,
    goal,
    display_label: shown,
    kernel_display_label: kernelLabel,
    artifact_category: surfaces.uiCategory,
    history_category: surfaces.historyCategory,
    select_label: displayLabel,
    active_category: active,
    route_primary: route && route.primary_category,
    plan: plan && plan.disposition,
    kept: reconstruction && reconstruction.kept,
    attempt_index: plan && plan.attempt_index,
    max_attempts: plan && plan.max_attempts,
    receipt_verdict: receipt && receipt.verdict,
    claims_pass: k3 && k3.claims_pass,
    execution_authorized: receipt && receipt.execution_authorized,
    effect_plan_is_object: Boolean(effect && typeof effect === "object" && !Array.isArray(effect)),
    compiled_is_prompt: typeof compiled === "string" && compiled.startsWith("## ") && compiled !== "NO_EFFECT_PLAN",
    quality_posts: trace.posts,
    surfaces_match:
      surfaces.visible === surfaces.json &&
      surfaces.visible === surfaces.spe &&
      surfaces.visible === surfaces.copy &&
      surfaces.visible === surfaces.history,
    receipt_text_present: Boolean(receiptText),
  };
  if (kind === "normal") {
    if (!plan || plan.disposition !== "NOT_TRIGGERED") errors.push("plan");
    if (!reconstruction || reconstruction.kept !== "original") errors.push("kept");
    if (surfaces.visible !== observation.canonical) errors.push("visible_kept");
    if (!base.surfaces_match) errors.push("surfaces");
    if (!receipt || receipt.verdict !== "PASS") errors.push("verdict");
  } else {
    const qualification = qualifyRepairedBrowserObservation({
      canonical: observation && observation.canonical,
      corrupted: observation && observation.corrupted,
      removed: observation && observation.removed,
      qualityPosts: trace.posts,
      reconstruction,
      receipt,
      visible: surfaces.visible,
      artifact: surfaces.history,
      history: surfaces.history,
      copy: surfaces.copy,
      json: surfaces.json,
      spe: surfaces.spe,
      receiptText,
    });
    if (!qualification.pass) errors.push(...qualification.errors);
    if (active !== shortId(categoryId)) errors.push("category_preserved");
  }
  return { ...base, status: errors.length === 0 ? "PASS" : "HOLD", errors };
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("r1v browser: dist missing; build the web app first");
  process.exit(2);
}

const { server, base } = await startStatic();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const externalHosts = new Set();
const report = {
  normal: {},
  repaired: {},
  core_b: "FAIL",
  external_hosts: [],
  error: null,
};

try {
  const normalContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await installHarness(normalContext, { arm: false });
  const normalPage = await normalContext.newPage();
  watchHosts(normalPage, externalHosts);
  await openCreate(normalPage, base);

  const repairContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    serviceWorkers: "block",
  });
  await installHarness(repairContext, { arm: true });
  const repairPage = await repairContext.newPage();
  watchHosts(repairPage, externalHosts);
  await openCreate(repairPage, base);

  for (const [categoryId, goal] of Object.entries(GOALS)) {
    try {
      const built = await compileIdea(normalPage, goal);
      const surfaces = await readSurfaces(normalPage, built.visible);
      const trace = await normalPage.evaluate(() => window.__speR1V);
      const displayLabel = await readDisplayLabel(normalPage);
      report.normal[categoryId] = recordCase("normal", categoryId, goal, displayLabel, trace, surfaces, built.receipt);
    } catch (err) {
      report.normal[categoryId] = {
        category_id: categoryId,
        status: "HOLD",
        errors: [String(err && err.message ? err.message : err)],
      };
    }
    try {
      const built = await compileIdea(repairPage, goal);
      const surfaces = await readSurfaces(repairPage, built.visible);
      const trace = await repairPage.evaluate(() => window.__speR1V);
      const displayLabel = await readDisplayLabel(repairPage);
      report.repaired[categoryId] = recordCase("repaired", categoryId, goal, displayLabel, trace, surfaces, built.receipt);
    } catch (err) {
      report.repaired[categoryId] = {
        category_id: categoryId,
        status: "HOLD",
        errors: [String(err && err.message ? err.message : err)],
      };
    }
  }

  const blockedContext = await browser.newContext({ serviceWorkers: "block" });
  const blocked = await blockedContext.newPage();
  watchHosts(blocked, externalHosts);
  await blocked.route("**/spe_wasm.wasm", (route) => route.abort());
  const idea = GOALS["CAT:C03"];
  await blocked.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await blocked.getByRole("textbox", { name: "Your idea" }).fill(idea);
  await blocked.getByRole("button", { name: "Build my prompt" }).click();
  await blocked.getByRole("region", { name: "Safe fallback" }).waitFor({ timeout: 30000 });
  const fallback = (await blocked.locator(".spe-create-result pre").innerText()).trim();
  const promptRegion = await blocked.getByRole("region", { name: "Your prompt" }).count();
  const speCount = await blocked.getByRole("button", { name: ".spe" }).count();
  const lower = fallback.toLowerCase();
  const coreErrors = [];
  if (!fallback.includes(idea)) coreErrors.push("idea_missing");
  if (lower.includes("verified")) coreErrors.push("verified_claim");
  if (speCount !== 0) coreErrors.push("spe_export");
  if (promptRegion !== 0) coreErrors.push("success_artifact");
  report.core_b = coreErrors.length === 0 ? "PASS" : "HOLD";
  report.core_b_errors = coreErrors;
  report.core_b_excerpt = fallback.slice(0, 240);
  await blocked.close();
  await blockedContext.close();
  await repairContext.close();
  await normalContext.close();
} catch (err) {
  report.error = String(err && err.message ? err.message : err);
} finally {
  report.external_hosts = [...externalHosts];
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}

const normalFail = Object.values(report.normal).filter((item) => item.status !== "PASS");
const repairedFail = Object.values(report.repaired).filter((item) => item.status !== "PASS");
if (report.core_b !== "PASS" || normalFail.length || repairedFail.length || report.external_hosts.length || report.error) {
  process.exit(2);
}
assert.equal(Object.keys(report.normal).length, 12);
assert.equal(Object.keys(report.repaired).length, 12);
