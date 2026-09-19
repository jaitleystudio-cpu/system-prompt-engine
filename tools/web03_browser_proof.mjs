#!/usr/bin/env node
/**
 * SPE-WEB-03 browser evidence harness.
 *
 * Requires PLAYWRIGHT_MODULE to point at a Playwright index.mjs. It does not
 * add a runtime dependency to the product. Captures real UI states only.
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(dirname(new URL(import.meta.url).pathname), "..");
const out = resolve(repo, "proofs/web03");
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4174/";
const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ||
  "/tmp/web03-playwright/node_modules/playwright/index.mjs";
const axeModule =
  process.env.AXE_PLAYWRIGHT_MODULE ||
  "/tmp/web03-playwright/node_modules/@axe-core/playwright/dist/index.js";

const { chromium } = await import(pathToFileURL(playwrightModule).href);
const { default: AxeBuilder } = await import(pathToFileURL(axeModule).href);

const dirs = [
  "screenshots/desktop",
  "screenshots/tablet",
  "screenshots/mobile",
  "screenshots/states",
  "motion",
  "reports",
  "visual_review/round-3",
];
await Promise.all(dirs.map((dir) => mkdir(resolve(out, dir), { recursive: true })));

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=swiftshader", "--disable-dev-shm-usage"],
});

const consoleErrors = [];
const pageErrors = [];
const observations = [];

async function openPage({
  width,
  height,
  reducedMotion = "no-preference",
  forceLite = false,
}) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: "dark",
    reducedMotion,
    locale: "en-US",
    serviceWorkers: "block",
  });
  if (forceLite) {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
        if (String(type).startsWith("webgl") || type === "experimental-webgl") return null;
        return original.call(this, type, ...args);
      };
    });
  }
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#hero-title");
  await page.waitForTimeout(900);
  return { context, page };
}

async function shot(page, relativePath, fullPage = false) {
  const path = resolve(out, relativePath);
  await page.screenshot({ path, fullPage, animations: "disabled" });
  return path;
}

async function scrollShot(page, selector, relativePath) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  await shot(page, relativePath);
}

async function collectMetrics(page, label) {
  const data = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const visual =
      document.querySelector(".spe-intel-canvas, .forge-lite-plate");
    const canvas = document.querySelector("canvas");
    return {
      url: location.href,
      title: document.title,
      visual_tier: visual?.getAttribute("data-quality") || "UNKNOWN",
      reduced_motion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      dom_nodes: document.querySelectorAll("*").length,
      canvas: canvas
        ? {
            css_width: canvas.clientWidth,
            css_height: canvas.clientHeight,
            pixel_width: canvas.width,
            pixel_height: canvas.height,
          }
        : null,
      navigation: navigation
        ? {
            dom_content_loaded_ms: Math.round(navigation.domContentLoadedEventEnd),
            load_ms: Math.round(navigation.loadEventEnd),
            transfer_bytes: navigation.transferSize,
            decoded_body_bytes: navigation.decodedBodySize,
          }
        : null,
      resource_count: resources.length,
      resource_transfer_bytes: resources.reduce(
        (total, entry) => total + (entry.transferSize || 0),
        0,
      ),
      external_hosts: [
        ...new Set(
          resources
            .map((entry) => new URL(entry.name, location.href))
            .filter((url) => url.origin !== location.origin)
            .map((url) => url.host),
        ),
      ],
    };
  });
  observations.push({ label, ...data });
}

// Desktop interaction and motion sequence.
{
  const { context, page } = await openPage({ width: 1440, height: 900 });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await shot(page, "visual_review/round-3/desktop-hero.png");
  await copyFile(
    resolve(out, "visual_review/round-3/desktop-hero.png"),
    resolve(out, "screenshots/desktop/1440x900-hero.png"),
  );
  await shot(page, "motion/01-hero-entry.png");

  await page.mouse.move(1170, 300, { steps: 12 });
  await page.waitForTimeout(300);
  await shot(page, "motion/02-pointer-response.png");

  const input = page.locator("#spe-one-line");
  await input.focus();
  await shot(page, "motion/03-composer-focus.png");
  await input.fill(
    "Design a local-first reading list for a small research team. Keep data on device and return a concise implementation plan.",
  );
  await shot(page, "motion/04-raw-thought-typed.png");

  await page.locator("#hero-compile-button").click();
  await page.waitForSelector(".forge-workspace");
  await page.waitForTimeout(700);
  await shot(page, "motion/05-compile-to-workspace.png");
  await shot(page, "screenshots/desktop/1440x900-workspace.png");

  await page.locator(".forge-lens-tabs button", { hasText: "intent" }).click();
  await page.waitForTimeout(250);
  await shot(page, "motion/06-intent-lens.png");
  await shot(page, "screenshots/states/intent-lens-1440x900.png");

  const axeResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await writeFile(
    resolve(out, "reports/accessibility-axe.json"),
    `${JSON.stringify(axeResults, null, 2)}\n`,
  );

  await page.locator(".forge-nav-brand").click();
  await page.waitForSelector("#act-extract");
  await scrollShot(page, "#act-extract", "motion/07-semantic-decomposition.png");
  await shot(page, "screenshots/desktop/1440x900-semantic-transformation.png");
  await scrollShot(page, "#act-structure", "motion/08-structure-assembly.png");
  await shot(page, "screenshots/desktop/1440x900-mid-story.png");
  await scrollShot(page, "#act-artifact", "motion/09-prompt-reveal.png");
  await shot(page, "screenshots/desktop/1440x900-prompt-artifact.png");
  await scrollShot(page, "#act-routing", "motion/10-any-ai-routing.png");
  await scrollShot(page, "#act-portable", "motion/11-spe-formation.png");
  await scrollShot(page, "#act-daily", "motion/12-daily-lab.png");
  await scrollShot(page, "#act-privacy", "motion/13-privacy-inversion.png");
  await collectMetrics(page, "desktop-1440x900-interaction");
  await context.tracing.stop({ path: resolve(out, "motion/semantic-forge-sequence-trace.zip") });
  await context.close();
}

// Broad desktop and tablet matrix.
for (const item of [
  { width: 1920, height: 1080, path: "screenshots/desktop/1920x1080-hero.png" },
  { width: 2560, height: 1440, path: "screenshots/desktop/2560x1440-hero.png" },
  { width: 768, height: 1024, path: "screenshots/tablet/768x1024-portrait-hero.png" },
  { width: 1024, height: 768, path: "screenshots/tablet/1024x768-landscape-hero.png" },
]) {
  const { context, page } = await openPage(item);
  await shot(page, item.path);
  await collectMetrics(page, `${item.width}x${item.height}-hero`);
  await context.close();
}

// Portrait matrix plus one real mobile scroll sequence.
for (const item of [
  { width: 390, height: 844, path: "screenshots/mobile/390x844-hero.png" },
  { width: 360, height: 800, path: "screenshots/mobile/360x800-hero.png" },
  { width: 320, height: 568, path: "screenshots/mobile/320x568-hero.png" },
]) {
  const { context, page } = await openPage(item);
  await shot(page, item.path);
  if (item.width === 390) {
    await copyFile(
      resolve(out, item.path),
      resolve(out, "visual_review/round-3/mobile-hero.png"),
    );
    await scrollShot(page, "#act-extract", "motion/14-mobile-semantic-scroll.png");
    await shot(page, "screenshots/mobile/390x844-semantic-transformation.png");
  }
  await collectMetrics(page, `${item.width}x${item.height}-hero`);
  await context.close();
}

// Explicit premium still and no-WebGL tiers.
{
  const { context, page } = await openPage({
    width: 1440,
    height: 900,
    reducedMotion: "reduce",
  });
  await shot(page, "screenshots/states/1440x900-reduced-motion.png");
  await collectMetrics(page, "desktop-reduced-motion");
  await context.close();
}
{
  const { context, page } = await openPage({
    width: 1440,
    height: 900,
    forceLite: true,
  });
  await shot(page, "screenshots/states/1440x900-lite-no-webgl.png");
  await collectMetrics(page, "desktop-forced-lite");
  await context.close();
}

// Keyboard and focus-order smoke proof.
{
  const { context, page } = await openPage({ width: 1280, height: 800 });
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName || null,
    class_name:
      document.activeElement instanceof HTMLElement
        ? document.activeElement.className
        : null,
    text:
      document.activeElement instanceof HTMLElement
        ? document.activeElement.innerText.trim()
        : null,
  }));
  await shot(page, "screenshots/states/keyboard-skip-focus.png");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const skipTarget = await page.evaluate(() => location.hash);
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll("a[href], button, textarea, select, input")]
      .filter((node) => !(node instanceof HTMLInputElement && node.type === "hidden"))
      .map((node) => {
        const element = node;
        return {
          tag: element.tagName,
          text:
            (element.getAttribute("aria-label") ||
              element.textContent ||
              element.getAttribute("placeholder") ||
              "").trim(),
          disabled: "disabled" in element ? Boolean(element.disabled) : false,
        };
      }),
  );
  await writeFile(
    resolve(out, "reports/keyboard-navigation.json"),
    `${JSON.stringify(
      {
        first_focus: firstFocus,
        skip_target: skipTarget,
        named_controls: controls.filter((item) => item.text.length > 0).length,
        unnamed_controls: controls.filter((item) => item.text.length === 0),
        total_controls: controls.length,
      },
      null,
      2,
    )}\n`,
  );
  await context.close();
}

await writeFile(
  resolve(out, "reports/browser-performance.json"),
  `${JSON.stringify(
    {
      captured_at: new Date().toISOString(),
      base_url: baseUrl,
      observations,
      console_errors: [...new Set(consoleErrors)],
      page_errors: [...new Set(pageErrors)],
    },
    null,
    2,
  )}\n`,
);

await browser.close();
console.log(
  JSON.stringify({
    ok: true,
    screenshots: 24,
    traces: 1,
    console_errors: [...new Set(consoleErrors)].length,
    page_errors: [...new Set(pageErrors)].length,
  }),
);
