#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const artifacts = "/opt/cursor/artifacts";
const baseUrl = "http://127.0.0.1:4173/";
const tip = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: join(here, "../../.."),
  encoding: "utf8",
}).trim();

mkdirSync(here, { recursive: true });
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

async function openHero({
  theme,
  width,
  height,
  reducedMotion = "no-preference",
}) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion,
    colorScheme: theme,
    deviceScaleFactor: 1,
  });
  await context.addInitScript((selectedTheme) => {
    localStorage.setItem("spe-theme", selectedTheme);
  }, theme);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".hero-story");
  return { context, page };
}

const captures = [];
for (const theme of ["dark", "light"]) {
  const { context, page } = await openHero({
    theme,
    width: 1440,
    height: 900,
  });
  const name = `home-${theme}.png`;
  const artifactName = `spe_batch_a_home_${theme}_final.png`;
  await page.screenshot({ path: join(here, name) });
  await page.screenshot({ path: join(artifacts, artifactName) });
  captures.push({ name, artifactName, viewport: "1440x900", theme });
  await context.close();
}

{
  const { context, page } = await openHero({
    theme: "dark",
    width: 390,
    height: 844,
  });
  const order = await page
    .locator(".hero-story-label strong")
    .evaluateAll((labels) => labels.map((label) => label.textContent?.trim()));
  const expected = [
    "MESSY HUMAN THOUGHT",
    "IDEA",
    "MEANING",
    "SPE",
    "STRUCTURE",
    "SYSTEM PROMPT",
  ];
  if (JSON.stringify(order) !== JSON.stringify(expected)) {
    throw new Error(`Mobile story order mismatch: ${JSON.stringify(order)}`);
  }
  await page
    .locator(".hero-theater")
    .screenshot({ path: join(here, "mobile-home.png") });
  await page
    .locator(".hero-theater")
    .screenshot({ path: join(artifacts, "spe_batch_a_mobile_home_final.png") });
  captures.push({
    name: "mobile-home.png",
    artifactName: "spe_batch_a_mobile_home_final.png",
    viewport: "390x844",
    theme: "dark",
    order,
  });
  await context.close();
}

{
  const { context, page } = await openHero({
    theme: "dark",
    width: 1440,
    height: 900,
    reducedMotion: "reduce",
  });
  const control = (await page.locator(".motion-button").innerText()).trim();
  if (control !== "Reduced motion") {
    throw new Error(`Reduced-motion control mismatch: ${control}`);
  }
  await page.screenshot({ path: join(here, "reduced-motion.png") });
  await page.screenshot({
    path: join(artifacts, "spe_batch_a_reduced_motion_final.png"),
  });
  captures.push({
    name: "reduced-motion.png",
    artifactName: "spe_batch_a_reduced_motion_final.png",
    viewport: "1440x900",
    theme: "dark",
    control,
  });
  await context.close();
}

await browser.close();

writeFileSync(
  join(here, "screenshot-manifest.json"),
  `${JSON.stringify(
    {
      baseSha: "9d5a37a913b5a30122d19734af106f5c85b085cb",
      testedTipSha: tip,
      HOSTING: "FORBIDDEN",
      WORLD_NUMBER_1: "NOT_PROVEN",
      captures,
    },
    null,
    2,
  )}\n`,
);

console.log(`PASS captured Batch A hero at ${tip}`);
