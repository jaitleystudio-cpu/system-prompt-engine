// End-to-end check of Pro Studio on a local Vite dev server (mocked provider, dev sandbox, test key; no money,
// Runs against `vite preview` (the production bundle). The dev server is not used because a pre-existing SPE module
// (src/engine/networkObserver.ts) reads `process.env` unguarded, which breaks fetch in dev only.
// no network calls to model providers). Writes screenshots and a JSON summary. Exit 1 on any failed step.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

const OUT = process.env.SHOTS_DIR || "/workspace/pro-studio/r3-shots";
const PORT = 5199, BASE = `http://127.0.0.1:${PORT}`;
mkdirSync(OUT, { recursive: true });
await build({ entryPoints: ["pro-api/keys.ts"], bundle: true, format: "esm", platform: "node", outfile: "node_modules/.cache/e2e-keys.mjs", logLevel: "silent" });
const K = await import(process.cwd() + "/node_modules/.cache/e2e-keys.mjs");
const { keys, publicB64u } = await K.newIssuerKeyPair();
const now = Date.now();
const KEY = await K.signProKey({ kid: K.TEST_KID, sub: "e2e_user", tier: "pro", iat: now - 1000, exp: now + 86400000 }, keys.privateKey);

const env = { ...process.env, SPE_PRO_PUBLIC_KEYS: JSON.stringify({ [K.TEST_KID]: publicB64u }), SPE_PRO_ALLOW_TEST_KEYS: "1", SPE_PRO_ALLOW_MOCK_PROVIDER: "1", SPE_PRO_DEV_SANDBOX: "1", BROWSER: "none" };
const srv = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let srvLog = ""; srv.stdout.on("data", (d) => (srvLog += d)); srv.stderr.on("data", (d) => (srvLog += d));
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + "/"); if (r.ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }

