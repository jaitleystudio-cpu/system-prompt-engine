#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("playwright");
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");
const dist = join(repo, "apps/web/dist");
const pub = join(repo, "apps/web/public");
const logDir = join(here, "logs");
mkdirSync(logDir, { recursive: true });
const mime = { ".html":"text/html",".js":"application/javascript",".css":"text/css",".wasm":"application/wasm",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".txt":"text/plain",".xml":"application/xml",".webmanifest":"application/manifest+json" };

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path === "/") path = "/index.html";
    let file = join(dist, path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const fromPub = join(pub, path.replace(/^\//, ""));
      if (existsSync(fromPub) && !statSync(fromPub).isDirectory()) file = fromPub;
      else file = join(dist, "index.html");
    }
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end("missing"); return; }
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(4188, "127.0.0.1", () => r(server)));
}

const results = [];
function check(id, pass, detail) {
  results.push({ id, result: pass ? "PASS" : "FAIL", detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

const server = await startServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto("http://127.0.0.1:4188/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);

  const skip = page.locator(".skip-link");
  check("skip_link_present", (await skip.count()) === 1, "skip link in DOM");
  await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  let skipFocused = false;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    skipFocused = await page.evaluate(() => document.activeElement?.classList?.contains("skip-link") === true);
    if (skipFocused) break;
  }
  check("skip_link_focus", skipFocused, "skip link reachable via Tab");
  if (!skipFocused) await skip.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const mainFocused = await page.evaluate(() => document.activeElement?.id === "main");
  check("skip_link_target", mainFocused, "skip focuses #main");

  const landmarks = await page.evaluate(() => ({
    header: !!document.querySelector("header, [role='banner']"),
    nav: !!document.querySelector("nav[aria-label], nav"),
    main: !!document.querySelector("main"),
    footer: !!document.querySelector("footer, [role='contentinfo']"),
  }));
  check("landmarks", landmarks.header && landmarks.nav && landmarks.main && landmarks.footer, JSON.stringify(landmarks));

  const pipeline = await page.locator(".spe-pipeline").getAttribute("aria-label");
  check("pipeline_aria", Boolean(pipeline && /idea/i.test(pipeline) && /prompt/i.test(pipeline)), pipeline || "missing");

  const theme = page.locator(".spe-theme-toggle");
  await theme.focus();
  check("theme_keyboard_focus", await theme.evaluate((el) => el === document.activeElement), "theme toggle focusable");
  const aria = await theme.getAttribute("aria-label");
  check("theme_aria", Boolean(aria && /theme/i.test(aria)), aria || "missing");

  const hrefs = await page.locator("#spe-primary-nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const needed = ["/", "/create", "/code", "/daily-lab", "/my-work", "/privacy", "/capabilities"];
  check("nav_real_links", needed.every((p) => hrefs.includes(p)), hrefs.join(", "));

  await page.goto("http://127.0.0.1:4188/create", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  check("route_create_reload", (await page.locator("#create-title").count()) > 0, "create h1 present");

  await page.goto("http://127.0.0.1:4188/privacy", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  const privacy = await page.locator("main").innerText();
  check("route_privacy_reload", /privacy|proof|local/i.test(privacy), "privacy main text");

  await page.goto("http://127.0.0.1:4188/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(400);
  const seen = new Set();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    seen.add(await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName}:${el.className}:${el.id}` : "null";
    }));
  }
  check("keyboard_no_obvious_trap", seen.size >= 3, `unique focus targets=${seen.size}`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  // Hero uses founder PNG (no Pause story control). Verify art present + reduced-motion CSS honored.
  const heroArt = page.locator(".hero-story-art");
  const artCount = await heroArt.count();
  const animNone = await page.evaluate(() => {
    const el = document.querySelector(".hero-story-plate, .hero-story-art, .hero-story");
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.animationName === "none" || cs.animationDuration === "0s";
  });
  check(
    "reduced_motion_control",
    artCount === 1 && animNone,
    `founder-art=${artCount} animNone=${animNone} (Pause control removed; image hero)`,
  );

  await page.setViewportSize({ width: 640, height: 400 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth * 2.2);
  check("zoom_200_usable", overflowX, "document roughly fits zoomed viewport heuristic");
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; });

  const decorative = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll(".press-canvas")];
    const statics = [...document.querySelectorAll(".static-core img")];
    return {
      canvases: canvases.length,
      statics: statics.length,
      canvasOk: canvases.every((c) => c.getAttribute("aria-hidden") === "true"),
      staticOk: statics.every((img) => img.getAttribute("alt") === "" || img.getAttribute("aria-hidden") === "true"),
    };
  });
  check("decorative_scene", (decorative.canvases === 0 || decorative.canvasOk) && (decorative.statics === 0 || decorative.staticOk), JSON.stringify(decorative));

  await page.setViewportSize({ width: 390, height: 844 });
  const burger = page.locator(".spe-nav-burger");
  if (await burger.isVisible()) {
    check("mobile_burger_aria", (await burger.getAttribute("aria-expanded")) !== null && (await burger.getAttribute("aria-controls")) === "spe-primary-nav", "burger aria-expanded + aria-controls");
  } else {
    check("mobile_burger_aria", true, "burger not required at this width/CSS");
  }
} catch (err) {
  check("harness", false, String(err));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => r.result === "FAIL");
const out = { standard: "WCAG 2.2 oriented", HOSTING: "FORBIDDEN", results, pass: failed.length === 0, failed: failed.map((f) => f.id), at: new Date().toISOString() };
writeFileSync(join(logDir, "a11y_verify.json"), JSON.stringify(out, null, 2));
writeFileSync(join(here, "A11Y_CHECKLIST.md"), ["# SPE V1 gap-closure — WCAG 2.2 a11y checklist","","HOSTING=FORBIDDEN.","", "| Check | Result | Detail |","|---|---|---|", ...results.map((r) => `| ${r.id} | **${r.result}** | ${String(r.detail).replace(/\|/g, "/")} |`), "", failed.length ? `Failures: ${failed.map((f) => f.id).join(", ")}` : "All automated checks PASS. Residual: full axe-core + screen-reader still recommended.", ""].join("\n"));
process.exit(failed.length ? 1 : 0);
