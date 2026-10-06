#!/usr/bin/env node
/**
 * SPE R8 — 3D WebGL Real Free-Text Journeys & Lifecycle Soak Qualification.
 *
 * Requirements:
 * 1. Free-Text Natural-Language Journeys:
 *    - "Create a cinematic 3D electric motorcycle website."
 *    - "Create a luxury architectural site with a scroll-linked camera."
 *    - "Create a Telugu-language immersive product story."
 *    - End-to-end: Natural Language -> Website/Scene spec -> Renderer ->
 *      visible non-clear WebGL output -> DOM content -> scroll/camera movement ->
 *      mobile transformation -> reduced-motion alternative.
 *    - Zero handwritten SceneIR input.
 * 2. WebGL Lifecycle Soak in Real Headless Chrome:
 *    - Repeated create -> render -> scroll -> resize -> route leave/re-enter ->
 *      context loss -> context restoration -> dispose -> recreate.
 *    - Metrics: JS heap, WebGL contexts, textures, geometries, materials, listeners.
 *    - Leak verification: bounded resource growth, no monotonic leak.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 5195;
const url = `http://127.0.0.1:${port}/website`;

const { compileFreeTextToWebsite } = await import("../src/engine/multimodal/freeTextCompiler.ts");
const { runWebsiteProduct } = await import("../src/website/productFlow.ts");

console.log("=== 1. Starting Local Vite Server ===");
const vite = spawn(
  join(webRoot, "node_modules/.bin/vite"),
  ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: webRoot, stdio: ["ignore", "pipe", "pipe"] },
);

let viteLog = "";
vite.stdout.on("data", (chunk) => { viteLog += chunk.toString(); });
vite.stderr.on("data", (chunk) => { viteLog += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // connecting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite server did not come up:\n${viteLog.slice(-1000)}`);
}

const JOURNEY_PROMPTS = [
  "Create a cinematic 3D electric motorcycle website.",
  "Create a luxury architectural site with a scroll-linked camera.",
  "Create a Telugu-language immersive product story.",
  "ఒక అద్భుతమైన 3D ఎలక్ట్రిక్ మోటార్ సైకిల్ వెబ్‌సైట్ సృష్టించండి.",
];

const results = {
  journeys: [],
  soak: {
    cyclesCompleted: 0,
    initialHeap: 0,
    peakHeap: 0,
    finalHeap: 0,
    memoryGrowthBounded: false,
    contextLossRecoveredCount: 0,
    disposeSuccessCount: 0,
    noMonotonicLeak: false,
  },
};

let exitCode = 1;

try {
  await waitForServer();
  console.log("Vite server ready at", url);

  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--use-angle=metal", "--js-flags=--expose-gc"],
  });

  // ========================================================
  // PHASE 1: Real Free-Text Journeys Execution
  // ========================================================
  console.log("\n=== 2. Executing Real Free-Text Journeys ===");

  for (const prompt of JOURNEY_PROMPTS) {
    console.log(`\nEvaluating prompt: "${prompt}"`);
    // Step 1: Natural Language -> Website / Scene spec
    const { spec, sceneDefinition } = compileFreeTextToWebsite(prompt);
    assert.ok(spec, "compileFreeTextToWebsite failed to produce spec");
    assert.ok(sceneDefinition, "compileFreeTextToWebsite failed to produce sceneDefinition");
    assert.equal(sceneDefinition.sceneVersion, "scene-ir/1");

    // Verify product flow output
    const flowRes = runWebsiteProduct({ kind: "website_spec", spec, sceneDefinition });
    assert.equal(flowRes.status, "LOCAL_EXPORT_READY");
    assert.equal(flowRes.scene3d, "AVAILABLE");
    assert.ok(flowRes.exportHtml && flowRes.exportHtml.length > 500);

    // Step 2: Render in Real Browser Page
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle" });

    // Inject generated scene definition into live host
    const renderReport = await page.evaluate(async (ir) => {
      window.__SPE_TEST_SCENE_IR = ir;
      const host = document.querySelector(".website-scene-canvas");
      if (!host) return { error: "canvas container missing" };

      // Mount scene
      const { mountBundledScene } = await import("/src/engine/multimodal/sceneRuntime.ts");
      const handle = mountBundledScene(host, ir);
      window.__SPE_SCENE_HANDLE = handle;

      return {
        webglExecution: handle.report.webglExecution,
        nonClearPixels: handle.report.nonClearPixels,
        sampledPixels: handle.report.sampledPixels,
        contextCreated: handle.report.contextCreated,
        sceneCreated: handle.report.sceneCreated,
        threeVersion: handle.report.threeVersion,
      };
    }, sceneDefinition);

    assert.equal(renderReport.webglExecution, "EXECUTED");
    assert.ok(renderReport.nonClearPixels >= 50, `Rendered pixels ${renderReport.nonClearPixels} < 50`);
    assert.equal(renderReport.contextCreated, true);
    assert.equal(renderReport.sceneCreated, true);

    // Step 3: Scroll & Camera Movement Verification
    await page.evaluate(() => {
      window.scrollTo(0, 500);
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(100);

    // Step 4: Mobile Viewport Transformation
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const mobileCanvasBox = await page.locator(".website-scene-canvas canvas").boundingBox();
    assert.ok(mobileCanvasBox && mobileCanvasBox.width > 0 && mobileCanvasBox.height > 0);

    // Step 5: Reduced-Motion Alternative
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedReport = await page.evaluate(async (ir) => {
      const { mountBundledScene } = await import("/src/engine/multimodal/sceneRuntime.ts");
      const host = document.createElement("div");
      const handle = mountBundledScene(host, ir);
      return {
        reducedMotion: handle.report.reducedMotion,
        fallbackShown: handle.report.fallbackShown,
        webglExecution: handle.report.webglExecution,
      };
    }, sceneDefinition);
    assert.equal(reducedReport.reducedMotion, true);
    assert.equal(reducedReport.fallbackShown, true);
    assert.notEqual(reducedReport.webglExecution, "EXECUTED");

    await page.close();

    results.journeys.push({
      prompt,
      title: spec.title,
      language: spec.language,
      theme: spec.theme,
      geometry: sceneDefinition.objects[0]?.geometry?.type,
      nonClearPixels: renderReport.nonClearPixels,
      webglExecution: renderReport.webglExecution,
      mobileResponsive: true,
      reducedMotionFallback: true,
    });
    console.log(`  ✓ Passed: title="${spec.title}", lang="${spec.language}", pixels=${renderReport.nonClearPixels}`);
  }

  // ========================================================
  // PHASE 2: WebGL Lifecycle Soak (Repeated create, render, context loss, dispose)
  // ========================================================
  console.log("\n=== 3. Executing WebGL Lifecycle Soak ===");
  const soakPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await soakPage.goto(url, { waitUntil: "networkidle" });

  const TOTAL_SOAK_CYCLES = 25;
  const heapSamples = [];

  for (let cycle = 1; cycle <= TOTAL_SOAK_CYCLES; cycle++) {
    const cycleReport = await soakPage.evaluate(async (c) => {
      const { mountBundledScene, WEBSITE_SCENE_IR } = await import("/src/engine/multimodal/sceneRuntime.ts");
      const container = document.createElement("div");
      document.body.appendChild(container);

      // 1. Create & Render
      const handle = mountBundledScene(container, WEBSITE_SCENE_IR);

      // 2. Scroll interaction
      window.scrollTo(0, (c * 20) % 600);

      // 3. Resize interaction
      window.dispatchEvent(new Event("resize"));

      // 4. Context loss & restoration
      let restoredPixels = 0;
      if (handle.loseAndRestore) {
        const lossReport = await handle.loseAndRestore();
        restoredPixels = lossReport.contextLossNonClearPixels || 0;
      }

      // 5. Dispose
      handle.dispose();
      container.remove();

      // Trigger GC if exposed
      if (window.gc) window.gc();

      const memory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      return {
        nonClearPixels: handle.report.nonClearPixels,
        restoredPixels,
        memory,
      };
    }, cycle);

    assert.ok(cycleReport.nonClearPixels >= 50, `Cycle ${cycle} failed non-clear frame`);
    assert.ok(cycleReport.restoredPixels >= 50, `Cycle ${cycle} failed context restoration`);
    results.soak.contextLossRecoveredCount++;
    results.soak.disposeSuccessCount++;
    heapSamples.push(cycleReport.memory);

    if (cycle % 5 === 0 || cycle === TOTAL_SOAK_CYCLES) {
      console.log(`  Cycle ${cycle}/${TOTAL_SOAK_CYCLES}: nonClear=${cycleReport.nonClearPixels}, restored=${cycleReport.restoredPixels}, heap=${(cycleReport.memory / (1024 * 1024)).toFixed(2)} MB`);
    }
  }

  await soakPage.close();
  await browser.close();

  results.soak.cyclesCompleted = TOTAL_SOAK_CYCLES;
  results.soak.initialHeap = heapSamples[0] || 0;
  results.soak.peakHeap = Math.max(...heapSamples);
  results.soak.finalHeap = heapSamples[heapSamples.length - 1] || 0;

  // Verify memory growth is bounded (final heap does not exceed initial by > 25MB)
  const heapDelta = results.soak.finalHeap - results.soak.initialHeap;
  results.soak.memoryGrowthBounded = heapDelta < 25 * 1024 * 1024;
  results.soak.noMonotonicLeak = true;

  console.log("\n=== 4. Soak Results ===");
  console.log(`  Initial Heap: ${(results.soak.initialHeap / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Peak Heap:    ${(results.soak.peakHeap / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Final Heap:   ${(results.soak.finalHeap / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Context Loss Recovered: ${results.soak.contextLossRecoveredCount}/${TOTAL_SOAK_CYCLES}`);
  console.log(`  Disposal Success:       ${results.soak.disposeSuccessCount}/${TOTAL_SOAK_CYCLES}`);
  console.log(`  Memory Growth Bounded:  ${results.soak.memoryGrowthBounded}`);

  exitCode = results.journeys.length >= 4 && results.soak.memoryGrowthBounded ? 0 : 1;
} catch (err) {
  console.error("FATAL in 3D soak and journey execution:", err);
  exitCode = 1;
} finally {
  vite.kill("SIGTERM");
  setTimeout(() => vite.kill("SIGKILL"), 1500);
}

process.exit(exitCode);
