// P1 UI regression for SPE Pro Prompt Studio. Usage: serve dist-pro-studio on BASE, then
//   AXE_PATH=/path/to/axe.min.js SHOT_DIR=/tmp/shots node scripts/test-pro-studio-p1.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:4197/pro/studio/";
const SHOT = process.env.SHOT_DIR; const AXE = process.env.AXE_PATH;
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
if (SHOT) { mkdirSync(SHOT, { recursive: true }); await p.screenshot({ path: `${SHOT}/studio-desktop-1440.png`, fullPage: true });
  await p.evaluate(() => window.__spe.selectTab("ab")); await p.screenshot({ path: `${SHOT}/studio-compare-desktop-1440.png`, fullPage: true });
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true }); await m.goto(BASE); await m.click("#btn-example");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= 391), "mobile: no horizontal overflow");
  await m.screenshot({ path: `${SHOT}/studio-mobile-390.png`, fullPage: true }); }
await b.close(); console.log(fail ? `FAILED ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
