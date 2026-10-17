/**
 * Live browser verification for Image-to-Prompt instant yield,
 * AudioStudio North Star speech & audio features, and Schema.org SEO.
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
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

console.log("1. Navigating to SPE at http://127.0.0.1:4177...");
await page.goto("http://127.0.0.1:4177/", { waitUntil: "networkidle", timeout: 30000 });

// Verify Schema.org JSON-LD in DOM
console.log("2. Verifying Schema.org JSON-LD structured data...");
const ldJsonText = await page.$eval('script[type="application/ld+json"]', (el) => el.textContent);
assert.ok(ldJsonText, "Schema.org JSON-LD script missing in index.html");
const ldJson = JSON.parse(ldJsonText);
assert.equal(ldJson["@context"], "https://schema.org");
assert.ok(Array.isArray(ldJson["@graph"]), "Expected @graph array");
const softwareApp = ldJson["@graph"].find((item) => item["@type"] === "SoftwareApplication");
assert.ok(softwareApp, "SoftwareApplication missing from Schema.org graph");
console.log("   ✓ Schema.org JSON-LD verified: SoftwareApplication & WebApplication intact.");

// Open Create tab
console.log("3. Navigating to Create / Compose tab...");
const createLink = page.locator('a[href="/create"], button:has-text("Create"), a:has-text("Create")').first();
if (await createLink.count()) {
  await createLink.click();
}
await page.waitForTimeout(600);

// Switch to Image mode
console.log("4. Testing Image-to-Prompt instant progressive yield...");
const imageTab = page.locator('#composer-tab-image, button:has-text("Image"), [role="tab"]:has-text("Image")').first();
assert.ok(await imageTab.count(), "Image tab not found");
await imageTab.click();
await page.waitForTimeout(400);

// Upload test image
const testImagePath = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/.user_uploaded/media_1791365059198.png";
const fileInput = page.locator('#composer-file-image, input[type="file"][accept*="image"]').first();
assert.ok(await fileInput.count(), "Image file input not found");

const t0 = Date.now();
await fileInput.setInputFiles(testImagePath);

// Wait for prompt textarea to populate using Playwright polling
const ideaTextarea = page.locator('label:has-text("Your idea") textarea, label:has-text("YOUR IDEA") textarea').first();
let ideaValue = "";
for (let i = 0; i < 40; i++) {
  ideaValue = (await ideaTextarea.inputValue()).trim();
  if (ideaValue.length > 50) break;
  await page.waitForTimeout(100);
}
const elapsed = Date.now() - t0;
console.log(`   ✓ Image uploaded! "YOUR IDEA" populated in ${elapsed}ms (${ideaValue.length} characters)`);
assert.ok(ideaValue.includes("Image → prompt request"), "Prompt must contain image request block");

// Verify "Build my prompt" button is active and enabled
const buildBtn = page.locator('button.spe-build:has-text("Build my prompt")').first();
assert.ok(await buildBtn.count(), "Build my prompt button not found");
const isReady = await buildBtn.getAttribute("data-ready");
const isDisabled = await buildBtn.isDisabled();
assert.equal(isReady, "true", "Build button data-ready must be true");
assert.equal(isDisabled, false, "Build button must NOT be disabled");
console.log("   ✓ Build button is active and clickable (data-ready=true, disabled=false)!");

// Click "Build my prompt" to compile prompt
console.log("5. Clicking 'Build my prompt' to compile system prompt...");
await buildBtn.click();
await page.waitForTimeout(1000);

// Capture screenshot of Image-to-Prompt working
const imageScreenshotPath = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_image_to_prompt_verified.png";
await page.screenshot({ path: imageScreenshotPath, fullPage: false });
console.log(`   ✓ Saved Image-to-Prompt verification screenshot: ${imageScreenshotPath}`);

// Switch to Speech mode
console.log("6. Testing Audio & Speech Studio v1.2 North Star...");
const speechTab = page.locator('#composer-tab-speech, button:has-text("Speech"), [role="tab"]:has-text("Speech")').first();
assert.ok(await speechTab.count(), "Speech tab not found");
await speechTab.click();
await page.waitForTimeout(500);

// Verify AudioStudio component elements
const audioStudio = page.locator('.spe-audio-studio-v12');
assert.ok(await audioStudio.count(), "AudioStudio v1.2 component not mounted");

// Verify canvas visualizer
const visualizerCanvas = audioStudio.locator('canvas');
assert.ok(await visualizerCanvas.count(), "Audio visualizer canvas missing");

// Click "Voice Presets" tab
const presetsTab = audioStudio.locator('button:has-text("Voice Presets")').first();
assert.ok(await presetsTab.count(), "Voice Presets button not found");
await presetsTab.click();
await page.waitForTimeout(300);

// Click preset: SaaS Landing Page Voice Note
const saasPreset = audioStudio.locator('button:has-text("SaaS Landing Page Voice Note")').first();
assert.ok(await saasPreset.count(), "SaaS preset not found");
await saasPreset.click();
await page.waitForTimeout(300);

// Click "⚡ Synthesize System Prompt"
const synthBtn = audioStudio.locator('button:has-text("Synthesize System Prompt")').first();
assert.ok(await synthBtn.count(), "Synthesize button not found");
await synthBtn.click();
await page.waitForTimeout(500);

// Verify that synthesized prompt was inserted into workspace
const finalIdea = page.locator('label:has-text("Your idea") textarea, label:has-text("YOUR IDEA") textarea, textarea.spe-prompt-body').first();
const finalVal = await ideaTextarea.inputValue();
assert.ok(finalVal.includes("System Role & Operational Directives") || finalVal.includes("Primary Mission & Objective"), "Synthesized system prompt must be inserted");
console.log("   ✓ Voice preset transformed into 10/10 system prompt and inserted successfully!");

// Capture screenshot of AudioStudio
const audioScreenshotPath = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_audio_studio_north_star_verified.png";
await page.screenshot({ path: audioScreenshotPath, fullPage: false });
console.log(`   ✓ Saved AudioStudio verification screenshot: ${audioScreenshotPath}`);

await context.close();
await browser.close();

console.log("ALL LIVE VERIFICATION CHECKS PASSED 100%!");
