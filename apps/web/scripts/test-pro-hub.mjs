// P9 Pro Features hub + shared nav. Usage: node scripts/build-pro-all.mjs && npx vite preview -c vite.pro-preview.config.ts
//   then AXE_PATH=... SHOT_DIR=... node scripts/test-pro-hub.mjs
import { chromium } from "playwright"; import { readFileSync } from "node:fs";
const O = process.env.BASE || "http://127.0.0.1:4199"; const AXE = process.env.AXE_PATH, SHOT = process.env.SHOT_DIR, PFX = process.env.SHOT_PREFIX || "";
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const PAGES = [["/pro/", "Pro Features"], ["/pro/studio/", "Prompt Studio"], ["/pro/blueprint/", "Agent Blueprint"], ["/pro/regression-lab/", "Regression Lab"], ["/pro/releases/", "Releases"]];
const b = await chromium.launch();
for (const [w, mob] of [[1440, false], [390, true]]) { const tag = mob ? "390" : "desktop";
  const c = await b.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, bypassCSP: !!AXE }); const pg = await c.newPage();
  const ext = []; pg.on("request", r => { if (!r.url().startsWith(O) && !r.url().startsWith("data:")) ext.push(r.url()); });
  const res = await pg.goto(O + "/pro/"); ok(res.status() === 200, `${tag}: /pro/ HTTP 200`);
  const titles = await pg.locator(".hub-card__t").allInnerTexts();
  ok(titles.join("|") === "Prompt Studio|Agent Blueprint|Regression Lab|Releases", `${tag}: hub lists features in order (${titles.join(", ")})`);
  ok(await pg.locator(".hub-card .badge", { hasText: "Preview" }).count() === 4, `${tag}: every card has a Preview badge`);
  ok(/not released/i.test(await pg.innerText("body")) && /pricing are not decided/i.test(await pg.innerText("body")) && /runs in your browser/i.test(await pg.innerText("body")), `${tag}: honest preview copy`);
  ok(await pg.locator(".hub-card__b").evaluateAll(l => l.every(x => x.textContent.trim().length > 20)), `${tag}: each card has a one-line benefit`);
  const hrefs = await pg.locator(".hub-card__go").evaluateAll(l => l.map(a => a.getAttribute("href")));
  for (const h of hrefs) { const r = await pg.request.get(O + h); ok(r.status() === 200, `${tag}: link ${h} -> HTTP ${r.status()}`); }
  if (SHOT) await pg.screenshot({ path: `${SHOT}/${PFX}hub-${w}.png`, fullPage: true });
  if (AXE) { await pg.addScriptTag({ content: readFileSync(AXE, "utf8") }); const r = await pg.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
    ok(r.violations.length === 0, `${tag}: axe /pro/ ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); }
  for (const [path, name] of PAGES) {
    await pg.goto(O + path);
    const links = await pg.locator("nav.pronav .pronav__links a").evaluateAll(l => l.map(a => a.textContent + (a.getAttribute("aria-current") === "page" ? "*" : "")));
    ok(links.join("|") === PAGES.map(([p, n]) => n + (p === path ? "*" : "")).join("|"), `${tag}: nav on ${path} with active '${name}'`);
    const small = await pg.locator("nav.pronav a").evaluateAll(l => l.filter(a => { const r = a.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44); }).length);
    ok(small === 0, `${tag}: ${path} nav targets >= 44px`);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: ${path} no horizontal overflow`);
    if (AXE && path !== "/pro/") { await pg.addScriptTag({ content: readFileSync(AXE, "utf8") }); const r = await pg.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }));
      ok(r.violations.length === 0, `${tag}: axe ${path} ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); }
    if (SHOT && path === "/pro/blueprint/") await pg.screenshot({ path: `${SHOT}/${PFX}blueprint-nav-${w}.png` });
  }
  ok(ext.length === 0, `${tag}: no external requests (${ext.length})`);
  await c.close(); }
await b.close(); console.log(fail ? `FAILED ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
