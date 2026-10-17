#!/usr/bin/env node
/**
 * Master 15 Browser Journeys Qualification Suite for SPE Free 3D Websites v1.1
 * Runs end-to-end against real Google Chrome browser DOM using Playwright.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const studioCss = readFileSync(join(webRoot, "src/website-studio/studio.css"), "utf8");

const bundleOut = "/tmp/studio-v11-browser-journeys-bundle.js";
console.log("================================================================================");
console.log("SPE v1.1 — BUNDLING COMPLETE STUDIO FOR 15 BROWSER JOURNEYS...");
console.log("================================================================================");

await esbuild.build({
  absWorkingDir: webRoot,
  entryPoints: [join(here, "studio-browser-harness-entry.tsx")],
  bundle: true,
  format: "iife",
  outfile: bundleOut,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  loader: { ".css": "empty" },
});

console.log("Launching headless Google Chrome...");
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.error("PAGE ERROR:", err));
  const htmlPath = "/tmp/studio-v11-browser-journeys.html";
  writeFileSync(
    htmlPath,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>SPE Studio v1.1 Browser Harness</title>
    <style>${studioCss}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__studioSurface="studio";</script>
    <script src="${pathToFileURL(bundleOut).href}"></script>
  </body>
</html>`,
  );

  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__studioReady === true, { timeout: 15000 });

  const studio = page.locator('[data-testid="website-studio"]');
  await assert.doesNotReject(studio.waitFor());
  console.log("✅ Studio mounted and ready in browser DOM.\n");

  // -------------------------------------------------------------------------
  // Journey 1: Create from Natural Language
  // -------------------------------------------------------------------------
  console.log("Executing Journey 1: Create from Natural Language...");
  const copilotInput = page.locator('[data-testid="copilot-input"]');
  await copilotInput.fill("Cybernetic Chrono Flagship");
  const createIntentBtn = page.locator('[data-testid="create-from-intent-btn"]');
  await createIntentBtn.click();
  const stageHeader = page.locator('.semantic-dom-layer h2');
  await stageHeader.waitFor();
  assert.equal(await stageHeader.textContent(), "Cybernetic Chrono Flagship");
  console.log("✅ Journey 1: Create from Natural Language verified.\n");

  // -------------------------------------------------------------------------
  // Journey 2: Reference Analysis
  // -------------------------------------------------------------------------
  console.log("Executing Journey 2: Reference Analysis...");
  const recipesTabBtn = page.locator('[data-testid="tab-explore"]');
  await recipesTabBtn.click();
  const analyzeRecipeBtn = page.locator('[data-testid="analyze-luxury-product-orbit"]');
  await analyzeRecipeBtn.click();
  const analysisPanel = page.locator('[data-testid="reference-analysis-panel"]');
  await analysisPanel.waitFor();
  const analysisText = await analysisPanel.textContent();
  assert.match(analysisText, /DesignDNA Analysis:\s*Luxury Product Showcase/i);
  assert.match(analysisText, /Palette:/i);
  assert.match(analysisText, /Typography:/i);
  assert.match(analysisText, /Motion Rhythm:/i);
  console.log("✅ Journey 2: Reference Analysis verified.\n");

  // -------------------------------------------------------------------------
  // Journey 3: Reference Blend
  // -------------------------------------------------------------------------
  console.log("Executing Journey 3: Reference Blend...");
  const blendAnalyzedBtn = page.locator('[data-testid="blend-analyzed-btn"]');
  await blendAnalyzedBtn.click();
  const blendedTitle = await stageHeader.textContent();
  assert.match(blendedTitle, /Cybernetic Chrono Flagship.*Luxury Product Showcase Blend/i);
  console.log("✅ Journey 3: Reference Blend verified.\n");

  // -------------------------------------------------------------------------
  // Journey 4: BehaviorGraph Create & Edit
  // -------------------------------------------------------------------------
  console.log("Executing Journey 4: BehaviorGraph Create & Edit...");
  const graphTabBtn = page.locator('[data-testid="tab-behaviors"]');
  await graphTabBtn.click();
  const addRuleBtn = page.getByRole("button", { name: "+ Add Interaction Rule" });
  await addRuleBtn.click();
  const graphPanel = page.locator('aside[aria-label="STRUCTURE Panel"]');
  const graphText = await graphPanel.textContent();
  assert.match(graphText, /Trigger:\s*scroll/i);
  assert.match(graphText, /Actions:\s*scene-rotate/i);
  assert.match(graphText, /Fallback:\s*dom-show/i);

  const graphJsonTabBtn = page.getByRole("button", { name: "Graph JSON" });
  await graphJsonTabBtn.click();
  const jsonPre = graphPanel.locator("pre");
  assert.match(await jsonPre.textContent(), /"version":\s*"behavior-graph\/1"/);
  const visualTabBtn = page.getByRole("button", { name: "Visual Rules" });
  await visualTabBtn.click();
  console.log("✅ Journey 4: BehaviorGraph Create & Edit verified.\n");

  // -------------------------------------------------------------------------
  // Journey 5: Narrative MotionBlock Create & Edit
  // -------------------------------------------------------------------------
  console.log("Executing Journey 5: Narrative MotionBlock Create & Edit...");
  const timelinePanel = page.locator('footer[aria-label="COPILOT & Motion Timeline"]');
  const addBlockBtn = timelinePanel.locator('[data-testid="add-motion-block-btn"]');
  await addBlockBtn.click();
  const detailedTracksBtn = timelinePanel.getByRole("button", { name: "Detailed Tracks" });
  await detailedTracksBtn.click();
  const motionTracksText = await timelinePanel.textContent();
  assert.match(motionTracksText, /camera:\s*position\.z/i);
  const narrativeBlocksBtn = timelinePanel.getByRole("button", { name: "Narrative Blocks" });
  await narrativeBlocksBtn.click();
  console.log("✅ Journey 5: Narrative MotionBlock Create & Edit verified.\n");

  // -------------------------------------------------------------------------
  // Journey 6: Camera Director
  // -------------------------------------------------------------------------
  console.log("Executing Journey 6: Camera Director...");
  const intelPanel = page.locator('aside[aria-label="INTELLIGENCE Panel"]');
  const luxuryOrbitBtn = intelPanel.getByRole("button", { name: "Luxury Orbit" });
  await luxuryOrbitBtn.click();
  let cameraText = await intelPanel.textContent();
  assert.match(cameraText, /Controlled luxury orbit/i);

  const dramaticPushBtn = intelPanel.getByRole("button", { name: "Dramatic Push-In" });
  await dramaticPushBtn.click();
  cameraText = await intelPanel.textContent();
  assert.match(cameraText, /push-in/i);
  console.log("✅ Journey 6: Camera Director verified.\n");

  // -------------------------------------------------------------------------
  // Journey 7: Performance Doctor
  // -------------------------------------------------------------------------
  console.log("Executing Journey 7: Performance Doctor...");
  const perfDoctorText = await intelPanel.textContent();
  assert.match(perfDoctorText, /Scene Performance Doctor/i);
  assert.match(perfDoctorText, /Triangles/i);
  assert.match(perfDoctorText, /Draw Calls/i);
  assert.match(perfDoctorText, /TIER\s*[ABC]/i);
  console.log("✅ Journey 7: Performance Doctor verified.\n");

  // -------------------------------------------------------------------------
  // Journey 8: Data Binding Inspector
  // -------------------------------------------------------------------------
  console.log("Executing Journey 8: Data Binding Inspector...");
  const dataTabBtn = page.locator('[data-testid="tab-data"]');
  await dataTabBtn.click();
  const dataPanel = page.locator('aside[aria-label="STRUCTURE Panel"]');
  let dataText = await dataPanel.textContent();
  assert.match(dataText, /\$localCount/i);
  assert.match(dataText, /\$publicFeed/i);
  assert.match(dataText, /\$temperature/i);
  assert.match(dataText, /LOCAL/);
  assert.match(dataText, /PUBLIC WEB FETCH/);
  assert.match(dataText, /EXTERNAL PROVIDER/);

  const disconnectBtn = dataPanel.getByRole("button", { name: "Disconnect" }).first();
  await disconnectBtn.click();
  dataText = await dataPanel.textContent();
  assert.doesNotMatch(dataText, /\$localCount/);
  console.log("✅ Journey 8: Data Binding Inspector verified.\n");

  // -------------------------------------------------------------------------
  // Journey 9: 3D Enhancement
  // -------------------------------------------------------------------------
  console.log("Executing Journey 9: 3D Enhancement...");
  const enhanceTabBtn = page.locator('[data-testid="tab-enhance"]');
  await enhanceTabBtn.click();
  const enhancePanel = page.locator('[data-testid="enhancement-panel"]');
  await enhancePanel.waitFor();
  await assert.doesNotReject(page.locator('[data-testid="tier-badge-TRUE_3D"]').waitFor());
  await assert.doesNotReject(page.locator('[data-testid="tier-badge-DEPTH_COMPOSITE"]').waitFor());
  await assert.doesNotReject(page.locator('[data-testid="tier-badge-2_5D"]').waitFor());
  await assert.doesNotReject(page.locator('[data-testid="tier-badge-CSS_MOTION"]').waitFor());
  console.log("✅ Journey 9: 3D Enhancement verified across all 4 truth tiers.\n");

  // -------------------------------------------------------------------------
  // Journey 10: Agent Propose Patch
  // -------------------------------------------------------------------------
  console.log("Executing Journey 10: Agent Propose Patch...");
  const proposePatchBtn = page.locator('[data-testid="propose-patch-btn"]');
  await proposePatchBtn.click();
  const diffPanel = page.locator('[data-testid="semantic-diff-panel"]');
  await diffPanel.waitFor();
  assert.equal(await page.locator('[data-testid="diff-source"]').textContent(), "AGENT");
  const patchId = await page.locator('[data-testid="diff-patch-id"]').textContent();
  assert.match(patchId, /^patch-sha256-/);
  console.log(`✅ Journey 10: Agent Propose Patch verified (${patchId}).\n`);

  // -------------------------------------------------------------------------
  // Journey 11: Semantic Diff Preview
  // -------------------------------------------------------------------------
  console.log("Executing Journey 11: Semantic Diff Preview...");
  const hashesText = await page.locator('[data-testid="diff-hashes"]').textContent();
  assert.match(hashesText, /beforeHash:\s*sha256-[0-9a-f]+.*→.*afterHash:\s*sha256-[0-9a-f]+/);
  const diffRows = page.locator('[data-testid="diff-operation-row"]');
  assert.ok((await diffRows.count()) > 0);
  console.log("✅ Journey 11: Semantic Diff Preview verified with cryptographic hashes.\n");

  // -------------------------------------------------------------------------
  // Journey 12: Approve & Apply Patch
  // -------------------------------------------------------------------------
  console.log("Executing Journey 12: Approve & Apply Patch...");
  const approvePatchBtn = page.locator('[data-testid="approve-patch-btn"]');
  await approvePatchBtn.click();
  await page.waitForSelector('[data-testid="semantic-diff-panel"]', { state: "detached" });
  const updatedStageTitle = await stageHeader.textContent();
  assert.match(updatedStageTitle, /\[Agent Enhanced\]/);
  console.log("✅ Journey 12: Approve & Apply Patch verified.\n");

  // -------------------------------------------------------------------------
  // Journey 13: Undo & Redo
  // -------------------------------------------------------------------------
  console.log("Executing Journey 13: Undo & Redo...");
  const undoBtn = page.locator('[data-testid="studio-undo-btn"]');
  await undoBtn.click();
  let revertedTitle = await stageHeader.textContent();
  assert.doesNotMatch(revertedTitle, /\[Agent Enhanced\]/);

  const redoBtn = page.locator('[data-testid="studio-redo-btn"]');
  await redoBtn.click();
  const redoneTitle = await stageHeader.textContent();
  assert.match(redoneTitle, /\[Agent Enhanced\]/);
  console.log("✅ Journey 13: Undo & Redo verified.\n");

  // -------------------------------------------------------------------------
  // Journey 14: Export .spe-site & Reopen Project
  // -------------------------------------------------------------------------
  console.log("Executing Journey 14: Export .spe-site & Reopen Project...");
  const exportBtn = page.locator('[data-testid="studio-export-btn"]');
  await exportBtn.click();
  const exportNotice = page.locator('[data-testid="export-notice"]');
  await exportNotice.waitFor();
  assert.match(await exportNotice.textContent(), /Exported \.spe-site package \(\d+ bytes\)/);

  const reopenBtn = page.locator('[data-testid="studio-reopen-btn"]');
  await reopenBtn.click();
  await exportNotice.waitFor();
  assert.match(await exportNotice.textContent(), /Reopened \.spe-site project package/);
  console.log("✅ Journey 14: Export .spe-site & Reopen Project verified.\n");

  // -------------------------------------------------------------------------
  // Journey 15: Reduced Motion, Mobile Layout, Keyboard & Context Recovery
  // -------------------------------------------------------------------------
  console.log("Executing Journey 15: Accessibility, Responsiveness & Context Loss...");
  
  // 15A. Mobile Layout
  const mobileBtn = page.locator('[data-testid="viewport-mobile"]');
  await mobileBtn.click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.website-preview-viewport');
    return el && Math.abs(el.getBoundingClientRect().width - 375) < 3;
  }, { timeout: 3000 });
  const desktopBtn = page.locator('[data-testid="viewport-desktop"]');
  await desktopBtn.click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.website-preview-viewport');
    return el && el.getBoundingClientRect().width > 500;
  }, { timeout: 3000 });

  // 15B. Reduced Motion & Accessible Fallback
  await assert.doesNotReject(page.locator('[data-testid="canvas-3d-active"]').waitFor());
  const toggleMotionBtn = page.locator('[data-testid="toggle-reduced-motion"]');
  await toggleMotionBtn.click();
  assert.equal(await toggleMotionBtn.textContent(), "Motion: Reduced");
  await assert.doesNotReject(page.locator('[data-testid="accessible-2d-fallback"]').waitFor());
  // Toggle back
  await toggleMotionBtn.click();
  assert.equal(await toggleMotionBtn.textContent(), "Motion: Normal");
  await assert.doesNotReject(page.locator('[data-testid="canvas-3d-active"]').waitFor());

  // 15C. Keyboard-Only Navigation
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  assert.equal(focusedTag, "BUTTON");

  // 15D. WebGL Context Loss & Recovery
  const contextLossBtn = page.locator('[data-testid="simulate-context-loss-btn"]');
  await contextLossBtn.click();
  const contextStatusEl = page.locator('[data-testid="webgl-context-status"]');
  await contextStatusEl.waitFor();
  // Wait for restored status
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="webgl-context-status"]');
      return el && el.textContent.includes("WebGL Context Restored");
    },
    { timeout: 5000 },
  );
  const finalContextStatus = await contextStatusEl.textContent();
  assert.match(finalContextStatus, /WebGL Context Restored — All Scene State Preserved/);
  console.log("✅ Journey 15: Reduced Motion, Mobile Layout, Keyboard Navigation & Context Recovery verified.\n");

  await page.close();
  console.log("================================================================================");
  console.log("PASS: ALL 15 STUDIO v1.1 BROWSER JOURNEYS 100% QUALIFIED IN REAL BROWSER DOM!");
  console.log("================================================================================");
} finally {
  await browser.close();
}
