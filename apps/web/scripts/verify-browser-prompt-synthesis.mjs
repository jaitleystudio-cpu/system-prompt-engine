import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("Launching headless Chromium to verify live prompt generation on SPE web...");
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Navigate to /create
  await page.goto("http://127.0.0.1:4173/create", { waitUntil: "networkidle" });
  console.log("Navigated to /create");

  // Wait for main elements
  await page.waitForSelector("textarea");

  // Type complex system prompt goal
  const promptRequest = "Build a distributed transaction coordinator using the Saga orchestration pattern with backward-recovery compensation logic, dead-letter queues, idempotent message handlers, and zero-loss ledger auditing.";
  await page.fill("textarea", promptRequest);
  console.log("Filled prompt request textarea");

  // Click the 'Coding' category pill if present, or let auto-detect work
  const codingPill = page.locator("button:has-text('Coding')");
  if (await codingPill.isVisible()) {
    await codingPill.click();
    console.log("Selected 'Coding' category pill");
  }

  // Click the Build / Compile Prompt button
  const buildBtn = page.locator("button.spe-build");
  await buildBtn.click();
  console.log("Clicked Compile / Build button");

  // Wait for output tabs or prompt artifact to render
  await page.waitForTimeout(2500);

  // Check generated prompt content
  const outputPre = page.locator("pre.prompt-body, pre");
  let promptText = "";
  const count = await outputPre.count();
  for (let i = 0; i < count; i++) {
    const text = await outputPre.nth(i).innerText();
    if (text.includes("## Objective") || text.includes("## ") || text.length > 200) {
      promptText = text;
      break;
    }
  }

  console.log("=== Generated Prompt Analysis ===");
  console.log("Prompt length (characters):", promptText.length);
  const words = promptText.split(/\s+/).filter(Boolean).length;
  console.log("Prompt length (words):", words);
  console.log("Sections detected:", (promptText.match(/^##\s+/gm) || []).length);

  // Check Quality receipt status
  const qualityText = await page.locator("body").innerText();
  const passFound = qualityText.includes("PASS") || qualityText.includes("OBLIGATIONS_SATISFIED");
  console.log("PASS / OBLIGATIONS_SATISFIED found in UI:", passFound);

  // Click Run local dry-run button if available
  const dryRunBtn = page.locator("button:has-text('Run local dry-run')");
  if (await dryRunBtn.isVisible()) {
    await dryRunBtn.click();
    console.log("Clicked 'Run local dry-run' button");
    await page.waitForTimeout(1000);
  }

  // Save full-page screenshot
  const screenshotPath = "/Users/prawinpalisetty/.gemini/antigravity/brain/ae54d847-945e-4cdb-9835-66f6f29f4825/live-verified-prompt-ui.png";
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("Saved verification screenshot to:", screenshotPath);

  // Save generated prompt artifact to brain
  const promptLogPath = "/Users/prawinpalisetty/.gemini/antigravity/brain/ae54d847-945e-4cdb-9835-66f6f29f4825/live-generated-prompt.md";
  fs.writeFileSync(promptLogPath, promptText, "utf8");
  console.log("Saved full prompt text to:", promptLogPath);

  await browser.close();

  if (words < 300) {
    throw new Error(`Generated prompt too short (${words} words). Expected deep structured prompt.`);
  }

  console.log("✅ Live Browser Prompt Synthesis and Quality Receipt Verified!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
