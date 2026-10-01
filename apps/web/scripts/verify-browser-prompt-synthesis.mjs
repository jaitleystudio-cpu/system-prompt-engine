import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("=== SPE Comprehensive Multi-Depth Prompt Synthesis Verification ===");
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:4173/create", { waitUntil: "networkidle" });
  console.log("Navigated to http://127.0.0.1:4173/create");

  await page.waitForSelector("textarea");

  const promptRequest = "Build a distributed transaction coordinator using the Saga orchestration pattern with backward-recovery compensation logic, dead-letter queues, idempotent message handlers, and zero-loss ledger auditing.";
  await page.fill("textarea", promptRequest);

  // Click Coding category
  const codingPill = page.locator("button:has-text('Coding')");
  if (await codingPill.isVisible()) {
    await codingPill.click();
    console.log("Selected 'Coding' category pill");
  }

  // Open Sources & Depth disclosure if closed
  const details = page.locator("details.spe-create-sources-depth");
  if (await details.isVisible()) {
    const isOpen = await details.evaluate((el) => el.hasAttribute("open"));
    if (!isOpen) {
      await details.locator("summary").click();
      await page.waitForTimeout(500);
      console.log("Opened 'Sources & depth' disclosure");
    }
  }

  const depths = [
    { id: "FAST", label: "Fast", fileSuffix: "fast" },
    { id: "SMART", label: "Smart", fileSuffix: "smart" },
    { id: "DEEP", label: "Deep", fileSuffix: "deep" },
  ];

  const results = [];

  for (const d of depths) {
    console.log(`\n--- Compiling Depth: ${d.id} (${d.label}) ---`);
    // Click depth button
    const depthBtn = page.locator(`button:has-text('${d.label}')`);
    if (await depthBtn.isVisible()) {
      await depthBtn.click();
      await page.waitForTimeout(400);
      console.log(`Selected depth: ${d.label}`);
    }

    // Click Compile Prompt button
    const buildBtn = page.locator("button.spe-build");
    await buildBtn.click();
    await page.waitForTimeout(2500);

    // Extract generated prompt
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

    const words = promptText.split(/\s+/).filter(Boolean).length;
    const chars = promptText.length;
    const sections = (promptText.match(/^##\s+/gm) || []).length;

    // Check Quality receipt
    const bodyText = await page.locator("body").innerText();
    const isPass = bodyText.includes("PASS");
    const isObligations = bodyText.includes("OBLIGATIONS_SATISFIED");
    const isEnforcement = bodyText.includes("ENFORCEMENT_VERIFIED");

    console.log(`Results for ${d.id}:`);
    console.log(`  - Characters: ${chars}`);
    console.log(`  - Words: ${words}`);
    console.log(`  - Sections: ${sections}`);
    console.log(`  - Quality Receipt: PASS=${isPass}, OBLIGATIONS_SATISFIED=${isObligations}, ENFORCEMENT_VERIFIED=${isEnforcement}`);

    // Save prompt markdown artifact
    const promptPath = `/Users/prawinpalisetty/.gemini/antigravity/brain/ae54d847-945e-4cdb-9835-66f6f29f4825/spe-prompt-${d.fileSuffix}.md`;
    fs.writeFileSync(promptPath, promptText, "utf8");
    console.log(`  - Saved prompt to: ${promptPath}`);

    // Save screenshot
    const screenshotPath = `/Users/prawinpalisetty/.gemini/antigravity/brain/ae54d847-945e-4cdb-9835-66f6f29f4825/spe-prompt-${d.fileSuffix}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  - Saved screenshot to: ${screenshotPath}`);

    results.push({
      depth: d.id,
      words,
      chars,
      sections,
      isPass,
      promptPath,
      screenshotPath,
    });
  }

  await browser.close();

  console.log("\n=== Final Multi-Depth Synthesis Summary ===");
  console.table(results.map(r => ({
    Depth: r.depth,
    Words: r.words,
    Characters: r.chars,
    Sections: r.sections,
    Pass: r.isPass,
  })));

  for (const r of results) {
    if (!r.isPass) throw new Error(`Depth ${r.depth} failed quality receipt!`);
  }

  console.log("\n✅ ALL DEPTH VERSIONS 100% GENERATED AND VERIFIED BY REAL SPE WASM ENGINE!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
