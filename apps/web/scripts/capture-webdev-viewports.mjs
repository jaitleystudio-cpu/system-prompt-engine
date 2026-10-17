import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ARTIFACT_DIR = "/Users/prawinpalisetty/.gemini/antigravity/brain/f1634964-b33f-46d3-b0c8-9ec0cec4e55b";
mkdirSync(ARTIFACT_DIR, { recursive: true });

export const VIEWPORTS = [
  { width: 320, height: 640, label: "320_mobile_se" },
  { width: 390, height: 844, label: "390_mobile_standard" },
  { width: 768, height: 1024, label: "768_tablet_portrait" },
  { width: 1024, height: 768, label: "1024_tablet_landscape" },
  { width: 1440, height: 900, label: "1440_desktop_standard" },
  { width: 1920, height: 1080, label: "1920_desktop_hd" },
];

export async function runViewportAudit(baseUrl = "http://127.0.0.1:5173/") {
  console.log("Launching Chromium for Multi-Viewport web.dev Precision Audit...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const measurements = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    await page.addInitScript(() => {
      window.__clsScore = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__clsScore += entry.value;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      } catch (e) {}
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(600);

      const shotPath = join(ARTIFACT_DIR, `spe_viewport_${vp.label}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      const metrics = await page.evaluate(() => {
        const h1 = document.querySelector("h1, .webdev-display, .webdev-h1");
        const container = document.querySelector(".webdev-container, main, #main");
        const prose = document.querySelector(".webdev-prose, p");
        const card = document.querySelector(".webdev-card, .spe-card");

        const h1Style = h1 ? window.getComputedStyle(h1) : null;
        const containerStyle = container ? window.getComputedStyle(container) : null;
        const proseStyle = prose ? window.getComputedStyle(prose) : null;
        const cardStyle = card ? window.getComputedStyle(card) : null;

        return {
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          cls: window.__clsScore || 0,
          h1: h1Style
            ? {
                fontSize: h1Style.fontSize,
                lineHeight: h1Style.lineHeight,
                fontWeight: h1Style.fontWeight,
                letterSpacing: h1Style.letterSpacing,
              }
            : null,
          container: containerStyle
            ? {
                width: containerStyle.width,
                maxWidth: containerStyle.maxWidth,
                paddingLeft: containerStyle.paddingLeft,
                paddingRight: containerStyle.paddingRight,
              }
            : null,
          prose: proseStyle
            ? {
                maxWidth: proseStyle.maxWidth,
                lineHeight: proseStyle.lineHeight,
                fontSize: proseStyle.fontSize,
              }
            : null,
          card: cardStyle
            ? {
                padding: cardStyle.padding,
                borderRadius: cardStyle.borderRadius,
              }
            : null,
        };
      });

      measurements.push({ viewport: vp, shotPath, metrics });
      console.log(`✅ [${vp.width}px] Captured screenshot & measured DOM: CLS=${metrics.cls.toFixed(4)}, H1=${metrics.h1?.fontSize}, Container maxWidth=${metrics.container?.maxWidth}`);
    } catch (err) {
      console.error(`❌ Failed at viewport ${vp.width}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const reportPath = join(ARTIFACT_DIR, "webdev_viewport_measurements.json");
  writeFileSync(reportPath, JSON.stringify(measurements, null, 2), "utf8");
  console.log(`\nAll viewport measurements saved to: ${reportPath}`);
  return measurements;
}

if (process.argv[1] && process.argv[1].endsWith("capture-webdev-viewports.mjs")) {
  runViewportAudit().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
}
