import { chromium } from "playwright";

async function main() {
  console.log("Launching Chromium for SPE Ω Proof Lab live browser verification...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle", timeout: 15000 });
  const artifactDir = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

  // 1. Click SPE Ω Proof Lab in FeaturesHub
  console.log("Clicking SPE Ω Proof Lab in FeaturesHub...");
  const omegaLink = page.locator("a:has-text('SPE Ω Proof Lab')").first();
  await omegaLink.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/spe_omega_proof_lab_diagnostics.png` });
  console.log("Saved spe_omega_proof_lab_diagnostics.png");

  // 2. Click Hostile Gym Ω tab
  console.log("Clicking Hostile Gym Ω tab...");
  const gymTab = page.locator("button:has-text('Hostile Gym Ω')").first();
  await gymTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/spe_omega_proof_lab_gym.png` });
  console.log("Saved spe_omega_proof_lab_gym.png");

  // 3. Click Counterfactual Twin tab
  console.log("Clicking Counterfactual Twin tab...");
  const twinTab = page.locator("button:has-text('Counterfactual Twin')").first();
  await twinTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/spe_omega_proof_lab_twin.png` });
  console.log("Saved spe_omega_proof_lab_twin.png");

  // 4. Click Proof Receipt (JCS) tab
  console.log("Clicking Proof Receipt tab...");
  const receiptTab = page.locator("button:has-text('Proof Receipt')").first();
  await receiptTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/spe_omega_proof_lab_receipt.png` });
  console.log("Saved spe_omega_proof_lab_receipt.png");

  await browser.close();
  console.log("All SPE Ω Proof Lab live browser views captured successfully!");
}

main().catch((err) => {
  console.error("Browser verification error:", err);
  process.exit(1);
});
