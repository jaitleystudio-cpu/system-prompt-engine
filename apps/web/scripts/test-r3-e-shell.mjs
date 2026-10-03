#!/usr/bin/env node
/**
 * R3-E product shell. Real Chrome on this Mac. ₹0.
 * Not a full WCAG audit. Criteria named at the bottom are the ones this file ran.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "../..");
const src = (rel) => readFileSync(join(webRoot, rel), "utf8");
let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log("PASS", name);
}

const FROZEN = "53028b17d28a233bef3076f33f38e9817d6fdb37";
const frozenFiles = [
  "apps/web/src/website/mount-contract.ts",
  "apps/web/src/website/WebsiteProduct.tsx",
  "apps/web/src/website/productFlow.ts",
  "apps/web/src/website/website-product.css",
  "apps/web/src/builder/websiteSpecModel.ts",
];
for (const rel of frozenFiles) {
  const want = execFileSync("git", ["rev-parse", `${FROZEN}:${rel}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const got = execFileSync("git", ["hash-object", join(repoRoot, rel)], {
    encoding: "utf8",
  }).trim();
  assert.equal(got, want, rel);
}
checks += 1;
console.log("PASS frozen website UI and compiler blobs match", FROZEN);

const routing = await import(pathToFileURL(join(webRoot, "src/routing.ts")).href);
const guards = await import(pathToFileURL(join(webRoot, "src/shell/shellGuards.ts")).href);
const mount = await import(pathToFileURL(join(webRoot, "src/shell/mountStatus.ts")).href);

check("unknown route is not-found and is not Home", () => {
  assert.equal(routing.resolveRoute("/no-such-route").kind, "not-found");
  assert.equal(routing.viewFromPath("/no-such-route"), null);
  assert.equal(routing.resolveRoute("/").view, "home");
  const app = src("src/App.tsx");
  assert.match(app, /kind === "not-found"/);
  assert.doesNotMatch(app, /viewFromPath\(window\.location\.pathname\)/);
  assert.doesNotMatch(app, /replaceState\(\{ view: "home" \}/);
});

check("website mounted and media pending", () => {
  assert.equal(routing.resolveRoute("/website").view, "website");
  assert.equal(routing.resolveRoute("/media").view, "media");
  assert.equal(mount.MOUNT_PENDING.length, 1);
  assert.equal(mount.MOUNT_PENDING[0].id, "media");
  assert.equal(mount.MOUNT_PENDING[0].sha, "a93e87d0efb247204883ecbd18203fe248c5c8e5");
  assert.equal(mount.MOUNT_PENDING[0].productMediaV1, "NOT_PASS");
  assert.equal(mount.WEBSITE_MOUNT.sha, FROZEN);
  assert.equal(mount.WEBSITE_MOUNT.status, "MOUNTED");
  const app = src("src/App.tsx");
  assert.match(app, /WebsiteProduct/);
  assert.match(app, /MediaRouteSlot/);
  assert.doesNotMatch(app, /StaticWebsiteBuilder/);
  assert.doesNotMatch(src("src/shell/MediaRouteSlot.tsx"), /<input|<textarea|<button|type="file"/);
  assert.match(src("src/shell/MediaRouteSlot.tsx"), /LOCAL_NEURAL is unavailable in the browser/);
  assert.match(src("src/shell/MediaRouteSlot.tsx"), /NOT_PASS/);
  assert.doesNotMatch(src("src/shell/MediaRouteSlot.tsx"), /PRODUCT_MEDIA_V1\s*=\s*PASS/);
  assert.doesNotMatch(src("src/shell/mountStatus.ts"), /PRODUCT_MEDIA_V1\s*=\s*"PASS"/);
  assert.equal(existsSync(join(webRoot, "src/media/mount-contract.ts")), false);
});

check("private and tool routes are noindex and off the sitemap", () => {
  const robots = src("public/robots.txt");
  const sitemap = src("public/sitemap.xml");
  for (const path of ["/my-work", "/workspace", "/website", "/media"]) {
    assert.match(robots, new RegExp(`Disallow:\\s*${path}`));
    assert.doesNotMatch(sitemap, new RegExp(`<loc>[^<]*${path}</loc>`));
    const view = path === "/my-work" ? "my-work" : path.slice(1);
    assert.equal(routing.NOINDEX_VIEWS.has(view), true);
  }
  assert.match(sitemap, /<loc>https:\/\/systempromptengine\.com\/<\/loc>/);
  assert.doesNotMatch(robots, /Allow:\s*\/my-work/);
  assert.match(src("src/ui/SeoHead.tsx"), /NOINDEX_VIEWS/);
});

check("empty build guard is an honest empty brief", () => {
  assert.equal(guards.workspaceBuildDisabled(false, ""), true);
  assert.equal(guards.workspaceBuildDisabled(false, "  "), true);
  assert.equal(guards.workspaceBuildDisabled(false, "a brief"), false);
  assert.equal(guards.EMPTY_IDEA_MESSAGE, "Enter what you want SPE to build.");
  assert.match(src("src/App.tsx"), /code:\s*"EMPTY_BRIEF"/);
  assert.doesNotMatch(src("src/ui/HumanError.tsx").split("EMPTY_BRIEF")[1].slice(0, 240), /interrupted/i);
});

check("wasm pin unchanged", () => {
  const pin = JSON.parse(src("public/spe_wasm.sha256.json"));
  assert.equal(
    pin.sha256,
    "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b",
  );
});

function loadShellCss() {
  const tokens = readFileSync(join(webRoot, "../../packages/design-system/src/tokens.css"), "utf8");
  const workspace = readFileSync(join(webRoot, "src/workspace.css"), "utf8");
  const product = src("src/website/website-product.css");
  return (
    src("src/index.css")
      .replace('@import "@spe/design-system";', tokens)
      .replace('@import "./workspace.css";', workspace) + product
  );
}

const outfile = "/tmp/r3-e-dom-entry.js";
await esbuild.build({
  absWorkingDir: webRoot,
  entryPoints: [join(here, "r3-e-dom-entry.tsx")],
  bundle: true,
  format: "iife",
  outfile,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  alias: {
    "@spe/human-perspective": join(webRoot, "../../packages/human-perspective/src/index.ts"),
    "@spe/web-runtime": join(webRoot, "../../packages/web-runtime/src/index.ts"),
  },
  loader: { ".css": "empty" },
});

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const cssText = loadShellCss();

async function openCase(caseName, viewport, theme = "dark") {
  const page = await browser.newPage({ viewport });
  const htmlPath = `/tmp/r3-e-${caseName}.html`;
  writeFileSync(
    htmlPath,
    `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>${cssText}</style></head><body><div id="root"></div><script>window.__r3Want=${JSON.stringify(caseName)};</script><script src="${pathToFileURL(outfile).href}"></script></body></html>`,
  );
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((name) => window.__r3Case === name, caseName, { timeout: 30000 });
  return page;
}

function contrastRatio(fg, bg) {
  const parse = (c) => {
    const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) throw new Error(`unparsed color ${c}`);
    return [1, 2, 3].map((i) => {
      const s = Number(m[i]) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
  };
  const L = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const l1 = L(parse(fg));
  const l2 = L(parse(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

try {
  const desktop = { width: 1280, height: 800 };

  const keys = await openCase("nav", desktop);
  await keys.keyboard.press("Tab");
  const first = await keys.evaluate(() => document.activeElement?.className);
  assert.equal(first, "skip-link");
  const skipOutline = await keys.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { style: s.outlineStyle, width: s.outlineWidth };
  });
  assert.notEqual(skipOutline.style, "none");
  assert.notEqual(skipOutline.width, "0px");
  await keys.keyboard.press("Enter");
  const focusedMain = await keys.evaluate(() => document.activeElement?.id);
  assert.equal(focusedMain, "main");
  console.log("PASS 2.4.1 skip link and 2.4.7 focus visible");
  checks += 1;
  await keys.close();

  const order = await openCase("nav", desktop);
  const seen = [];
  for (let i = 0; i < 12; i += 1) {
    await order.keyboard.press("Tab");
    const label = await order.evaluate(() => {
      const el = document.activeElement;
      return el?.textContent?.trim().slice(0, 40) || el?.getAttribute("aria-label") || el?.id || "";
    });
    seen.push(label);
  }
  assert.equal(seen[0], "Skip to main content");
  for (const label of ["Home", "Create", "Code", "Website", "Daily Lab"]) {
    assert.ok(seen.some((item) => item.includes(label)), `missing ${label} in ${JSON.stringify(seen)}`);
  }
  console.log("PASS 2.1.1 / 2.4.3 keyboard traversal", JSON.stringify(seen));
  checks += 1;
  await order.close();

  const mobile = await openCase("nav", { width: 360, height: 700 });
  await mobile.emulateMedia({ reducedMotion: "reduce" });
  const motion = await mobile.evaluate(() => ({
    reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    animation: getComputedStyle(document.querySelector("header.spe-nav")).animationName,
  }));
  assert.equal(motion.reduce, true);
  assert.equal(motion.scroll, "auto");
  assert.equal(motion.animation, "none");
  const burger = mobile.locator(".spe-nav-burger");
  await burger.click();
  assert.equal(await burger.getAttribute("aria-expanded"), "true");
  assert.equal(await burger.getAttribute("aria-controls"), "spe-primary-nav");
  await mobile.keyboard.press("Escape");
  assert.equal(await burger.getAttribute("aria-expanded"), "false");
  const hidden = await mobile.evaluate(() =>
    [...document.querySelectorAll("#spe-primary-nav a")].every((a) => a.getClientRects().length === 0),
  );
  assert.equal(hidden, true);
  await burger.click();
  let left = false;
  for (let i = 0; i < 24; i += 1) {
    await mobile.keyboard.press("Tab");
    left = await mobile.evaluate(() => document.activeElement?.id === "after-nav");
    if (left) break;
  }
  assert.equal(left, true);
  const fit = await mobile.evaluate(() => ({
    nav: document.querySelector("header.spe-nav").getBoundingClientRect().width,
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(fit.nav <= fit.client + 1, JSON.stringify(fit));
  assert.ok(fit.scroll <= fit.client + 1, JSON.stringify(fit));
  console.log("PASS Escape, mobile nav, 2.1.2 no trap, reduced motion", JSON.stringify(fit));
  checks += 1;
  await mobile.close();

  const themePage = await openCase("nav", desktop, "dark");
  await themePage.evaluate(() => localStorage.setItem("spe-theme", "dark"));
  await themePage.reload({ waitUntil: "domcontentloaded" });
  await themePage.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  async function ctaSample() {
    return themePage.evaluate(() => {
      const cta = document.querySelector("a.spe-nav-cta");
      const s = getComputedStyle(cta);
      return {
        theme: document.documentElement.getAttribute("data-theme"),
        fg: s.color,
        bg: s.backgroundColor,
        size: s.fontSize,
        weight: s.fontWeight,
      };
    });
  }
  const darkCta = await ctaSample();
  assert.equal(darkCta.theme, "dark");
  const darkRatio = contrastRatio(darkCta.fg, darkCta.bg);
  assert.ok(darkRatio >= 4.5, JSON.stringify(darkCta));
  await themePage.getByRole("button", { name: /Theme:/ }).click();
  await themePage.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
  const lightCta = await ctaSample();
  assert.equal(lightCta.theme, "light");
  assert.notEqual(lightCta.bg, darkCta.bg, "light CTA fill must differ from dark");
  const lightRatio = contrastRatio(lightCta.fg, lightCta.bg);
  assert.ok(lightRatio >= 4.5, JSON.stringify(lightCta));
  await themePage.evaluate(() => localStorage.setItem("spe-theme", "dark"));
  console.log("PASS 1.4.3 dark nav CTA", darkRatio.toFixed(2), JSON.stringify(darkCta));
  console.log("PASS 1.4.3 light nav CTA", lightRatio.toFixed(2), JSON.stringify(lightCta));
  checks += 2;
  await themePage.close();

  const media = await openCase("media", desktop, "dark");
  async function mediaPaint(theme) {
    return media.evaluate((next) => {
      document.documentElement.setAttribute("data-theme", next);
      const el = document.querySelector(".spe-mount-pending");
      const s = getComputedStyle(el);
      return {
        theme: next,
        fg: s.color,
        bg: s.backgroundColor,
        state: el.getAttribute("data-mount-state"),
        title: document.getElementById("media-unavailable-title")?.textContent,
      };
    }, theme);
  }
  const mediaSample = await mediaPaint("light");
  assert.equal(mediaSample.state, "MOUNT_PENDING");
  assert.match(mediaSample.title, /not available/i);
  const mediaRatio = contrastRatio(mediaSample.fg, mediaSample.bg);
  assert.ok(mediaRatio >= 4.5, JSON.stringify(mediaSample));
  const mediaDark = await mediaPaint("dark");
  const mediaDarkRatio = contrastRatio(mediaDark.fg, mediaDark.bg);
  assert.ok(mediaDarkRatio >= 4.5, JSON.stringify(mediaDark));
  assert.notEqual(mediaSample.bg, mediaDark.bg, "media slot colors must change with theme");
  console.log("PASS 1.4.3 media slot", mediaRatio.toFixed(2), mediaDarkRatio.toFixed(2), JSON.stringify({ light: mediaSample, dark: mediaDark }));
  checks += 1;
  await media.close();

  async function robotsOf(caseName) {
    const page = await openCase(caseName, desktop);
    await page.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content);
    const data = await page.evaluate(() => ({
      title: document.title,
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      jsonld: document.getElementById("spe-jsonld-app")?.textContent ?? null,
    }));
    await page.close();
    return data;
  }

  const home = await robotsOf("seo-home");
  assert.match(home.robots, /index, follow/);
  assert.doesNotMatch(home.robots, /noindex/);
  assert.equal(home.canonical, "https://systempromptengine.com");
  assert.ok(home.jsonld);
  assert.match(home.title, /SPE/);
  console.log("PASS public home indexable canonical title");
  checks += 1;

  for (const [name, titleBit] of [
    ["seo-workspace", /Workspace/],
    ["seo-my-work", /My Work/],
    ["seo-not-found", /Page not found/],
  ]) {
    const data = await robotsOf(name);
    assert.match(data.robots, /noindex, nofollow/);
    assert.equal(data.canonical, null);
    assert.equal(data.jsonld, null);
    assert.match(data.title, titleBit);
    console.log("PASS noindex", name);
    checks += 1;
  }

  const missing = await openCase("unknown", desktop);
  const route = await missing.evaluate(() => window.__r3Route);
  assert.equal(route.kind, "not-found");
  assert.equal(route.rewritten, false);
  assert.match(await missing.locator("h1").innerText(), /Page not found/);
  assert.equal(await missing.locator("h1").count(), 1);
  const url = new URL(missing.url());
  assert.notEqual(url.pathname, "/");
  console.log("PASS unknown route stays not-found, url", url.pathname);
  checks += 1;
  await missing.close();

  const empty = await openCase("empty-build", desktop);
  await empty.getByRole("button", { name: "Build" }).click();
  const alertText = await empty.locator("[role=alert]").innerText();
  assert.match(alertText, /Add an idea first/);
  assert.match(alertText, /Enter what you want SPE to build\./);
  assert.doesNotMatch(alertText, /interrupted/i);
  console.log("PASS empty Build is an honest empty brief");
  checks += 1;
  await empty.close();

  const site = await openCase("website", desktop, "light");
  const product = await site.evaluate(() => {
    const root = document.querySelector(".website-product");
    const s = getComputedStyle(root);
    return {
      mount: document.querySelector("[data-shell-mount=website]")?.getAttribute("data-shell-mount"),
      contract: root?.getAttribute("data-route-mount"),
      fg: s.color,
      bg: s.backgroundColor,
      heading: root?.querySelector("h1")?.textContent,
    };
  });
  assert.equal(product.mount, "website");
  assert.equal(product.contract, "NOT_INTEGRATED");
  assert.equal(product.heading, "Website");
  const productRatio = contrastRatio(product.fg, product.bg);
  assert.ok(productRatio >= 4.5, JSON.stringify(product));
  await site.getByRole("button", { name: "Build preview" }).click();
  await site.waitForFunction(() =>
    document.querySelector('[aria-label="Website result"]')?.textContent?.includes("LOCAL_EXPORT_READY"),
  );
  const frame = site.locator("iframe[title='Local website preview']");
  assert.equal(await frame.getAttribute("sandbox"), "");
  console.log("PASS mounted website product preview", productRatio.toFixed(2));
  checks += 1;
  await site.close();
} finally {
  await browser.close();
}

console.log(`R3-E shell checks: ${checks}`);
