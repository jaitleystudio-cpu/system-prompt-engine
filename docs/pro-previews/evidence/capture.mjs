import { chromium, webkit } from "/Volumes/4TB-WD/spe-worktrees/spe-pro-previews-r1/apps/web/node_modules/playwright/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:4181", OUT = process.env.HOME + "/spe-pro-r1";
const axe = fs.readFileSync("/tmp/rdtools/node_modules/axe-core/axe.min.js", "utf8");
const pages = { "regression-lab": "/pro/regression-lab/", releases: "/pro/releases/", blueprint: "/pro/blueprint/", redesign: "/redesign/" };
const slow = (p, ms) => p.waitForTimeout(ms);
async function act(name, p, fast = true) {
  const w = fast ? 50 : 700;
  if (name === "regression-lab") { await p.click("#run"); await slow(p, w); await p.locator("details summary").first().click(); }
  if (name === "releases") { await p.click("#signbtn"); await p.waitForSelector("#out:not([hidden])"); await slow(p, w); await p.click("#toverify"); await slow(p, w + 300); }
  if (name === "blueprint") { await p.locator('.node[data-id="billing"]').focus(); await p.keyboard.press("Enter"); for (let i = 0; i < 3; i++) { await p.keyboard.press("Shift+ArrowDown"); await slow(p, fast ? 0 : 150); } await p.check('input[name="fmt"][value="openai"]'); await slow(p, w); }
}
const b = await chromium.launch({ channel: "chrome" }); const res = { browser: b.version() }; const copy = {};
for (const [name, path] of Object.entries(pages)) {
  res[name] = {};
  for (const [vpn, vp, mobile] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage(); const ext = [], errs = [];
    p.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("blob:") && !r.url().startsWith("data:")) ext.push(r.url()); });
    p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await p.goto(BASE + path, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
    await act(name, p); await slow(p, name === "redesign" ? 5200 : 400);
    await p.evaluate(axe);
    const ax = await p.evaluate(async () => { const o = await axe.run(document, { runOnly: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"] }); return { violations: o.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,3).map(n=>n.target.join(" ")) })), passes: o.passes.length, incomplete: o.incomplete.map(v=>v.id) }; });
    const small = await p.evaluate(() => [...document.querySelectorAll("a,button,summary,select,input:not([type=radio]):not([type=checkbox]),textarea,label.opt")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 47.5 || r.width < 47.5) && getComputedStyle(e).visibility !== "hidden" && !e.closest(".sr-only,.skip"); }).map(e => e.tagName + "#" + e.id + " " + (e.textContent||"").trim().slice(0,30) + " " + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height)));
    const heads = await p.evaluate(() => [...document.querySelectorAll("h1,h2,h3")].filter(h=>h.offsetParent||h.closest("details")).map(h => h.tagName + ": " + h.textContent.trim()));
    const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await p.evaluate(() => { const n = document.querySelector(".nav"); if (n) n.style.position = "static"; }); const shot = `${OUT}/${name}-${vpn}.jpg`; await p.screenshot({ path: shot, fullPage: true, type: "jpeg", quality: 78 });
    if (fs.statSync(shot).size > 1.45e6) await p.screenshot({ path: shot, fullPage: true, type: "jpeg", quality: 60 });
    if (vpn === "1440") copy[name] = await p.evaluate(() => [...new Set([...document.querySelectorAll("title,h1,h2,h3,p,label,legend,button,a,th,option,summary,li.hint,.badge,.hint,code")].map(e => (e.tagName === "TITLE" ? "title: " : "") + e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean))]);
    res[name][vpn] = { axe: ax, ext, errs, small, heads, hscroll, shotBytes: fs.statSync(shot).size }; await ctx.close();
  }
}
// in-browser crypto e2e on chrome + webkit
async function cryptoE2E(bt, o) { const br = await bt.launch(o); const p = await br.newPage(); await p.goto(BASE + "/pro/releases/");
  await p.click("#signbtn"); await p.waitForSelector("#out:not([hidden])"); await p.click("#toverify"); await p.waitForTimeout(300);
  const ok = await p.textContent("#verdict"); await p.click("#tamper"); await p.waitForTimeout(300); const bad = await p.textContent("#verdict");
  const v = br.version(); await br.close(); return { version: v, signedThenVerified: ok.trim(), tampered: bad.trim() }; }
res.cryptoE2E = { chrome: await cryptoE2E(chromium, { channel: "chrome" }), webkit: await cryptoE2E(webkit, {}), chromium131: await (async () => { const br = await chromium.launch(); const p = await br.newPage(); await p.goto(BASE + "/pro/releases/"); await p.waitForTimeout(500); const t = await p.textContent("#support"); await br.close(); return t.trim(); })() };
// reduced motion: verdict animation off
{ const ctx = await b.newContext({ reducedMotion: "reduce" }); const p = await ctx.newPage(); await p.goto(BASE + "/pro/releases/"); res.reducedMotionTransition = await p.evaluate(() => getComputedStyle(document.querySelector(".verdict")).transitionDuration); await ctx.close(); }
// videos
for (const name of ["regression-lab", "releases", "blueprint"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "/tmp/protools/vid", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage(); await p.goto(BASE + pages[name]); await p.evaluate(() => localStorage.clear()); await p.reload(); await slow(p, 1200);
  if (name === "regression-lab") { await p.locator("#pb").scrollIntoViewIfNeeded(); await slow(p, 1500); await p.locator("#run").scrollIntoViewIfNeeded(); await slow(p, 800); await p.click("#run"); await slow(p, 900); await p.locator("#report").evaluate(e => e.scrollIntoView({ block: "start", behavior: "smooth" })); await slow(p, 1500); await p.locator("details summary").first().click(); await slow(p, 2500); }
  if (name === "releases") { await p.locator("#sign").scrollIntoViewIfNeeded(); await slow(p, 800); await p.fill("#rv", "1.2.0"); await slow(p, 600); await p.click("#signbtn"); await slow(p, 1500); await p.click("#toverify"); await slow(p, 2000); await p.click("#tamper"); await slow(p, 2500); }
  if (name === "blueprint") { await p.locator("#canvas").scrollIntoViewIfNeeded(); await slow(p, 1000); await p.locator('.node[data-id="billing"]').focus(); await p.keyboard.press("Enter"); for (let i = 0; i < 6; i++) { await p.keyboard.press("Shift+ArrowRight"); await slow(p, 200); } await p.click("#addagent"); await slow(p, 900); await p.fill("#an", "Parts finder"); await slow(p, 800); await p.locator("#x-t").scrollIntoViewIfNeeded(); await p.check('input[name="fmt"][value="anthropic"]'); await slow(p, 2500); }
  const v = await p.video().path(); await ctx.close(); fs.copyFileSync(v, `${OUT}/${name}-walkthrough.webm`);
}
await b.close();
fs.writeFileSync(`${OUT}/axe-and-checks.json`, JSON.stringify(res, null, 1)); fs.writeFileSync(`${OUT}/copy-extract.json`, JSON.stringify(copy, null, 1));
const summ = {}; for (const n of Object.keys(pages)) for (const v of ["1440","390"]) summ[`${n}@${v}`] = { viol: res[n][v].axe.violations, ext: res[n][v].ext.length, errs: res[n][v].errs, small: res[n][v].small, hscroll: res[n][v].hscroll, kb: Math.round(res[n][v].shotBytes/1024) };
console.log(JSON.stringify({ summ, crypto: res.cryptoE2E, rm: res.reducedMotionTransition, heads: res.blueprint["1440"].heads }, null, 1));
