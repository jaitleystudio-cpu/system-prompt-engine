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
await pg.goto(O + "/pro/releases/"); await pg.evaluate(() => localStorage.clear()); await pg.reload();
await pg.fill("#rn", "Support bot"); await pg.fill("#rv", "1.2.0"); await pg.fill("#rc", "First release."); await pg.fill("#rp", "You are a support bot.\nNever say: refund");
await pg.click("#signbtn"); await pg.waitForFunction(() => !document.getElementById("out").hidden, null, { timeout: 5000 });
await pg.click("#toverify"); await pg.waitForFunction(() => /^Valid/.test(document.getElementById("verdict").textContent.trim()), null, { timeout: 5000 }); await ready(pg);
// Releases: "Sign a release" and "Verify a pack" sit side by side (~1300px tall). Anchor on both panels' bounding
// boxes: full width of the pair, a 16:10 window ending just below the lower of the signed pack (#out) and the Valid verdict.
const u = await pg.evaluate(() => { const g = (q) => document.querySelector(q).getBoundingClientRect(); const sp = document.querySelector("#signbtn").closest("section").getBoundingClientRect(), vp = document.querySelector("#verify").closest("section").getBoundingClientRect();
  return { x: Math.min(sp.x, vp.x) + scrollX, w: Math.max(sp.right, vp.right) - Math.min(sp.x, vp.x), top: Math.min(sp.y, vp.y) + scrollY, bottom: Math.max(g("#out").bottom, g("#verdict").bottom) + 24 + scrollY, v: document.getElementById("verdict").textContent.trim().slice(0, 40) }; });
const cw = u.w + 32, ch = cw / 1.6, cy = Math.max(u.top - 16, u.bottom - ch);
console.log("releases crop", JSON.stringify(u), Math.round(cw), Math.round(ch), Math.round(cy));
await pg.screenshot({ path: D + "releases.jpg", type: "jpeg", quality: 74, fullPage: true, clip: { x: u.x - 16, y: cy, width: cw, height: ch } });
await b.close(); console.log("media ok");
