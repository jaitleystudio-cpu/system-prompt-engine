import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/f1634964-b33f-46d3-b0c8-9ec0cec4e55b";

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });

  const viewports = [
    { name: "mobile_390", width: 390, height: 844 },
    { name: "desktop_1440", width: 1440, height: 900 }
  ];

  const results = {};

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    await page.waitForSelector(".hero-start");

    const btn = page.locator(".hero-start");
    await btn.waitFor({ state: "visible" });

    const metrics = await btn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const sparkle = el.querySelector(".spe-gold-sparkle");
      const coin = el.querySelector(".spe-gold-coin-arrow");
      const text = el.querySelector(".spe-gold-text");
      return {
        text: text ? text.textContent.trim() : el.textContent.trim(),
        width: rect.width,
        height: rect.height,
        backgroundImage: style.backgroundImage,
        color: style.color,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
        hasSparkle: !!sparkle,
        hasCoin: !!coin,
        top: rect.top,
        bottom: rect.bottom
      };
    });

    // Take screenshot of hero section focusing on the button
    const heroSection = page.locator(".spe-hero--main-theater");
    const shotPath = path.join(ARTIFACT_DIR, `spe_gold_treasury_button_${vp.name}.png`);
    await heroSection.screenshot({ path: shotPath });

    // Also take a tight crop screenshot of just the button itself
    const btnShotPath = path.join(ARTIFACT_DIR, `spe_gold_treasury_button_close_${vp.name}.png`);
    await btn.screenshot({ path: btnShotPath });

    results[vp.name] = {
      ...metrics,
      screenshot: shotPath,
      buttonScreenshot: btnShotPath
    };
    await page.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "gold_button_audit.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("Audit complete:", JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
