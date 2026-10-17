/**
 * Capture ≥6 REAL UI screenshots (HTML fixtures rendered in Chromium) for Screenshot→Code validation.
 * Kinds: desktop landing, mobile app, form, dashboard/sidebar, card/grid, difficult dark UI.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = join(repo, "proofs/spe_v1_launch/screenshot_real_fixtures");
const htmlDir = join(root, "scripts/fixtures/real-ui");
mkdirSync(outDir, { recursive: true });
mkdirSync(htmlDir, { recursive: true });

const pages = {
  "desktop-landing": {
    w: 1280, h: 800,
    html: `<!doctype html><html><head><meta charset="utf-8"/><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,system-ui,sans-serif;color:#0f172a;background:#f8fafc}
      header{display:flex;justify-content:space-between;align-items:center;padding:1rem 2rem;background:#fff;border-bottom:1px solid #e2e8f0}
      nav a{margin-left:1.25rem;color:#334155;text-decoration:none;font-weight:600}
      .hero{display:grid;grid-template-columns:1.2fr 1fr;gap:2rem;padding:3rem 2rem;max-width:1100px;margin:0 auto}
      .hero h1{font-size:2.6rem;line-height:1.15;margin-bottom:1rem}
      .hero p{color:#475569;font-size:1.1rem;margin-bottom:1.5rem}
      .cta{background:#2563eb;color:#fff;border:0;padding:.85rem 1.4rem;border-radius:999px;font-weight:700}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:1.25rem;box-shadow:0 10px 30px rgba(15,23,42,.06)}
      footer{margin-top:2rem;padding:1.5rem 2rem;color:#64748b;border-top:1px solid #e2e8f0}
    </style></head><body>
      <header><strong>Northwind Studio</strong><nav><a href="#">Product</a><a href="#">Pricing</a><a href="#">Docs</a></nav></header>
      <main class="hero"><div><h1>Ship calmer product prompts</h1><p>Turn messy briefs into clear instructions your team can reuse.</p><button class="cta">Start free</button></div>
      <aside class="card"><h2>Today</h2><p>3 drafts ready · 1 review pending</p></aside></main>
      <footer>© Northwind Studio</footer></body></html>`,
  },
  "mobile-app": {
    w: 390, h: 844,
    html: `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;background:#0b1020;color:#e2e8f0}
    .app{max-width:390px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
    .top{padding:1rem;display:flex;justify-content:space-between;align-items:center;background:#121826}
    .list{flex:1;padding:1rem;display:flex;flex-direction:column;gap:.75rem}
    .row{background:#1a2236;border-radius:14px;padding:1rem;display:flex;justify-content:space-between}
    .tabbar{display:grid;grid-template-columns:repeat(4,1fr);gap:.25rem;padding:.75rem;background:#121826;border-top:1px solid #243049}
    .tabbar span{text-align:center;font-size:.75rem;color:#94a3b8}
    </style></head><body><div class="app"><div class="top"><strong>Pulse</strong><span>Account</span></div>
    <div class="list"><div class="row"><div><b>Morning run</b><div style="color:#94a3b8;font-size:.85rem">32 min</div></div><span>Done</span></div>
    <div class="row"><div><b>Focus block</b><div style="color:#94a3b8;font-size:.85rem">90 min</div></div><span>Next</span></div>
    <div class="row"><div><b>Inbox zero</b><div style="color:#94a3b8;font-size:.85rem">12 left</div></div><span>Open</span></div></div>
    <div class="tabbar"><span>Home</span><span>Plan</span><span>Stats</span><span>Me</span></div></div></body></html>`,
  },
  "form": {
    w: 960, h: 720,
    html: `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:system-ui;background:#f1f5f9;color:#0f172a;margin:0}
    .wrap{max-width:560px;margin:2rem auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:1.5rem}
    h1{font-size:1.4rem;margin:0 0 1rem}label{display:block;margin:.75rem 0 .35rem;font-weight:600}
    input,textarea,select{width:100%;padding:.7rem;border:1px solid #94a3b8;border-radius:8px;font:inherit}
    button{margin-top:1rem;background:#0f766e;color:#fff;border:0;padding:.8rem 1.2rem;border-radius:8px;font-weight:700}
    </style></head><body><div class="wrap"><h1>Contact support</h1>
    <form><label>Full name</label><input value="Ada Lovelace"/>
    <label>Email</label><input type="email" value="ada@example.com"/>
    <label>Topic</label><select><option>Billing</option><option selected>Product help</option></select>
    <label>Message</label><textarea rows="5">I need help exporting my prompts.</textarea>
    <button type="submit">Send message</button></form></div></body></html>`,
  },
  "dashboard-sidebar": {
    w: 1280, h: 800,
    html: `<!doctype html><html><head><meta charset="utf-8"/><style>
    *{box-sizing:border-box;margin:0;padding:0}body{display:grid;grid-template-columns:240px 1fr;min-height:100vh;font-family:system-ui;background:#f8fafc;color:#0f172a}
    aside{background:#0f172a;color:#e2e8f0;padding:1.25rem}.aside a{display:block;color:#cbd5e1;text-decoration:none;padding:.55rem 0}
    main{padding:1.5rem}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
    .tile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem}.tile b{font-size:1.6rem}
    table{width:100%;margin-top:1.25rem;border-collapse:collapse;background:#fff}th,td{border-bottom:1px solid #e2e8f0;text-align:left;padding:.7rem}
    </style></head><body><aside><strong>Acme Ops</strong><nav style="margin-top:1rem"><a href="#">Overview</a><a href="#">Teams</a><a href="#">Alerts</a><a href="#">Settings</a></nav></aside>
    <main><header><h1>Overview</h1><button>New report</button></header>
    <div class="grid"><div class="tile"><div>Open tickets</div><b>18</b></div><div class="tile"><div>SLA risk</div><b>3</b></div><div class="tile"><div>CSAT</div><b>94%</b></div></div>
    <table><thead><tr><th>Queue</th><th>Owner</th><th>Status</th></tr></thead>
    <tbody><tr><td>Billing</td><td>Riya</td><td>Healthy</td></tr><tr><td>Onboarding</td><td>Jon</td><td>Watch</td></tr></tbody></table>
    </main></body></html>`,
  },
  "card-grid": {
    w: 1100, h: 760,
    html: `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{margin:0;font-family:system-ui;background:#eef2ff;color:#1e1b4b;padding:1.5rem}
    h1{margin:0 0 1rem}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
    article{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #c7d2fe}
    .swatch{height:110px}article h2{font-size:1rem;margin:.9rem .9rem .35rem}article p{margin:0 .9rem 1rem;color:#4338ca;font-size:.9rem}
    </style></head><body><h1>Pattern library</h1><div class="grid">
    <article><div class="swatch" style="background:#6366f1"></div><h2>Indigo calm</h2><p>Primary surfaces</p></article>
    <article><div class="swatch" style="background:#14b8a6"></div><h2>Teal focus</h2><p>Action accents</p></article>
    <article><div class="swatch" style="background:#f59e0b"></div><h2>Amber notice</h2><p>Warnings</p></article>
    <article><div class="swatch" style="background:#ef4444"></div><h2>Rose alert</h2><p>Blocking errors</p></article>
    <article><div class="swatch" style="background:#64748b"></div><h2>Slate quiet</h2><p>Secondary text</p></article>
    <article><div class="swatch" style="background:#22c55e"></div><h2>Green success</h2><p>Completed states</p></article>
    </div></body></html>`,
  },
  "dark-difficult": {
    w: 1200, h: 800,
    html: `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{margin:0;background:#05070d;color:#d1d5db;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .shell{display:grid;grid-template-columns:72px 1fr;min-height:100vh}
    .rail{background:#0b1220;border-right:1px solid #1f2937;display:flex;flex-direction:column;gap:.75rem;padding:.75rem;align-items:center}
    .dot{width:36px;height:36px;border-radius:10px;background:#111827;border:1px solid #374151}
    .main{padding:1rem 1.25rem}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
    .panel{display:grid;grid-template-columns:2fr 1fr;gap:1rem}
    .chart,.side{background:linear-gradient(180deg,#0b1220,#0a0f1a);border:1px solid #1f2937;border-radius:14px;min-height:420px;padding:1rem;position:relative}
    .bars{position:absolute;inset:4rem 1rem 1rem 1rem;display:flex;align-items:flex-end;gap:.45rem}
    .bars i{flex:1;background:#22d3ee;opacity:.85;border-radius:4px 4px 0 0}
    .side li{list-style:none;padding:.55rem 0;border-bottom:1px solid #1f2937;color:#9ca3af}
    h1{font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#67e8f9}
    </style></head><body><div class="shell"><div class="rail"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    <div class="main"><div class="top"><h1>Night telemetry</h1><span>live · 42ms</span></div>
    <div class="panel"><div class="chart"><div>Throughput</div><div class="bars"><i style="height:40%"></i><i style="height:65%"></i><i style="height:35%"></i><i style="height:80%"></i><i style="height:55%"></i><i style="height:70%"></i><i style="height:48%"></i></div></div>
    <ul class="side"><li>ingest ok</li><li>queue 12</li><li>retry 1</li><li>drop 0</li><li>cpu 31%</li></ul></div></div></div></body></html>`,
  },
};

for (const [id, spec] of Object.entries(pages)) {
  writeFileSync(join(htmlDir, `${id}.html`), spec.html);
}

const server = createServer((req, res) => {
  try {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/" || path === "/favicon.ico") {
      res.writeHead(204); res.end(); return;
    }
    const id = path.replace(/^\//, "").replace(/\.html$/, "");
    const file = join(htmlDir, `${id}.html`);
    if (!existsSync(file)) { res.writeHead(404); res.end("missing"); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(file));
  } catch (e) {
    if (!res.headersSent) res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((r) => server.listen(4191, "127.0.0.1", r));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const manifest = { ok: true, fixtures: [] };
for (const [id, spec] of Object.entries(pages)) {
  const page = await browser.newPage({ viewport: { width: spec.w, height: spec.h } });
  await page.goto(`http://127.0.0.1:4191/${id}.html`, { waitUntil: "networkidle" });
  const pngPath = join(outDir, `${id}.png`);
  await page.screenshot({ path: pngPath, fullPage: false });
  await page.close();
  manifest.fixtures.push({ id, file: `${id}.png`, width: spec.w, height: spec.h });
}
await browser.close();
server.close();
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ wrote: outDir, count: manifest.fixtures.length }, null, 2));
