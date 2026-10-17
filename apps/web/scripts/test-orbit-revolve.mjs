import { chromium } from "playwright";

async function verifyOrbitRevolve() {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Scroll to universe section
  const universeSection = page.locator(".spe-universe-section");
  await universeSection.scrollIntoViewIfNeeded();

  const firstNode = page.locator(".spe-satellite-node").first();
  const box1 = await firstNode.boundingBox();
  console.log("Position at t = 0s:", box1);

  await page.waitForTimeout(1500); // Wait 1.5 seconds

  const box2 = await firstNode.boundingBox();
  console.log("Position at t = 1.5s:", box2);

  const deltaX = Math.abs((box2?.x ?? 0) - (box1?.x ?? 0));
  const deltaY = Math.abs((box2?.y ?? 0) - (box1?.y ?? 0));
  console.log(`Delta over 1.5s: dx=${deltaX.toFixed(2)}px, dy=${deltaY.toFixed(2)}px`);

  if (deltaX > 5 || deltaY > 5) {
    console.log("✓ SUCCESS: Orbit is visibly and continuously revolving!");
  } else {
    console.error("FAIL: Orbit appears static!");
    process.exit(1);
  }

  await browser.close();
}

verifyOrbitRevolve().catch((err) => {
  console.error(err);
  process.exit(1);
});
