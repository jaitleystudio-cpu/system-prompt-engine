#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const base = process.env.HERO_URL || "http://127.0.0.1:4194";
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} ${detail}`);
};
try {
  for (const theme of ["dark", "light", "system"])
    for (const os of theme === "system" ? ["dark", "light"] : ["dark"]) {
      const c = await browser.newContext({
        serviceWorkers: "block",
        viewport: { width: 1440, height: 1000 },
        colorScheme: os,
        reducedMotion: "reduce",
      });
      await c.addInitScript((t) => localStorage.setItem("spe-theme", t), theme);
      const p = await c.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base, { waitUntil: "networkidle" });
      check(
        `theme ${theme}/${os}`,
        (await p.locator("html").getAttribute("data-theme")) ===
          (theme === "system" ? os : theme),
      );
      check(
        `no PNG or Canvas ${theme}/${os}`,
        (await p.locator(".hero-stage img,.hero-stage canvas").count()) === 0,
      );
      check(
        `PNG not fetched ${theme}/${os}`,
        await p.evaluate(
          () =>
            !performance
              .getEntriesByType("resource")
              .some((r) => r.name.includes("founder-hero-story")),
        ),
      );
      check(
        `six native fragments ${theme}/${os}`,
        (await p.locator(".sns-fragment").count()) === 6,
      );
      check(
        `five text steps ${theme}/${os}`,
        (await p.locator(".spe-native-story .visually-hidden li").count()) ===
          5,
      );
      check(
        `complete reduced-motion state ${theme}/${os}`,
        (await p.locator(".spe-native-story").getAttribute("data-step")) ===
          "4" &&
          (await p
            .locator(".spe-native-story")
            .evaluate((e) => e.getAnimations({ subtree: true }).length === 0)),
      );
      check(
        `prompt visible ${theme}/${os}`,
        await p
          .locator(".sns-prompt-lines p")
          .evaluateAll(
            (es) =>
              es.length === 4 &&
              es.every((e) => getComputedStyle(e).opacity === "1"),
          ),
      );
      if (process.env.AXE_PATH) {
        await p.route("**/hero-test-axe.js", (r) =>
          r.fulfill({
            contentType: "application/javascript",
            body: readFileSync(process.env.AXE_PATH, "utf8"),
          }),
        );
        await p.addScriptTag({ url: base + "/hero-test-axe.js" });
        const a = await p.evaluate(() =>
          window.axe.run(document.querySelector(".hero-theater"), {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          }),
        );
        check(
          `axe ${theme}/${os}`,
          a.violations.length === 0,
          JSON.stringify(
            a.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
          ),
        );
      }
      if (theme === "system") {
        await p.emulateMedia({ colorScheme: os === "dark" ? "light" : "dark" });
        for (let retry = 0; retry < 30; retry++) {
          if ((await p.locator("html").getAttribute("data-theme")) !== os)
            break;
          await p.waitForTimeout(100);
        }
        check(
          `system live ${os}`,
          (await p.locator("html").getAttribute("data-theme")) !== os,
        );
      }
      check(`runtime ${theme}/${os}`, errors.length === 0, errors.join(";"));
      await c.close();
    }
  const c = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  const p = await c.newPage();
  await p.goto(base, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Pause story", exact: true }).focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  check(
    "keyboard pause",
    (await p.locator(".spe-native-story").getAttribute("data-paused")) ===
      "true",
  );
  const times = () =>
    p
      .locator(".spe-native-story")
      .evaluate((e) =>
        e.getAnimations({ subtree: true }).map((a) => a.currentTime),
      );
  const first = await times();
  const stage = await p.locator(".spe-native-story").getAttribute("data-step");
  await p.waitForTimeout(500);
  check(
    "pause freezes motion",
    JSON.stringify(first) === JSON.stringify(await times()),
  );
  check(
    "pause freezes stage",
    stage === (await p.locator(".spe-native-story").getAttribute("data-step")),
  );
  await p.getByRole("button", { name: "Play story", exact: true }).click();
  let resumed = false;
  for (let retry = 0; retry < 10; retry++) {
    await p.waitForTimeout(100);
    if (JSON.stringify(first) !== JSON.stringify(await times())) {
      resumed = true;
      break;
    }
  }
  check("play resumes", resumed);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(200);
  check(
    "offscreen pauses",
    (await p.locator(".spe-native-story").getAttribute("data-paused")) ===
      "true",
  );
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(200);
  for (const [i, name] of [
    "ideas",
    "meaning",
    "spe",
    "plan",
    "prompt",
  ].entries()) {
    await p
      .getByRole("button", { name: `Show ${name} step`, exact: true })
      .click();
    check(
      `step navigation ${name}`,
      (await p.locator(".spe-native-story").getAttribute("data-step")) ===
        String(i),
    );
  }
  for (let retry = 0; retry < 45; retry++) {
    if (
      await p
        .getByRole("button", { name: "Replay story", exact: true })
        .isVisible()
    )
      break;
    await p.waitForTimeout(100);
  }
  check(
    "finite end and replay",
    await p
      .getByRole("button", { name: "Replay story", exact: true })
      .isVisible(),
  );
  await p.getByRole("button", { name: "Replay story", exact: true }).click();
  check(
    "replay starts at ideas",
    (await p.locator(".spe-native-story").getAttribute("data-step")) === "0",
  );
  await p.emulateMedia({ reducedMotion: "reduce" });
  for (let retry = 0; retry < 30; retry++) {
    const settled = await p
      .locator(".spe-native-story")
      .evaluate(
        (story) =>
          story.getAttribute("data-step") === "4" &&
          story.getAnimations({ subtree: true }).length === 0,
      );
    if (settled) break;
    await p.waitForTimeout(100);
  }
  check(
    "live reduced motion",
    (await p.locator(".spe-native-story").getAttribute("data-step")) === "4" &&
      (await p
        .locator(".spe-native-story")
        .evaluate((e) => e.getAnimations({ subtree: true }).length === 0)),
  );
  for (const width of [320, 390, 700, 768, 1024, 1440, 1920]) {
    await p.setViewportSize({ width, height: 1000 });
    const g = await p.evaluate(() => {
      const hero = document
          .querySelector(".hero-theater")
          .getBoundingClientRect(),
        scene = document.querySelector(".sns-scene").getBoundingClientRect(),
        art = document.querySelector(".sns-artifact").getBoundingClientRect(),
        caption = document
          .querySelector(".sns-caption")
          .getBoundingClientRect(),
        cta = document.querySelector(".hero-start").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        sceneHeight: scene.height,
        artInHero: art.bottom < hero.bottom,
        captionBelowArt: caption.top >= art.bottom,
        ctaInHero: cta.bottom < hero.bottom,
      };
    });
    check(
      `layout ${width}`,
      !g.overflow &&
        g.sceneHeight > 350 &&
        g.artInHero &&
        g.captionBelowArt &&
        g.ctaInHero,
      JSON.stringify(g),
    );
  }
  await p.setViewportSize({ width: 640, height: 1000 });
  await p.evaluate(() => (document.documentElement.style.zoom = "2"));
  check(
    "200% zoom",
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await c.close();
  const clockContext = await browser.newContext({
    serviceWorkers: "block",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const clockPage = await clockContext.newPage();
  await clockPage.clock.install({ time: new Date("2026-09-27T23:59:50Z") });
  await clockPage.clock.pauseAt(new Date("2026-09-27T23:59:58Z"));
  await clockPage.goto(base, { waitUntil: "domcontentloaded" });
  await clockPage.waitForTimeout(100);
  const old = await clockPage.locator("#hero-title").innerText();
  await clockPage.clock.fastForward(2500);
  for (let retry = 0; retry < 30; retry++) {
    if (old !== (await clockPage.locator("#hero-title").innerText())) break;
    await clockPage.waitForTimeout(100);
  }
  check(
    "open tab title changes at midnight",
    old !== (await clockPage.locator("#hero-title").innerText()),
  );
  const midnight = await clockPage.locator("#hero-title").innerText();
  await clockPage.clock.fastForward(3600000);
  check(
    "title stable within same day",
    midnight === (await clockPage.locator("#hero-title").innerText()),
  );
  await clockPage.clock.setSystemTime(new Date("2026-10-03T12:00:00Z"));
  await clockPage.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  for (let retry = 0; retry < 30; retry++) {
    if (midnight !== (await clockPage.locator("#hero-title").innerText()))
      break;
    await clockPage.waitForTimeout(100);
  }
  check(
    "returning tab refreshes daily title",
    midnight !== (await clockPage.locator("#hero-title").innerText()),
  );
  for (const width of [320, 768, 1440, 1920]) {
    await clockPage.setViewportSize({ width, height: 1000 });
    let overlaps = [];
    for (let day = 1; day <= 31; day++) {
      await clockPage.clock.setSystemTime(new Date(Date.UTC(2026, 9, day, 12)));
      await clockPage.evaluate(() => window.dispatchEvent(new Event("focus")));
      const expectedIndex = String(
        Math.floor(Date.UTC(2026, 9, day) / 86400000) % 31,
      );
      let titleUpdated = false;
      for (let retry = 0; retry < 30; retry++) {
        titleUpdated =
          (await clockPage
            .locator("#hero-title")
            .getAttribute("data-daily-title")) === expectedIndex;
        if (titleUpdated) break;
        await clockPage.waitForTimeout(100);
      }
      const fit = await clockPage.evaluate(() => {
        const title = document
            .querySelector("#hero-title")
            .getBoundingClientRect(),
          cta = document.querySelector(".hero-start").getBoundingClientRect(),
          hero = document
            .querySelector(".hero-theater")
            .getBoundingClientRect();
        return (
          document.documentElement.scrollWidth <= innerWidth &&
          title.bottom < cta.top &&
          cta.bottom < hero.bottom - 40
        );
      });
      if (!fit || !titleUpdated) overlaps.push(day);
    }
    check(
      `all 31 headlines fit ${width}`,
      overlaps.length === 0,
      JSON.stringify(overlaps),
    );
  }
  await clockContext.close();
} finally {
  await browser.close();
  if (results.length > 0) {
    writeFileSync(
      new URL("../../../proofs/hero_revision/tests.json", import.meta.url),
      JSON.stringify(results, null, 2),
    );
  }
}
assert.ok(
  results.every((r) => r.pass),
  "Hero checks failed",
);
console.log(`${results.length} hero checks passed`);
