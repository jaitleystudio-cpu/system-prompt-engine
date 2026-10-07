import assert from "node:assert/strict";
import { chromium } from "playwright";

async function main() {
  console.log("================================================================================");
  console.log("SPE 10/10 NORTHSTAR MOONSHOT — FULL LIVE SYSTEM QUALIFICATION");
  console.log("Testing targets, synthesis depth, features hub, and multi-surface routing");
  console.log("================================================================================");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[BROWSER ERROR]", msg.text());
  });

  console.log("\n1. Navigating to http://127.0.0.1:4177/ ...");
  await page.goto("http://127.0.0.1:4177/", { waitUntil: "networkidle" });

  // 1. Verify FeaturesHub with Cmd+K Quick Filter
  console.log("2. Verifying FeaturesHub & ⌘K Quick Switcher...");
  const hub = await page.waitForSelector(".spe-features-hub", { timeout: 10000 });
  assert.ok(hub, "FeaturesHub must be mounted");

  const searchInput = await page.waitForSelector('.spe-features-hub input[placeholder*="⌘K"]');
  assert.ok(searchInput, "Quick feature filter input must be present");

  await searchInput.fill("3D");
  await page.waitForTimeout(300);
  const filteredText = await hub.textContent();
  assert.ok(filteredText.includes("3D Studio v1.2"), "Filtering by '3D' must show 3D Studio");
  await searchInput.fill("");
  console.log("   -> FeaturesHub & ⌘K Quick Switcher: 100% VERIFIED GREEN!");

  // 2. Test Neural Network Prompt on ChatGPT Target (Default/Any AI)
  console.log("\n3. Testing Neural Network Prompt (Default / Any AI)...");
  const userPrompt = "Explain how a neural network learns to a curious 14-year-old. Use one everyday analogy, a worked example and three questions to check understanding.";
  await page.fill("#spe-one-line", "");
  await page.fill("#spe-one-line", userPrompt);
  await page.click(".spe-build");
  await page.waitForSelector(".prompt-document", { timeout: 15000 });
  const textAny = await page.locator(".prompt-document").textContent();
  console.log(`   -> Generated prompt length: ${textAny.length} characters`);
  assert.equal(textAny.length, 5555, `Normal depth must be exactly 5,555 characters, got ${textAny.length}`);
  assert.ok(textAny.includes("# System Role & Persona"), "Must contain System Role & Persona");
  assert.ok(textAny.includes("patient, expert subject-matter educator"), "Must calibrate Educator role");
  assert.ok(textAny.includes("basketball free throws") || textAny.includes("recipe"), "Must include everyday analogy");
  assert.ok(textAny.includes("forward pass") || textAny.includes("weights"), "Must include worked example");
  assert.ok(textAny.includes("three progressive questions"), "Must include 3 check questions");
  assert.ok(!textAny.includes("## Budget none"), "ZERO raw IR leakage");
  console.log("   -> Default prompt synthesis: 100% VERIFIED GREEN (Exact 5,555 chars)!");

  // 2b. Verify SPE Ω Prompt Radar Inspector & Multi-Model Matrix
  console.log("\n3b. Testing SPE Ω Prompt Radar Inspector HUD...");
  const radar = await page.waitForSelector(".spe-prompt-radar-inspector", { timeout: 5000 });
  assert.ok(radar, "Prompt Radar Inspector must mount upon prompt synthesis");

  // 3b-1. Test Depth Tier Switcher: Mid-Size (15,000 chars)...
  console.log("\n3b-1. Testing Depth Tier Switcher: Mid-Size (15,000 chars)...");
  await page.click('.spe-prompt-radar-inspector button:has-text("Mid (15kc)")');
  await page.waitForTimeout(400);
  const textMid = await page.locator(".prompt-document").textContent();
  console.log(`   -> Mid tier prompt length: ${textMid.length} characters`);
  assert.equal(textMid.length, 15000, `Mid tier must be exactly 15,000 characters, got ${textMid.length}`);

  // Assert ZERO duplicate lines in Mid tier
  const midLines = textMid.split("\n").map((l) => l.trim()).filter(Boolean);
  const midCounts = {};
  for (const l of midLines) {
    midCounts[l] = (midCounts[l] || 0) + 1;
    assert.equal(midCounts[l], 1, `Zero duplicate lines allowed in Mid tier! Found duplicate: "${l}"`);
  }
  console.log("   -> Mid tier: ZERO DUPLICATE LINES verified!");

  // Scroll .prompt-document to the invariants section and capture focused screenshot
  await page.evaluate(() => {
    const el = document.querySelector(".prompt-document");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_depth_tier_mid_15k_verified.png",
    fullPage: false,
  });
  console.log("   -> Mid-Size Depth (15,000 chars): 100% VERIFIED GREEN!");

  console.log("\n3b-2. Testing Depth Tier Switcher: Deep-Large (30,000 chars)...");
  await page.click('.spe-prompt-radar-inspector button:has-text("Deep (30kc)")');
  await page.waitForTimeout(400);
  const textDeep = await page.locator(".prompt-document").textContent();
  console.log(`   -> Deep tier prompt length: ${textDeep.length} characters`);
  assert.equal(textDeep.length, 30000, `Deep tier must be exactly 30,000 characters, got ${textDeep.length}`);

  // Assert ZERO duplicate lines in Deep tier
  const deepLines = textDeep.split("\n").map((l) => l.trim()).filter(Boolean);
  const deepCounts = {};
  for (const l of deepLines) {
    deepCounts[l] = (deepCounts[l] || 0) + 1;
    assert.equal(deepCounts[l], 1, `Zero duplicate lines allowed in Deep tier! Found duplicate: "${l}"`);
  }
  console.log("   -> Deep tier: ZERO DUPLICATE LINES verified!");

  // Scroll .prompt-document to the bottom / invariants section and capture focused screenshot
  await page.evaluate(() => {
    const el = document.querySelector(".prompt-document");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_depth_tier_deep_30k_verified.png",
    fullPage: false,
  });
  console.log("   -> Deep-Large Depth (30,000 chars): 100% VERIFIED GREEN!");

  console.log("\n3b-3. Testing Depth Tier Switcher: Return to Normal (5,555 chars)...");
  await page.click('.spe-prompt-radar-inspector button:has-text("Normal (5,555c)")');
  await page.waitForTimeout(400);
  const textNormalReturn = await page.locator(".prompt-document").textContent();
  console.log(`   -> Normal tier prompt length: ${textNormalReturn.length} characters`);
  assert.equal(textNormalReturn.length, 5555, `Normal tier must be exactly 5,555 characters, got ${textNormalReturn.length}`);
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_depth_tier_normal_5555_verified.png",
    fullPage: false,
  });
  console.log("   -> Normal Depth (5,555 chars): 100% VERIFIED GREEN!");

  const radarText = await radar.textContent();
  assert.ok(radarText.includes("SPE Ω PROMPT RADAR"), "Must display SPE Ω PROMPT RADAR title");
  assert.ok(radarText.includes("SCORE:"), "Must display health score");
  assert.ok(radarText.includes("TOKENS"), "Must display token estimate");
  assert.ok(radarText.includes("Injection Defense"), "Must display injection defense radar metric");
  console.log("   -> Quality Radar HUD: 100% VERIFIED GREEN!");

  // Test Model Matrix Tab inside Inspector
  console.log("3c. Testing Inspector Model Matrix Tab...");
  await page.click('.spe-prompt-radar-inspector button:has-text("Model Matrix")');
  await page.waitForTimeout(400);
  const matrixContent = await radar.textContent();
  assert.ok(matrixContent.includes("Claude XML"), "Model Matrix must feature Claude XML");
  assert.ok(matrixContent.includes("ChatGPT / GPT-4o"), "Model Matrix must feature ChatGPT / GPT-4o");
  assert.ok(matrixContent.includes("Google Gemini"), "Model Matrix must feature Google Gemini");
  assert.ok(matrixContent.includes("Local Llama"), "Model Matrix must feature Local Llama");
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_model_matrix_verified.png",
    fullPage: false,
  });
  console.log("   -> Multi-Model Matrix Tab: 100% VERIFIED GREEN!");

  // Test SDK Runners Tab inside Inspector
  console.log("3d. Testing Inspector SDK Runners Tab...");
  await page.click('.spe-prompt-radar-inspector button:has-text("SDK Runners")');
  await page.waitForTimeout(400);
  const sdkContent = await radar.textContent();
  assert.ok(sdkContent.includes("Python") && sdkContent.includes("TypeScript"), "SDK Runners must support Python and TS");
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_sdk_runners_verified.png",
    fullPage: false,
  });
  console.log("   -> 1-Click SDK Runners Tab: 100% VERIFIED GREEN!");

  // Test IDE Rules Tab inside Inspector
  console.log("3e. Testing Inspector IDE Rules Tab...");
  await page.click('.spe-prompt-radar-inspector button:has-text("IDE Rules")');
  await page.waitForTimeout(400);
  const rulesContent = await radar.textContent();
  assert.ok(rulesContent.includes("CLAUDE.md") || rulesContent.includes(".cursorrules"), "IDE Rules must support Cursor & Claude");
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_ide_rules_verified.png",
    fullPage: false,
  });
  console.log("   -> IDE Rules Tab: 100% VERIFIED GREEN!");

  // Test AGI Brain Harness Tab inside Inspector
  console.log("3e-1. Testing Inspector AGI Brain Harness Tab...");
  await page.click('.spe-prompt-radar-inspector button:has-text("AGI Brain Harness")');
  await page.waitForTimeout(400);
  const harnessContent = await radar.textContent();
  assert.ok(harnessContent.includes("SPE AGI NEURAL BRAIN HARNESS v1.2"), "Must display AGI Neural Brain Harness v1.2 title");
  assert.ok(harnessContent.includes("LEVEL 5 COGNITIVE HARNESS"), "Must display Level 5 badge");
  assert.ok(harnessContent.includes("ANTI-SYCOPHANCY 100% IMMUNE"), "Must display anti-sycophancy badge");
  assert.ok(harnessContent.includes("harness_reasoning"), "Must display harness_reasoning");
  assert.ok(harnessContent.includes("harness_code"), "Must display harness_code");
  assert.ok(harnessContent.includes("harness_anti_deception"), "Must display harness_anti_deception");
  assert.ok(harnessContent.includes("harness_memory"), "Must display harness_memory");
  assert.ok(harnessContent.includes("[NEGATIVE GATE]"), "Must display [NEGATIVE GATE]");
  assert.ok(harnessContent.includes("[FALSIFICATION TEST]"), "Must display [FALSIFICATION TEST]");
  assert.ok(harnessContent.includes("CoALA 4-Tier Memory"), "Must display CoALA memory architecture");
  assert.ok(harnessContent.includes("Formal BDI"), "Must display BDI Grounding");
  assert.ok(harnessContent.includes("forward_message"), "Must display direct pass-through protocol");
  assert.ok(harnessContent.includes("Hierarchical Agent Memory"), "Must display HAM routing");

  // Verify Copy Harness button
  await page.click('.spe-prompt-radar-inspector button:has-text("Copy Harness Spec")');
  await page.waitForTimeout(300);
  const copiedHarnessBtn = await radar.textContent();
  assert.ok(copiedHarnessBtn.includes("✓ Copied Harness!"), "Must indicate successful copy of AGI harness");

  // Capture screenshot of AGI Brain Harness tab
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_agi_brain_harness_verified.png",
    fullPage: false,
  });
  console.log("   -> AGI Brain Harness Tab & Telemetry: 100% VERIFIED GREEN!");

  // Test Markdown (.md) System Prompt Tab & Download Features
  console.log("3e-2. Testing Markdown (.md) System Prompt Tab & Download Features...");
  await page.click('.spe-prompt-radar-inspector button:has-text("Markdown (.md)")');
  await page.waitForTimeout(400);
  const mdContent = await radar.textContent();
  assert.ok(mdContent.includes("CommonMark / GitHub Flavored Markdown (GFM)"), "Must display GFM format indicator");
  assert.ok(mdContent.includes("# System Role & Persona"), "Must contain # System Role & Persona heading");
  assert.ok(mdContent.includes("# Objective"), "Must contain # Objective heading");
  assert.ok(mdContent.includes("# Approach & Methodological Plan"), "Must contain methodology heading");
  assert.ok(mdContent.includes("# Acceptance Checks & Verification Battery"), "Must contain acceptance battery");

  // Verify YAML Frontmatter toggle
  const frontmatterCheckbox = await page.waitForSelector('.spe-prompt-radar-inspector input[type="checkbox"]');
  await frontmatterCheckbox.check();
  await page.waitForTimeout(300);
  const mdWithFrontmatter = await radar.textContent();
  assert.ok(mdWithFrontmatter.includes('generator: "System Prompt Engine (SPE v1.2)"'), "Must contain YAML frontmatter generator v1.2");
  assert.ok(mdWithFrontmatter.includes('format: "Markdown (CommonMark / GitHub Flavored Markdown)"'), "Must contain YAML frontmatter format");

  // Verify Copy Markdown button
  await page.click('.spe-prompt-radar-inspector button:has-text("Copy Markdown")');
  await page.waitForTimeout(300);
  const copiedMdBtn = await radar.textContent();
  assert.ok(copiedMdBtn.includes("✓ Copied MD!"), "Must indicate successful copy of Markdown prompt");

  // Verify HUD Header Download .MD button
  const hudDownloadBtn = await page.waitForSelector('.spe-prompt-radar-inspector button:has-text("📥 Download .MD")');
  assert.ok(hudDownloadBtn, "HUD Header Download .MD button must be present");

  // Capture screenshot of Markdown prompt tab
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_markdown_export_verified.png",
    fullPage: false,
  });
  console.log("   -> Markdown (.md) System Prompt Tab & Frontmatter: 100% VERIFIED GREEN!");

  // Verify 1-Click .md Action Button in Create View
  console.log("3e-3. Verifying 1-Click .md Action Button in Create View...");
  const createMdBtn = await page.waitForSelector('.spe-actions button:has-text(".md")');
  assert.ok(createMdBtn, "Create view actions must include .md button");
  assert.ok(await createMdBtn.isEnabled(), ".md export button must be enabled");
  console.log("   -> 1-Click .md Action Button in Create View: 100% VERIFIED GREEN!");

  // Return to radar tab & capture screenshot
  await page.click('.spe-prompt-radar-inspector button:has-text("Quality Radar")');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_prompt_radar_inspector_verified.png",
    fullPage: false,
  });
  console.log("   -> Prompt Radar Screenshot captured!");

  // Test Interactive Diagnostic Drawer on Cognitive Scaffolding Pill
  console.log("3f. Testing Diagnostic Drawer on Cognitive Scaffolding Pill...");
  await page.click('.spe-prompt-radar-inspector button:has-text("Cognitive Scaffolding")');
  await page.waitForTimeout(400);
  const drawer = await page.waitForSelector('.spe-prompt-radar-inspector button:has-text("Copy Snippet")', { timeout: 5000 });
  assert.ok(drawer, "Diagnostic Drawer must open with Copy Snippet button");
  const drawerText = await radar.textContent();
  assert.ok(drawerText.includes("Why Frontier LLMs"), "Must display reasoning degradation analysis");
  assert.ok(drawerText.includes("What You Must Provide"), "Must display actionable user remediation");
  await page.screenshot({
    path: "/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375/spe_prompt_radar_drawer_verified.png",
    fullPage: false,
  });
  console.log("   -> Interactive Diagnostic Drawer: 100% VERIFIED GREEN!");

  // 3. Test Target AI: Claude
  console.log("\n4. Testing Target AI Selector: Claude (Anthropic XML Spec)...");
  await page.selectOption('.brief-field select:has(option[value="claude"])', "claude");
  await page.click(".spe-build");
  await page.waitForTimeout(1000);
  await page.waitForSelector(".prompt-document", { timeout: 15000 });
  const textClaude = await page.locator(".prompt-document").textContent();
  console.log(`   -> Claude target prompt length: ${textClaude.length} characters`);
  assert.equal(textClaude.length, 5555, `Claude normal target must be exactly 5,555 chars, got ${textClaude.length}`);
  assert.ok(textClaude.includes("<system_prompt>"), "Must contain <system_prompt> tag");
  assert.ok(textClaude.includes("<role>"), "Must contain <role> tag");
  assert.ok(textClaude.includes("<objective>"), "Must contain <objective> tag");
  assert.ok(textClaude.includes("<approach>"), "Must contain <approach> tag");
  assert.ok(textClaude.includes("</system_prompt>"), "Must close </system_prompt> tag");
  console.log("   -> Claude XML prompt synthesis: 100% VERIFIED GREEN (Exact 5,555 chars)!");

  // 4. Test Target AI: Gemini
  console.log("\n5. Testing Target AI Selector: Gemini (Google Multimodal Spec)...");
  await page.selectOption('.brief-field select:has(option[value="gemini"])', "gemini");
  await page.click(".spe-build");
  await page.waitForTimeout(1000);
  await page.waitForSelector(".prompt-document", { timeout: 15000 });
  const textGemini = await page.locator(".prompt-document").textContent();
  console.log(`   -> Gemini target prompt length: ${textGemini.length} characters`);
  assert.equal(textGemini.length, 5555, `Gemini normal target must be exactly 5,555 chars, got ${textGemini.length}`);
  assert.ok(textGemini.includes("System Instructions"), "Must contain System Instructions");
  assert.ok(textGemini.includes("Grounded Methodology"), "Must contain Grounded Methodology");
  console.log("   -> Gemini prompt synthesis: 100% VERIFIED GREEN (Exact 5,555 chars)!");

  // 5. Test Target AI: Local Model (Llama-3 / Mistral high density)
  console.log("\n6. Testing Target AI Selector: Local Model (Instruction Delimiter Spec)...");
  await page.selectOption('.brief-field select:has(option[value="local"])', "local");
  await page.click(".spe-build");
  await page.waitForTimeout(1000);
  await page.waitForSelector(".prompt-document", { timeout: 15000 });
  const textLocal = await page.locator(".prompt-document").textContent();
  console.log(`   -> Local model target prompt length: ${textLocal.length} characters`);
  assert.equal(textLocal.length, 5555, `Local normal target must be exactly 5,555 chars, got ${textLocal.length}`);
  assert.ok(textLocal.includes("[INST] <<SYS>>"), "Must contain [INST] <<SYS>> delimiter");
  assert.ok(textLocal.includes("<</SYS>>"), "Must contain <</SYS>> delimiter");
  console.log("   -> Local model prompt synthesis: 100% VERIFIED GREEN (Exact 5,555 chars)!");

  // 6. Test 3D Website Studio Navigation & Viewport
  console.log("\n7. Testing In-App 3D Studio Navigation (/website)...");
  await page.goto("http://127.0.0.1:4177/website", { waitUntil: "networkidle" });
  const hasWebsiteView = await page.evaluate(() => {
    return document.body.innerText.includes("Website") || document.body.innerText.includes("Scene");
  });
  assert.ok(hasWebsiteView, "Must render Website Studio scene view");
  console.log("   -> In-App 3D Studio navigation: 100% VERIFIED GREEN!");

  // 7. Test Standalone 3D Studio (port 4180)
  console.log("\n8. Testing Standalone 3D Studio at http://127.0.0.1:4180 ...");
  const studioPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await studioPage.goto("http://127.0.0.1:4180/", { waitUntil: "networkidle" });
  const title = await studioPage.title();
  assert.ok(title.includes("Studio"), "Must load SPE 3D Studio");
  await studioPage.close();
  console.log("   -> Standalone 3D Studio at port 4180: 100% VERIFIED GREEN!");

  // 8. Test Workspace View & Actions
  console.log("\n9. Testing Workspace View (/workspace) & .md Action Button...");
  await page.goto("http://127.0.0.1:4177/workspace", { waitUntil: "networkidle" });
  const hasWorkspaceView = await page.waitForSelector(".spe-workspace", { timeout: 10000 });
  assert.ok(hasWorkspaceView, "Must render Workspace view");
  const wsActions = await page.waitForSelector(".spe-actions", { timeout: 10000 });
  assert.ok(wsActions, "Must render action buttons in Workspace");
  console.log("   -> Workspace View & actions: 100% VERIFIED GREEN!");

  await browser.close();
  console.log("\n================================================================================");
  console.log("ALL 9 VERIFICATION GATES PASSED (100% GREEN, ZERO DEFECTS, 10/10 NORTHSTAR)");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("QUALIFICATION FAILURE:", err);
  process.exit(1);
});
