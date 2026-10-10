import { chromium } from "playwright";
import { join } from "node:path";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";
const BASE_URL = process.env.HERO_URL || "http://127.0.0.1:4173";

async function run() {
  console.log(`Connecting to ${BASE_URL} to capture Hero cliparts & storytelling preview screenshots...`);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1150 },
    colorScheme: "dark",
  });

  const page = await context.newPage();

  console.log("Navigating to Homepage...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Capture Hero 1 (SpeCapabilityDeck) with Chamber 1 Clipart (Compiler Bot)
  const deckSection = page.locator(".spe-deck-section");
  if (await deckSection.isVisible()) {
    console.log("Capturing Hero 1: SpeCapabilityDeck with Chamber 1 (CompilerBotClipart)...");
    await deckSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await deckSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero1_with_cliparts.png") });
    console.log("✓ Saved preview_spe_hero1_with_cliparts.png");

    // Click next button to rotate 3D deck to Chamber 02 (GuardianShieldClipart)
    const nextBtn = page.locator(".spe-deck-arrow-btn").nth(1);
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(800);
      await deckSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero1_card2_attackgym.png") });
      console.log("✓ Saved preview_spe_hero1_card2_attackgym.png");
    }
  } else {
    console.warn("Could not find .spe-deck-section");
  }

  // 2. Capture The Verse (SpeUniverseHero) Revolving Orbit
  const universeSection = page.locator(".spe-universe-section");
  if (await universeSection.isVisible()) {
    console.log("Capturing The Verse: SpeUniverseHero celestial orbit...");
    await universeSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await universeSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_the_verse_revolving.png") });
    console.log("✓ Saved preview_spe_the_verse_revolving.png");
  }

  // 3. Capture Hero 2 (SpeStorytellingCinema) - Stage 01 (TangledKnotClipart)
  const cinemaSection = page.locator(".spe-cinema-section");
  if (await cinemaSection.isVisible()) {
    console.log("Capturing Hero 2: SpeStorytellingCinema Stage 01 (TangledKnotClipart)...");
    await cinemaSection.scrollIntoViewIfNeeded();
    // Pause auto-playback so it stays on Stage 01
    const pauseBtn = page.locator(".spe-cinema-playback-btn");
    if (await pauseBtn.isVisible() && (await pauseBtn.innerText()).includes("Pause")) {
      await pauseBtn.click();
      await page.waitForTimeout(400);
    }
    // Click Keyframe 1
    const kf1 = page.locator(".spe-cinema-keyframe-tab").nth(0);
    await kf1.click();
    await page.waitForTimeout(600);
    await cinemaSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero2_cinema_stage1.png") });
    console.log("✓ Saved preview_spe_hero2_cinema_stage1.png");

    // Click Keyframe 4 (Stage 04: Hostile Attack Gym with ForcefieldShieldClipart)
    console.log("Capturing Hero 2: SpeStorytellingCinema Stage 04 (ForcefieldShieldClipart)...");
    const kf4 = page.locator(".spe-cinema-keyframe-tab").nth(3);
    await kf4.click();
    await page.waitForTimeout(600);
    await cinemaSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero2_cinema_stage4.png") });
    console.log("✓ Saved preview_spe_hero2_cinema_stage4.png");

    // Click Keyframe 8 (Stage 08: 1-Click CI/CD Merge Gate with ProductionRocketClipart)
    console.log("Capturing Hero 2: SpeStorytellingCinema Stage 08 (ProductionRocketClipart)...");
    const kf8 = page.locator(".spe-cinema-keyframe-tab").nth(7);
    await kf8.click();
    await page.waitForTimeout(600);
    await cinemaSection.screenshot({ path: join(ARTIFACTS_DIR, "preview_spe_hero2_cinema_stage8.png") });
    console.log("✓ Saved preview_spe_hero2_cinema_stage8.png");
  } else {
    console.warn("Could not find .spe-cinema-section");
  }

  await browser.close();
  console.log("All Hero clipart previews successfully captured!");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
