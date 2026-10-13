// P11 Pro landing + app shell + Cmd/Ctrl+K palette. Serve: node scripts/build-pro-all.mjs && npx vite preview -c vite.pro-preview.config.ts
//   then AXE_PATH=... SHOT_DIR=... node scripts/test-pro-hub.mjs
import { chromium, ENGINE } from "./pw-engine.mjs"; import { readFileSync } from "node:fs";
const O = process.env.BASE || "http://127.0.0.1:4199"; const AXE = process.env.AXE_PATH, SHOT = process.env.SHOT_DIR, PFX = process.env.SHOT_PREFIX || "";
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const FEAT = [["/pro/studio/", "Prompt Studio"], ["/pro/blueprint/", "Agent Blueprint"], ["/pro/regression-lab/", "Regression Lab"], ["/pro/releases/", "Signed Releases"]];
const NAV = [["/pro/", "Overview"], ...FEAT];
const axeRun = async (pg, tag, what) => { if (!AXE) return; await pg.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const r = await pg.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
  ok(r.violations.length === 0, `${tag}: axe ${what} ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); };
// 44px on touch (390); 40px floor on desktop (WCAG 2.2 AA asks 24px)
const small = (pg, sel, min = 44) => pg.locator(sel).evaluateAll((l, m) => l.filter(a => { const r = a.getBoundingClientRect(); return r.width && (r.height < m || r.width < m); }).map(a => a.textContent.trim().slice(0, 20)), min);
const b = await chromium.launch();
for (const [w, mob] of [[1440, false], [390, true]]) { const tag = mob ? "390" : "1440";
  const c = await b.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, bypassCSP: !!AXE }); const pg = await c.newPage();
  const ext = []; pg.on("request", r => { if (!r.url().startsWith(O) && !r.url().startsWith("data:")) ext.push(r.url()); });
  // Landing
  const res = await pg.goto(O + "/pro/"); ok(res.status() === 200, `${tag}: /pro/ HTTP 200`);
  ok(/intent into prompts/i.test(await pg.innerText("h1")), `${tag}: hero headline about intent -> prompts`);
  ok(await pg.locator(".hero .cta a", { hasText: "Open Prompt Studio" }).getAttribute("href") === "/pro/studio/" && await pg.locator(".hero .cta a", { hasText: "See all features" }).getAttribute("href") === "#features", `${tag}: hero primary + secondary CTA`);
  const imgs = await pg.locator("main img").evaluateAll(l => l.map(i => [i.getAttribute("src"), i.alt.length > 10]));
  ok(imgs.length === 5 && imgs.every(([s, a]) => s.startsWith("/pro/media/") && a), `${tag}: hero + 4 feature visuals are real captures with alt text`);
  for (const [s] of imgs) { const r = await pg.request.get(O + s); ok(r.status() === 200 && /image/.test(r.headers()["content-type"]), `${tag}: ${s} HTTP ${r.status()}`); }
  const feats = await pg.locator("[data-feature]").evaluateAll(l => l.map(s => [s.querySelector("h2").textContent.length > 10, s.querySelectorAll(".ticks li").length, s.querySelector("a.btn").getAttribute("href"), /Preview/.test(s.textContent)]));
  ok(feats.length === 4 && feats.every(([h, n], i) => h && n >= 2 && n <= 3) && feats.map(f => f[2]).join() === FEAT.map(f => f[0]).join() && feats.every(f => f[3]), `${tag}: 4 feature sections, 2-3 points, correct Open link, Preview label`);
  ok(await pg.locator(".trust li").allInnerTexts().then(t => /browser/i.test(t[0]) && /no account/i.test(t[1]) && /nothing uploaded/i.test(t[2]) && /preview/i.test(t[3])), `${tag}: honest trust strip`);
  ok(!/\b\d[\d,.]*\s*(k|\+)?\s*(users|customers|teams|companies)\b|testimonial|trusted by/i.test(await pg.innerText("body")), `${tag}: no fake metrics/testimonials`);
  const foot = await pg.locator("footer nav a").evaluateAll(l => l.map(a => a.getAttribute("href")));
  ok(NAV.every(([p]) => foot.includes(p)), `${tag}: footer lists every Pro page`);
  for (const p of foot) ok((await pg.request.get(O + p)).status() === 200, `${tag}: footer link ${p} HTTP 200`);
  ok((await small(pg, "header a, header button, footer a", mob ? 44 : 40)).length === 0, `${tag}: landing nav/footer targets >= ${mob ? 44 : 40}px`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: /pro/ no horizontal overflow`);
  await axeRun(pg, tag, "/pro/");
  if (SHOT) await pg.screenshot({ path: `${SHOT}/${PFX}landing-${w}.png`, fullPage: true });
  // Shell on every feature page
  for (const [path, name] of FEAT) {
    await pg.goto(O + path);
    const links = await pg.locator("nav.shell-side .shell-nav a").evaluateAll(l => l.map(a => a.textContent + (a.getAttribute("aria-current") === "page" ? "*" : "")));
    ok(links.join("|") === NAV.map(([p, n]) => n + (p === path ? "*" : "")).join("|"), `${tag}: sidebar on ${path}, active '${name}'`);
    ok(await pg.locator("nav.shell-side").isVisible() === !mob, `${tag}: ${path} sidebar ${mob ? "hidden (drawer instead)" : "visible"}`);
    ok((await pg.locator(".shell-crumb [aria-current=page]").innerText()) === name && await pg.locator(".shell-crumb a").getAttribute("href") === "/pro/", `${tag}: ${path} breadcrumb Pro / ${name}`);
    ok(await pg.locator("h1").count() === 1 && (await pg.locator("h1").innerText()).length > 3, `${tag}: ${path} page title`);
    ok((await small(pg, ".pro-top a, .pro-top button" + (mob ? "" : ", .shell-side a"), mob ? 44 : 40)).length === 0, `${tag}: ${path} shell targets >= ${mob ? 44 : 40}px`);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: ${path} no horizontal overflow`);
    if (mob) { await pg.click("[data-drawer-open]"); ok(await pg.locator("#shell-drawer").isVisible() && await pg.locator("#shell-drawer [aria-current=page]").innerText() === name, `${tag}: ${path} drawer opens with active item`);
      await pg.keyboard.press("Escape"); ok(!(await pg.locator("#shell-drawer").isVisible()), `${tag}: ${path} drawer closes on Esc`); }
    if (path !== "/pro/studio/") await axeRun(pg, tag, path);
  }
  // Mobile drawer navigates
  if (mob) { await pg.goto(O + "/pro/blueprint/"); await pg.click("[data-drawer-open]"); await pg.click("#shell-drawer a[href='/pro/releases/']"); await pg.waitForURL("**/pro/releases/"); ok(true, `${tag}: drawer link navigates to Releases`); }
  // Palette
  await pg.goto(O + "/pro/blueprint/"); await pg.keyboard.press("Control+k");
  ok(await pg.locator("#cmdk").isVisible() && await pg.evaluate(() => document.activeElement.id) === "cmdk-q", `${tag}: Ctrl+K opens palette, focus in search`);
  ok(await pg.getAttribute("#cmdk-q", "role") === "combobox" && await pg.getAttribute("#cmdk-q", "aria-controls") === "cmdk-list" && await pg.locator("#cmdk-list[role=listbox] [role=option]").count() >= 10, `${tag}: combobox + listbox semantics`);
  await pg.waitForTimeout(400); // let the open animation finish so axe sees final colours
  await axeRun(pg, tag, "palette open");
  await pg.keyboard.type("regres"); const opts = await pg.locator("#cmdk-list [role=option]").allInnerTexts();
  ok(opts.length >= 1 && /Regression Lab/.test(opts[0]), `${tag}: typing filters (${opts.length})`);
  await pg.keyboard.press("Enter"); await pg.waitForURL("**/pro/regression-lab/"); ok(true, `${tag}: Enter navigates to Regression Lab`);
  await pg.keyboard.press("Escape"); await pg.locator("[data-palette]").first().click(); ok(await pg.locator("#cmdk").isVisible(), `${tag}: search button opens palette`);
  await pg.fill("#cmdk-q", "zzqqxx"); ok(await pg.locator("#cmdk-empty").isVisible(), `${tag}: empty state`);
  await pg.keyboard.press("Escape"); ok(!(await pg.locator("#cmdk").isVisible()) && await pg.evaluate(() => document.activeElement.matches("[data-palette]")), `${tag}: Esc closes, focus restored`);
  // Action on another page: Templates from Releases -> Studio opens gallery
  await pg.goto(O + "/pro/releases/"); await pg.keyboard.press("Control+k"); await pg.keyboard.type("templat");
  await pg.keyboard.press("Enter"); await pg.waitForURL("**/pro/studio/**"); await pg.waitForTimeout(300);
  ok(await pg.locator("#tpl-dialog").isVisible(), `${tag}: 'Templates' action from Releases opens Studio gallery`);
  await pg.keyboard.press("Escape");
  // Action on current page: Add agent in Blueprint
  await pg.goto(O + "/pro/blueprint/"); const cards0 = await pg.locator(".node").count();
  await pg.keyboard.press("Control+k"); await pg.keyboard.type("add agent"); await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("ArrowUp");
  ok(await pg.getAttribute("#cmdk-q", "aria-activedescendant") === "cmdk-o-add-agent", `${tag}: arrows move active option (aria-activedescendant)`);
  await pg.keyboard.press("Enter"); await pg.waitForTimeout(200);
  ok(!(await pg.locator("#cmdk").isVisible()) && await pg.evaluate(() => location.pathname) === "/pro/blueprint/" && await pg.locator(".node").count() === cards0 + 1, `${tag}: 'Add agent' runs on current page`);
  // Ctrl+K works while typing in a field
  await pg.goto(O + "/pro/studio/"); await pg.click("#btn-example"); await pg.locator("#blocks textarea").first().focus(); await pg.keyboard.press("Control+k"); ok(await pg.locator("#cmdk").isVisible(), `${tag}: Ctrl+K works inside a text field`);
  if (SHOT) { await pg.keyboard.type("exp"); await pg.screenshot({ path: `${SHOT}/${PFX}palette-${w}.png` }); }
  await pg.keyboard.press("Escape");
  ok(ext.length === 0, `${tag}: no external requests (${ext.length})`);
  await c.close(); }
// P13: bento links, page weight, scroll reveal + reduced motion
for (const rm of ["no-preference", "reduce"]) { const c = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: rm }); const pg = await c.newPage();
  await pg.goto(O + "/pro/"); await pg.evaluate(async () => { for (const i of document.images) { i.loading = "eager"; await i.decode().catch(() => {}); } }); await pg.waitForTimeout(500);
  if (rm === "reduce") {
    ok(await pg.locator(".rv").count() === 0, "reduced motion: no reveal-hidden elements");
    ok(await pg.locator("[data-reveal]").evaluateAll(l => l.every(e => getComputedStyle(e).opacity === "1")), "reduced motion: all sections fully visible without scrolling");
    ok(await pg.evaluate(() => { const s = getComputedStyle(document.querySelector(".hero__shot")); return s.transitionDuration.split(",").every(d => parseFloat(d) === 0) && !/matrix3d/.test(s.transform); }), "reduced motion: hero shot has no transition and no 3D tilt");
  } else {
    const hrefs = await pg.locator(".bento a").evaluateAll(l => l.map(a => a.getAttribute("href").slice(1)));
    ok(hrefs.length === 4 && await pg.evaluate(h => h.every(id => document.getElementById(id)?.matches("[data-feature]")), hrefs), "bento: 4 cards link to feature sections");
    const bytes = await pg.evaluate(() => [performance.getEntriesByType("navigation")[0], ...performance.getEntriesByType("resource")].reduce((n, e) => n + (e.encodedBodySize || 0), 0)); ok(bytes > 400e3 && bytes < 1e6, `page weight < 1 MB (${Math.round(bytes / 1024)} KB)`);
    const below = await pg.locator(".final").evaluate(e => e.classList.contains("rv") && getComputedStyle(e).opacity !== "1"); ok(below, "reveal: below-fold section starts hidden");
    await pg.locator(".final").scrollIntoViewIfNeeded(); await pg.waitForTimeout(1000);
    ok(await pg.locator(".final").evaluate(e => e.classList.contains("is-in") && getComputedStyle(e).opacity === "1"), "reveal: section visible after scrolling");
    ok(await pg.evaluate(() => /^"?Inter/.test(getComputedStyle(document.body).fontFamily) && [...document.fonts].some(f => f.family.replace(/"/g, "") === "Inter" && f.status === "loaded")), "self-hosted Inter font loaded");
  }
  await c.close(); }
await b.close(); console.log(fail ? `FAILED ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
