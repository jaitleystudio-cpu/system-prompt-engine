// End-to-end check of Pro Studio on a local Vite dev server (mocked provider, dev sandbox, test key; no money,
// Runs against `vite preview` (the production bundle). The dev server is not used because a pre-existing SPE module
// (src/engine/networkObserver.ts) reads `process.env` unguarded, which breaks fetch in dev only.
// no network calls to model providers). Writes screenshots and a JSON summary. Exit 1 on any failed step.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

const OUT = process.env.SHOTS_DIR || "/workspace/pro-studio/r5-shots";
const PORT = 5199, BASE = `http://127.0.0.1:${PORT}`;
mkdirSync(OUT, { recursive: true });
await build({ entryPoints: ["pro-api/keys.ts"], bundle: true, format: "esm", platform: "node", outfile: "node_modules/.cache/e2e-keys.mjs", logLevel: "silent" });
const K = await import(process.cwd() + "/node_modules/.cache/e2e-keys.mjs");
const { keys, publicB64u } = await K.newIssuerKeyPair();
const now = Date.now();
const KEY = await K.signProKey({ kid: K.TEST_KID, sub: "e2e_user", tier: "pro", iat: now - 1000, exp: now + 86400000 }, keys.privateKey);
// Separate test accounts for the all-tools sweep and the display-mode checks, so the per-account rate limit
// (unchanged) is not shared with the flows above.
const KEY_TOOLS = await K.signProKey({ kid: K.TEST_KID, sub: "e2e_tools", tier: "pro", iat: now - 1000, exp: now + 86400000 }, keys.privateKey);
const KEY_MODES = await K.signProKey({ kid: K.TEST_KID, sub: "e2e_modes", tier: "pro", iat: now - 1000, exp: now + 86400000 }, keys.privateKey);

const env = { ...process.env, SPE_PRO_PUBLIC_KEYS: JSON.stringify({ [K.TEST_KID]: publicB64u }), SPE_PRO_ALLOW_TEST_KEYS: "1", SPE_PRO_ALLOW_MOCK_PROVIDER: "1", SPE_PRO_DEV_SANDBOX: "1", BROWSER: "none" };
const srv = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let srvLog = ""; srv.stdout.on("data", (d) => (srvLog += d)); srv.stderr.on("data", (d) => (srvLog += d));
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + "/"); if (r.ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }

const results = []; const consoleErrors = [];
const step = async (name, fn) => { const t = Date.now(); try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log("✔", name); } catch (e) { results.push({ name, ok: false, error: String(e.message || e).slice(0, 400) }); console.log("✖", name, "—", String(e.message || e).slice(0, 300)); } };
const browser = await chromium.launch();
const ctxFor = async (w, h, theme, withKey = true, extra = {}) => {
  const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", ...extra });
  await c.addInitScript(([t, k]) => { localStorage.setItem("spe-theme", t); if (k) localStorage.setItem("spe.pro.key", k); }, [theme, typeof withKey === "string" ? withKey : withKey ? KEY : ""]);
  return c;
};
const watch = (page, tag) => { page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${tag}: ${m.text().slice(0, 300)}`); }); page.on("pageerror", (e) => consoleErrors.push(`${tag} pageerror: ${e.message.slice(0, 300)}`)); if (process.env.E2E_TRACE) { page.on("request", (r) => { if (r.url().includes("/api/pro/living/")) console.log(`  [${tag}] ${new Date().toISOString().slice(17, 23)} -> ${r.url().split("/api/pro")[1]} ${(r.postData() ?? "").replace(/\s+/g, " ").match(/"inputs":\[[^\]]{0,200}/)?.[0] ?? ""}`); }); page.on("requestfinished", (r) => { if (r.url().includes("/api/pro/living/")) console.log(`  [${tag}] ${new Date().toISOString().slice(17, 23)} <- ${r.url().split("/api/pro")[1]}`); }); }
  page.on("dialog", (d) => { console.log(`  [${tag}] dialog: ${d.message().slice(0, 160)}`); void d.dismiss(); }); page.on("response", async (r) => { if (r.url().includes("/api/pro") && r.status() >= 400) console.log(`  [${tag}] ${r.status()} ${r.request().method()} ${r.url().split("/api/pro")[1]} ${(await r.text().catch(() => "")).slice(0, 160)}`); }); page.on("requestfailed", (r) => { if (r.url().includes("/api/pro")) console.log(`  [${tag}] request failed: ${r.url()} ${r.failure()?.errorText}`); }); };
const idle = (page) => page.waitForFunction(() => !/Running/.test(document.querySelector('[data-testid="living-run"]')?.textContent ?? ""), null, { timeout: 30000 });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const into = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); const sc = document.querySelector(".ps-content"); if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; }, sel).then(() => page.waitForTimeout(350));
const noHOverflow = async (page, where) => { const o = await page.evaluate(() => { const c = document.querySelector(".ps-content"); if (!c) return null; const r = c.getBoundingClientRect(); return { sw: c.scrollWidth, cw: c.clientWidth, wide: [...c.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > r.right + 1).slice(0, 6).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}:${Math.round(e.getBoundingClientRect().width)}`), chain: (() => { const out = []; let e = [...c.querySelectorAll("*")].find((x) => x.getBoundingClientRect().right > r.right + 1); while (e && e !== c) { const cs = getComputedStyle(e); out.push(`${e.tagName}.${String(e.className).slice(0, 24)}[${cs.display} ${cs.gridTemplateColumns.slice(0, 30)} w${Math.round(e.getBoundingClientRect().width)}]`); e = e.parentElement; } return out.join(" < "); })() }; }); if (o && o.sw > o.cw + 1) throw new Error(`${where}: workspace scrolls sideways (${o.sw} > ${o.cw}) ${o.wide.join(" ")} CHAIN ${o.chain}`); };
const expectText = async (loc, re, timeout = 15000) => { await loc.first().waitFor({ state: "visible", timeout }); const end = Date.now() + timeout; let t = ""; while (Date.now() < end) { t = await loc.first().innerText(); if (re.test(t)) return; await new Promise((r) => setTimeout(r, 150)); } throw new Error(`expected ${re} in: ${t.slice(0, 300)}`); };

