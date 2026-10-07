import { chromium } from "playwright";
import { resolve } from "node:path";

const BRAIN_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

async function main() {
  console.log("Launching headless browser to capture 3 Strategic Projects...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  try {
    await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle", timeout: 10000 });
    console.log("Loaded SPE main page.");

    // Open Proof Lab modal via "SPE Ω Proof Lab" link in FeaturesHub
    const omegaLink = page.locator("a:has-text('SPE Ω Proof Lab')").first();
    if (await omegaLink.isVisible()) {
      await omegaLink.click();
      await page.waitForTimeout(800);
      console.log("Opened Ω Proof Lab modal.");

      // 1. Model Behavior Atlas Tab
      const atlasTab = page.locator("button:has-text('Model Behavior Atlas')").first();
      if (await atlasTab.isVisible()) {
        await atlasTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_behavior_atlas.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_behavior_atlas.png");
      } else {
        console.error("Could not find Model Behavior Atlas tab button");
      }

      // 2. Vulnerability Inventory Tab
      const vulnTab = page.locator("button:has-text('Vulnerability Inventory')").first();
      if (await vulnTab.isVisible()) {
        await vulnTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_vulnerability_inventory.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_vulnerability_inventory.png");
      } else {
        console.error("Could not find Vulnerability Inventory tab button");
      }

      // 3. AI Prompt Refiner Tab
      const refinerTab = page.locator("button:has-text('AI Prompt Refiner')").first();
      if (await refinerTab.isVisible()) {
        await refinerTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_ai_refiner.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_ai_refiner.png");
      } else {
        console.error("Could not find AI Prompt Refiner tab button");
      }
    } else {
      console.error("Could not find SPE Ω Proof Lab link");
    }
  } catch (err) {
    console.error("Capture failed:", err);
  } finally {
    await browser.close();
    console.log("Capture completed.");
  }
}

main();
