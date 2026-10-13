// P1 UI regression for SPE Pro Prompt Studio. Usage: serve dist-pro-studio on BASE, then
//   AXE_PATH=/path/to/axe.min.js SHOT_DIR=/tmp/shots node scripts/test-pro-studio-p1.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:4197/pro/studio/";
const SHOT = process.env.SHOT_DIR; const PFX = process.env.SHOT_PREFIX || ""; const AXE = process.env.AXE_PATH;
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, bypassCSP: !!AXE }); // bypassCSP only so axe can be injected
const p = await ctx.newPage(); const net = [];
p.on("request", r => { if (!r.url().startsWith(new URL(BASE).origin)) net.push(r.url()); });
await p.goto(BASE); await p.click("#btn-example");
const body = await p.evaluate(() => document.body.innerText);
ok(!/\b\d{1,3}\s*\/\s*100\b/.test(body), "no N/100 score text");
ok(!/quality (check|score|grade)|heuristic score|A\/B/i.test(body + await p.content()), "no quality score / A/B wording in DOM");
ok(/Static Prompt Checks/i.test(body), "Static Prompt Checks heading");
ok(/not a measure of output quality/.test(body), "static-check disclaimer note");
for (const t of ["deterministic", "heuristic", "tokens", "model"]) ok(await p.locator(`#quality [data-qtype="${t}"]`).count() > 0, `check type rendered: ${t}`);
ok(/Not run/.test(await p.locator('#quality [data-qtype="model"]').innerText()), "model evaluation shows Not run");
for (const l of ["Deterministic check", "Heuristic warning", "Token estimate (approximate)", "Model evaluation"]) ok(body.includes(l) || body.toUpperCase().includes(l.toUpperCase()), `label: ${l}`);
ok(await p.locator("#tab-ab").innerText() === "Compare Versions", "Compare Versions tab label");
// editor
const n0 = await p.locator("#blocks > li").count(); await p.selectOption("#add-kind", "custom"); await p.click("#btn-add");
ok(await p.locator("#blocks > li").count() === n0 + 1, "add block");
await p.keyboard.type("Zebra rule"); ok((await p.locator("#preview").innerText()).includes("Zebra rule"), "typing updates preview");
// keyboard reorder
await p.locator("#blocks > li").last().locator(".handle").focus(); await p.keyboard.press("Alt+ArrowUp");
ok((await p.locator("#blocks > li").nth(n0 - 1).getAttribute("data-k")) === "custom", "Alt+ArrowUp reorder");
// persistence
await p.reload(); ok((await p.locator("#preview").innerText()).includes("Zebra rule"), "draft persists after reload");
// versions + diff + compare
await p.click("#tab-ver"); await p.fill("#v-name", "p1 test"); await p.click("#btn-save-v");
ok(/deterministic checks pass/.test(await p.locator("#vlist").innerText()), "version saved, no score");
await p.click("#tab-edit"); await p.locator("#blocks > li").first().locator("textarea").fill("You are Diffy.");
await p.click("#tab-ver"); await p.selectOption("#d-from", { index: 1 }); await p.selectOption("#d-to", "draft"); ok(/lines added/.test(await p.locator("#d-sum").innerText()), "diff shows changes");
await p.locator("#tab-ver").focus(); await p.keyboard.press("ArrowRight");
ok(await p.locator("#tab-ab").getAttribute("aria-selected") === "true", "arrow-key tab nav to Compare Versions");
const sum = await p.locator("#ab-sum").innerText(); ok(/not ranked|neither version is ranked/i.test(sum) && !/scores higher/.test(sum), "compare does not rank");
if (AXE) { await p.addScriptTag({ content: readFileSync(AXE, "utf8") });
  for (const t of ["edit", "ver", "ab"]) { await p.evaluate(k => window.__spe.selectTab(k), t);
    const r = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }));
    ok(r.violations.length === 0, `axe ${t}: ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); } }
// export / import roundtrip
await p.evaluate(() => window.__spe.selectTab("edit"));
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btn-export")]); const fp = await dl.path();
const f = JSON.parse(readFileSync(fp, "utf8")); ok(f.format === "spe.prompt" && f.versions.length >= 1, "export .spe");
await p.click("#btn-example"); ok(!(await p.locator("#preview").innerText()).includes("Diffy"), "pre-import state differs"); await p.setInputFiles("#file-import", fp);
await p.waitForFunction(() => document.querySelector("#preview").textContent.includes("Diffy"), null, { timeout: 5000 }).catch(() => {}); ok((await p.locator("#preview").innerText()).includes("Diffy"), "import .spe restores blocks");
ok(net.length === 0, `no external network requests (${net.length})`);
// P2: real pointer drag-to-reorder (mouse on desktop, touch on mobile), order in list + prompt, survives reload
const order = pg => pg.$$eval("#blocks > li", l => l.map(x => x.dataset.k).join(","));
const heads = async pg => [...(await pg.locator("#preview").innerText()).matchAll(/^## (.+)$/gm)].map(m => m[1]).join(",");
const EXP = "rules,tone,role,output,examples", EXPH = "Rules,Tone,Role,Output format,Examples";
async function dragCheck(pg, kind, doDrag) {
  await pg.goto(BASE); await pg.click("#btn-example");
  ok(await order(pg) === "role,rules,tone,output,examples", `${kind}: before order role,rules,tone,output,examples`);
  const h = await pg.locator("#blocks > li").nth(0).locator(".handle").boundingBox(); const t = await pg.locator("#blocks > li").nth(2).boundingBox();
  await doDrag(h.x + h.width / 2, h.y + h.height / 2, t.x + t.width / 2, t.y + t.height * 0.8);
  ok(await order(pg) === EXP, `${kind}: blocks reordered (${await order(pg)})`);
  ok(await heads(pg) === EXPH, `${kind}: assembled prompt reordered (${await heads(pg)})`);
  await pg.reload(); ok(await order(pg) === EXP && await heads(pg) === EXPH, `${kind}: new order survives reload`);
}
{ const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await c.newPage();
  await dragCheck(pg, "mouse", async (x0, y0, x1, y1) => { await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x1, y1, { steps: 20 }); await pg.mouse.up(); });
  await c.close(); }
{ const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const pg = await c.newPage(); const cdp = await c.newCDPSession(pg);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await dragCheck(pg, "touch", async (x0, y0, x1, y1) => { await touch("touchStart", x0, y0); for (let k = 1; k <= 20; k++) await touch("touchMove", x0 + (x1 - x0) * k / 20, y0 + (y1 - y0) * k / 20); await touch("touchEnd"); });
  if (SHOT) { mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: `${SHOT}/${PFX}studio-mobile-after-touch-drag-390.png`, fullPage: true }); }
  await c.close(); }
// P3 mobile density. Before (fa396a1f): height 3589/3674px (390/360), prompt at y=2137/2159, checks at 2733/2756,
// 29 tap targets <44px, 31 text nodes <14px, overflow 0. Assert the after state stays well below that.
for (const [w, H] of [[390, 3589], [360, 3674]]) {
  const c = await b.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true }); const pg = await c.newPage();
  await pg.goto(BASE); await pg.click("#btn-example");
  const m = await pg.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const taps = [...document.querySelectorAll("button,select,input:not([type=file]),textarea,a,[role=tab]")].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; });
    const txt = [...document.querySelectorAll("body *")].filter(e => vis(e) && !e.closest(".sr-only") && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 14);
    return { h: document.documentElement.scrollHeight, ov: document.documentElement.scrollWidth - innerWidth, taps: taps.length, txt: txt.length }; });
  ok(m.h <= H * 0.8, `${w}px: page height ${m.h} <= 80% of before ${H}`);
  ok(m.ov <= 0 && m.taps === 0 && m.txt === 0, `${w}px: overflow ${m.ov}, small taps ${m.taps}, small text ${m.txt}`);
  ok(await pg.locator(".mjump").isVisible(), `${w}px: sticky jump bar visible`);
  await pg.locator('.mjump a[href="#preview-title"]').tap(); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => { const r = document.querySelector("#preview").getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), `${w}px: one tap on Prompt brings the prompt into view`);
  ok(await pg.locator("#quality").isHidden() && await pg.locator("#q-sum").isVisible(), `${w}px: checks collapsed by default with summary`);
  await pg.locator("#q-toggle").tap(); ok(await pg.locator("#quality").isVisible() && await pg.locator("#q-toggle").getAttribute("aria-expanded") === "true", `${w}px: checks expand on tap`);
  if (SHOT && w === 390) await pg.screenshot({ path: `${SHOT}/${PFX}studio-mobile-checks-open-390.png`, fullPage: true });
  await c.close(); }
{ const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); await pg.goto(BASE); await pg.click("#btn-example");
  ok(await pg.locator(".mjump").isHidden() && await pg.locator("#q-toggle").isHidden() && await pg.locator("#quality").isVisible(), "desktop: no mobile bar/toggle, checks visible");
  await pg.close(); }
if (SHOT) { mkdirSync(SHOT, { recursive: true }); await p.screenshot({ path: `${SHOT}/${PFX}studio-desktop-1440.png`, fullPage: true });
  await p.evaluate(() => window.__spe.selectTab("ab")); await p.screenshot({ path: `${SHOT}/${PFX}studio-compare-desktop-1440.png`, fullPage: true });
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true }); await m.goto(BASE); await m.click("#btn-example");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= 391), "mobile: no horizontal overflow");
  await m.screenshot({ path: `${SHOT}/${PFX}studio-mobile-390.png`, fullPage: true }); }
await b.close(); console.log(fail ? `FAILED ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
