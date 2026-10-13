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
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btn-export")]); const fp = "/tmp/spe-p1-" + dl.suggestedFilename(); await dl.saveAs(fp);
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
// P4: .spe round trip with real files + invalid files never wipe the draft
{ const c = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const pg = await c.newPage();
  const dialogs = []; pg.on("dialog", d => { dialogs.push(d.message()); d.dismiss(); });
  await pg.goto(BASE);
  const TE = "మీరు ఒక సహాయకుడు. తెలుగులో జవాబు ఇవ్వండి 🚀👩🏽‍💻 — “quotes” & <tags>";
  const big = ("Long rule line " + TE + "\n").repeat(800); // >50k chars
  const kinds = ["role", "rules", "tone", "output", "examples", "custom"];
  const draft = kinds.map((k, i) => ({ id: "x" + i, kind: k, title: k === "custom" ? "కస్టమ్ 🎯" : k, text: k === "rules" ? big : `${k}: ${TE}` }));
  await pg.evaluate(([d]) => { localStorage.setItem("spe.pro.studio.r1.draft", JSON.stringify(d)); localStorage.setItem("spe.pro.studio.r1.versions", JSON.stringify([{ id: "v1", note: "వెర్షన్ 1 ✅", at: "2026-10-14T00:00:00.000Z", blocks: d.slice(0, 2).map(({ kind, title, text }) => ({ kind, title, text })) }])); }, [draft]);
  await pg.reload();
  const state = () => pg.evaluate(() => ({ d: JSON.parse(localStorage.getItem("spe.pro.studio.r1.draft")).map(({ kind, title, text }) => ({ kind, title, text })), v: JSON.parse(localStorage.getItem("spe.pro.studio.r1.versions")).map(({ note, blocks }) => ({ note, blocks })) }));
  const s0 = await state();
  ok(big.length > 50000 && s0.d[1].text.length === big.length, `roundtrip: draft has ${big.length}-char block`);
  const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#btn-export")]); const fp = "/tmp/spe-p4-" + dl.suggestedFilename(); await dl.saveAs(fp);
  await pg.click("#btn-example"); await pg.waitForTimeout(100);
  await pg.setInputFiles("#file-import", fp); await pg.waitForTimeout(300);
  const s1 = await state();
  ok(JSON.stringify(s1.d) === JSON.stringify(s0.d), `roundtrip: all 6 block types, Telugu/emoji and ${big.length}-char block identical after import (got rules len ${s1.d[1]?.text.length})`);
  ok(JSON.stringify(s1.v) === JSON.stringify(s0.v), "roundtrip: versions (with Telugu note) identical after import");
  const bad = [
    ["malformed JSON", "broken.spe", Buffer.from('{"format":"spe.prompt","version":1,"blocks":['), /not valid JSON/i],
    ["wrong format", "other.spe", Buffer.from(JSON.stringify({ format: "other.tool", version: 1, blocks: [] })), /format.*spe\.prompt/i],
    ["wrong version", "future.spe", Buffer.from(JSON.stringify({ format: "spe.prompt", version: 2, blocks: [] })), /version 2/i],
    ["too large", "huge.spe", Buffer.alloc(6 * 1024 * 1024, 32), /too large.*5 MB/i],
    ["not a .spe file", "photo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), /photo\.png.*\.spe/i],
  ];
  for (const [name, fname, buf, re] of bad) {
    const before = await state(); dialogs.length = 0;
    await pg.setInputFiles("#file-import", { name: fname, mimeType: "application/octet-stream", buffer: buf }); await pg.waitForTimeout(300);
    const msg = (await pg.locator("#import-err").count() ? await pg.locator("#import-err").innerText() : "") + " " + dialogs.join(" ");
    ok(re.test(msg), `invalid ${name}: specific error shown ("${msg.trim().slice(0, 90)}")`);
    ok(JSON.stringify(await state()) === JSON.stringify(before), `invalid ${name}: draft and versions unchanged`);
    if (SHOT && name === "malformed JSON") await pg.screenshot({ path: `${SHOT}/${PFX}import-error-1440.png` });
  }
  await c.close(); }
// P4-B: axe at mobile widths, jump bar + checks toggle (collapsed and expanded)
if (AXE) for (const w of [390, 360]) { const c = await b.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true }); const pg = await c.newPage();
  await pg.goto(BASE); await pg.click("#btn-example"); await pg.addScriptTag({ content: readFileSync(AXE, "utf8") });
  for (const st of ["collapsed", "expanded"]) { if (st === "expanded") await pg.locator("#q-toggle").tap();
    const r = await pg.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
    ok(r.violations.length === 0, `axe ${w}px checks ${st}: ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); }
  await c.close(); }
// P5: Requirements block (user-entered MUST FOLLOW / MUST NOT, deterministic rendering, no extraction)
for (const [w, mob] of [[1440, false], [390, true]]) { const tag = mob ? "390" : "desktop";
  const c = await b.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, acceptDownloads: true, bypassCSP: !!AXE }); const pg = await c.newPage();
  try {
    await pg.goto(BASE); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.selectOption("#add-kind", "requirements", { timeout: 3000 }); await pg.click("#btn-add");
    const pv = () => pg.locator("#preview").innerText(); const blk = pg.locator('#blocks > li[data-k="requirements"]');
    ok(!/Requirements|Must/.test(await pv()), `P5 ${tag}: empty requirements render nothing`);
    ok(/Your requirements/.test(await blk.innerText()) && !/extract/i.test(await pg.content()), `P5 ${tag}: labelled 'Your requirements', never 'extracted'`);
    const addTo = async (list, t, viaEnter) => { const inp = blk.locator(`[data-req="${list}"] .req-new`); await inp.fill(t); if (viaEnter) await inp.press("Enter"); else await blk.locator(`[data-req="${list}"] .req-addbtn`).click(); };
    await addTo("must", "Work fully offline", true); await addTo("must", "Reply in under 200 words", false);
    await addTo("mustNot", "collect analytics", true); await addTo("mustNot", "create user accounts", false);
    const want = "## Requirements\nMust:\n- Work fully offline\n- Reply in under 200 words\nMust not:\n- Do not: collect analytics\n- Do not: create user accounts";
    ok((await pv()).includes(want), `P5 ${tag}: offline (must), analytics+accounts (must not), 'under 200 words' exact`);
    await blk.locator('[data-req="must"] .req-item input').nth(1).fill("Reply in under 150 words");
    ok((await pv()).includes("- Reply in under 150 words") && !(await pv()).includes("200"), `P5 ${tag}: edit to 150, only 150 appears`);
    await blk.locator('[data-req="mustNot"] .req-item').nth(0).locator(".req-del").click();
    ok((await pv()).includes("Must:\n- Work fully offline\n- Reply in under 150 words\nMust not:\n- Do not: create user accounts") && !(await pv()).includes("analytics"), `P5 ${tag}: remove one, others unchanged`);
    await addTo("must", "Create user accounts", true);
    const q = await pg.locator('#quality [data-qtype="deterministic"]').allInnerTexts(); const cq = q.find(x => /Requirement conflict/.test(x)) || "";
    ok(/Create user accounts/.test(cq) && /create user accounts/.test(cq) && (await pv()).includes("- Create user accounts") && (await pv()).includes("- Do not: create user accounts"), `P5 ${tag}: conflict shown with both items, neither dropped`);
    for (const el of await blk.locator(mob ? "button, input" : ".req button, .req input").all()) { const r = await el.boundingBox(); if (r && (r.height < 44 || r.width < 44)) { ok(false, `P5 ${tag}: tap target ${r.width}x${r.height}`); break; } }
    ok(true, `P5 ${tag}: requirement controls >= 44px`); const before = await pv(); await pg.reload(); ok(await pv() === before, `P5 ${tag}: persists after reload`);
    const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#btn-export")]); const fp = "/tmp/spe-p5-" + dl.suggestedFilename(); await dl.saveAs(fp);
    await pg.click("#btn-example"); ok(!(await pv()).includes("Must not:"), `P5 ${tag}: draft replaced before import`);
    await pg.setInputFiles("#file-import", fp); await pg.waitForTimeout(300); ok(await pv() === before, `P5 ${tag}: .spe round trip identical`);
    if (!mob) { await pg.evaluate(() => window.__spe.selectTab("ver")); await pg.fill("#v-name", "reqs"); await pg.click("#btn-save-v");
      await pg.evaluate(() => window.__spe.selectTab("edit")); await blk.locator('[data-req="must"] .req-item input').nth(0).fill("Work offline only");
      await pg.evaluate(() => window.__spe.selectTab("ver")); await pg.selectOption("#d-from", { index: 1 }); await pg.selectOption("#d-to", "draft");
      const df = await pg.locator("#diff").innerText(); ok(/Removed: - Work fully offline/.test(df.replace(/\n/g, " ")) || (df.includes("Work fully offline") && df.includes("Work offline only")), `P5 ${tag}: version + diff show requirement change`);
      await pg.evaluate(() => window.__spe.selectTab("edit")); }
    if (AXE) { await pg.addScriptTag({ content: readFileSync(AXE, "utf8") }); const r = await pg.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
      ok(r.violations.length === 0, `P5 axe ${tag}: ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); }
    if (SHOT) { await blk.scrollIntoViewIfNeeded(); await pg.screenshot({ path: `${SHOT}/${PFX}requirements-${tag}.png`, fullPage: !mob }); }
  } catch (e) { ok(false, `P5 ${tag}: ${String(e.message).split("\n")[0]}`); }
  await c.close(); }
