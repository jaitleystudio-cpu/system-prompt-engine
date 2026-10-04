#!/usr/bin/env node
/**
 * Lane G5 — universal shell / UX / a11y regression.
 * Unit checks plus desktop, 320/360, and keyboard DOM checks.
 * COST ₹0. No pixel claims. network_mode=NONE.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const src = (rel) => readFileSync(join(webRoot, rel), "utf8");

const routing = await import(pathToFileURL(join(webRoot, "src/routing.ts")).href);
const guards = await import(pathToFileURL(join(webRoot, "src/shell/shellGuards.ts")).href);

function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name);
    throw error;
  }
}

test("unknown paths are not Home", () => {
  assert.equal(routing.viewFromPath("/no-such-route"), null);
  assert.equal(routing.viewFromPath("/CREATE"), null);
  assert.equal(routing.viewFromPath("/create"), "create");
  assert.equal(routing.resolveRoute("/no-such-route").kind, "not-found");
  assert.equal(routing.resolveRoute("/daily-lab/").kind, "view");
  assert.equal(routing.resolveRoute("/daily-lab/").canonicalPath, "/daily-lab");
});

test("workspace build is disabled without an idea", () => {
  assert.equal(guards.workspaceBuildDisabled(false, ""), true);
  assert.equal(guards.workspaceBuildDisabled(false, "   "), true);
  assert.equal(guards.workspaceBuildDisabled(true, "idea"), true);
  assert.equal(guards.workspaceBuildDisabled(false, "idea"), false);
  assert.match(src("src/workspace/Workspace.tsx"), /workspaceBuildDisabled\(busy, userRequest\)/);
});

test("empty idea is not described as an interruption", () => {
  const app = src("src/App.tsx");
  assert.match(app, /code:\s*"EMPTY_BRIEF"/);
  assert.doesNotMatch(
    app.slice(app.indexOf("const compile"), app.indexOf("const lensState")),
    /INVALID_JSON/,
  );
  const human = src("src/ui/HumanError.tsx");
  assert.match(human, /EMPTY_BRIEF/);
  assert.match(human, /error\.message/);
});

test("in-app links do not hard-navigate", () => {
  const footer = src("src/App.tsx").split('<footer className="spe-footer">')[1].split("</footer>")[0];
  assert.doesNotMatch(footer, /<a href=\{pathForView/);
  assert.match(footer, /InAppLink/);
  const seo = src("src/landing/SeoContent.tsx");
  assert.doesNotMatch(seo, /<a href=\{pathForView/);
  assert.match(seo, /InAppLink/);
  const hero = src("src/landing/Hero.tsx");
  assert.doesNotMatch(hero, /href="\/create"/);
  const caps = src("src/pages/Capabilities.tsx");
  assert.doesNotMatch(caps, /<a href=\{pathForView/);
});

test("private workspace is noindex and not a public WebApplication", () => {
  const seo = src("src/ui/SeoHead.tsx");
  const routing = src("src/routing.ts");
  assert.match(seo, /noindex, nofollow/);
  assert.match(seo, /NOINDEX_VIEWS/);
  assert.match(routing, /"workspace"/);
  assert.match(routing, /"my-work"/);
  assert.match(seo, /removeJsonLd\("spe-jsonld-app"\)/);
});

test("dark CTA rule beats transparent nav link background", () => {
  const css = src("src/index.css");
  assert.match(
    css,
    /html\[data-theme="dark"\] \.spe-nav-links a\.spe-nav-cta[\s\S]*background:\s*#eff2ff/,
  );
});

test("Daily Lab does not use publication wording", () => {
  const lab = src("src/lab/DailyLab.tsx");
  assert.doesNotMatch(lab, /Publish date/);
  assert.doesNotMatch(lab, /\{active\.status\}/);
  assert.match(lab, /Queue date/);
  assert.match(lab, /Research preview/);
});

test("initial view change does not steal focus from the skip link", () => {
  const app = src("src/App.tsx");
  assert.match(app, /focusMainAfterNavigation\(isInitialMount\)/);
  assert.doesNotMatch(app, /document\.getElementById\("main"\)\?\.focus/);
});

test("unknown routes are not replaceState'd onto Home", () => {
  const app = src("src/App.tsx");
  assert.match(app, /resolveRoute\(/);
  assert.match(app, /kind === "not-found"/);
  assert.doesNotMatch(app, /viewFromPath\(window\.location\.pathname\)/);
});

function loadShellCss() {
  const tokens = readFileSync(join(webRoot, "../../packages/design-system/src/tokens.css"), "utf8");
  const workspace = readFileSync(join(webRoot, "src/workspace.css"), "utf8");
  return src("src/index.css")
    .replace('@import "@spe/design-system";', tokens)
    .replace('@import "./workspace.css";', workspace);
}
const cssText = loadShellCss();
const outfile = "/tmp/lane-g5-dom-entry.js";
await esbuild.build({
  absWorkingDir: webRoot,
  entryPoints: [join(here, "lane-g5-dom-entry.tsx")],
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

async function openCase(caseName, viewport) {
  const page = await browser.newPage({ viewport });
  const htmlPath = `/tmp/lane-g5-${caseName}.html`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>${cssText}</style></head><body><div id="root"></div><script>window.__g5Want=${JSON.stringify(caseName)};</script><script src="${pathToFileURL(outfile).href}"></script></body></html>`,
  );
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((name) => window.__g5Case === name, caseName, { timeout: 30000 });
  return page;
}

try {
  const desktop = { width: 1280, height: 800 };
  const page = await browser.newPage({ viewport: desktop });
  await page.setContent(
    `<!doctype html><html data-theme="dark"><head><style>${cssText}</style></head><body>
      <header class="spe-nav"><nav class="spe-nav-links" aria-label="Primary">
        <a href="/create" class="spe-nav-cta">Build my prompt <span>↗</span></a>
      </nav></header></body></html>`,
    { waitUntil: "domcontentloaded" },
  );
  const dark = await page.evaluate(() => {
    const el = document.querySelector("a.spe-nav-cta");
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color };
  });
  assert.notEqual(dark.bg, "rgba(0, 0, 0, 0)", "dark CTA fill must not be transparent");
  assert.equal(dark.bg, "rgb(239, 242, 255)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  const light = await page.evaluate(() => getComputedStyle(document.querySelector("a.spe-nav-cta")).backgroundColor);
  assert.notEqual(light, "rgba(0, 0, 0, 0)", "light CTA fill must remain visible");
  console.log("PASS dark and light CTA computed fill");
  await page.close();

  for (const width of [320, 360, 1280]) {
    const sized = await openCase("nav", { width, height: 800 });
    const fit = await sized.evaluate(() => {
      const nav = document.querySelector("header.spe-nav");
      return {
        navWidth: nav.getBoundingClientRect().width,
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      };
    });
    assert.ok(fit.navWidth <= fit.client + 1, `nav wider than viewport at ${width}: ${JSON.stringify(fit)}`);
    assert.ok(fit.scroll <= fit.client + 1, `document overflow at ${width}: ${JSON.stringify(fit)}`);
    console.log("PASS layout", width, JSON.stringify(fit));
    await sized.close();
  }

  const keys = await openCase("nav", { width: 1280, height: 800 });
  await keys.keyboard.press("Tab");
  const first = await keys.evaluate(() => document.activeElement?.className);
  assert.equal(first, "skip-link");
  console.log("PASS desktop first Tab is the skip link");
  await keys.close();

  const mobile = await openCase("nav", { width: 360, height: 640 });
  await mobile.emulateMedia({ reducedMotion: "reduce" });
  const motion = await mobile.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  assert.equal(motion, "auto");
  const burger = mobile.locator(".spe-nav-burger");
  await burger.focus();
  await burger.click();
  assert.equal(await burger.getAttribute("aria-expanded"), "true");
  const closedHidden = await mobile.evaluate(() => {
    const links = [...document.querySelectorAll("#spe-primary-nav a")];
    return links.every((a) => a.getClientRects().length > 0);
  });
  assert.equal(closedHidden, true, "open mobile menu links should be present");
  await mobile.keyboard.press("Escape");
  assert.equal(await burger.getAttribute("aria-expanded"), "false");
  const hidden = await mobile.evaluate(() => {
    const links = [...document.querySelectorAll("#spe-primary-nav a")];
    return links.every((a) => a.getClientRects().length === 0);
  });
  assert.equal(hidden, true, "closed mobile menu links must not be focusable boxes");
  await burger.focus();
  let landedInClosedMenu = false;
  for (let i = 0; i < 6; i += 1) {
    await mobile.keyboard.press("Tab");
    landedInClosedMenu = await mobile.evaluate(() => {
      const el = document.activeElement;
      return !!el && !!el.closest && !!el.closest("#spe-primary-nav") && el.tagName === "A";
    });
    if (landedInClosedMenu) break;
  }
  assert.equal(landedInClosedMenu, false, "Tab must not enter closed mobile menu links");
  await burger.click();
  let leftMenu = false;
  for (let i = 0; i < 20; i += 1) {
    await mobile.keyboard.press("Tab");
    leftMenu = await mobile.evaluate(() => document.activeElement?.id === "after-nav");
    if (leftMenu) break;
  }
  assert.equal(leftMenu, true, "open mobile menu must not trap Tab");
  const names = await mobile.evaluate(() => ({
    nav: document.querySelector("nav")?.getAttribute("aria-label"),
    expanded: document.querySelector(".spe-nav-burger")?.getAttribute("aria-controls"),
    skip: document.querySelector(".skip-link")?.textContent?.trim(),
    main: document.querySelector("main")?.id,
  }));
  assert.equal(names.nav, "Primary");
  assert.equal(names.expanded, "spe-primary-nav");
  assert.equal(names.skip, "Skip to main content");
  assert.equal(names.main, "main");
  console.log("PASS mobile Escape, closed-menu focus, no trap, reduced motion, semantics");
  await mobile.close();

  const focus = await openCase("focus", desktop);
  const firstFocus = await focus.evaluate(() => window.focusStep());
  const secondFocus = await focus.evaluate(() => window.focusStep());
  assert.equal(firstFocus, false);
  assert.equal(secondFocus, true);
  console.log("PASS load focus stays off #main until a later view change");
  await focus.close();

  const idea = await openCase("idea", desktop);
  await idea.getByRole("textbox", { name: "idea", exact: true }).fill("unsaved idea");
  await idea.getByRole("link", { name: "Open the free prompt builder (Create)" }).click();
  assert.equal(await idea.getByRole("textbox", { name: "idea", exact: true }).inputValue(), "unsaved idea");
  assert.equal(await idea.getByTestId("view").innerText(), "create");
  await idea.getByRole("link", { name: "Footer Create" }).click();
  assert.equal(await idea.getByRole("textbox", { name: "idea", exact: true }).inputValue(), "unsaved idea");
  console.log("PASS idea preserved across SEO and footer navigation");
  await idea.close();

  const seo = await openCase("seo-workspace", desktop);
  await seo.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content?.includes("noindex"));
  const robots = await seo.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content,
    jsonld: document.getElementById("spe-jsonld-app")?.textContent ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
  }));
  assert.match(robots.robots, /noindex/);
  assert.match(robots.robots, /nofollow/);
  assert.equal(robots.jsonld, null);
  assert.equal(robots.canonical, null);
  console.log("PASS workspace robots noindex and no public JSON-LD");
  await seo.close();

  const homeSeo = await openCase("seo-home", desktop);
  await homeSeo.waitForFunction(() => document.getElementById("spe-jsonld-app"));
  const homeRobots = await homeSeo.evaluate(() => document.querySelector('meta[name="robots"]')?.content);
  assert.match(homeRobots, /index, follow/);
  assert.doesNotMatch(homeRobots, /noindex/);
  console.log("PASS public home remains indexable");
  await homeSeo.close();

  const missing = await openCase("not-found", desktop);
  const heading = await missing.locator("h1").innerText();
  assert.match(heading, /Page not found/);
  assert.equal(await missing.locator("main h1").count(), 1);
  const nfRobots = await missing.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? "");
  assert.match(nfRobots, /noindex/);
  console.log("PASS not-found heading and noindex");
  await missing.close();

  const lab = await openCase("lab", desktop);
  await lab.waitForSelector(".spe-lab-meta");
  const labText = await lab.locator(".spe-lab-meta").innerText();
  assert.match(labText, /queue date/i);
  assert.match(labText, /research preview/i);
  assert.doesNotMatch(labText, /Publish date/i);
  assert.doesNotMatch(labText, /\bpublished\b/i);
  const labH1 = await lab.locator("h1").count();
  assert.equal(labH1, 1);
  console.log("PASS Daily Lab queue wording");
  await lab.close();

  const err = await openCase("error", desktop);
  const alertText = await err.locator("[role=alert]").first().innerText();
  assert.match(alertText, /Enter what you want SPE to build\./);
  assert.doesNotMatch(alertText, /interrupted/i);
  const interrupted = await err.locator("[data-testid=real-invalid]").innerText();
  assert.match(interrupted, /interrupted/i);
  console.log("PASS empty-idea error is truthful; real INVALID_JSON stays diagnostic");
  await err.close();
} finally {
  await browser.close();
}

console.log("PASS lane G5 shell UX");
