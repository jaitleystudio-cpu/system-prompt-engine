import { chromium } from "playwright";
import { join } from "node:path";

const ARTIFACTS_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";
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

  // 1. Capture Before/After Diff Slider on Homepage
  console.log("Navigating to Homepage for Diff Slider...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const diffSection = page.locator(".spe-diff-section");
  if (await diffSection.isVisible()) {
    await diffSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const diffShotPath = join(ARTIFACTS_DIR, "preview_before_after_diff_slider.png");
    await diffSection.screenshot({ path: diffShotPath });
    console.log(`✓ Saved ${diffShotPath}`);
  } else {
    console.warn("Could not find .spe-diff-section");
  }

  // 1b. Capture ROI Calculator
  const roiSection = page.locator(".spe-roi-calculator-section");
  if (await roiSection.isVisible()) {
    await roiSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const roiShotPath = join(ARTIFACTS_DIR, "preview_developer_roi_calculator.png");
    await roiSection.screenshot({ path: roiShotPath });
    console.log(`✓ Saved ${roiShotPath}`);
  }

  // 2. Capture Workflows Catalog with Submit Modal open
  console.log("Navigating to /workflows...");
  await page.goto(`${BASE_URL}/workflows`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const submitBtn = page.locator(".spe-submit-workflow-btn");
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await page.waitForTimeout(600);
    const modalPath = join(ARTIFACTS_DIR, "preview_workflows_community_modal.png");
    await page.screenshot({ path: modalPath });
    console.log(`✓ Saved ${modalPath}`);
  } else {
    console.warn("Could not find .spe-submit-workflow-btn");
  }

  // 3. Capture Studio with Agent Export Tabs & Agent Simulator
  console.log("Navigating to /create (Studio)...");
  await page.goto(`${BASE_URL}/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const ideaInput = page.locator("textarea").first();
  if (await ideaInput.isVisible()) {
    await ideaInput.fill("Build an API authentication middleware that validates JWT tokens and logs security events.");
    await page.waitForTimeout(300);
  }

  const buildBtn = page.locator("button.spe-build");
  if (await buildBtn.isVisible()) {
    await buildBtn.click();
    await page.waitForSelector(".spe-create-result", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  const exportResult = page.locator(".spe-create-result");
  if (await exportResult.isVisible()) {
    await exportResult.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const studioShotPath = join(ARTIFACTS_DIR, "preview_agent_simulator_and_export_tabs.png");
    await exportResult.screenshot({ path: studioShotPath });
    console.log(`✓ Saved ${studioShotPath}`);
  } else {
    const studioShotPath = join(ARTIFACTS_DIR, "preview_agent_simulator_and_export_tabs.png");
    await page.screenshot({ path: studioShotPath });
    console.log(`✓ Saved full page ${studioShotPath}`);
  }

  await browser.close();
  console.log("All previews captured successfully!");
}

run().catch((err) => {
  console.error("Error capturing previews:", err);
  process.exit(1);
});
