#!/usr/bin/env node
/**
 * Browser-level proof suite for Studio v1.1 surfaces:
 * 1. BehaviorGraph
 * 2. Narrative Motion Blocks
 * 3. Camera Director
 * 4. Performance Doctor
 * 5. Data Binding Inspector
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

const bundleOut = "/tmp/studio-browser-proof-bundle.js";
console.log("Bundling Studio test harness with esbuild...");
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

console.log("Launching headless browser...");
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const htmlPath = "/tmp/studio-browser-proof.html";
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>${studioCss}</style></head><body><div id="root"></div><script>window.__studioSurface="all";</script><script src="${pathToFileURL(bundleOut).href}"></script></body></html>`,
  );

  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__studioReady === true, { timeout: 15000 });

  console.log("Testing Surface 1: BehaviorGraph Editor...");
  const behaviorSection = page.locator("#harness-behavior");
  await assert.doesNotReject(behaviorSection.waitFor());
  const addRuleBtn = behaviorSection.getByRole("button", { name: "+ Add Interaction Rule" });
  await addRuleBtn.click();
  const ruleText = await behaviorSection.textContent();
  assert.match(ruleText, /Trigger:\s*scroll/i);
  assert.match(ruleText, /Actions:\s*scene-rotate/i);
  assert.match(ruleText, /Fallback:\s*dom-show/i);

  // Switch to JSON tab and back
  const jsonTabBtn = behaviorSection.getByRole("button", { name: "Graph JSON" });
  await jsonTabBtn.click();
  const jsonContent = await behaviorSection.locator("pre").textContent();
  assert.match(jsonContent, /"version":\s*"behavior-graph\/1"/);
  const visualTabBtn = behaviorSection.getByRole("button", { name: "Visual Rules" });
  await visualTabBtn.click();
  console.log("✅ Surface 1: BehaviorGraph Editor verified in real browser DOM.");

  console.log("Testing Surface 2: Narrative Motion Blocks...");
  const motionSection = page.locator("#harness-motion");
  await assert.doesNotReject(motionSection.waitFor());
  assert.match(await motionSection.textContent(), /product-reveal/i);
  const detailedTracksBtn = motionSection.getByRole("button", { name: "Detailed Tracks" });
  await detailedTracksBtn.click();
  const tracksContent = await motionSection.textContent();
  assert.match(tracksContent, /camera:\s*position\.z/i);
  const narrativeBtn = motionSection.getByRole("button", { name: "Narrative Blocks" });
  await narrativeBtn.click();
  console.log("✅ Surface 2: Motion Block Editor verified in real browser DOM.");

  console.log("Testing Surface 3: Camera Director...");
  const cameraSection = page.locator("#harness-camera");
  await assert.doesNotReject(cameraSection.waitFor());
  const luxuryOrbitBtn = cameraSection.getByRole("button", { name: "Luxury Orbit" });
  await luxuryOrbitBtn.click();
  let cameraText = await cameraSection.textContent();
  assert.match(cameraText, /establish.*Establish premium subject/i);
  assert.match(cameraText, /orbit.*Controlled luxury orbit/i);
  assert.match(cameraText, /settle.*Hero.*settle/i);

  const dramaticPushBtn = cameraSection.getByRole("button", { name: "Dramatic Push-In" });
  await dramaticPushBtn.click();
  cameraText = await cameraSection.textContent();
  assert.match(cameraText, /push.*push-in/i);
  console.log("✅ Surface 3: Camera Director verified in real browser DOM.");

  console.log("Testing Surface 4: Performance Doctor...");
  const perfSection = page.locator("#harness-performance");
  await assert.doesNotReject(perfSection.waitFor());
  const perfText = await perfSection.textContent();
  assert.match(perfText, /Scene Performance Doctor/i);
  assert.match(perfText, /Triangles/i);
  assert.match(perfText, /Draw Calls/i);
  assert.match(perfText, /Geometry Memory/i);
  assert.match(perfText, /TIER\s*[ABC]/i);
  console.log("✅ Surface 4: Performance Doctor verified in real browser DOM.");

  console.log("Testing Surface 5: Data Binding Inspector...");
  const dataSection = page.locator("#harness-data");
  await assert.doesNotReject(dataSection.waitFor());
  const dataText = await dataSection.textContent();
  assert.match(dataText, /\$localCount/i);
  assert.match(dataText, /\$publicFeed/i);
  assert.match(dataText, /\$temperature/i);
  assert.match(dataText, /LOCAL/);
  assert.match(dataText, /PUBLIC WEB FETCH/);
  assert.match(dataText, /EXTERNAL PROVIDER/);

  // Disconnect local binding
  const disconnectButtons = dataSection.getByRole("button", { name: "Disconnect" });
  await disconnectButtons.first().click();
  const updatedDataText = await dataSection.textContent();
  assert.doesNotMatch(updatedDataText, /\$localCount/);
  console.log("✅ Surface 5: Data Binding Inspector verified in real browser DOM.");

  await page.close();
  console.log("\nPASS: All 5 Studio v1.1 interactive surfaces verified with real browser DOM execution.");
} finally {
  await browser.close();
}
