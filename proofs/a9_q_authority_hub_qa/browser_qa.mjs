/**
 * A9-Q local browser QA. Binds only to 127.0.0.1. Does not publish or deploy.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "../../apps/web/node_modules/playwright/index.js";

const { chromium } = playwright;

const here = dirname(fileURLToPath(import.meta.url));
const base = "http://127.0.0.1:5173";
const shots = "/opt/cursor/artifacts";
mkdirSync(shots, { recursive: true });

const chrome = "/usr/bin/google-chrome";
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const pages = ["/", "/capabilities", "/daily-lab", "/privacy", "/workspace", "/create"];
const findings = [];

function hits(text) {
  const patterns = [/publish/i, /public share/i, /deploy/i, /\bhost(ed|ing)?\b/i, /share/i];
  return patterns
    .filter((re) => re.test(text))
    .map((re) => re.source);
}

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

for (const path of pages) {
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  const buttons = await page.locator("button, a").allInnerTexts();
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
  const og = await page.locator('meta[property="og:url"]').getAttribute("content").catch(() => null);
  findings.push({
    path,
    canonical,
    og,
    publication_hits: hits(body).length ? body.split("\n").filter((line) => /publish|public share|deploy|\bhost/i.test(line)).slice(0, 12) : [],
    control_hits: buttons
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter((t) => /publish|share|deploy|host/i.test(t))
      .slice(0, 20),
  });
  const name = path === "/" ? "home" : path.slice(1).replace(/\//g, "-");
  await page.screenshot({ path: join(shots, `a9q-${name}.png`), fullPage: false });
}

await page.goto(base + "/daily-lab", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const labMeta = await page.locator(".spe-lab-meta").innerText().catch(() => "");
await page.locator(".spe-lab-meta").scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: join(shots, "a9q-daily-lab-publish.png") });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mobile.newPage();
await mpage.goto(base + "/daily-lab", { waitUntil: "domcontentloaded" });
await mpage.waitForTimeout(500);
await mpage.locator(".spe-lab-meta").scrollIntoViewIfNeeded().catch(() => {});
await mpage.screenshot({ path: join(shots, "a9q-daily-lab-mobile.png") });
await mobile.close();

await page.goto(base + "/workspace", { waitUntil: "domcontentloaded" });
await page.locator('input[aria-label="Import .spe or JSON file"]').setInputFiles(
  join(here, "fixtures/smuggled-authority.spe.json"),
);
await page.waitForTimeout(800);
const afterImport = await page.locator("body").innerText();
const pill = afterImport.split("\n").filter((line) => /authority:/i.test(line));
const authorityCard = await page.locator('[data-section="authority"]').innerText().catch(() => "");
const checks = afterImport
  .split("\n")
  .filter((line) => /authority|grant|side effect|PASS|FAIL/i.test(line))
  .slice(0, 40);
const authority = page.locator('[data-section="authority"]');
await authority.scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: join(shots, "a9q-workspace-smuggled-inspect.png") });
await authority.screenshot({ path: join(shots, "a9q-authority-card.png") }).catch(() => {});
await page.locator(".header-meta").screenshot({ path: join(shots, "a9q-authority-pill.png") }).catch(() => {});

const simpleBtn = page.getByRole("button", { name: "Simple", exact: true });
if (await simpleBtn.count()) {
  await simpleBtn.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(shots, "a9q-workspace-smuggled-simple.png") });
  await page
    .locator(".spe-contract-simple")
    .screenshot({ path: join(shots, "a9q-simple-false-badge.png") })
    .catch(() => {});
}
const simpleText = await page.locator(".spe-contract-simple").innerText().catch(() => "");

const result = {
  base,
  lab_meta: labMeta,
  findings,
  import: {
    pills: pill,
    authority_card: authorityCard,
    check_lines: checks,
    simple_text: simpleText,
  },
};
writeFileSync(join(here, "browser_qa_results.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
await browser.close();
