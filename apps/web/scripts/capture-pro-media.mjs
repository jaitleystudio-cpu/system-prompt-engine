// Captures REAL screenshots of the Pro preview pages for the /pro/ landing.
// Usage: serve dist-pro-all on :4199 (vite.pro-preview.config.ts), then: node scripts/capture-pro-media.mjs
import { chromium } from "playwright";
const O = "http://127.0.0.1:4199", D = new URL("../redesign-site/public/pro/media/", import.meta.url).pathname;
const b = await chromium.launch({ channel: "chrome" }); // Chrome for Ed25519 on Releases
const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const shot = (n, clip) => pg.screenshot({ path: D + n, type: "jpeg", quality: 82, clip });
const main = async () => { const r = await pg.locator("main").boundingBox(); return { x: r.x, y: 56, width: 1440 - r.x, height: (1440 - r.x) * 0.625 }; };
await pg.goto(O + "/pro/studio/"); await pg.click("#btn-example"); await pg.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); }); await pg.waitForTimeout(400);
await shot("studio-hero.jpg"); await shot("studio.jpg", await main());
await pg.goto(O + "/pro/blueprint/"); await pg.waitForTimeout(400); await shot("blueprint.jpg", await main());
await pg.goto(O + "/pro/regression-lab/"); await pg.check("input[value=demo]", { force: true }).catch(() => {}); await pg.click("#run"); await pg.waitForTimeout(600);
await pg.locator("#report").scrollIntoViewIfNeeded(); await pg.evaluate(() => scrollBy(0, -80)); await pg.waitForTimeout(200); await shot("regression.jpg", { x: 240, y: 56, width: 1200, height: 750 });
await pg.goto(O + "/pro/releases/"); await pg.fill("#rn", "support-bot"); await pg.fill("#rv", "1.0.0"); await pg.fill("#rc", "First release"); await pg.fill("#rp", "You are a support assistant.");
await pg.click("#signbtn"); await pg.waitForTimeout(800);
const pk = await pg.inputValue("#pack").catch(() => ""); if (pk) { await pg.fill("#vp", pk); await pg.click("#verify").catch(() => {}); await pg.waitForTimeout(500); }
await pg.locator("#verdict").scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(200); await shot("releases.jpg", { x: 240, y: 56, width: 1200, height: 750 });
await b.close(); console.log("media ok");
