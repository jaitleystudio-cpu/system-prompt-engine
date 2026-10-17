import { chromium } from "playwright";
import { resolve } from "node:path";

const BRAIN_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

async function main() {
  console.log("Launching headless browser to capture SPE Advanced Screenshots...");
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

      // 1. Capture OWASP Tab
      const owaspTab = page.locator("button:has-text('OWASP LLM-10')").first();
      if (await owaspTab.isVisible()) {
        await owaspTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_owasp_compliance.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_owasp_compliance.png");
      } else {
        console.warn("OWASP tab not visible");
      }

      // 2. Capture SDK CodeGen Tab
      const codegenTab = page.locator("button:has-text('SDK CodeGen')").first();
      if (await codegenTab.isVisible()) {
        await codegenTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_sdk_codegen.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_sdk_codegen.png");
      } else {
        console.warn("SDK CodeGen tab not visible");
      }

      // 3. Capture Semantic Diff Tab
      const diffTab = page.locator("button:has-text('Semantic Diff')").first();
      if (await diffTab.isVisible()) {
        await diffTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_semantic_diff.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_semantic_diff.png");
      } else {
        console.warn("Semantic Diff tab not visible");
      }
    } else {
      console.warn("omegaLink not visible");
    }
  } catch (err) {
    console.error("Browser error:", err);
  } finally {
    await browser.close();
  }
}

main();