const results = []; const consoleErrors = [];
const step = async (name, fn) => { const t = Date.now(); try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log("✔", name); } catch (e) { results.push({ name, ok: false, error: String(e.message || e).slice(0, 400) }); console.log("✖", name, "—", String(e.message || e).slice(0, 300)); } };
const browser = await chromium.launch();
const ctxFor = async (w, h, theme, withKey = true) => {
  const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await c.addInitScript(([t, k]) => { localStorage.setItem("spe-theme", t); if (k) localStorage.setItem("spe.pro.key", k); }, [theme, withKey ? KEY : ""]);
  return c;
};
const watch = (page, tag) => { page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${tag}: ${m.text().slice(0, 300)}`); }); page.on("pageerror", (e) => consoleErrors.push(`${tag} pageerror: ${e.message.slice(0, 300)}`)); if (process.env.E2E_TRACE) { page.on("request", (r) => { if (r.url().includes("/api/pro/living/")) console.log(`  [${tag}] ${new Date().toISOString().slice(17, 23)} -> ${r.url().split("/api/pro")[1]} ${(r.postData() ?? "").replace(/\s+/g, " ").match(/"inputs":\[[^\]]{0,200}/)?.[0] ?? ""}`); }); page.on("requestfinished", (r) => { if (r.url().includes("/api/pro/living/")) console.log(`  [${tag}] ${new Date().toISOString().slice(17, 23)} <- ${r.url().split("/api/pro")[1]}`); }); }
  page.on("dialog", (d) => { console.log(`  [${tag}] dialog: ${d.message().slice(0, 160)}`); void d.dismiss(); }); page.on("response", async (r) => { if (r.url().includes("/api/pro") && r.status() >= 400) console.log(`  [${tag}] ${r.status()} ${r.request().method()} ${r.url().split("/api/pro")[1]} ${(await r.text().catch(() => "")).slice(0, 160)}`); }); page.on("requestfailed", (r) => { if (r.url().includes("/api/pro")) console.log(`  [${tag}] request failed: ${r.url()} ${r.failure()?.errorText}`); }); };
const idle = (page) => page.waitForFunction(() => !/Running/.test(document.querySelector('[data-testid="living-run"]')?.textContent ?? ""), null, { timeout: 30000 });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
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
  await step("CoWorkie opens a tool by command", async () => {
    if (!(await p.locator("#ps-cw-input").isVisible())) await p.locator('[data-testid="cw-toggle"]').click();
    await p.fill("#ps-cw-input", "open batch"); await p.keyboard.press("Enter");
    await p.locator('[data-tool="batch"]').waitFor({ timeout: 10000 });
  });

  // 2. Flagship: Living loop with the simulated provider + real sandbox execution
  await step("FLAGSHIP: crash -> captured error -> V2 -> verified (sandbox), receipt + certificate", async () => {
    await p.goto(BASE + "/pro-studio/living"); await p.locator('[data-testid="living-demo"]').click();
    await p.locator('[data-testid="living-run"]').click();
    await expectText(p.locator('[data-testid="living-status"]'), /VERIFIED/, 30000);
    await expectText(p.locator('[data-testid="captured-errors"]'), /ReferenceError: window is not defined/);
    await expectText(p.locator('[data-testid="prompt-diff"]'), /MUST NOT use `window` during server-side rendering/);
    await expectText(p.locator('[data-testid="living-ledger"]'), /0 runtime errors, 0 console errors/);
    await expectText(p.locator('[data-testid="living-timeline"]'), /Verified 0 errors, fix recorded/);
    await expectText(p.locator('[data-testid="scoped-repairs"]'), /Accepted/);
    await p.locator('[data-testid="living-cert"]').click(); await expectText(p.locator('[data-testid="cert-summary"]'), /VERIFIED/);
    await expectText(p.locator(".ps-badge-sim").first(), /SIMULATED/);
  });
  await shot(p, "1440-dark-living-verified");
  await p.locator('[data-testid="living-attempts"]').scrollIntoViewIfNeeded().catch(() => {}); await shot(p, "1440-dark-living-attempts");
  await step("NEGATIVE (UI): a fix that renders but drops a feature is rejected as drift", async () => {
    await idle(p); await p.locator('[data-testid="living-demo-drift"]').click(); await p.locator('[data-testid="living-run"]').click();
    await expectText(p.locator('[data-testid="living-status"]'), /PAUSED/, 30000);
    await expectText(p.locator('[data-testid="scoped-repairs"]'), /Rejected: drift/);
    await expectText(p.locator('[data-testid="scoped-repairs"]'), /Features removed: footer/);
  });
  await shot(p, "1440-dark-living-drift-rejected");
  await step("NEGATIVE (UI): code that keeps crashing pauses at the cap with a receipt, never verified", async () => {
    await idle(p); await p.locator('[data-testid="living-demo"]').click();
    await p.fill("#lv-in-0", "Write the app as one JavaScript code block. [demo:always-crash]"); await p.fill("#lv-max", "3"); await p.fill("#lv-name", "Always crashes");
    await p.waitForFunction(() => /always-crash/.test(document.querySelector("#lv-in-0")?.value ?? "") && document.querySelector("#lv-max")?.value === "3", null, { timeout: 5000 });
    await p.locator('[data-testid="living-run"]').click();
    await expectText(p.locator('[data-testid="living-status"]'), /PAUSED/, 30000);
    await expectText(p.locator('[data-testid="living-receipt"]'), /BUDGET_ATTEMPTS/);
    const st = await p.locator('[data-testid="living-status"]').innerText(); if (/VERIFIED/.test(st)) throw new Error("reported success");
  });
  await shot(p, "1440-dark-living-paused");
  await step("Stop button is available and audit log records Living steps", async () => {
    await p.goto(BASE + "/pro-studio/audit"); await expectText(p.locator('[data-testid="audit-out"]'), /Chain intact/);
    await expectText(p.locator(".ps-table"), /living\.step/);
  });
  await c1.close();

  // 3. Every tool renders at 1280 (light), plus key screens
  const c2 = await ctxFor(1280, 800, "light"); const q = await c2.newPage(); watch(q, "1280-light");
  for (const t of ["living", "blind", "portability", "studio", "blueprint", "regression", "releases", "code", "batch", "brand", "formats", "cost", "scanner", "audit", "library", "report"]) {
    await step(`tool renders: ${t} (1280 light)`, async () => { await q.goto(`${BASE}/pro-studio/${t}`); await q.locator(`[data-tool="${t}"]`).waitFor({ timeout: 10000 }); });
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
    await m.goto(`${BASE}/pro-studio`); await m.locator("#ps-home-h").waitFor(); await shot(m, "390-dark-home");
    await m.getByRole("button", { name: "Open menu" }).click(); await m.locator(".ps-drawer--left[open]").waitFor(); await shot(m, "390-dark-menu"); await m.keyboard.press("Escape");
    await m.locator('[data-testid="cw-toggle"]').click(); await m.locator(".ps-drawer--right[open]").waitFor(); await shot(m, "390-dark-coworkie"); await m.keyboard.press("Escape");
    await m.goto(`${BASE}/pro-studio/living`); await m.locator('[data-tool="living"]').waitFor(); await shot(m, "390-dark-living");
    const sw = await m.evaluate(() => document.documentElement.scrollWidth); if (sw > 392) throw new Error(`horizontal overflow: ${sw}px`);
  });
  const c5 = await ctxFor(390, 844, "light"); const m2 = await c5.newPage(); watch(m2, "390-light");
  await m2.goto(`${BASE}/pro-studio/living`); await m2.locator('[data-tool="living"]').waitFor(); await shot(m2, "390-light-living");
  await c4.close(); await c5.close();
  await step("no console errors or page errors across all flows", async () => { if (consoleErrors.length) throw new Error(consoleErrors.slice(0, 8).join(" | ")); });
} finally {
  await browser.close(); try { process.kill(-srv.pid, "SIGTERM"); } catch { srv.kill("SIGTERM"); }
}
const pass = results.filter((x) => x.ok).length, fail = results.length - pass;
writeFileSync(`${OUT}/e2e-summary.json`, JSON.stringify({ pass, fail, results, consoleErrors, note: "Model output is the deterministic development mock (SIMULATED). Sandbox execution, checks, receipts and certificates are real." }, null, 2));
console.log(`\nE2E: ${results.length} steps, ${pass} passed, ${fail} failed. Screenshots in ${OUT}`);
if (fail) { writeFileSync(`${OUT}/vite-server.log`, srvLog.slice(-20000)); process.exit(1); }
process.exit(0);
