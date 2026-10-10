import { chromium } from "playwright";
import { join } from "node:path";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375";

async function captureOrbitSequence() {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const universeSection = page.locator(".spe-universe-section");
  await universeSection.scrollIntoViewIfNeeded();

  for (let i = 1; i <= 4; i++) {
    const filename = `orbit_revolving_frame_${i}.png`;
    await universeSection.screenshot({ path: join(ARTIFACTS_DIR, filename) });
    console.log(`✓ Captured ${filename}`);
    await page.waitForTimeout(1200); // 1.2s between frames
  }

  await browser.close();
}

captureOrbitSequence().catch((err) => {
  console.error(err);
  process.exit(1);
});
