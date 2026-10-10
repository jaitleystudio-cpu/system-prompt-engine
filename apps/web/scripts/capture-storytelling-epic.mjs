import { chromium } from "playwright";
import { join } from "node:path";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";
const BASE_URL = process.env.HERO_URL || "http://127.0.0.1:4173";

async function run() {
  console.log(`Connecting to ${BASE_URL} to capture SPE Ω Storytelling & Physics previews...`);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });

  const page = await context.newPage();

  console.log("Navigating to Homepage...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // 1. Capture Hero 1: Reflective Typography & Higgsfield 3D Deck
  const deckSection = page.locator(".spe-deck-section");
  if (await deckSection.isVisible()) {
    console.log("Capturing SpeCapabilityDeck (Hero 1)...");
    await deckSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await deckSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero1_reflective_deck.png") });
    console.log("✓ Saved preview_spe_hero1_reflective_deck.png");
  }

  // 2. Capture The Verse: Living Celestial Model Orbit
  const universeSection = page.locator(".spe-universe-section");
  if (await universeSection.isVisible()) {
    console.log("Capturing SpeUniverseHero (The Verse)...");
    await universeSection.scrollIntoViewIfNeeded();
    // Wait for a typewriter and spark cycle
    await page.waitForTimeout(2200);
    await universeSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_the_verse_celestial_orbit.png") });
    console.log("✓ Saved preview_spe_the_verse_celestial_orbit.png");
  }

  // 3. Capture Hero 2: The Storytelling Cinema (AGENT SENTINEL)
  const cinemaSection = page.locator(".spe-cinema-section");
  if (await cinemaSection.isVisible()) {
    console.log("Capturing SpeStorytellingCinema (Hero 2)...");
    await cinemaSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await cinemaSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero2_storytelling_cinema.png") });
    console.log("✓ Saved preview_spe_hero2_storytelling_cinema.png");

    // Click on Stage 04: Hostile Attack Gym to demonstrate interactive scrubbing
    const stage4Tab = page.locator(".spe-cinema-keyframe-tab:has-text('04')");
    if (await stage4Tab.isVisible()) {
      console.log("Scrubbing to Stage 04 (Hostile Attack Gym)...");
      await stage4Tab.click();
      await page.waitForTimeout(800);
      await cinemaSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero2_scrubber_stage4.png") });
      console.log("✓ Saved preview_spe_hero2_scrubber_stage4.png");
    }

    // Click on Stage 07: Cryptographic Receipt
    const stage7Tab = page.locator(".spe-cinema-keyframe-tab:has-text('07')");
    if (await stage7Tab.isVisible()) {
      console.log("Scrubbing to Stage 07 (RFC 8785 Proof Receipt)...");
      await stage7Tab.click();
      await page.waitForTimeout(800);
      await cinemaSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero2_scrubber_stage7.png") });
      console.log("✓ Saved preview_spe_hero2_scrubber_stage7.png");
    }
  }

  await browser.close();
  console.log("All epic previews captured successfully!");
}

run();
