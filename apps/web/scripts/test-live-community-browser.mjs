import { chromium } from "playwright";
import { resolve } from "node:path";

const BRAIN_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

async function main() {
  console.log("Launching headless browser to capture SPE Monopoly screenshots...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle", timeout: 10000 });
    console.log("Loaded SPE main page.");

    // Click on "🌐 Prompts.chat Fortifier" button or open modal
    const communityBtn = page.locator("text=Prompts.chat Fortifier").first();
    if (await communityBtn.isVisible()) {
      await communityBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: resolve(BRAIN_DIR, "spe_monopoly_community_fortifier.png"),
        fullPage: false,
      });
      console.log("Saved spe_monopoly_community_fortifier.png");

      // Click "Export Promptfoo Config"
      const exportBtn = page.locator("button:has-text('Export Promptfoo Config')").first();
      if (await exportBtn.isVisible()) {
        await exportBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_promptfoo_yaml_export.png"),
          fullPage: false,
        });
        console.log("Saved spe_monopoly_promptfoo_yaml_export.png");
      }
    }

    // Now navigate to Prompt Radar and switch to Proof Lab -> Promptfoo Bridge
    await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle" });
    const proofTab = page.locator("button:has-text('🛡️ Ω Proof Lab')").first();
    if (await proofTab.isVisible()) {
      await proofTab.click();
      await page.waitForTimeout(500);

      const promptfooTab = page.locator("button:has-text('⚡ Promptfoo Bridge')").first();
      if (await promptfooTab.isVisible()) {
        await promptfooTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_promptfoo_bridge.png"),
          fullPage: false,
        });
        console.log("Saved spe_monopoly_promptfoo_bridge.png");
      }
    }
  } catch (err) {
    console.error("Browser screenshot note:", err.message);
  } finally {
    await browser.close();
  }
}

main();
