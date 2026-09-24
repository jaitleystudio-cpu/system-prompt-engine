/**
 * Recapture distinct SPE V1 visual QA screenshots.
 * Usage: SPE_PLAYWRIGHT_MODULE=... node proofs/spe_v1_launch/capture-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(
  process.env.SPE_PLAYWRIGHT_MODULE || "playwright"
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "screenshots");
const BASE = process.env.SPE_TEST_URL || "http://127.0.0.1:4173/";
const BRIEF =
  "Write a warm leave-of-absence email to my manager for next Friday. Keep it under 150 words, polite, and include that I'll hand off open tickets.";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
});

const hashes = {};

async function shot(page, name) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  const buf = readFileSync(dest);
  const md5 = createHash("md5").update(buf).digest("hex");
  hashes[name] = { bytes: buf.length, md5 };
  console.log(`OK ${name} ${buf.length}B md5=${md5}`);
}

async function nav(page, label) {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", {
    name: label,
    exact: true,
  }).click();
  await page.waitForTimeout(400);
}

try {
  // --- 01 home hero 1440 ---
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "01-home-1440.png");
    await page.close();
  }

  // --- 02 create composer 1440 ---
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await nav(page, "Create");
    await page.waitForSelector(".spe-create, #create-title", { timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, "02-create-1440.png");
    await page.close();
  }

  // --- 03 text→prompt WASM result via homepage studio (proven E2E path) ---
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.locator("#prompt-studio").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const ta = page.locator("#spe-one-line");
    await ta.click();
    await ta.fill(BRIEF);
    // Click the studio form build button (not nav CTA)
    await page.locator("#prompt-studio form.spe-command button.spe-build").click();
    await page.waitForFunction(
      () => {
        const status = document.querySelector("#prompt-studio .compile-status");
        return status && status.textContent.includes("Ready to use");
      },
      { timeout: 90000 },
    );
    await page.locator("#prompt-studio .studio-output.live-result").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // Frame both panels if possible
    const studio = page.locator("#prompt-studio .studio-shell");
    if (await studio.count()) {
      await studio.screenshot({ path: path.join(OUT, "03-text-prompt-result-1440.png") });
      const buf = readFileSync(path.join(OUT, "03-text-prompt-result-1440.png"));
      hashes["03-text-prompt-result-1440.png"] = {
        bytes: buf.length,
        md5: createHash("md5").update(buf).digest("hex"),
      };
      console.log(
        `OK 03-text-prompt-result-1440.png ${buf.length}B md5=${hashes["03-text-prompt-result-1440.png"].md5} (studio element)`,
      );
    } else {
      await shot(page, "03-text-prompt-result-1440.png");
    }
    // Sanity: page text must include Ready to use and not be Daily Lab-only
    const text = await page.locator("body").innerText();
    if (!text.includes("Ready to use")) throw new Error("03 missing Ready to use");
    if (!text.includes("YOUR PROMPT") && !text.includes("Your idea, given structure")) {
      console.warn("WARN: 03 may not show result heading");
    }
    await page.close();
  }

  // --- 04 daily lab 1440 ---
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await nav(page, "Daily Lab");
    await page.waitForSelector("text=Daily Lab", { timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, "04-daily-lab-1440.png");
    await page.close();
  }

  // --- 05 daily lab 390 ---
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    // open burger then Daily Lab
    const burger = page.getByRole("button", { name: "Menu" });
    if (await burger.isVisible()) await burger.click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Daily Lab", exact: true }).click();
    await page.waitForTimeout(600);
    await shot(page, "05-daily-lab-390.png");
    await page.close();
  }

  // --- 06 privacy 390 ---
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const burger = page.getByRole("button", { name: "Menu" });
    if (await burger.isVisible()) await burger.click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Privacy / Proof", exact: true }).click();
    await page.waitForTimeout(700);
    await shot(page, "06-privacy-390.png");
    await page.close();
  }

  // --- 07 privacy 320 (must differ from 06) ---
  {
    const page = await browser.newPage({
      viewport: { width: 320, height: 720 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const burger = page.getByRole("button", { name: "Menu" });
    if (await burger.isVisible()) await burger.click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Privacy / Proof", exact: true }).click();
    await page.waitForTimeout(700);
    await shot(page, "07-privacy-320.png");
    await page.close();
  }

  // --- 08 create 390 (optional) ---
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const burger = page.getByRole("button", { name: "Menu" });
    if (await burger.isVisible()) await burger.click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForTimeout(600);
    await shot(page, "08-create-390.png");
    await page.close();
  }

  // Uniqueness checks
  if (hashes["03-text-prompt-result-1440.png"].md5 === hashes["04-daily-lab-1440.png"].md5) {
    throw new Error("FAIL: 03 and 04 still byte-identical");
  }
  if (hashes["06-privacy-390.png"].md5 === hashes["07-privacy-320.png"].md5) {
    throw new Error("FAIL: 06 and 07 still byte-identical (viewport not applied?)");
  }
  console.log("\nUNIQUENESS OK: 03≠04 and 06≠07");
  console.log(JSON.stringify(hashes, null, 2));
} finally {
  await browser.close();
}
