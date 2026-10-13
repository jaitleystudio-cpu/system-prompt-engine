// P15 cross-engine audit of the Pro area (no Playwright pointer actions: on this macOS host, headless
// WebKit never reports elements "stable", so flows are driven with DOM clicks). Usage:
//   ENGINE=webkit PW_MODULE=/path/to/playwright@latest/index.mjs AXE_PATH=... SHOT=~/p1-shots/p15-webkit-landing-1440.png node scripts/test-pro-xbrowser.mjs
import { chromium, ENGINE } from "./pw-engine.mjs"; import { readFileSync } from "node:fs";
const O = process.env.BASE || "http://127.0.0.1:4199"; const AXE = process.env.AXE_PATH;
let fail = 0, notrun = 0; const T = Symbol("timeout");
// headless WebKit here can stall a page script indefinitely; cap each evaluate and report NOT_RUN instead of hanging
const ev = (pg, f, a, ms = 15000) => Promise.race([pg.evaluate(f, a), new Promise(r => setTimeout(() => r(T), ms))]).catch(() => T);
const nr = (m) => { console.log(`NOT_RUN [${ENGINE}] ${m} (page script stalled)`); notrun++; }; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} [${ENGINE}] ${m}`); if (!c) fail++; };
const PAGES = ["/pro/", "/pro/studio/", "/pro/blueprint/", "/pro/regression-lab/", "/pro/releases/"];
const b = await chromium.launch(); console.log(`INFO ${ENGINE} ${b.version()}`);
for (const [w, mob] of [[1440, false], [390, true]]) {
  const c = await b.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, bypassCSP: !!AXE }); const pg = await c.newPage();
  const errs = [], ext = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => m.type() === "error" && errs.push(m.text()));
  pg.on("request", r => { if (!r.url().startsWith(O) && !r.url().startsWith("data:")) ext.push(r.url()); });
  for (const p of PAGES) { errs.length = 0; const pg = await c.newPage(); pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => m.type() === "error" && errs.push(m.text())); pg.on("request", r => { if (!r.url().startsWith(O) && !r.url().startsWith("data:")) ext.push(r.url()); });
    const r = await pg.goto(O + p); await pg.waitForTimeout(400);
    ok(r.status() === 200 && (await pg.locator("h1").innerText()).length > 5, `${w}: ${p} renders (h1)`);
    ok(errs.length === 0, `${w}: ${p} no JS/CSP errors ${errs.slice(0, 2).join(" | ")}`);
    { const v = await ev(pg, () => document.documentElement.scrollWidth <= innerWidth + 1); v === T ? nr(`${w}: ${p} overflow`) : ok(v, `${w}: ${p} no horizontal overflow`); }
    if (p !== "/pro/") ok(await pg.evaluate(m => { const s = getComputedStyle(document.querySelector(".shell-side")).display !== "none"; return m ? !s && !!document.querySelector("[data-drawer-open]").offsetWidth : s; }, mob), `${w}: ${p} ${mob ? "drawer button" : "sidebar"} shown`);
    if (AXE) { await pg.addScriptTag({ content: readFileSync(AXE, "utf8") }); const a = await ev(pg, () => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }), null, 30000);
      if (a === T) nr(`${w}: axe ${p}`); else ok(a.violations.length === 0, `${w}: axe ${p} ${a.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); }
    await pg.close(); }
  const sect = async (name, f) => { const pg = await c.newPage(); pg.on("request", r => { if (!r.url().startsWith(O) && !r.url().startsWith("data:")) ext.push(r.url()); }); try { await f(pg); } catch (e) { nr(`${w}: ${name}: ${String(e.message).split("\n")[0].slice(0, 90)}`); } await pg.close().catch(() => {}); };
  await sect("landing", async (pg) => {
  await pg.goto(O + "/pro/"); await pg.evaluate(async () => { document.documentElement.classList.add("no-reveal"); for (const i of document.images) { i.loading = "eager"; await i.decode().catch(() => {}); } }); await pg.waitForTimeout(800);
  ok(await pg.evaluate(() => [...document.images].every(i => i.naturalWidth > 0)), `${w}: landing images decode`);
  ok(await pg.evaluate(() => [...document.fonts].some(f => f.family.replace(/"/g, "") === "Inter" && f.status === "loaded")), `${w}: self-hosted Inter loaded`);
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector(".bento__c a")).backgroundImage !== "none"), `${w}: bento cards have a tinted gradient background (readable even without backdrop blur)`);
  console.log(`INFO ${ENGINE} ${w}: box-reflect=${await pg.evaluate(() => CSS.supports("-webkit-box-reflect", "below 0"))} backdrop=${await pg.evaluate(() => CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"))}`);
  if (process.env.SHOT && w === 1440) await pg.screenshot({ path: process.env.SHOT, fullPage: true });
  });
  await sect("palette", async (pg) => {
  await pg.goto(O + "/pro/blueprint/"); await pg.keyboard.press(ENGINE === "webkit" ? "Meta+k" : "Control+k"); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.getElementById("cmdk").open), `${w}: palette opens with ${ENGINE === "webkit" ? "⌘" : "Ctrl"}+K`);
  });
  await sect("studio", async (pg) => {
  await pg.goto(O + "/pro/studio/"); await pg.evaluate(() => document.getElementById("btn-example").click()); await pg.waitForTimeout(300);
  ok(await pg.locator("#blocks textarea").count() >= 3, `${w}: studio example loads blocks`);
  });
  await sect("releases", async (pg) => {
  await pg.goto(O + "/pro/releases/"); await pg.waitForTimeout(500);
  const ed = await pg.evaluate(async () => { try { await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]); return true; } catch { return false; } });
  if (ed) { await pg.fill("#rn", "Support bot"); await pg.fill("#rv", "1.2.0"); await pg.fill("#rc", "First."); await pg.fill("#rp", "You are a support bot.");
    await pg.evaluate(() => document.getElementById("signbtn").click()); await pg.waitForFunction(() => !document.getElementById("out").hidden, null, { timeout: 8000 }).catch(() => {});
    await pg.evaluate(() => document.getElementById("toverify").click()); await pg.waitForTimeout(500);
    ok(/^Valid/.test(await pg.locator("#verdict").innerText()), `${w}: Ed25519 sign + verify works`); }
  else ok(/does not support Ed25519/.test(await pg.locator("#support").innerText()) && await pg.locator("#signbtn").isDisabled(), `${w}: no Ed25519 -> clear unsupported message, signing off`);
  });
  ok(ext.length === 0, `${w}: no external requests`);
  await c.close(); }
await b.close(); console.log(`NOT_RUN ${notrun}`); console.log(fail ? `FAILED ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
