// Captures REAL screenshots of the Pro preview pages for the /pro/ landing (tight crops, ~2x of display size).
// Usage: serve dist-pro-all on :4199 (vite.pro-preview.config.ts), then: node scripts/capture-pro-media.mjs
import { chromium } from "playwright";
const O = "http://127.0.0.1:4199", D = new URL("../redesign-site/public/pro/media/", import.meta.url).pathname;
const W = 1100, H = 688; // feature crop (16:10), shown at ~740px wide
const b = await chromium.launch({ channel: "chrome" }); // Chrome for Ed25519 on Releases
const page = async (dsf) => b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
// crop anchored to an element's top-left, in document coordinates
const crop = async (pg, n, sel, dx = -16, dy = -16) => { const r = await pg.evaluate(s => { const e = document.querySelector(s).getBoundingClientRect(); return { x: e.x + scrollX, y: e.y + scrollY }; }, sel);
  await pg.screenshot({ path: D + n, type: "jpeg", quality: 74, fullPage: true, clip: { x: Math.max(0, r.x + dx), y: Math.max(0, r.y + dy), width: W, height: H } }); };
const ready = async (pg) => { await pg.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); }); await pg.waitForTimeout(400); };
let pg = await page(1.5); await pg.goto(O + "/pro/studio/"); await pg.click("#btn-example"); await ready(pg);
await pg.screenshot({ path: D + "studio-hero.jpg", type: "jpeg", quality: 72 }); await pg.close();
pg = await page(1.4); await pg.goto(O + "/pro/studio/"); await pg.click("#btn-example"); await ready(pg); await crop(pg, "studio.jpg", "[role=tablist]", -24, -24);
await pg.goto(O + "/pro/blueprint/"); await ready(pg); await crop(pg, "blueprint.jpg", "#canvas", -16, -56);
await pg.goto(O + "/pro/regression-lab/"); await pg.check("input[value=demo]", { force: true }).catch(() => {}); await pg.click("#run"); await pg.waitForTimeout(600); await ready(pg); await crop(pg, "regression.jpg", "#report");
await pg.goto(O + "/pro/releases/"); await pg.fill("#rn", "support-bot"); await pg.fill("#rv", "1.0.0"); await pg.fill("#rc", "First release"); await pg.fill("#rp", "You are a support assistant.");
await pg.click("#signbtn"); await pg.waitForTimeout(800);
const pk = await pg.inputValue("#pack").catch(() => ""); if (pk) { await pg.fill("#vp", pk); await pg.click("#verify").catch(() => {}); await pg.waitForTimeout(500); }
await ready(pg); await crop(pg, "releases.jpg", "#verdict", -16, -420);
await b.close(); console.log("media ok");