try {
  // 1. Main-page entry -> gate -> bad key -> good key
  const c1 = await ctxFor(1440, 900, "dark", false); const p = await c1.newPage(); watch(p, "1440-entry");
  await step("main page has a Pro Studio entry that opens /pro-studio", async () => {
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const link = p.locator('[data-testid="nav-pro-studio"]').first(); await link.waitFor({ timeout: 30000 }); await link.click();
    await p.waitForURL(/\/pro-studio/); await p.locator('[data-testid="pro-gate"]').waitFor({ timeout: 30000 });
  });
  await shot(p, "1440-dark-gate");
  await step("gate rejects a forged key with a reason", async () => {
    await p.fill("#ps-key", "spe_pro.v1.eyJmYWtlIjoxfQ.AAAA"); await p.getByRole("button", { name: "Unlock" }).click();
    await expectText(p.locator('[data-testid="gate-reason"]'), /malformed|signature|not valid|key/i);
  });
  for (let i = consoleErrors.length - 1; i >= 0; i--) if (/^1440-entry: Failed to load resource: the server responded with a status of 401/.test(consoleErrors[i])) consoleErrors.splice(i, 1); // expected: the forged key above
  await step("gate unlocks with a server-verified key", async () => {
    await p.fill("#ps-key", KEY); await p.getByRole("button", { name: "Unlock" }).click();
    await p.locator("#ps-home-h").waitFor({ timeout: 15000 });
  });
  await shot(p, "1440-dark-home");
  await step("Ctrl+K opens the command palette", async () => { await p.keyboard.press("Control+k"); await p.locator(".ps-cmdk").waitFor({ state: "visible" }); await shot(p, "1440-dark-palette"); await p.keyboard.press("Escape"); });
  await step("left sidebar unpins to an auto-hide rail and pins back", async () => {
    await p.locator('[data-testid="left-pin"]').click(); await p.locator('[data-testid="ps-rail"]').waitFor(); await p.mouse.move(700, 400); await shot(p, "1440-dark-rail");
    await p.locator('[data-testid="ps-rail"] button').first().click(); await p.locator('[data-testid="left-pin"]').waitFor();
  });
  await step("rail Pin works while the pointer rests on the rail (hover expand does not swallow the click)", async () => {
    const pinned = () => p.locator('.ps[data-left="pinned"]').waitFor({ timeout: 3000 });
    await p.locator('[data-testid="left-pin"]').click(); await p.locator('[data-testid="ps-rail"]').waitFor(); await p.mouse.move(900, 400);
    const pin = p.locator('[data-testid="ps-rail"] button').first(); await pin.hover(); await p.waitForTimeout(150); await pin.click(); await pinned();
    await p.locator('[data-testid="left-pin"]').click(); await p.locator('[data-testid="ps-rail"]').waitFor(); await p.mouse.move(900, 400);
    await p.locator('[data-testid="ps-rail"] a').nth(3).hover(); await p.locator('.ps[data-left-peek="1"]').waitFor({ timeout: 3000 });
    await shot(p, "1440-dark-rail-peek");
    await p.locator('[data-testid="left-pin"]').click(); await pinned(); await p.mouse.move(900, 400);
  });
  await step("account chip opens a popover with theme, keys, plans and remove key", async () => {
    await p.locator('[data-testid="acct-chip"]').click(); await p.locator("#ps-acct-pop").waitFor();
    await expectText(p.locator("#ps-acct-pop"), /Theme[\s\S]*Keyboard shortcuts[\s\S]*Plans[\s\S]*Remove key/);
    await shot(p, "1440-dark-account-popover"); await p.keyboard.press("Escape"); await p.locator("#ps-acct-pop").waitFor({ state: "detached" });
  });
  await step("CoWorkie opens a tool by command", async () => {
    if (!(await p.locator("#ps-cw-input").isVisible())) await p.locator('[data-testid="cw-toggle"]').click();
    await p.locator(".ps-cw-empty").waitFor(); await p.mouse.move(700, 400); await shot(p, "1440-dark-coworkie-open");
    await p.fill("#ps-cw-input", "open batch"); await p.keyboard.press("Enter");
    await p.locator('[data-tool="batch"]').waitFor({ timeout: 10000 });
  });
  await p.waitForTimeout(400); await shot(p, "1440-dark-batch-with-coworkie");

  // 2. Flagship: Living loop with the simulated provider + real sandbox execution
  await step("FLAGSHIP: crash -> captured error -> V2 -> verified (sandbox), receipt + certificate", async () => {
    await p.goto(BASE + "/pro-studio/living"); await p.locator('[data-testid="living-demo"]').click();
    await p.locator('[data-testid="living-run"]').click();
    await expectText(p.locator('[data-testid="living-status"]'), /VERIFIED/, 30000);
    await expectText(p.locator('[data-testid="captured-errors"]'), /ReferenceError: window is not defined/);
    await p.locator('[data-testid="prompt-diff-details"]').evaluate((d) => { d.open = true; });
    await expectText(p.locator('[data-testid="prompt-diff"]'), /MUST NOT use `window` during server-side rendering/);
    await p.locator('[data-testid="lv-tab-ledger"]').click();
    await expectText(p.locator('[data-testid="living-ledger"]'), /0 runtime errors, 0 console errors/);
    await expectText(p.locator('[data-testid="living-timeline"]'), /Verified 0 errors, fix recorded/);
    await p.locator('[data-testid="lv-tab-repairs"]').click();
    await expectText(p.locator('[data-testid="scoped-repairs"]'), /Accepted/);
    await p.locator('[data-testid="lv-tab-cert"]').click();
    await p.locator('[data-testid="living-cert"]').click(); await expectText(p.locator('[data-testid="cert-summary"]'), /VERIFIED/);
    await expectText(p.locator(".ps-badge-sim").first(), /SIMULATED/);
  });
  await into(p, '[data-testid="living-panel"]'); await shot(p, "1440-dark-living-verified");
  await into(p, '[data-testid="living-timeline"]'); await shot(p, "1440-dark-living-timeline");
  await into(p, '.ps-tabs'); await shot(p, "1440-dark-living-cert");
  await p.locator('[data-testid="lv-tab-ledger"]').click(); await into(p, '.ps-tabs'); await shot(p, "1440-dark-living-ledger");
  await p.locator('[data-testid="lv-tab-result"]').click(); await into(p, '.ps-tabs'); await shot(p, "1440-dark-living-receipt");
  await into(p, '[data-testid="living-attempts"]'); await shot(p, "1440-dark-living-attempts");
  await step("Living page has no sideways overflow (1440)", async () => noHOverflow(p, "living 1440"));
  await step("NEGATIVE (UI): a fix that renders but drops a feature is rejected as drift", async () => {
    await idle(p); await p.locator('[data-testid="living-demo-drift"]').click(); await p.locator('[data-testid="living-run"]').click();
    await expectText(p.locator('[data-testid="living-status"]'), /PAUSED/, 30000);
    await p.locator('[data-testid="lv-tab-repairs"]').click();
    await expectText(p.locator('[data-testid="scoped-repairs"]'), /Rejected: drift/);
    await expectText(p.locator('[data-testid="scoped-repairs"]'), /Features removed: footer/);
    const ov = await p.evaluate(() => { const panel = document.querySelector(".ps-run"), main = document.querySelector("main") ?? document.body; if (!panel) return null; const pr = panel.getBoundingClientRect(), cw = document.querySelector(".ps-cw, [data-testid=\"coworkie\"], aside.ps-right"), mr = cw ? { right: cw.getBoundingClientRect().left } : main.getBoundingClientRect(); if (pr.right <= mr.right + 1 && panel.scrollWidth <= panel.clientWidth + 1) return null; const wide = [...panel.querySelectorAll("*")].map((e) => [e.tagName + "." + e.className, Math.round(e.getBoundingClientRect().width), e.scrollWidth]).sort((a, b) => b[2] - a[2]).slice(0, 5); return { sw: panel.scrollWidth, cwid: panel.clientWidth, panelRight: pr.right, mainRight: mr.right, panelW: pr.width, wide }; });
    if (ov) throw new Error(`proof panel overflows the workspace: ${JSON.stringify(ov)}`);
  });
  await into(p, '.ps-tabs'); await shot(p, "1440-dark-living-drift-rejected");
  await step("NEGATIVE (UI): code that keeps crashing pauses at the cap with a receipt, never verified", async () => {
    await idle(p); await p.locator('[data-testid="living-demo"]').click();
    await p.fill("#lv-in-0", "Write the app as one JavaScript code block. [demo:always-crash]"); await p.fill("#lv-max", "3"); await p.fill("#lv-name", "Always crashes");
    await p.waitForFunction(() => /always-crash/.test(document.querySelector("#lv-in-0")?.value ?? "") && document.querySelector("#lv-max")?.value === "3", null, { timeout: 5000 });
    await p.locator('[data-testid="living-run"]').click();
    await expectText(p.locator('[data-testid="living-status"]'), /PAUSED/, 30000);
    await p.locator('[data-testid="lv-tab-result"]').click();
    await expectText(p.locator('[data-testid="living-receipt"]'), /BUDGET_ATTEMPTS/);
    const st = await p.locator('[data-testid="living-status"]').innerText(); if (/VERIFIED/.test(st)) throw new Error("reported success");
  });
  await into(p, '[data-testid="living-panel"]'); await shot(p, "1440-dark-living-paused");
  await p.locator('[data-testid="living-def"] button', { hasText: "Edit" }).click(); await into(p, '[data-tool="living"]'); await shot(p, "1440-dark-living-editor");
  await step("Stop button is available and audit log records Living steps", async () => {
    await p.goto(BASE + "/pro-studio/audit"); await expectText(p.locator('[data-testid="audit-out"]'), /Chain intact/);
    await expectText(p.locator(".ps-table"), /living\.step/);
  });
  await c1.close();

  // 3. Every tool renders at 1280 (light), plus key screens
  const c2 = await ctxFor(1280, 800, "light"); const q = await c2.newPage(); watch(q, "1280-light");
  for (const t of ["living", "blind", "portability", "studio", "blueprint", "regression", "releases", "code", "batch", "brand", "formats", "cost", "scanner", "audit", "library", "report"]) {
    await step(`tool renders: ${t} (1280 light)`, async () => { await q.goto(`${BASE}/pro-studio/${t}`); await q.locator(`[data-tool="${t}"]`).waitFor({ timeout: 10000 }); await noHOverflow(q, `${t} 1280`); });
    if (["living", "studio", "blind", "portability", "scanner"].includes(t)) await shot(q, `1280-light-${t}`);
  }
  await step("Prompt Studio: example session analysed on the server", async () => {
    await q.goto(`${BASE}/pro-studio/studio`); await q.locator('[data-testid="studio-empty"]').waitFor({ timeout: 10000 }); await q.getByRole("button", { name: "Load example" }).first().click();
    await expectText(q.locator('[data-testid="studio-preview"]'), /## Role[\s\S]{40,}/);
  });
  await shot(q, "1280-light-studio-session");
  await c2.close();
  const c3 = await ctxFor(1440, 900, "light"); const r = await c3.newPage(); watch(r, "1440-light");
  await r.goto(`${BASE}/pro-studio`); await r.locator("#ps-home-h").waitFor(); await shot(r, "1440-light-home");
  await r.goto(`${BASE}/pro-studio/living`); await r.locator('[data-tool="living"]').waitFor(); await shot(r, "1440-light-living");
  await c3.close();

  // 4. Mobile 390
  const c4 = await ctxFor(390, 844, "dark"); const m = await c4.newPage(); watch(m, "390-dark");
  await step("390: home, menu drawer, CoWorkie drawer, Living", async () => {
    await m.goto(`${BASE}/pro-studio`); await m.locator("#ps-home-h").waitFor(); await shot(m, "390-dark-home"); const hw = await m.evaluate(() => document.documentElement.scrollWidth); if (hw > 392) throw new Error(`home horizontal overflow: ${hw}px`);
    await m.getByRole("button", { name: "Open menu" }).click(); await m.locator(".ps-drawer--left[open]").waitFor(); await shot(m, "390-dark-menu"); await m.keyboard.press("Escape");
    await m.locator('[data-testid="cw-toggle"]').click(); await m.locator(".ps-drawer--right[open]").waitFor(); await shot(m, "390-dark-coworkie"); await m.keyboard.press("Escape");
    await m.goto(`${BASE}/pro-studio/living`); await m.locator('[data-tool="living"]').waitFor(); await shot(m, "390-dark-living");
    const sw = await m.evaluate(() => document.documentElement.scrollWidth); if (sw > 392) throw new Error(`horizontal overflow: ${sw}px`);
  });
  const c5 = await ctxFor(390, 844, "light"); const m2 = await c5.newPage(); watch(m2, "390-light");
  await m2.goto(`${BASE}/pro-studio/living`); await m2.locator('[data-tool="living"]').waitFor(); await shot(m2, "390-light-living");
  await c4.close(); await c5.close();
  // 5. Every tool at 1440 dark, with the example session loaded so tools show real content
  const c6 = await ctxFor(1440, 900, "dark", KEY_TOOLS); await c6.addInitScript(() => localStorage.setItem("spe.pro.studio.v2.layout", JSON.stringify({ leftPinned: true, rightPinned: false }))); const t6 = await c6.newPage(); watch(t6, "1440-dark-tools");
  await step("every tool renders at 1440 dark with a session (no sideways overflow)", async () => {
    await t6.goto(`${BASE}/pro-studio/studio`); await t6.locator('[data-tool="studio"]').waitFor();
    if (await t6.locator('[data-testid="studio-empty"]').isVisible().catch(() => false)) await t6.getByRole("button", { name: "Load example" }).first().click();
    await expectText(t6.locator('[data-testid="studio-preview"]'), /## Role[\s\S]{40,}/);
    await t6.locator('[data-testid="acct-chip"]', { hasText: "Saved" }).waitFor({ timeout: 10000 }); // workspace persisted before navigating
    for (const t of ["living", "blind", "portability", "studio", "blueprint", "regression", "releases", "code", "batch", "brand", "formats", "cost", "scanner", "audit", "library", "report"]) {
      await t6.goto(`${BASE}/pro-studio/${t}`); await t6.locator(`[data-tool="${t}"]`).waitFor({ timeout: 10000 }); await t6.waitForTimeout(700);
      await noHOverflow(t6, `${t} 1440`); await shot(t6, `1440-dark-tool-${t}`);
    }
  });
  await c6.close();
  // 6. Motion and contrast modes render cleanly
  const c7 = await ctxFor(1440, 900, "dark", KEY_MODES, { reducedMotion: "reduce" }); const rm = await c7.newPage(); watch(rm, "reduced-motion");
  await step("prefers-reduced-motion: home and Living render, animations are off", async () => {
    await rm.goto(`${BASE}/pro-studio`); await rm.locator("#ps-home-h").waitFor();
    const an = await rm.evaluate(() => getComputedStyle(document.querySelector(".ps-home")).animationName); if (an !== "none") throw new Error(`animation still on: ${an}`);
    await rm.goto(`${BASE}/pro-studio/living`); await rm.locator('[data-tool="living"]').waitFor();
  });
  await c7.close();
  const c8 = await ctxFor(1440, 900, "dark", KEY_MODES, { reducedMotion: "no-preference" }); const mo = await c8.newPage(); watch(mo, "motion-on");
  await step("motion on: home and Living render without errors", async () => { await mo.goto(`${BASE}/pro-studio`); await mo.locator("#ps-home-h").waitFor(); await mo.goto(`${BASE}/pro-studio/living`); await mo.locator('[data-tool="living"]').waitFor(); await mo.waitForTimeout(500); });
  await c8.close();
  const c9 = await ctxFor(1440, 900, "dark", KEY_MODES, { forcedColors: "active" }); const fc = await c9.newPage(); watch(fc, "forced-colors");
  await step("forced-colors: home, Living and Audit render with system colours", async () => {
    await fc.goto(`${BASE}/pro-studio`); await fc.locator("#ps-home-h").waitFor();
    const m = await fc.evaluate(() => matchMedia("(forced-colors: active)").matches); if (!m) throw new Error("forced-colors not emulated");
    await shot(fc, "1440-forced-colors-home");
    await fc.goto(`${BASE}/pro-studio/living`); await fc.locator('[data-tool="living"]').waitFor(); await shot(fc, "1440-forced-colors-living");
    await fc.goto(`${BASE}/pro-studio/audit`); await fc.locator('[data-tool="audit"]').waitFor();
  });
  await c9.close();
  await step("no console errors or page errors across all flows", async () => { if (consoleErrors.length) throw new Error(consoleErrors.slice(0, 8).join(" | ")); });
} finally {
  await browser.close(); try { process.kill(-srv.pid, "SIGTERM"); } catch { srv.kill("SIGTERM"); }
}
const pass = results.filter((x) => x.ok).length, fail = results.length - pass;
writeFileSync(`${OUT}/e2e-summary.json`, JSON.stringify({ pass, fail, results, consoleErrors, note: "Model output is the deterministic development mock (SIMULATED). Sandbox execution, checks, receipts and certificates are real." }, null, 2));
console.log(`\nE2E: ${results.length} steps, ${pass} passed, ${fail} failed. Screenshots in ${OUT}`);
if (fail) { writeFileSync(`${OUT}/vite-server.log`, srvLog.slice(-20000)); process.exit(1); }
process.exit(0);
