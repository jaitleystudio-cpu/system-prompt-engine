import { chromium } from "playwright";
import { resolve } from "node:path";

const BRAIN_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

async function main() {
  console.log("Launching headless browser to capture 6 Epic Breakthrough Pillars...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle", timeout: 10000 });
    console.log("Loaded SPE main page.");

    // Open Proof Lab modal via "SPE Ω Proof Lab" link in FeaturesHub
    const omegaLink = page.locator("a:has-text('SPE Ω Proof Lab')").first();
    if (await omegaLink.isVisible()) {
      await omegaLink.click();
      await page.waitForTimeout(800);
      console.log("Opened Ω Proof Lab modal.");

      // 1. Attention Salience Tab
      const salienceTab = page.locator("button:has-text('Attention Salience')").first();
      if (await salienceTab.isVisible()) {
        await salienceTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_attention_salience.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_attention_salience.png");
      }

      // 2. Multi-Turn Trajectory Tab
      const simulateTab = page.locator("button:has-text('Multi-Turn Trajectory')").first();
      if (await simulateTab.isVisible()) {
        await simulateTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_multiturn_trajectory.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_multiturn_trajectory.png");
      }

      // 3. Few-Shot Curriculum Tab
      const fewshotTab = page.locator("button:has-text('Few-Shot Curriculum')").first();
      if (await fewshotTab.isVisible()) {
        await fewshotTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_fewshot_curriculum.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_fewshot_curriculum.png");
      }

      // 4. Canary Watermark Tab
      const watermarkTab = page.locator("button:has-text('Canary Watermark')").first();
      if (await watermarkTab.isVisible()) {
        await watermarkTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_canary_watermark.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_canary_watermark.png");
      }

      // 5. Cost & Carbon Matrix Tab
      const costTab = page.locator("button:has-text('Cost & Carbon Matrix')").first();
      if (await costTab.isVisible()) {
        await costTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_cost_carbon_matrix.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_cost_carbon_matrix.png");
      }

      // 6. OpenTelemetry & Prometheus Tab
      const otelTab = page.locator("button:has-text('OpenTelemetry / Prom')").first();
      if (await otelTab.isVisible()) {
        await otelTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_opentelemetry_prom.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_opentelemetry_prom.png");
      }
    } else {
      console.warn("Could not find SPE Ω Proof Lab link");
    }
  } catch (err) {
    console.error("Screenshot capture failed:", err);
  } finally {
    await browser.close();
  }
}

main();
