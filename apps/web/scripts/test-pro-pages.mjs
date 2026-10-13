// P10 end-to-end flows for Pro pages + single Studio header. Serve: node scripts/build-pro-all.mjs && npx vite preview -c vite.pro-preview.config.ts
import { chromium, ENGINE } from "./pw-engine.mjs"; import { readFileSync } from "node:fs";
const O = process.env.BASE || "http://127.0.0.1:4199"; const SHOT = process.env.SHOT_DIR, PFX = process.env.SHOT_PREFIX || "";
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const step = async (name, f) => { try { await f(); } catch (e) { ok(false, `${name}: ${String(e.message).split("\n")[0]}`); } };
const b = await chromium.launch();
// A) Studio: one top bar (P11 shell) containing breadcrumb + search + actions
for (const [w, mob] of [[1440, false], [390, true]]) await step(`studio header ${w}`, async () => {
  const pg = await b.newPage({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob }); await pg.goto(O + "/pro/studio/");
  ok(await pg.locator("header").count() === 1 && await pg.locator('[role="banner"], header').count() === 1, `studio ${w}: exactly one header`);
  ok(await pg.locator("header nav.shell-crumb").count() === 1 && await pg.locator("header #btn-templates, header #btn-example, header #btn-import, header #btn-export").count() === 4, `studio ${w}: nav + 4 actions in the header`);
  const top = await pg.locator("header").boundingBox(); ok(top.y === 0, `studio ${w}: header at top`);
  if (!mob) { const ys = await pg.locator("header .shell-crumb [aria-current], header #btn-export").evaluateAll(l => l.map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
    ok(Math.abs(ys[0] - ys[1]) <= 4, `studio 1440: nav and actions share one row (${ys})`); }
  if (mob) { const small = await pg.locator("header a, header button").evaluateAll(l => l.filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44); }).length); ok(small === 0, "studio 390: header targets >= 44px");
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "studio 390: no horizontal overflow"); }
  if (SHOT) await pg.screenshot({ path: `${SHOT}/${PFX}studio-header-${w}.png` }); await pg.close(); });
// B1) Blueprint
await step("blueprint", async () => {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const pg = await c.newPage(); await pg.goto(O + "/pro/blueprint/"); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const nodes = () => pg.locator("#inner .node").count(); const n0 = await nodes(); const checks = () => pg.locator("#checks").innerText();
  ok(/No problems found/.test(await checks()), "blueprint: example has no problems");
  await pg.click("#addagent"); ok(await nodes() === n0 + 1, "blueprint: add agent");
  await pg.fill("#an", "Triage"); ok(/Two agents are named Triage/.test(await checks()), "blueprint: duplicate name shows in Checks");
  await pg.fill("#an", "Shipping"); ok(/No problems found/.test(await checks()) && (await pg.locator("#inner .node").last().innerText()).includes("Shipping"), "blueprint: edit name updates canvas + Checks");
  await pg.locator('#tools input[value="send_email"]').check(); ok(/Shipping: has a tool that changes things/.test(await checks()), "blueprint: risky tool without approval flagged");
  await pg.check("#aa"); ok(/No problems found/.test(await checks()), "blueprint: approval clears the check");
  const h0 = await pg.locator("#hlist [data-h]").count();
  await pg.selectOption("#hf", { label: "Triage" }); await pg.selectOption("#ht", { label: "Shipping" }); await pg.fill("#hw", "the order has shipped");
  await pg.locator('#hform button[type="submit"], #hform button:not([type])').first().click();
  ok(await pg.locator("#hlist [data-h]").count() === h0 + 1 && (await pg.locator("#hlist").innerText()).includes("Triage → Shipping"), "blueprint: add handoff Triage → Shipping");
  ok(await pg.locator("#edges path.e").count() === h0 + 1, "blueprint: handoff drawn on canvas");
  await pg.locator("#hlist [data-h]").last().click(); ok(await pg.locator("#hlist [data-h]").count() === h0, "blueprint: remove handoff");
  await pg.locator("#inner .node").last().click(); await pg.click("#del"); ok(await nodes() === n0 && !(await pg.locator("#inner").innerText()).includes("Shipping"), "blueprint: remove agent");
  for (const f of ["mcp", "openai", "anthropic"]) { await pg.check(`input[name="fmt"][value="${f}"]`); let j = null; try { j = JSON.parse(await pg.inputValue("#exp")); } catch {}
    ok(j && typeof j === "object", `blueprint: ${f} export is valid JSON`);
    const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 5000 }), pg.click("#dl")]); const fp = `/tmp/p10-bp-${f}.json`; await dl.saveAs(fp);
    let d = null; try { d = JSON.parse(readFileSync(fp, "utf8")); } catch {} ok(d && dl.suggestedFilename() === `blueprint-${f}-draft.json`, `blueprint: download ${dl.suggestedFilename()} valid JSON`); }
  await pg.reload(); ok(await nodes() === n0, "blueprint: state persists after reload");
  if (SHOT) await pg.screenshot({ path: `${SHOT}/${PFX}blueprint-flow.png`, fullPage: true }); await c.close(); });
