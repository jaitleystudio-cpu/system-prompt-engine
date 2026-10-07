import { chromium } from "playwright";

async function main() {
  console.log("Launching Chromium for SPE v1.4 OmniBrain modal verification...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle", timeout: 15000 });
  const artifactDir = "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

  // 1. Click Genetic Evolver
  console.log("Clicking Genetic Evolver...");
  const evolverLink = page.locator("a:has-text('Genetic Evolver')").first();
  await evolverLink.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/spe_v1.4_genetic_evolver_studio.png` });
  console.log("Saved spe_v1.4_genetic_evolver_studio.png");

  // Close modal with button containing ✕
  await page.locator("button:has-text('✕')").first().click();
  await page.waitForTimeout(500);

  // 2. Click Blinded Arena
  console.log("Clicking Blinded Arena...");
  const arenaLink = page.locator("a:has-text('Blinded Arena')").first();
  await arenaLink.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/spe_v1.4_blinded_arena_studio.png` });
  console.log("Saved spe_v1.4_blinded_arena_studio.png");

  // Close modal
  await page.locator("button:has-text('✕')").first().click();
  await page.waitForTimeout(500);

  // 3. Click Vision Compiler
  console.log("Clicking Vision Compiler...");
  const visionLink = page.locator("a:has-text('Vision Compiler')").first();
  await visionLink.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/spe_v1.4_vision_compiler_studio.png` });
  console.log("Saved spe_v1.4_vision_compiler_studio.png");

  // Close modal
  await page.locator("button:has-text('✕')").first().click();
  await page.waitForTimeout(500);

  // 4. Click 3D Quantum Field
  console.log("Clicking 3D Quantum Field...");
  const quantumLink = page.locator("a:has-text('3D Quantum Field')").first();
  await quantumLink.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/spe_v1.4_quantum_field_studio.png` });
  console.log("Saved spe_v1.4_quantum_field_studio.png");

  await browser.close();
  console.log("All modal studios verified and captured!");
}

main().catch(err => {
  console.error("Browser verification error:", err);
  process.exit(1);
});
