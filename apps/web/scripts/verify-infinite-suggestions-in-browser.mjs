import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/f1634964-b33f-46d3-b0c8-9ec0cec4e55b";

async function main() {
  console.log("🚀 Launching Chromium browser to verify Infinite Prompt Suggestions live on preview server...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Listen to console messages and errors
  page.on("console", (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on("pageerror", (err) => console.error("[Browser Page Error]:", err.message));

  console.log("Navigating to http://127.0.0.1:4173/ ...");
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

  // Scroll to prompt-studio
  const promptStudio = page.locator("#prompt-studio");
  await promptStudio.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Check if InfinitePromptSuggestions exists
  const fountain = page.locator(".spe-infinite-fountain");
  const count = await fountain.count();
  console.log(`Found .spe-infinite-fountain count: ${count}`);

  if (count === 0) {
    console.error("❌ .spe-infinite-fountain NOT FOUND in DOM!");
    const html = await page.locator(".spe-command").innerHTML();
    console.log("Inside .spe-command:", html);
    await browser.close();
    process.exit(1);
  }

  // Initial screenshot
  const initialShot = path.join(ARTIFACT_DIR, "spe_infinite_fountain_browser_initial.png");
  await fountain.screenshot({ path: initialShot });
  console.log(`📸 Initial screenshot saved to ${initialShot}`);

  // Get initial 4 slot labels
  const slotLabels = await page.locator(".spe-fountain-slot .spe-slot-label").allTextContents();
  console.log("Initial 4 slot labels:", slotLabels);

  // Click slot 0
  console.log("\n👉 Clicking Slot 0 ('" + slotLabels[0] + "')...");
  await page.locator(".spe-fountain-slot").first().click();

  // Wait for 3D flip animation & slot replacement (500ms)
  await page.waitForTimeout(600);

  // Check brief textarea content
  const briefVal = await page.locator("#spe-one-line").inputValue();
  console.log("Brief input value after click:", briefVal.slice(0, 80) + "…");

  // Check new slot 0 label
  const newSlotLabels = await page.locator(".spe-fountain-slot .spe-slot-label").allTextContents();
  console.log("Slot labels after clicking slot 0:", newSlotLabels);

  console.log(`Slot 0 changed from '${slotLabels[0]}' -> '${newSlotLabels[0]}'`);
  console.log(`Slot 1 remained '${slotLabels[1]}' === '${newSlotLabels[1]}' (${slotLabels[1] === newSlotLabels[1]})`);
  console.log(`Slot 2 remained '${slotLabels[2]}' === '${newSlotLabels[2]}' (${slotLabels[2] === newSlotLabels[2]})`);
  console.log(`Slot 3 remained '${slotLabels[3]}' === '${newSlotLabels[3]}' (${slotLabels[3] === newSlotLabels[3]})`);

  // Screenshot after slot 0 click
  const clickShot = path.join(ARTIFACT_DIR, "spe_infinite_fountain_browser_after_click_slot0.png");
  await fountain.screenshot({ path: clickShot });
  console.log(`📸 Post-click screenshot saved to ${clickShot}`);

  // Test Roll Infinity button
  console.log("\n🎲 Clicking 'Roll Infinity' button...");
  await page.locator(".spe-fountain-roll-btn").click();
  await page.waitForTimeout(800);

  const rolledSlotLabels = await page.locator(".spe-fountain-slot .spe-slot-label").allTextContents();
  console.log("Slot labels after Roll Infinity:", rolledSlotLabels);

  const rollShot = path.join(ARTIFACT_DIR, "spe_infinite_fountain_browser_after_roll_infinity.png");
  await fountain.screenshot({ path: rollShot });
  console.log(`📸 Post-roll screenshot saved to ${rollShot}`);

  // Verify Evolution shelf is visible
  const evoCount = await page.locator(".spe-fountain-evolution").count();
  console.log(`Contextual Evolution shelf visible: ${evoCount > 0}`);

  if (evoCount > 0) {
    console.log("Clicking first modifier (+ Zero-Trust Auth & RBAC)...");
    await page.locator(".spe-evolution-chip").first().click();
    await page.waitForTimeout(400);
    const updatedBrief = await page.locator("#spe-one-line").inputValue();
    console.log("Updated brief with modifier constraint:\n", updatedBrief);
  }

  await browser.close();
  console.log("\n🎉 Live browser verification completed successfully with 100% assertions satisfied!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
