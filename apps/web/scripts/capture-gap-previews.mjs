import { chromium } from "playwright";
import { join } from "node:path";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "/Users/prawinpalisetty/.gemini/antigravity/brain/56183f26-b3d5-4328-820c-5d76116b5617";
const BASE_URL = process.env.HERO_URL || "http://127.0.0.1:4173";

async function run() {
  console.log(`Connecting to ${BASE_URL} to capture screenshots...`);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
  });

  const page = await context.newPage();

  // 1. Capture Homepage Top
  console.log("Navigating to Homepage...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(ARTIFACTS_DIR, "preview_homepage_hero.png") });
  console.log("✓ Saved preview_homepage_hero.png");

  // 1b. Capture Diff Slider
  const diffSection = page.locator(".spe-diff-section");
  if (await diffSection.isVisible()) {
    await diffSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await diffSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_before_after_diff_slider.png") });
    console.log("✓ Saved preview_before_after_diff_slider.png");
  }

  // 1c. Capture ROI Calculator
  const roiSection = page.locator(".spe-roi-calculator-section");
  if (await roiSection.isVisible()) {
    await roiSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await roiSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_developer_roi_calculator.png") });
    console.log("✓ Saved preview_developer_roi_calculator.png");
  }

  // 1d. Capture FeaturesHub on Homepage
  const featuresHub = page.locator(".spe-features-hub");
  if (await featuresHub.isVisible()) {
    await featuresHub.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await featuresHub.screenshot({ path: join(ARTIFACTS_DIR, "preview_features_hub.png") });
    console.log("✓ Saved preview_features_hub.png");
  }

  // 2. Capture Workflows Catalog with framework pills
  console.log("Navigating to /workflows...");
  await page.goto(`${BASE_URL}/workflows`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(ARTIFACTS_DIR, "preview_workflows_catalog_frameworks.png") });
  console.log("✓ Saved preview_workflows_catalog_frameworks.png");

  // 3. Capture Skill Builder with 1-click Framework Presets
  console.log("Navigating to /skill-builder...");
  await page.goto(`${BASE_URL}/skill-builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(ARTIFACTS_DIR, "preview_skill_builder_presets.png") });
  console.log("✓ Saved preview_skill_builder_presets.png");

  // 4. Capture Attack Gym (Agent Simulator) on /create
  console.log("Navigating to /create for Attack Gym...");
  await page.goto(`${BASE_URL}/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const ideaInput = page.locator("textarea").first();
  if (await ideaInput.isVisible()) {
    await ideaInput.fill("Build an API authentication middleware with token verification");
    await page.waitForTimeout(300);
  }
  const buildBtn = page.locator("button.spe-build");
  if (await buildBtn.isVisible()) {
    await buildBtn.click();
    await page.waitForSelector(".spe-create-result", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  const simulator = page.locator(".spe-simulator-box");
  if (await simulator.isVisible()) {
    await simulator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    // Click Hostile Attack preset
    const hostileBtn = page.locator("button:has-text('Hostile Attack Preset')").first();
    if (await hostileBtn.isVisible()) {
      await hostileBtn.click();
      await page.waitForTimeout(500);
    }
    await simulator.screenshot({ path: join(ARTIFACTS_DIR, "preview_attack_gym_defense.png") });
    console.log("✓ Saved preview_attack_gym_defense.png");
  }

  // 5. Capture Pricing Page ($9/mo Developer Pro & $99/mo Team)
  console.log("Navigating to /pricing...");
  await page.goto(`${BASE_URL}/pricing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(ARTIFACTS_DIR, "preview_pricing_page.png") });
  console.log("✓ Saved preview_pricing_page.png");

  await browser.close();
  console.log("All previews captured successfully!");
}

run().catch((err) => {
  console.error("Error capturing previews:", err);
  process.exit(1);
});
