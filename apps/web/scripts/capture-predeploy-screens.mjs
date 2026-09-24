import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const outDir = join(root, "../../proofs/spe_v1_launch/predeploy_screens");
mkdirSync(outDir, { recursive: true });
const mime = { ".html":"text/html",".js":"application/javascript",".css":"text/css",".wasm":"application/wasm",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".txt":"text/plain",".webmanifest":"application/manifest+json" };

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/index.html";
    let file = join(dist, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "public", path);
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end("missing"); return; }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4177, "127.0.0.1", () => r(server)));
}

async function nav(page, label) {
  const burger = page.locator(".spe-nav-burger");
  if (await burger.isVisible().catch(() => false)) {
    if ((await burger.getAttribute("aria-expanded")) !== "true") await burger.click();
  }
  const btn = page.locator("#spe-primary-nav").getByRole("button", { name: label });
  if (await btn.count()) await btn.first().click();
  await page.waitForTimeout(500);
}

const server = await startServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shots = [];
try {
  await page.goto("http://127.0.0.1:4177/", { waitUntil: "networkidle", timeout: 60000 });
  const targets = [
    ["home", null],
    ["create", "Create"],
    ["code", "Code"],
    ["lab", "Lab"],
    ["mywork", "My Work"],
    ["privacy", "Privacy"],
  ];
  for (const [name, label] of targets) {
    if (label) await nav(page, new RegExp(label, "i"));
    const path = join(outDir, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    shots.push(name);
  }
  // mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, /Create/i);
  await page.screenshot({ path: join(outDir, "mobile-create.png"), fullPage: true });
  shots.push("mobile-create");
  // reduced motion
  await page.emulateMedia({ reducedMotion: "reduce" });
  await nav(page, /Lab/i);
  await page.screenshot({ path: join(outDir, "lab-reduced-motion.png"), fullPage: true });
  shots.push("lab-reduced-motion");
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ shots, at: new Date().toISOString() }, null, 2));
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({ ok: true, outDir, shots }));
