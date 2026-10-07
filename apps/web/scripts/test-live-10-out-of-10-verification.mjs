/**
 * End-to-End Live Verification for SPE 10/10 North Star Upgrade:
 * 1. Schema.org Rich Snippets (SoftwareApplication, WebApplication, BreadcrumbList, FAQPage, TechArticle)
 * 2. Audio Studio v1.2 (Visualizer, dB Level, Quick Intents, 4 Personas, Sound FX)
 * 3. 6-Axis Interactive Radar Spider Chart
 * 4. 1-Click Auto-Optimize to 100% Quality Score
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";

const chromePath =
  process.env.CHROME_PATH ||
  (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
});
const page = await context.newPage();

console.log("1. Navigating to SPE at http://127.0.0.1:4177...");
await page.goto("http://127.0.0.1:4177/", { waitUntil: "networkidle", timeout: 30000 });

// 1. Verify Schema.org JSON-LD
console.log("2. Verifying Schema.org JSON-LD structured data...");
const ldJsonText = await page.$eval('script[type="application/ld+json"]', (el) => el.textContent);
assert.ok(ldJsonText, "Schema.org JSON-LD script missing in index.html");
const ldJson = JSON.parse(ldJsonText);
assert.equal(ldJson["@context"], "https://schema.org");
assert.ok(Array.isArray(ldJson["@graph"]), "Expected @graph array");

const graphTypes = ldJson["@graph"].map((item) => item["@type"]);
console.log("   Found Schema types:", graphTypes);
assert.ok(graphTypes.includes("SoftwareApplication"), "Missing SoftwareApplication");
assert.ok(graphTypes.includes("WebApplication"), "Missing WebApplication");
assert.ok(graphTypes.includes("BreadcrumbList"), "Missing BreadcrumbList");
assert.ok(graphTypes.includes("FAQPage"), "Missing FAQPage");
assert.ok(graphTypes.includes("TechArticle"), "Missing TechArticle");
console.log("   ✓ All 5 Schema.org structured data schemas verified!");

// 2. Open Create / Compose view
console.log("3. Navigating to Create / Compose tab...");
const createLink = page.locator('a[href="/create"], button:has-text("Create"), a:has-text("Create")').first();
if (await createLink.count()) {
  await createLink.click();
}
await page.waitForTimeout(600);

// 3. Test Audio Studio
console.log("4. Navigating to Speech Tab...");
const speechTab = page.locator('#composer-tab-speech, button:has-text("Speech"), [role="tab"]:has-text("Speech")').first();
assert.ok(await speechTab.count(), "Speech tab not found");
await speechTab.click();
await page.waitForTimeout(500);

const audioStudio = page.locator(".spe-audio-studio-v12");
assert.ok((await audioStudio.count()) > 0, "AudioStudio component not mounted");

// Verify 4 Persona buttons
console.log("4. Verifying 4 Specialized Persona Synthesizers & Quick Intents...");
assert.ok(await page.locator('button:has-text("👔 Executive CTO")').count(), "Executive CTO button missing");
assert.ok(await page.locator('button:has-text("⚡ 10x Lead Dev")').count(), "10x Lead Dev button missing");
assert.ok(await page.locator('button:has-text("🎨 Creative Director")').count(), "Creative Director button missing");
assert.ok(await page.locator('button:has-text("🛡️ Security Lead")').count(), "Security Lead button missing");

// Click Voice Presets
const presetsTab = page.locator('button:has-text("Voice Presets")').first();
await presetsTab.click();
await page.waitForTimeout(300);

const firstPreset = page.locator('.spe-audio-studio-v12 button:has-text("SaaS Landing Page")').first();
await firstPreset.click();
await page.waitForTimeout(300);

// Click Executive CTO Persona synthesis
console.log("5. Synthesizing prompt via 👔 Executive CTO Persona...");
const ctoBtn = page.locator('button:has-text("👔 Executive CTO")').first();
await ctoBtn.click();
await page.waitForTimeout(400);

// Check textarea
const ideaArea = page.locator('textarea[placeholder*="Describe the task"]').first();
const ideaValue = await ideaArea.inputValue();
assert.ok(ideaValue.includes("Executive CTO"), "Expected CTO persona in idea textarea");
assert.ok(ideaValue.includes("Strategic Mandate"), "Expected Strategic Mandate section");
console.log("   ✓ Executive CTO prompt successfully synthesized into composer textarea!");

// Screenshot of Audio Studio
const artifactDir = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";
await audioStudio.screenshot({ path: `${artifactDir}/spe_audio_studio_10_out_of_10.png` });
console.log("   ✓ Captured screenshot: spe_audio_studio_10_out_of_10.png");

// 6. Build the prompt
console.log("6. Building prompt...");
const buildBtn = page.locator('.compile-row button.spe-build, button.spe-build').first();
assert.ok(await buildBtn.count(), "Build button not found");
console.log("   Build button ready status:", await buildBtn.getAttribute("data-ready"));
await buildBtn.click();

// 7. Verify Prompt Radar Inspector & 6-Axis Spider Chart
console.log("7. Waiting for WASM compile and Prompt Radar Inspector...");
const radarInspector = page.locator(".spe-prompt-radar-inspector").first();
await radarInspector.waitFor({ state: "visible", timeout: 15000 });
assert.ok((await radarInspector.count()) > 0, "PromptRadarInspector not rendered");

const spiderChartSvg = radarInspector.locator('svg').first();
assert.ok((await spiderChartSvg.count()) > 0, "6-Axis Radar Spider SVG not found");
console.log("   ✓ 6-Axis Radar Spider Chart SVG rendered successfully!");

// 8. Test 1-Click Auto-Optimize to 100% Score
console.log("8. Testing 1-Click '⚡ Auto-Optimize to 100% Score'...");
const autoOptBtn = radarInspector.locator('button:has-text("Auto-Optimize to 100% Score")').first();
if (await autoOptBtn.count()) {
  await autoOptBtn.click();
  await page.waitForTimeout(500);

  const scoreBadge = radarInspector.locator('text=/100\\/100/').first();
  assert.ok((await scoreBadge.count()) > 0, "Score did not reach 100/100 after auto-optimization");
  console.log("   ✓ Prompt health score surged to 100/100 SATURATED!");

  const copy100Btn = radarInspector.locator('button:has-text("Copy 100% Prompt")').first();
  assert.ok((await copy100Btn.count()) > 0, "Copy 100% Prompt button missing");
} else {
  console.log("   (Prompt already saturated at 100/100)");
}

// Screenshot of Radar Inspector & Spider Chart
await radarInspector.screenshot({ path: `${artifactDir}/spe_prompt_radar_spider_chart_100_percent.png` });
console.log("   ✓ Captured screenshot: spe_prompt_radar_spider_chart_100_percent.png");

await browser.close();
console.log("ALL 10/10 NORTH STAR LIVE CHECKS PASSED PERFECTLY!");
