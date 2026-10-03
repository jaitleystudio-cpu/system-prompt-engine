#!/usr/bin/env node
/**
 * Real Chrome network instrumentation for two local flows:
 *   1. prompt compile through EngineClient -> engine.worker (WASM)
 *   2. opt-in local history write/clear via @spe/web-runtime
 * Audio, video, OCR, website, image, and document journeys are not run.
 * FIELD_CWV stays UNKNOWN. Local lab timings are not a field score.
 * Does not edit product shell, media engines, scholarly adapters, or .spe.
 * COST ₹0. Binds 127.0.0.1 only.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyRequest, judgeEgress } from "./classify_egress.mjs";
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

function shorten(url) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, path: parsed.pathname };
  } catch {
    return { host: null, path: url.slice(0, 120) };
  }
}

async function loadPlaywright() {
  const spec = process.env.SPE_PLAYWRIGHT_MODULE
    || require.resolve("playwright");
  return import(pathToFileURL(spec).href);
}

async function loadVite() {
  return import(pathToFileURL(require.resolve("vite")).href);
}

async function runPage(browser, origin, { phase, repeats, canary, cacheDisabled }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (cacheDisabled) {
    const client = await context.newCDPSession(page);
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    await client.send("Network.enable");
  }
  const requests = [];
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    const postData = request.postData() || "";
    const kind = classifyRequest(
      { url, postData, resourceType: request.resourceType() },
      [canary],
    );
    const where = shorten(url);
    requests.push({
      phase,
      method: request.method(),
      host: where.host,
      path: where.path,
      resourceType: request.resourceType(),
      postBytes: postData.length,
      canary: postData.includes(canary) || url.includes(canary),
      class: kind,
    });
  });
  const url = `${origin}/__r3g/harness.html?canary=${encodeURIComponent(canary)}&repeats=${repeats}&phase=${phase}`;
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  try {
    await page.waitForFunction(() => window.__r3g && window.__r3g.done, null, { timeout: 60000 });
  } catch (err) {
    const result = {
      done: true,
      fatal: `harness_timeout: ${pageErrors.join(" | ") || err.message}`,
    };
    await context.close();
    return { result, requests };
  }
  const result = await page.evaluate(() => window.__r3g);
  if (pageErrors.length && result && !result.fatal) result.pageErrors = pageErrors;
  await context.close();
  return { result, requests };
}

function engineOk(result) {
  if (!result || result.fatal) return false;
  const samples = result.compile && Array.isArray(result.compile.samples) ? result.compile.samples : [];
  if (samples.length === 0) return false;
  return samples.every((sample) => sample.error == null && typeof sample.sha256 === "string" && sample.sha256.length === 64);
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
    ],
  });
  const browserVersion = browser.version();
  const requests = [];
  const cold = [];
  const warm = [];
  const flowNotes = [];
  let storageOk = false;
  try {
    for (let i = 0; i < COLD_N; i += 1) {
      const canary = `SPE-R3G-CANARY-COLD-${head.slice(0, 8)}-${i}-${Date.now()}`;
      const run = await runPage(browser, origin, {
        phase: "cold",
        repeats: 1,
        canary,
        cacheDisabled: true,
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
    const warmCanary = `SPE-R3G-CANARY-WARM-${head.slice(0, 8)}-${Date.now()}`;
    const warmRun = await runPage(browser, origin, {
      phase: "warm",
      repeats: WARM_N + 1,
      canary: warmCanary,
      cacheDisabled: false,
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
  } finally {
    await browser.close();
    await server.close();
  }

  const compileOk = flowNotes.some((note) => note.phase === "cold" && note.engineOk)
    && flowNotes.some((note) => note.phase === "warm" && note.engineOk);
  const executed = [];
  if (compileOk) executed.push("prompt");
  if (storageOk) executed.push("local_storage");
  const judgment = judgeEgress({
    measured: true,
    engineOk: compileOk,
    flowsExecuted: executed.filter((name) => name === "prompt"),
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
  const report = {
    start_sha_base: "8afc3564ae608f818e172d15f9e7c38a79a7a9ab",
    git_head_at_run: head,
    command: "node tools/r3g/browser_egress_harness.mjs",
    host: "127.0.0.1",
    remote: false,
    cost_inr: 0,
    device: info.device,
    browser: `${info.browser}; playwright channel=chrome ${browserVersion}`,
    wasm: wasm,
    flows_executed: executed,
    flows_not_executed: ["transcript", "image", "audio", "video", "ocr", "website", "code", "document"],
    local_storage_roundtrip: storageOk,
    compile_notes: flowNotes,
    request_counts: {
      raw_user_data_egress: judgment.raw_user_data_egress,
      asset_ingress: judgment.asset_ingress,
      loopback_asset: judgment.loopback_asset,
      loopback_with_canary: judgment.loopback_with_canary,
      external_other: judgment.external_other,
      observed: requests.length,
    },
    external_hosts: [...new Set(requests.filter((item) => item.class !== "loopback_asset" && item.class !== "loopback_with_canary" && item.class !== "ignored_non_network").map((item) => `${item.class} ${item.host}${item.path}`))],
    requests,
    judgment,
    lab,
    field_cwv: "UNKNOWN",
    cwv_assess: cwv,
    privacy_qualification: "HOLD",
    note: "Executed flows are prompt compile and local history only. QUALIFICATION stays HOLD because transcript, image, audio, video, OCR, website, code, and document were not executed. A missing WASM result is not a pass. Lab medians are not field CWV.",
  };
  if (!compileOk) {
    report.note += " Compile engine was not ok on every phase, so these runs do not prove zero raw egress.";
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
  const hold = [
    "# R3-G privacy and performance HOLD",
    "",
    `git_head_at_run: \`${head}\``,
    `device: ${info.device}`,
    `browser: ${report.browser}`,
    `flows_executed: ${executed.join(", ") || "(none)"}`,
    `flows_not_executed: transcript, image, audio, video, ocr, website, code, document`,
    `raw_user_data_egress: ${judgment.raw_user_data_egress}`,
    `privacy_qualification: HOLD`,
    "FIELD_CWV: UNKNOWN",
    "",
    report.note,
    "",
    "PR #107 crawl-document measurer was not ported: `apps/web/src/search/foundation.mjs` is absent on this ancestry. Perf ideas that were ported: unpublished CWV stays UNKNOWN, and lab cold/warm median/p95 are recorded separately from field CWV.",
    "",
    `WASM file sha256 remains \`${wasm.spe_wasm_sha256}\`. Release pin \`${WASM_PIN_NOT_IN_TREE}\` is not a file in this tree and was not written.`,
    "",
    "No product shell, Nav, media engine, scholarly adapter, or .spe file was edited.",
    "",
  ].join("\n");
  writeFileSync(join(outDir, "HOLD.md"), hold);
  console.log(JSON.stringify({
    qualification: "HOLD",
    field_cwv: "UNKNOWN",
    executed,
    raw_user_data_egress: judgment.raw_user_data_egress,
    compileOk,
    storageOk,
    lab,
    external: report.external_hosts,
  }, null, 2));
  if (!wasm.matches_tree_constant) process.exit(1);
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  await main();
}
