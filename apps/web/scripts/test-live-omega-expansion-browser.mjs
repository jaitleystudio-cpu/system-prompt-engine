import { chromium } from "playwright";
import { resolve } from "node:path";

const BRAIN_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

async function main() {
  console.log("Launching headless browser to capture SPE Omega Expansion screenshots...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle", timeout: 10000 });
    console.log("Loaded SPE main page.");

    // Open Proof Lab modal via "SPE Ω Proof Lab" link in FeaturesHub
    const omegaLink = page.locator("a:has-text('SPE Ω Proof Lab')").first();
    if (await omegaLink.isVisible()) {
      await omegaLink.click();
      await page.waitForTimeout(600);
      console.log("Opened Ω Proof Lab modal.");

      // 1. Capture Mutation Testing Tab (PMS)
      const mutationTab = page.locator("button:has-text('Mutation (PMS)')").first();
      if (await mutationTab.isVisible()) {
        await mutationTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_prompt_mutation_pms.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_prompt_mutation_pms.png");
      }

      // 2. Capture Invariant Coverage Graph Tab (ICG)
      const coverageTab = page.locator("button:has-text('Invariant Graph')").first();
      if (await coverageTab.isVisible()) {
        await coverageTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_invariant_coverage_icg.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_invariant_coverage_icg.png");
      }

      // 3. Capture Model Transcompiler Tab
      const transcompilerTab = page.locator("button:has-text('Transcompiler')").first();
      if (await transcompilerTab.isVisible()) {
        await transcompilerTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_cross_model_transcompiler.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_cross_model_transcompiler.png");
      }

      // 4. Capture Symbolic Logic (FOL-CV) Tab
      const logicTab = page.locator("button:has-text('Symbolic Logic (FOL)')").first();
      if (await logicTab.isVisible()) {
        await logicTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_logic_constraint_fol.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_logic_constraint_fol.png");
      }

      // 5. Capture Swarm Topology Compiler Tab
      const swarmTab = page.locator("button:has-text('Swarm Topology')").first();
      if (await swarmTab.isVisible()) {
        await swarmTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: resolve(BRAIN_DIR, "spe_monopoly_swarm_topology.png"),
          fullPage: false,
        });
        console.log("✓ Saved spe_monopoly_swarm_topology.png");
      }
    }
  } catch (err) {
    console.error("Browser screenshot error:", err.message);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

main().catch(console.error);
