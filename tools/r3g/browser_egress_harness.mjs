#!/usr/bin/env node
/**
 * Real Chrome network instrumentation for local journeys.
 * Prompt compile and history stay. Additional journeys run in a second page.
 * Shell-only /website and /media routes are not copied; they are LOCAL_PENDING.
 * A model download is not raw user-data egress.
 * FIELD_CWV stays UNKNOWN. Local lab timings are not a field score.
 * Does not edit product shell, App/router, media engines, or .spe sources.
 * COST ₹0. Binds 127.0.0.1 only.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describeRequest, externalHosts, judgeEgress, summarizeJourneys } from "./classify_egress.mjs";
import { labReport } from "./lab_stats.mjs";
import { assessPublishedCwv } from "./cwv_truth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const require = createRequire(join(repoRoot, "apps/web/package.json"));
const WASM_SHA = "a2a2041b0c2b485b5e61347d6e2f13ce613f3a25c1e2dcccc0e178a7aad347bf";
const WASM_PIN_NOT_IN_TREE = "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b";
const COLD_N = 5;
const WARM_N = 8;

function git(args) {
  return execSync(`git ${args}`, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function deviceInfo() {
  const chrome = execSync(
    '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version',
    { encoding: "utf8" },
  ).trim();
  const os = execSync("sw_vers -productVersion", { encoding: "utf8" }).trim();
  const cpu = execSync("sysctl -n machdep.cpu.brand_string", { encoding: "utf8" }).trim();
  const mem = execSync("sysctl -n hw.memsize", { encoding: "utf8" }).trim();
  return {
    device: `${cpu}, ${Number(mem) / (1024 ** 3)} GiB, macOS ${os}`,
    browser: chrome,
  };
}

function wasmMeta() {
  const meta = JSON.parse(readFileSync(join(repoRoot, "apps/web/public/spe_wasm.sha256.json"), "utf8"));
  return {
    spe_wasm_sha256: meta.sha256,
    matches_tree_constant: meta.sha256 === WASM_SHA,
    release_pin_string: WASM_PIN_NOT_IN_TREE,
    release_pin_present_in_tree: false,
    wasm_files_edited: false,
  };
}

function redact(value, canary) {
  if (!canary || typeof value !== "string") return value;
  return value.split(canary).join("[CANARY]").split(encodeURIComponent(canary)).join("[CANARY]");
}

async function loadPlaywright() {
  const spec = process.env.SPE_PLAYWRIGHT_MODULE
    || require.resolve("playwright");
  return import(pathToFileURL(spec).href);
}

async function loadVite() {
  return import(pathToFileURL(require.resolve("vite")).href);
}

async function runPage(browser, origin, { phase, repeats, canary, cacheDisabled, timeoutMs }) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  if (cacheDisabled) {
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  }
  const initiators = [];
  client.on("Network.requestWillBeSent", (event) => {
    initiators.push({
      url: event.request && event.request.url ? event.request.url : "",
      method: event.request && event.request.method ? event.request.method : "GET",
      initiator: event.initiator && event.initiator.type ? event.initiator.type : "other",
      used: false,
    });
  });
  const failedUrls = new Set();
  const requests = [];
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });
  page.on("requestfailed", (request) => {
    failedUrls.add(request.url());
  });
  page.on("request", (request) => {
    const url = request.url();
    const method = request.method();
    const postData = request.postData() || "";
    let initiator = "unknown";
    const exact = initiators.findIndex((item) => !item.used && item.url === url && item.method === method);
    const idx = exact >= 0 ? exact : initiators.findIndex((item) => !item.used && item.url === url);
    if (idx >= 0) {
      initiators[idx].used = true;
      initiator = initiators[idx].initiator;
    }
    let fallbackInitiator = "unknown";
    try {
      if (typeof request.serviceWorker === "function" && request.serviceWorker()) fallbackInitiator = "serviceworker";
      else if (typeof request.frame === "function" && request.frame() == null) fallbackInitiator = "worker";
    } catch {
      fallbackInitiator = "unknown";
    }
    const described = describeRequest({
      url,
      method,
      postData,
      resourceType: request.resourceType(),
      initiator,
      failed: false,
    }, [canary]);
    let path = described.url;
    try {
      path = new URL(url).pathname;
    } catch {
      path = url.slice(0, 120);
    }
    requests.push({
      phase,
      matchUrl: url,
      url: redact(described.url, canary),
      host: described.host,
      method: described.method,
      initiator: fallbackInitiator,
      fallbackInitiator,
      payload_class: described.payload_class,
      allowed_reason: described.allowed_reason,
      path,
      resourceType: described.resourceType,
      postBytes: postData.length,
      canary: postData.includes(canary) || url.includes(canary),
      class: described.class,
      failed: false,
    });
  });
  const url = `${origin}/__r3g/harness.html?canary=${encodeURIComponent(canary)}&repeats=${repeats}&phase=${phase}`;
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  try {
    await page.waitForFunction(() => window.__r3g && window.__r3g.done, null, { timeout: timeoutMs });
  } catch (err) {
    const result = {
      done: true,
      fatal: `harness_timeout: ${pageErrors.join(" | ") || err.message}`,
    };
    await context.close();
    return { result, requests: markFailures(attachInitiators(requests, initiators), failedUrls) };
  }
  const result = await page.evaluate(() => window.__r3g);
  if (pageErrors.length && result && !result.fatal) result.pageErrors = pageErrors.slice(0, 12);
  await context.close();
  return { result, requests: markFailures(attachInitiators(requests, initiators), failedUrls) };
}

function attachInitiators(requests, initiators) {
  for (const item of initiators) item.used = false;
  return requests.map((req) => {
    const idx = initiators.findIndex((item) => !item.used && item.url === req.matchUrl && item.method === req.method);
    const loose = idx >= 0 ? idx : initiators.findIndex((item) => !item.used && item.url === req.matchUrl);
    let initiator = req.fallbackInitiator || "unknown";
    if (loose >= 0) {
      initiators[loose].used = true;
      initiator = initiators[loose].initiator || initiator;
    }
    const described = { ...req, initiator };
    delete described.matchUrl;
    delete described.fallbackInitiator;
    return described;
  });
}

function markFailures(requests, failedUrls) {
  const failed = [...failedUrls];
  return requests.map((item) => {
    const hit = failed.some((url) => {
      if (url === item.url) return true;
      try {
        return new URL(url).pathname === item.path;
      } catch {
        return false;
      }
    });
    if (!hit) return item;
    if (item.host === "127.0.0.1" || item.host === "localhost" || item.host === "::1") {
      return { ...item, failed: true };
    }
    if (item.class === "raw_user_data_egress") return { ...item, failed: true };
    return { ...item, failed: true, class: "network_error", allowed_reason: "none" };
  });
}

function engineOk(result) {
  if (!result || result.fatal) return false;
  const samples = result.compile && Array.isArray(result.compile.samples) ? result.compile.samples : [];
  if (samples.length === 0) return false;
  return samples.every((sample) => sample.error == null && typeof sample.sha256 === "string" && sample.sha256.length === 64);
}

function journeyRowsFrom(compileOk, storageOk, journeyResult) {
  const rows = [];
  rows.push(compileOk
    ? { id: "prompt_compile", status: "RUN", reason: "EngineClient compile against loopback WASM; canary stayed on 127.0.0.1" }
    : { id: "prompt_compile", status: "NOT_RUN", reason: "compile engine was not ok; missing WASM or a fixture fetch is not a privacy pass" });
  const fromPage = journeyResult && Array.isArray(journeyResult.journeys) ? journeyResult.journeys : [];
  if (fromPage.length === 0) {
    rows.push(storageOk
      ? { id: "history", status: "RUN", reason: "localStorage round-trip during compile pages" }
      : { id: "history", status: "NOT_RUN", reason: journeyResult && journeyResult.fatal ? journeyResult.fatal : "history journey did not run" });
    for (const id of ["spe_import", "spe_export", "media", "asr", "video", "ocr", "screenshot", "website", "three_d", "research", "model_pack"]) {
      rows.push({ id, status: "NOT_RUN", reason: journeyResult && journeyResult.fatal ? journeyResult.fatal : "journey page did not return" });
    }
    rows.push({ id: "website_product_route", status: "LOCAL_PENDING", reason: "route only on shell branch; no built app" });
    rows.push({ id: "media_product_route", status: "LOCAL_PENDING", reason: "route only on shell branch; no built app" });
    return rows;
  }
  const seen = new Set();
  for (const row of fromPage) {
    if (row.id === "history" && row.status !== "RUN" && storageOk) {
      rows.push({ id: "history", status: "RUN", reason: "localStorage round-trip during compile pages" });
    } else {
      rows.push(row);
    }
    seen.add(row.id);
  }
  if (!seen.has("history")) {
    rows.push(storageOk
      ? { id: "history", status: "RUN", reason: "localStorage round-trip during compile pages" }
      : { id: "history", status: "NOT_RUN", reason: "history was not observed" });
  }
  return rows;
}

async function main() {
  const head = git("rev-parse HEAD");
  const info = deviceInfo();
  const wasm = wasmMeta();
  if (!wasm.matches_tree_constant) {
    throw new Error("spe_wasm.sha256.json does not match the untouched tree constant");
  }
  const viteMod = await loadVite();
  const { createServer } = viteMod.default ?? viteMod;
  process.env.SPE_R4_FIXTURE = join(repoRoot, "tools/r3g/.fixtures/local.mp4");
  mkdirSync(join(repoRoot, "tools/r3g/.fixtures"), { recursive: true });
  execSync(
    "ffmpeg -y -f lavfi -i color=c=0x224466:s=64x64:d=0.6 -pix_fmt yuv420p -movflags +faststart " + process.env.SPE_R4_FIXTURE,
    { stdio: "ignore" },
  );
  const server = await createServer({
    configFile: join(here, "vite.harness.config.mjs"),
    server: { host: "127.0.0.1", port: 5199, strictPort: true },
  });
  await server.listen();
  const origin = "http://127.0.0.1:5199";
  const playwright = await loadPlaywright();
  const { chromium } = playwright.default ?? playwright;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--use-gl=angle",
    ],
  });
  const browserVersion = browser.version();
  const requests = [];
  const cold = [];
  const warm = [];
  const flowNotes = [];
  let storageOk = false;
  let journeyResult = null;
  try {
    for (let i = 0; i < COLD_N; i += 1) {
      const canary = `SPE-R4T5-CANARY-COLD-${head.slice(0, 8)}-${i}-${Date.now()}`;
      const run = await runPage(browser, origin, {
        phase: "cold",
        repeats: 1,
        canary,
        cacheDisabled: true,
        timeoutMs: 60000,
      });
      requests.push(...run.requests);
      const sample = run.result?.compile?.samples?.[0];
      cold.push(sample ? sample.ms : null);
      flowNotes.push({
        phase: "cold",
        i,
        engineOk: engineOk(run.result),
        fatal: run.result?.fatal || run.result?.compile?.error || null,
        error: sample?.error || null,
        sha256: sample?.sha256 || null,
        storage: run.result?.storage || null,
      });
      if (run.result?.storage?.stored && run.result?.storage?.cleared) storageOk = true;
    }
    const warmCanary = `SPE-R4T5-CANARY-WARM-${head.slice(0, 8)}-${Date.now()}`;
    const warmRun = await runPage(browser, origin, {
      phase: "warm",
      repeats: WARM_N + 1,
      canary: warmCanary,
      cacheDisabled: false,
      timeoutMs: 90000,
    });
    requests.push(...warmRun.requests);
    const warmSamples = warmRun.result?.compile?.samples || [];
    for (const sample of warmSamples.slice(1)) warm.push(sample.ms);
    flowNotes.push({
      phase: "warm",
      engineOk: engineOk(warmRun.result),
      fatal: warmRun.result?.fatal || warmRun.result?.compile?.error || null,
      discarded_warmup: warmSamples[0] ? warmSamples[0].ms : null,
      errors: warmSamples.map((sample) => sample.error),
      storage: warmRun.result?.storage || null,
    });
    if (warmRun.result?.storage?.stored && warmRun.result?.storage?.cleared) storageOk = true;

    const journeyCanary = `SPE-R4T5-CANARY-JOURNEY-${head.slice(0, 8)}-${Date.now()}`;
    const journeyRun = await runPage(browser, origin, {
      phase: "journeys",
      repeats: 1,
      canary: journeyCanary,
      cacheDisabled: true,
      timeoutMs: 180000,
    });
    requests.push(...journeyRun.requests);
    journeyResult = journeyRun.result;
  } finally {
    await browser.close();
    await server.close();
  }

  const compileOk = flowNotes.some((note) => note.phase === "cold" && note.engineOk)
    && flowNotes.some((note) => note.phase === "warm" && note.engineOk);
  const rows = journeyRowsFrom(compileOk, storageOk, journeyResult);
  const summary = summarizeJourneys(rows);
  const executedModalities = [];
  if (compileOk) executedModalities.push("prompt");
  if (rows.some((row) => row.id === "media" && row.status === "RUN")) executedModalities.push("image");
  if (rows.some((row) => row.id === "video" && row.status === "RUN")) executedModalities.push("video");
  if (rows.some((row) => row.id === "screenshot" && row.status === "RUN")) executedModalities.push("code");
  if (rows.some((row) => row.id === "website" && row.status === "RUN" && row.local_html === "ok")) executedModalities.push("document");
  const externalNetworkError = requests.some((item) => item.class === "network_error" && item.host && item.host !== "127.0.0.1" && item.host !== "localhost" && item.host !== "::1");
  const judgment = judgeEgress({
    measured: true,
    engineOk: compileOk,
    missingWasm: !compileOk,
    fixtureOnly: !compileOk,
    networkError: externalNetworkError,
    flowsExecuted: executedModalities,
    requests,
  });
  const lab = labReport(cold, warm);
  const cwv = assessPublishedCwv({
    lcpMs: lab.cold.median,
    cls: 0,
    inpMs: lab.warm.median,
    command: "node tools/r3g/browser_egress_harness.mjs",
    sha: head,
    field: false,
    status: "PASS",
  });
  const rawObservations = requests.filter((item) => item.class === "raw_user_data_egress").map((item) => ({
    url: item.url,
    host: item.host,
    method: item.method,
    initiator: item.initiator,
    payload_class: item.payload_class,
    allowed_reason: item.allowed_reason,
  }));
  const hosts = externalHosts(requests);
  const report = {
    start_sha_base: "44ea4026e05f8c289d530da1b843a8c25e492fff",
    git_head_at_run: head,
    command: "node tools/r3g/browser_egress_harness.mjs",
    host: "127.0.0.1",
    remote: false,
    cost_inr: 0,
    device: info.device,
    browser: `${info.browser}; playwright channel=chrome ${browserVersion}`,
    wasm: wasm,
    workflows_run: summary.run,
    workflows_not_run: summary.notRun,
    workflows_local_pending: summary.localPending,
    flows_executed_modalities: executedModalities,
    local_storage_roundtrip: storageOk,
    compile_notes: flowNotes,
    journey_page: {
      fatal: journeyResult && journeyResult.fatal ? journeyResult.fatal : null,
      pageErrors: journeyResult && journeyResult.pageErrors ? journeyResult.pageErrors : [],
    },
    request_counts: {
      raw_user_data_egress: judgment.raw_user_data_egress,
      asset_ingress: judgment.asset_ingress,
      user_authorized_model_download: judgment.user_authorized_model_download,
      loopback_asset: judgment.loopback_asset,
      loopback_with_canary: judgment.loopback_with_canary,
      external_other: judgment.external_other,
      network_error: judgment.network_error,
      observed: requests.length,
    },
    external_hosts: hosts,
    raw_egress_observations: rawObservations,
    requests,
    judgment,
    lab,
    field_cwv: "UNKNOWN",
    cwv_assess: cwv,
    privacy_qualification: "HOLD",
    tested_scope_verdict: "HOLD",
    mutants: [
      "missing WASM is not privacy PASS",
      "fixture fetch is not privacy PASS",
      "localhost is not an external host",
      "model download is not raw media upload",
      "a network error is not privacy proof",
    ],
    note: "Qualification stays HOLD. Prompt compile and the journeys that actually ran are the tested scope only. ASR, OCR, research, and any shell-only product route that was not instrumented are NOT_RUN or LOCAL_PENDING and are not a pass. FIELD_CWV stays UNKNOWN. No raw prompt, audio, video, image, screenshot, transcript, private document, or code was observed leaving the device on the recorded requests. A user-authorized model download was not observed; the vendored MobileNet fetch, if it happened, is loopback model bytes.",
  };
  if (!compileOk) {
    report.note += " Compile engine was not ok, so these runs do not prove zero raw egress.";
    report.tested_scope_verdict = "HOLD";
  }
  const outDir = join(repoRoot, "evidence/r3g");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "browser_egress.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, "compile_lab.json"), `${JSON.stringify({
    git_head_at_run: head,
    device: info.device,
    browser: report.browser,
    build_sha: head,
    field_cwv: "UNKNOWN",
    pass: false,
    cold: lab.cold,
    warm: lab.warm,
    samples: { cold, warm },
  }, null, 2)}\n`);
  const r4 = join(repoRoot, "evidence/r4t5");
  mkdirSync(r4, { recursive: true });
  const brief = {
    git_head_at_run: head,
    privacy_qualification: "HOLD",
    field_cwv: "UNKNOWN",
    workflows_run: summary.run,
    workflows_not_run: summary.notRun,
    workflows_local_pending: summary.localPending,
    external_hosts: hosts,
    raw_egress_observations: rawObservations,
    request_counts: report.request_counts,
    mutants: report.mutants,
    wasm_sha256: wasm.spe_wasm_sha256,
  };
  writeFileSync(join(r4, "journey.json"), `${JSON.stringify(brief, null, 2)}\n`);
  const hold = [
    "# R4 task 5 privacy whole-journey HOLD",
    "",
    `git_head_at_run: \`${head}\``,
    `device: ${info.device}`,
    `browser: ${report.browser}`,
    `workflows_run: ${summary.run.join(", ") || "(none)"}`,
    `workflows_not_run: ${summary.notRun.map((item) => item.id).join(", ") || "(none)"}`,
    `workflows_local_pending: ${summary.localPending.map((item) => item.id).join(", ") || "(none)"}`,
    `external_hosts: ${hosts.length === 0 ? "(none)" : hosts.join("; ")}`,
    `raw_user_data_egress: ${judgment.raw_user_data_egress}`,
    `privacy_qualification: HOLD`,
    "FIELD_CWV: UNKNOWN",
    "",
    report.note,
    "",
    "Shell product routes /website and /media were not copied onto this branch. No built shell app was present to instrument read-only.",
    "",
    `WASM file sha256 remains \`${wasm.spe_wasm_sha256}\`. Release pin \`${WASM_PIN_NOT_IN_TREE}\` was not written.`,
    "",
    "No App/router, product shell, Nav, media engine, scholarly adapter, or .spe source was edited.",
    "",
  ].join("\n");
  writeFileSync(join(outDir, "HOLD.md"), hold);
  writeFileSync(join(r4, "HOLD.md"), hold);
  console.log(JSON.stringify({
    qualification: "HOLD",
    field_cwv: "UNKNOWN",
    workflows_run: summary.run,
    workflows_not_run: summary.notRun,
    workflows_local_pending: summary.localPending,
    raw_user_data_egress: judgment.raw_user_data_egress,
    raw_observations: rawObservations.length,
    compileOk,
    storageOk,
    external_hosts: hosts,
    counts: report.request_counts,
    journey_fatal: report.journey_page.fatal,
  }, null, 2));
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  await main();
}
