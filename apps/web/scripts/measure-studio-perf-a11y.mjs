#!/usr/bin/env node
/**
 * SPE-R9-H — Measure Studio surfaces in local Chromium (lab only).
 *
 * Frame timings are sampled INDEPENDENTLY per environment:
 *   DESKTOP 1280×800 @1x and MOBILE 390×844 @3x (isMobile, hasTouch),
 * each in its own browser context, each with its own warmup + samples.
 * Mobile is never calculated from desktop.
 *
 * Two scene fixtures: studio-empty-v1 (Studio idle) and
 * studio-representative-v1 (non-empty SceneIR rendered every frame by the
 * existing engine/multimodal scene runtime). Lab workload, not production
 * performance. Field Core Web Vitals stay UNKNOWN (pass=false).
 *
 * Custody: the candidate is frozen (commit + tree digest + lockfiles +
 * harness digest) BEFORE measurement and re-checked after. The verifier
 * receipt is written OUTSIDE the candidate worktree:
 *   --receipt-dir <dir>  or  SPE_VERIFIER_RECEIPT_DIR=<dir>   (required)
 *   --candidate <candidate.json> or SPE_FROZEN_CANDIDATE        (optional;
 *     a previously frozen identity; the checkout must match it exactly)
 * Nothing is written into the candidate tree.
 * COST ₹0. network: file:// only, http(s) requests are blocked and counted.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  RECEIPT_DIR_ENV,
  FROZEN_CANDIDATE_ENV,
  assertCandidateUnchanged,
  createVerifierReceipt,
  fileArtifactDigest,
  freezeCandidate,
  loadFrozenCandidate,
  repoToplevel,
  resolveExternalReceiptDir,
  writeFrozenCandidate,
  writeVerifierReceipt,
} from "../../../tools/candidate-custody.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = repoToplevel(join(webRoot, "../.."));

const HARNESS_VERSION = "measure-studio-perf-a11y/2";
const HARNESS_FILES = [
  "apps/web/scripts/measure-studio-perf-a11y.mjs",
  "apps/web/scripts/fixtures/studio-perf-fixtures.mjs",
  "apps/web/src/website-studio/performance/measureScene.ts",
  "apps/web/src/engine/multimodal/sceneRuntime.ts",
  "tools/candidate-custody.mjs",
];
const WARMUP_FRAMES = 20;
const SAMPLE_FRAMES = 120;
const ENVIRONMENTS = [
  {
    environmentClass: "DESKTOP",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  {
    environmentClass: "MOBILE",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
];

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// ---- Custody: freeze (or load) the candidate before anything runs. --------
const receiptRoot = resolveExternalReceiptDir({
  cliValue: argValue("receipt-dir"),
  envValue: process.env[RECEIPT_DIR_ENV],
  candidateRoot: repoRoot,
});
const candidateFile = argValue("candidate") || process.env[FROZEN_CANDIDATE_ENV];
const identity = candidateFile
  ? loadFrozenCandidate(candidateFile)
  : freezeCandidate({
      repoRoot,
      harnessFiles: HARNESS_FILES,
      repo: "jaitleystudio-cpu/system-prompt-engine",
    });
assertCandidateUnchanged(repoRoot, identity);
const frozenFile = writeFrozenCandidate(receiptRoot, identity);
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/[:.]/g, "-");
const workDir = join(receiptRoot, identity.commit_sha, `work-${runId}`);
mkdirSync(workDir, { recursive: true });

const verifier = {
  id: argValue("verifier-id") || process.env.SPE_VERIFIER_ID || `${os.userInfo().username}@${os.hostname()}`,
  type: argValue("verifier-type") || process.env.SPE_VERIFIER_TYPE || "BUILDER_LAB_HARNESS",
};
const command = `node --experimental-strip-types apps/web/scripts/measure-studio-perf-a11y.mjs ${process.argv
  .slice(2)
  .join(" ")}`.trim();

const {
  measureSceneStatic,
  attachVerifiedBrowserTelemetry,
  validateScenePerformanceReceipt,
  fieldCwvUnknown,
  validateFieldCwv,
} = await import("../src/website-studio/performance/measureScene.ts");
const { createEmptySceneIR } = await import("../src/website-studio/model/sceneIR.ts");
const { STUDIO_REPRESENTATIVE_SCENE, REPRESENTATIVE_FIXTURE_ID, EMPTY_FIXTURE_ID } = await import(
  "./fixtures/studio-perf-fixtures.mjs"
);

const results = {
  harness: HARNESS_VERSION,
  lab_only: true,
  not_a_release: true,
  production_performance_claim: false,
  network_mode: "FILE_ONLY_HTTP_BLOCKED",
  field_cwv: fieldCwvUnknown(),
  field_cwv_validation: null,
  note:
    "Lab frame timings only, sampled separately per environment. Mobile is a 390×844 @3x viewport emulated on the host machine, not a physical phone. Field Core Web Vitals are UNKNOWN — not faked.",
  sampling: { warmup_frames: WARMUP_FRAMES, sample_frames: SAMPLE_FRAMES, method: "requestAnimationFrame timestamp deltas" },
  a11y: {},
  fixtures: [],
  blocked_network_requests: 0,
};
results.field_cwv_validation = validateFieldCwv(results.field_cwv);
assert.equal(results.field_cwv_validation.valid, true);

let exitCode = 0;
let failure = null;
const artifacts = [];

async function buildHarness() {
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch {
    throw new Error("HARNESS_DEPENDENCY_MISSING: esbuild (run npm ci in apps/web; the harness does not install packages)");
  }
  const bundleOut = join(workDir, "studio-harness.js");
  await esbuild.build({
    absWorkingDir: webRoot,
    stdin: {
      contents: `
import React from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "./src/website-studio/Studio.tsx";
import { mountBundledScene } from "./src/engine/multimodal/sceneRuntime.ts";
import { STUDIO_REPRESENTATIVE_SCENE, REPRESENTATIVE_FIXTURE_ID } from "./scripts/fixtures/studio-perf-fixtures.mjs";
const fixture = new URLSearchParams(location.search).get("fixture") || "";
createRoot(document.getElementById("root")).render(React.createElement(Studio));
let handle = null;
if (fixture === REPRESENTATIVE_FIXTURE_ID) {
  handle = mountBundledScene(document.getElementById("perf-scene"), STUDIO_REPRESENTATIVE_SCENE);
}
window.__speScene = handle
  ? { report: JSON.parse(JSON.stringify(handle.report)), renderable: typeof handle.renderFrame === "function" }
  : null;
window.__speSampleFrames = (warmup, samples) =>
  new Promise((resolve) => {
    const timings = [];
    let rendered = 0;
    let prev = null;
    let i = 0;
    function tick(now) {
      if (handle && handle.renderFrame && handle.renderFrame(now)) rendered += 1;
      if (prev !== null && i > warmup) timings.push(Math.round((now - prev) * 1000) / 1000);
      prev = now;
      i += 1;
      if (timings.length < samples) requestAnimationFrame(tick);
      else {
        const sorted = [...timings].sort((a, b) => a - b);
        const pct = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))];
        resolve({
          frameTimingsMs: timings,
          sampleCount: timings.length,
          warmupDiscarded: warmup,
          framesRendered: rendered,
          frameP50: pct(50),
          frameP95: pct(95),
          frameP99: pct(99),
          memoryBytes: performance.memory ? performance.memory.usedJSHeapSize : undefined,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          dpr: window.devicePixelRatio,
          userAgent: navigator.userAgent,
          maxTouchPoints: navigator.maxTouchPoints,
          timestamp: Date.now(),
        });
      }
    }
    requestAnimationFrame(tick);
  });
window.__studioReady = true;
`,
      resolveDir: webRoot,
      sourcefile: "r9h-harness-entry.tsx",
      loader: "tsx",
    },
    bundle: true,
    format: "iife",
    outfile: bundleOut,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty", ".ts": "ts", ".tsx": "tsx" },
    logLevel: "silent",
  });
  const studioCss = readFileSync(join(webRoot, "src/website-studio/studio.css"), "utf8");
  const htmlPath = join(workDir, "studio-harness.html");
  writeFileSync(
    htmlPath,
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>SPE Studio R9-H measure</title>
<style>${studioCss}
#perf-scene{position:fixed;right:0;bottom:0;width:min(480px,100vw);pointer-events:none;z-index:0}
#perf-scene canvas{display:block;width:100%;height:auto}</style>
</head>
<body>
<main id="main" tabindex="-1"><div id="root"></div><div id="perf-scene" aria-hidden="true"></div></main>
<script src="./studio-harness.js"></script>
</body>
</html>`,
  );
  artifacts.push(fileArtifactDigest(bundleOut, "studio-harness.js"));
  artifacts.push(fileArtifactDigest(htmlPath, "studio-harness.html"));
  return htmlPath;
}

async function collectA11y(page) {
  return page.evaluate(() => {
    const mains = document.querySelectorAll("main");
    const studioRoot = document.querySelector('[data-testid="website-studio"]');
    const stage = document.querySelector('[aria-label="LIVE WEBSITE Stage"]');
    const fallbackBtn = document.querySelector('[data-testid="studio-reduced-motion"]');
    const mobileBtn = document.querySelector('[data-testid="viewport-mobile"]');
    const focusables = studioRoot
      ? [...studioRoot.querySelectorAll("button, a[href], input, select, textarea")]
      : [];
    const smallTargets = focusables
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
      })
      .map((el) => ({
        name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 48),
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
      }));
    return {
      mainCount: mains.length,
      hasStudio: !!studioRoot,
      stageRole: stage?.getAttribute("role"),
      hasReducedMotionToggle: !!fallbackBtn,
      hasMobileViewport: !!mobileBtn,
      smallTargets,
    };
  });
}

async function openPage(browser, env, htmlPath, fixture) {
  const context = await browser.newContext({
    viewport: env.viewport,
    deviceScaleFactor: env.deviceScaleFactor,
    isMobile: env.isMobile,
    hasTouch: env.hasTouch,
    reducedMotion: "no-preference",
  });
  await context.route(/^https?:\/\//, (route) => {
    results.blocked_network_requests += 1;
    return route.abort();
  });
  const page = await context.newPage();
  const url = `${pathToFileURL(htmlPath).href}${fixture ? `?fixture=${fixture}` : ""}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__studioReady === true, { timeout: 30000 });
  return { context, page };
}

async function sampleEnvironment(browser, browserLabel, env, htmlPath, urlFixture, fixtureId) {
  const { context, page } = await openPage(browser, env, htmlPath, urlFixture);
  try {
    const scene = await page.evaluate(() => window.__speScene);
    const sample = await page.evaluate(
      ([warmup, samples]) => window.__speSampleFrames(warmup, samples),
      [WARMUP_FRAMES, SAMPLE_FRAMES],
    );
    assert.deepEqual(sample.viewport, env.viewport, `${env.environmentClass} observed viewport differs from requested`);
    assert.equal(sample.dpr, env.deviceScaleFactor, `${env.environmentClass} observed DPR differs from requested`);
    return {
      scene,
      telemetry: {
        environment: "BROWSER_HARNESS",
        environmentClass: env.environmentClass,
        browser: browserLabel,
        userAgent: sample.userAgent,
        viewport: sample.viewport,
        dpr: sample.dpr,
        isMobile: env.isMobile,
        hasTouch: env.hasTouch,
        sampleCount: sample.sampleCount,
        warmupDiscarded: sample.warmupDiscarded,
        frameTimingsMs: sample.frameTimingsMs,
        frameP50: sample.frameP50,
        frameP95: sample.frameP95,
        frameP99: sample.frameP99,
        drawCalls: 0,
        triangles: 0,
        textureBytes: 0,
        memoryBytes: sample.memoryBytes,
        timestamp: sample.timestamp,
        sceneFixtureId: fixtureId,
      },
      framesRendered: sample.framesRendered,
      maxTouchPoints: sample.maxTouchPoints,
    };
  } finally {
    await context.close();
  }
}

const chromeCandidates = [
  process.env.SPE_CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
const launchOpts = { headless: true, args: ["--no-sandbox"] };
if (executablePath) launchOpts.executablePath = executablePath;

let browser;
const environmentRecord = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  os_release: os.release(),
  cpu_model: os.cpus()[0]?.model ?? "UNKNOWN",
  cpu_count: os.cpus().length,
  total_memory_bytes: os.totalmem(),
  browser_executable: executablePath ?? "playwright-bundled-chromium",
  browser_version: "UNKNOWN",
  headless: true,
  cpu_throttling_rate: 1,
  physical_mobile_device: false,
};

try {
  const htmlPath = await buildHarness();
  browser = await chromium.launch(launchOpts);
  environmentRecord.browser_version = browser.version();
  const browserLabel = `chromium ${browser.version()}`;

  // ---- Frame sampling: each fixture × each environment independently. ----
  const fixtures = [
    { id: EMPTY_FIXTURE_ID, scene: createEmptySceneIR(), requiresWebgl: false },
    { id: REPRESENTATIVE_FIXTURE_ID, scene: STUDIO_REPRESENTATIVE_SCENE, requiresWebgl: true },
  ];
  for (const fixture of fixtures) {
    const staticReceipt = measureSceneStatic(fixture.scene);
    let receipt = staticReceipt;
    const fixtureRecord = {
      fixture_id: fixture.id,
      objects: fixture.scene.objects.length,
      lights: fixture.scene.lighting.length,
      static: {
        triangles: staticReceipt.triangles,
        draw_calls: staticReceipt.drawCalls,
        max_triangles: fixture.scene.performanceBudget.maxTriangles,
        max_draw_calls: fixture.scene.performanceBudget.maxDrawCalls,
        within_static_budget: staticReceipt.findings.length === 0,
        findings: staticReceipt.findings,
      },
      environments: {},
    };
    for (const env of ENVIRONMENTS) {
      const sampled = await sampleEnvironment(
        browser,
        browserLabel,
        env,
        htmlPath,
        fixture.requiresWebgl ? fixture.id : "",
        fixture.id,
      );
      const envRecord = {
        requested: {
          viewport: env.viewport,
          dpr: env.deviceScaleFactor,
          isMobile: env.isMobile,
          hasTouch: env.hasTouch,
        },
        observed_max_touch_points: sampled.maxTouchPoints,
        frames_rendered_during_sampling: sampled.framesRendered,
        scene_execution: sampled.scene?.report ?? null,
        attached: false,
        hold_reason: null,
      };
      const webglExecuted = sampled.scene?.report?.webglExecution === "EXECUTED" && sampled.scene?.renderable;
      if (fixture.requiresWebgl && (!webglExecuted || sampled.framesRendered < SAMPLE_FRAMES)) {
        // Frames without the representative render work are not this workload.
        envRecord.hold_reason = `WEBGL_NOT_EXECUTED: ${sampled.scene?.report?.note ?? "no scene handle"}`;
      } else {
        receipt = attachVerifiedBrowserTelemetry(receipt, sampled.telemetry);
        envRecord.attached = true;
      }
      fixtureRecord.environments[env.environmentClass] = envRecord;
    }
    fixtureRecord.frame_receipt = receipt;
    fixtureRecord.frame_state = receipt.frameMeasurementState;
    fixtureRecord.validation = validateScenePerformanceReceipt(receipt);
    assert.equal(fixtureRecord.validation.valid, true, JSON.stringify(fixtureRecord.validation));
    results.fixtures.push(fixtureRecord);
  }

  // ---- Accessibility DOM checks (separate pages from frame sampling). ----
  {
    const { context, page } = await openPage(browser, ENVIRONMENTS[0], htmlPath, "");
    const critical = await collectA11y(page);
    assert.equal(critical.mainCount, 1, "critical nested <main>");
    assert.ok(critical.hasStudio);
    assert.equal(critical.stageRole, "region");
    assert.ok(critical.hasReducedMotionToggle);
    assert.ok(critical.hasMobileViewport);
    assert.equal(critical.smallTargets.length, 0, `touch targets <44px: ${JSON.stringify(critical.smallTargets)}`);
    await page.click('[data-testid="studio-reduced-motion"]');
    await page.locator('[data-testid="accessible-2d-fallback"]').waitFor({ timeout: 5000 });
    await page.click('[data-testid="viewport-mobile"]');
    assert.equal(await page.getAttribute('[data-testid="website-renderer"]', "data-view-mode"), "mobile");
    await context.close();
    results.a11y = {
      critical_blockers: 0,
      main_landmark_count: critical.mainCount,
      stage_role: critical.stageRole,
      reduced_motion_fallback: true,
      mobile_viewport_control: true,
      touch_targets_below_44px: critical.smallTargets.length,
      status: "NO_CRITICAL_BLOCKER_FOUND_BY_DOM_CHECKS",
      manual_screen_reader_review: "NOT_RUN",
    };
  }
  {
    const { context, page } = await openPage(browser, ENVIRONMENTS[1], htmlPath, "");
    const mobileA11y = await collectA11y(page);
    assert.equal(mobileA11y.mainCount, 1);
    assert.equal(mobileA11y.smallTargets.length, 0, `mobile touch <44px: ${JSON.stringify(mobileA11y.smallTargets)}`);
    await context.close();
    results.a11y.mobile_390x844 = {
      touch_targets_below_44px: mobileA11y.smallTargets.length,
      main_landmark_count: mobileA11y.mainCount,
    };
  }
  assert.equal(results.blocked_network_requests, 0, "harness page attempted network egress");
} catch (error) {
  exitCode = 1;
  failure = String(error?.stack || error);
} finally {
  if (browser) await browser.close();
}

// ---- Custody re-check, then write the receipt OUTSIDE the candidate. ------
let custodyAfter = "UNCHANGED";
try {
  assertCandidateUnchanged(repoRoot, identity);
} catch (error) {
  custodyAfter = String(error?.message || error);
  exitCode = exitCode || 3;
}
const receipt = createVerifierReceipt(identity, {
  verifier,
  environment: environmentRecord,
  command,
  exitCode,
  results: { ...results, failure, candidate_custody_after_run: custodyAfter },
  artifacts,
  startedAt,
});
const receiptFile = writeVerifierReceipt(receiptRoot, receipt, `measure-studio-perf-a11y-${runId}`);

const summary = {
  subject_commit_sha: identity.commit_sha,
  subject_tree_digest: identity.tree_digest,
  frozen_candidate: frozenFile,
  receipt: receiptFile,
  receipt_outside_candidate: relative(repoRoot, receiptFile).startsWith(".."),
  exit_code: exitCode,
  candidate_custody_after_run: custodyAfter,
  field_cwv: results.field_cwv,
  fixtures: results.fixtures.map((fixture) => ({
    fixture_id: fixture.fixture_id,
    frame_state: fixture.frame_state,
    desktop: pickEnv(fixture.frame_receipt?.frameEnvironments?.desktop, fixture.environments.DESKTOP),
    mobile: pickEnv(fixture.frame_receipt?.frameEnvironments?.mobile, fixture.environments.MOBILE),
  })),
  qualification_verdict: receipt.qualification_verdict,
};
function pickEnv(env, record) {
  if (!env) return null;
  return {
    state: env.state,
    viewport: env.viewport,
    dpr: env.dpr,
    samples: env.sampleCount,
    warmup: env.warmupDiscarded,
    p50: env.frameP50,
    p95: env.frameP95,
    p99: env.frameP99,
    hold_reason: record?.hold_reason ?? null,
  };
}
console.log(JSON.stringify(summary, null, 2));
if (failure) console.error(failure);
console.log(
  exitCode === 0
    ? "\nLAB RECEIPT WRITTEN (not a qualification verdict): SPE-R9-H measurements bound to the frozen candidate."
    : `\nHARNESS FAILED (exit ${exitCode}); failure receipt written.`,
);
process.exitCode = exitCode;