// B2) Regression Lab
await step("regression", async () => {
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); await pg.goto(O + "/pro/regression-lab/"); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const k0 = await pg.locator("#cases > li").count();
  await pg.fill("#cn", "Mentions staff"); await pg.fill("#ci", "Can you fix my gears?"); await pg.fill("#cy", "staff"); await pg.fill("#cw", "40");
  await pg.locator('#add button[type="submit"], #add button:not([type])').first().click();
  ok(await pg.locator("#cases > li").count() === k0 + 1, "regression: add test case");
  await pg.check('input[name="runner"][value="demo"]', { force: true }); await pg.click("#run");
  ok(await pg.locator("#report").isVisible() && (await pg.locator("#rows").innerText()).includes("Mentions staff"), "regression: run shows the new case in the report");
  const ui = (await pg.innerText("body")); ok(/simulated/i.test(await pg.locator("#status").innerText()) && /Demo runner \(simulated\)/.test(ui) && /simulated answer/i.test(await pg.locator("#rows").innerHTML()), "regression: runner, status and answers labelled simulated");
  ok(await pg.locator('input[name="runner"][value="byok"]').isDisabled() && /Not available in this preview/.test(ui), "regression: own-API-key runner is disabled and says not available");
  if (SHOT) { await pg.screenshot({ path: `${SHOT}/${PFX}regression-flow.png`, fullPage: true }); } await pg.close(); });
// B3) Releases
// Ed25519 WebCrypto needs Chrome 137+; Playwright's bundled Chromium (131) lacks it, so use installed Chrome if present.
const bc = await chromium.launch({ channel: "chrome" }).catch(() => null); console.log(`INFO releases browser: ${bc ? "chrome " + bc.version() : "bundled chromium " + b.version()}`);
await step("releases", async () => {
  const pg = await (bc || b).newPage({ viewport: { width: 1440, height: 900 } }); await pg.goto(O + "/pro/releases/"); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  ok(await pg.locator("#signbtn").isEnabled(), "releases: Ed25519 supported, signing enabled");
  await pg.fill("#rn", "Support bot"); await pg.fill("#rv", "1.x"); await pg.click("#signbtn"); ok(/Version must look like/.test(await pg.locator("#sstat").innerText()), "releases: bad version rejected");
  await pg.fill("#rv", "1.2.0"); await pg.fill("#rc", "First release."); await pg.fill("#rp", "You are a support bot.\nNever say: refund"); await pg.click("#signbtn");
  await pg.waitForFunction(() => !document.getElementById("out").hidden, null, { timeout: 5000 }); ok(/Signed Support bot 1.2.0/.test(await pg.locator("#sstat").innerText()), "releases: create + sign version");
  const pack = JSON.parse(await pg.inputValue("#pack")); ok(pack.signature && pack.publicKey && pack.sha256, "releases: pack has signature, key, sha256");
  await pg.click("#toverify"); await pg.waitForTimeout(300); ok(/^Valid/.test(await pg.locator("#verdict").innerText()), "releases: verify passes");
  await pg.click("#tamper"); await pg.waitForTimeout(300); ok(/Not valid/.test(await pg.locator("#verdict").innerText()), "releases: tampered prompt fails");
  const t2 = { ...pack, version: "9.9.9" }; await pg.fill("#vp", JSON.stringify(t2)); await pg.click('#verify button[type="submit"], #verify button:not([type])'); await pg.waitForTimeout(300);
  ok(/Not valid/.test(await pg.locator("#verdict").innerText()), "releases: tampered version field fails");
  await pg.fill("#vp", JSON.stringify(pack)); await pg.fill("#vf", "deadbeef"); await pg.click('#verify button[type="submit"], #verify button:not([type])'); await pg.waitForTimeout(300);
  ok(/Not valid/.test(await pg.locator("#verdict").innerText()), "releases: wrong expected fingerprint fails");
  await pg.fill("#vp", "{not json"); await pg.fill("#vf", ""); await pg.click('#verify button[type="submit"], #verify button:not([type])'); await pg.waitForTimeout(300);
  ok(/Not valid/.test(await pg.locator("#verdict").innerText()), "releases: malformed pack fails cleanly");
  if (SHOT) { await pg.click("#toverify"); await pg.waitForTimeout(300); await pg.screenshot({ path: `${SHOT}/${PFX}releases-flow.png`, fullPage: true }); } await pg.close(); });
// P12: editing an agent field must not reset the handoff From/To selections
await step("blueprint handoff selection", async () => {
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); await pg.goto(O + "/pro/blueprint/");
  const ids = await pg.locator("#hf option").evaluateAll(l => l.map(o => o.value)); ok(ids.length >= 3, `handoff: >=3 agents (${ids.length})`);
  await pg.selectOption("#hf", ids[2]); await pg.selectOption("#ht", ids[0]);
  await pg.locator(".node").first().click(); await pg.fill("#an", "Renamed agent"); await pg.fill("#ar", "edited role");
  ok(await pg.inputValue("#hf") === ids[2] && await pg.inputValue("#ht") === ids[0], "handoff: From/To kept after editing agent fields");
  ok(await pg.locator("#hf option", { hasText: "Renamed agent" }).count() === 1, "handoff: renamed agent shows in dropdown");
  await pg.close(); });
if (bc) await bc.close(); await b.close(); console.log(fail ? `FAILED ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