// P6: {{variables}} — deterministic detection, Template/Filled preview, no re-expansion, persistence
for (const [w, mob] of [[1440, false], [390, true]]) { const tag = mob ? "390" : "desktop";
  const c = await b.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, acceptDownloads: true, bypassCSP: !!AXE, permissions: ["clipboard-read", "clipboard-write"] }); const pg = await c.newPage();
  try {
    await pg.goto(BASE); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.selectOption("#add-kind", "custom"); await pg.click("#btn-add");
    await pg.locator('#blocks > li[data-k="custom"] textarea').fill("Hello {{name}}, welcome to {{city}} on {{date}}. Bye {{name}}. Broken: {{ x and {y}}");
    const rows = await pg.locator("#vars [data-var]").evaluateAll(l => l.map(x => x.dataset.var + ":" + x.querySelector(".var-count").textContent.replace(/\D/g, "")).join(","), null, { timeout: 3000 });
    ok(rows === "name:2,city:1,date:1", `P6 ${tag}: detection + counts (${rows})`);
    const qt = (await pg.locator("#quality").innerText());
    ok(/Unfilled variables \(3\)/.test(qt), `P6 ${tag}: unfilled-variables check`);
    ok(/Malformed braces/.test(qt) && /\{\{ x/.test(qt) && /\{y\}\}/.test(qt), `P6 ${tag}: malformed-brace warning lists '{{ x' and '{y}}'`);
    await pg.fill('#vars [data-var="name"] input', "ప్రవీణ్ 🙏"); await pg.fill('#vars [data-var="city"] input', "{{name}}");
    await pg.click("#pv-filled");
    const pv = await pg.locator("#preview").innerText();
    ok(pv.includes("Hello ప్రవీణ్ 🙏, welcome to {{name}} on {{date}}. Bye ప్రవీణ్ 🙏."), `P6 ${tag}: substitution with Telugu; value '{{name}}' not re-expanded`);
    ok(await pg.locator("#preview mark.var-unfilled").allInnerTexts().then(a => a.join(",")) === "{{date}}", `P6 ${tag}: unfilled kept as {{date}} and highlighted`);
    await pg.click("#btn-copy"); const clip = await pg.evaluate(() => navigator.clipboard.readText());
    ok(clip.includes("Hello ప్రవీణ్ 🙏") && clip.includes("{{date}}"), `P6 ${tag}: copy uses Filled mode`);
    await pg.click("#pv-template"); await pg.click("#btn-copy");
    ok((await pg.evaluate(() => navigator.clipboard.readText())).includes("Hello {{name}}"), `P6 ${tag}: copy uses Template mode`);
    await pg.click("#pv-filled");
    if (mob) for (const el of await pg.locator("#vars input, #vars button, #pv-template, #pv-filled").all()) { const r = await el.boundingBox(); if (r && (r.height < 44 || r.width < 44)) { ok(false, `P6 ${tag}: tap target ${Math.round(r.width)}x${Math.round(r.height)}`); break; } }
    await pg.reload();
    ok(await pg.inputValue('#vars [data-var="name"] input') === "ప్రవీణ్ 🙏" && await pg.locator("#pv-filled").getAttribute("aria-pressed") === "true", `P6 ${tag}: values + mode persist after reload`);
    const before = await pg.locator("#preview").innerText();
    const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#btn-export")]); const fp = "/tmp/spe-p6-" + dl.suggestedFilename(); await dl.saveAs(fp);
    const f = JSON.parse(readFileSync(fp, "utf8"));
    ok(f.variables?.city === "{{name}}" && f.mode === "filled" && f.rendered?.includes("Hello ప్రవీణ్ 🙏"), `P6 ${tag}: export carries variables + current-mode rendered prompt`);
    await pg.click("#btn-example"); await pg.setInputFiles("#file-import", fp); await pg.waitForTimeout(300);
    ok(await pg.locator("#preview").innerText() === before && await pg.inputValue('#vars [data-var="name"] input') === "ప్రవీణ్ 🙏", `P6 ${tag}: .spe round trip identical`);
    if (!mob) { await pg.evaluate(() => window.__spe.selectTab("ver")); await pg.fill("#v-name", "vars"); await pg.click("#btn-save-v"); await pg.evaluate(() => window.__spe.selectTab("edit"));
      await pg.fill('#vars [data-var="name"] input', "Other"); await pg.evaluate(() => window.__spe.selectTab("ver")); await pg.locator("[data-restore]").first().click(); await pg.evaluate(() => window.__spe.selectTab("edit"));
      ok(await pg.inputValue('#vars [data-var="name"] input') === "ప్రవీణ్ 🙏", `P6 ${tag}: versions save + restore variable values`); }
    if (AXE) { await pg.addScriptTag({ content: readFileSync(AXE, "utf8") }); const r = await pg.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
      ok(r.violations.length === 0, `P6 axe ${tag}: ${r.violations.map(v => v.id + "(" + v.nodes.length + ")").join(",") || "0 violations"}`); }
    if (SHOT) { await pg.locator("#vars").scrollIntoViewIfNeeded(); await pg.screenshot({ path: `${SHOT}/${PFX}variables-${tag}.png`, fullPage: !mob }); }
  } catch (e) { ok(false, `P6 ${tag}: ${String(e.message).split("\n")[0]}`); }
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
