import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../apps/web/node_modules/playwright/index.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const dist = join(repo, "apps/web/dist");
const pub = join(repo, "apps/web/public");
const outRoot = join(repo, "proofs/spe_v1_launch/final_visual");
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
    if (!existsSync(file) || (existsSync(file) && statSync(file).isDirectory())) {
      res.writeHead(404); res.end("missing"); return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4176, "127.0.0.1", () => r(server)));
}

async function nav(page, label) {
  const burger = page.locator(".spe-nav-burger");
  if (await burger.isVisible().catch(() => false)) {
    const expanded = await burger.getAttribute("aria-expanded");
    if (expanded !== "true") await burger.click();
    await page.waitForTimeout(200);
  }
  await page.locator("#spe-primary-nav").getByRole("button", { name: label, exact: true }).click({ timeout: 15000 });
  await page.waitForTimeout(600);
}

const shots = [
  { name: "01-home-1440", view: null, w: 1440, h: 900 },
  { name: "02-create-1440", view: "Create", w: 1440, h: 900 },
  { name: "03-code-1440", view: "Code", w: 1440, h: 900 },
  { name: "04-daily-lab-1440", view: "Daily Lab", w: 1440, h: 900 },
  { name: "05-daily-lab-390", view: "Daily Lab", w: 390, h: 844 },
  { name: "06-privacy-390", view: "Privacy / Proof", w: 390, h: 844 },
  { name: "07-privacy-320", view: "Privacy / Proof", w: 320, h: 720 },
  { name: "08-create-390", view: "Create", w: 390, h: 844 },
];

const server = await startServer();
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

for (const round of [1, 2, 3]) {
  const dir = join(outRoot, `round-${round}`);
  mkdirSync(dir, { recursive: true });
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await page.goto("http://127.0.0.1:4176/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(400);
    if (s.view) await nav(page, s.view);
    await page.screenshot({ path: join(dir, `${s.name}.png`), fullPage: false });
    await page.close();
  }
  writeFileSync(
    join(dir, "review.md"),
    `# Final visual round ${round}\n\nCaptured after SPE V1 final rebuild.\nFocus: ${
      round === 1
        ? "Home hero + Create instrument + Daily 3D stage"
        : round === 2
          ? "Code vs Create separation + mobile lab"
          : "Privacy + narrow widths + lab finite-queue honesty"
    }.\n`,
  );
}

await browser.close();
server.close();
console.log(JSON.stringify({ ok: true, rounds: 3, outRoot }));
