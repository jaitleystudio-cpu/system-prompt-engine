import { chromium } from "playwright";
import { join } from "node:path";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";
const BASE_URL = process.env.HERO_URL || "http://127.0.0.1:4173";

async function run() {
  console.log(`Connecting to ${BASE_URL} to capture Storytelling Universe & Capability Deck previews...`);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });

  const page = await context.newPage();

  console.log("Navigating to Homepage...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 1. Capture Celestial Orbital Universe Section
  const universeSection = page.locator(".spe-universe-section");
  if (await universeSection.isVisible()) {
    console.log("Focusing SpeUniverseHero section...");
    await universeSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await universeSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_orbital_universe.png") });
    console.log("✓ Saved preview_spe_orbital_universe.png");

    // Click another model node (e.g. Claude 3.7 Sonnet) to test interaction state
    const claudeNode = page.locator(".spe-satellite-node:has-text('Claude 3.7 Sonnet')");
    if (await claudeNode.isVisible()) {
      await claudeNode.click();
      await page.waitForTimeout(600);
      await universeSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_orbital_universe_claude.png") });
      console.log("✓ Saved preview_spe_orbital_universe_claude.png");
    }
  } else {
    console.warn("Could not find .spe-universe-section");
  }

  // 2. Capture 3D Cover Flow Capability Deck Section
  const deckSection = page.locator(".spe-deck-section");
  if (await deckSection.isVisible()) {
    console.log("Focusing SpeCapabilityDeck section...");
    await deckSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await deckSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_3d_capability_deck.png") });
    console.log("✓ Saved preview_spe_3d_capability_deck.png");

    // Click next button to rotate 3D deck to Chamber 02
    const nextBtn = page.locator(".spe-deck-arrow-btn").nth(1);
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(600);
      await deckSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_3d_deck_rotated.png") });
      console.log("✓ Saved preview_spe_3d_deck_rotated.png");
    }
  } else {
    console.warn("Could not find .spe-deck-section");
  }

  await browser.close();
  console.log("All previews successfully captured!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
