import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { chromium } from "../../apps/web/node_modules/playwright/index.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const dist = join(repo, "apps/web/dist");
const pub = join(repo, "apps/web/public");
const outDir = join(repo, "proofs/spe_v1_launch/fresh_visual");
const sha = execSync("git rev-parse HEAD", { cwd: repo }).toString().trim();
mkdirSync(outDir, { recursive: true });

const mime = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".wasm": "application/wasm", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".onnx": "application/octet-stream", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json", ".mjs": "application/javascript",
};

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/index.html";
    let file = join(dist, path);
    if (!existsSync(file)) file = join(pub, path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404); res.end("missing"); return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4178, "127.0.0.1", () => r(server)));
}

async function openNav(page, label) {
  const burger = page.locator(".spe-nav-burger, button[aria-label*='Menu' i], .spe-nav-toggle").first();
  if (await burger.isVisible().catch(() => false)) {
    const expanded = await burger.getAttribute("aria-expanded");
    if (expanded !== "true") await burger.click().catch(() => {});
    await page.waitForTimeout(150);
  }
  const candidates = [
    page.locator("#spe-primary-nav").getByRole("button", { name: new RegExp(label, "i") }),
    page.getByRole("button", { name: new RegExp(label, "i") }),
    page.getByRole("link", { name: new RegExp(label, "i") }),
  ];
  for (const loc of candidates) {
    if (await loc.count()) {
      await loc.first().click({ timeout: 10000 });
      await page.waitForTimeout(500);
      return;
    }
  }
  throw new Error("nav target not found: " + label);
}

async function modeTab(page, name) {
  const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
  if (await tab.count()) await tab.first().click();
  await page.waitForTimeout(300);
}

const shots = [
  { name: "home-1440", view: null, mode: null, w: 1440, h: 900 },
  { name: "create-1440", view: "Create", mode: null, w: 1440, h: 900 },
  { name: "code-1440", view: "Code", mode: null, w: 1440, h: 900 },
  { name: "image-flow-1440", view: "Create", mode: "Image", w: 1440, h: 900 },
  { name: "video-flow-1440", view: "Create", mode: "Video", w: 1440, h: 900 },
  { name: "url-flow-1440", view: "Create", mode: "URL", w: 1440, h: 900 },
  { name: "daily-lab-1440", view: "Daily Lab", mode: null, w: 1440, h: 900 },
  { name: "my-work-1440", view: "My Work", mode: null, w: 1440, h: 900 },
  { name: "privacy-1440", view: "Privacy", mode: null, w: 1440, h: 900 },
  { name: "create-390", view: "Create", mode: null, w: 390, h: 844 },
  { name: "create-360", view: "Create", mode: null, w: 360, h: 740 },
  { name: "create-320", view: "Create", mode: null, w: 320, h: 680 },
  { name: "lab-reduced-motion-1440", view: "Daily Lab", mode: null, w: 1440, h: 900, reducedMotion: true },
];

const server = await startServer();
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const manifest = {
  testedSha: sha,
  capturedAtIst: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  shots: [],
};

for (const s of shots) {
  const page = await browser.newPage({
    viewport: { width: s.w, height: s.h },
    reducedMotion: s.reducedMotion ? "reduce" : undefined,
  });
  await page.goto("http://127.0.0.1:4178/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(400);
  if (s.view) {
    try { await openNav(page, s.view); } catch (e) { console.error("nav fail", s.name, e.message); }
  }
  if (s.mode) {
    try { await modeTab(page, s.mode); } catch (e) { console.error("mode fail", s.name, e.message); }
  }
  const file = `${s.name}.png`;
  await page.screenshot({ path: join(outDir, file), fullPage: false });
  manifest.shots.push({ file, view: s.view, mode: s.mode, w: s.w, h: s.h, reducedMotion: !!s.reducedMotion });
  await page.close();
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
server.close();
console.log(JSON.stringify({ wrote: outDir, testedSha: sha, count: manifest.shots.length }, null, 2));
