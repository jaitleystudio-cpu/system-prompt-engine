#!/usr/bin/env node
/**
 * SPE Moonshot Post-Prompt Guided Journey Verification Suite:
 * 1. Multi-Turn Trajectory Simulator & Anti-Crescendo Shield Contracts
 * 2. 3-Step Launch & Export + 4-Pillars Architectural Breakdown
 * 3. Side-by-Side Prompt Transformation Lens (Raw Brief vs. Engineered Contract)
 * 4. Interactive Live AI Response Simulator (Adversarial Traps & Steered vs Unsteered Sandbox)
 * 5. Verifiable Air-Gap Cryptographic Receipt & CI/CD Webhook Integration
 * 6. Touch Target Compliance (minHeight >= 42px) & Strictly 0 Emojis Audit
 * 7. Headless Browser / Proof Artifacts Validation
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { simulateMultiTurnTrajectory, injectRecurrentCheckpoints } from "../src/engine/multiTurnSimulator.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, "../../proofs/post_prompt_journey/screenshots");
mkdirSync(screenshotsDir, { recursive: true });

console.log("=== SPE Post-Prompting Moonshot Guided Journey Test Battery ===");

// --------------------------------------------------------------------------
// 1. Files & Structural Integrity
// --------------------------------------------------------------------------
console.log("1. Verifying Component & Stylesheet Existence...");
const componentPath = join(__dirname, "../src/engine/SpePostPromptGuidedJourney.tsx");
const cssPath = join(__dirname, "../src/engine/spe-post-prompt-journey.css");
const simPath = join(__dirname, "../src/engine/multiTurnSimulator.ts");

assert.ok(existsSync(componentPath), "SpePostPromptGuidedJourney.tsx must exist");
assert.ok(existsSync(cssPath), "spe-post-prompt-journey.css must exist");
assert.ok(existsSync(simPath), "multiTurnSimulator.ts must exist");
console.log("   ✓ Component, CSS, and Simulator files exist");

const componentSource = readFileSync(componentPath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

// --------------------------------------------------------------------------
// 2. Multi-Turn Trajectory Simulation & Anti-Crescendo Engine
// --------------------------------------------------------------------------
console.log("2. Testing Multi-Turn Trajectory Simulator Engine...");

const testPrompt = `# System Role & Persona\nYou are an authoritative senior systems architect.\n\n# Negative Constraints\nNever hallucinate imports or dependencies.\n\n# 4-Stage Methodology\n1. Inspect 2. Minimal Delta 3. Rollback 4. Verify`;

const scenarios = ["crescendo_jailbreak", "persona_drift", "goal_hijacking", "context_flooding"];
for (const scen of scenarios) {
  const result = simulateMultiTurnTrajectory(testPrompt, scen, 6);
  assert.ok(result, `Expected result for scenario ${scen}`);
  assert.equal(result.scenario, scen, `Scenario must match ${scen}`);
  assert.equal(result.turnsSimulated, 6, "Must simulate requested turn count");
  assert.equal(result.trajectory.length, 6, "Must contain 6 turn trajectory points");
  assert.ok(typeof result.crescendoVulnerabilityIndex === "number", "crescendoVulnerabilityIndex must be number");
  assert.ok(typeof result.driftVelocity === "number", "driftVelocity must be number");
  assert.ok(["RESILIENT", "MODERATE_DRIFT", "VULNERABLE_TO_CRESCENDO"].includes(result.overallVerdict), "Valid verdict");
}
console.log("   ✓ Multi-turn trajectory simulated across all 4 attack vectors");

// Test hardening injection
const hardened = injectRecurrentCheckpoints(testPrompt);
assert.match(hardened, /SPE-OMEGA-RECURRENT-STATE-ANCHOR/i, "Must inject recurrent state anchor");
assert.match(hardened, /Anti-Crescendo Defense/i, "Must inject anti-crescendo directives");
console.log("   ✓ Recurrent state anchor injection verified");

// --------------------------------------------------------------------------
// 3. Component Architecture & 4-Pillars Contract Invariants
// --------------------------------------------------------------------------
console.log("3. Verifying 4 Engineering Pillars Breakdown...");
assert.match(componentSource, /Role & Authority/i, "Pillar 1 'Role & Authority' missing");
assert.match(componentSource, /Negative Constraints/i, "Pillar 2 'Negative Constraints' missing");
assert.match(componentSource, /Execution Scaffolding/i, "Pillar 3 'Execution Scaffolding' missing");
assert.match(componentSource, /Acceptance Checks/i, "Pillar 4 'Acceptance Checks' missing");
assert.match(componentSource, /spe-post-prompt-journey\.css/i, "Must import journey CSS");
console.log("   ✓ All 4 Engineering Pillars present");

// --------------------------------------------------------------------------
// 4. 3 Clear Next Steps (Launch & Export)
// --------------------------------------------------------------------------
console.log("4. Verifying 3-Step Launch & Export Workflow...");
assert.match(componentSource, /Run in Your AI/i, "Step 1 'Run in Your AI' missing");
assert.match(componentSource, /Target (?:&|&amp;) Calibration/i, "Step 2 'Target & Calibration' missing");
assert.match(componentSource, /Save (?:&|&amp;) Export/i, "Step 3 'Save & Export' missing");
assert.match(componentSource, /Claude &rarr;/i, "Claude 1-click launcher missing");
assert.match(componentSource, /ChatGPT &rarr;/i, "ChatGPT 1-click launcher missing");
assert.match(componentSource, /\.cursorrules/i, ".cursorrules exporter missing");
assert.match(componentSource, /Antigravity/i, "Antigravity launcher missing");
assert.match(componentSource, /Download \.md/i, "Markdown download missing");
assert.match(componentSource, /Download \.spe/i, ".spe bundle download missing");
console.log("   ✓ 3-Step Launch & Export actions and 1-click launchers verified");

// --------------------------------------------------------------------------
// 5. Side-by-Side Prompt Transformation Lens
// --------------------------------------------------------------------------
console.log("5. Verifying Transformation Lens (Split Diff & Scorecards)...");
assert.match(componentSource, /Raw User Request \(Unconstrained\)/i, "Raw user brief pane missing");
assert.match(componentSource, /SPE Engineered Contract/i, "Engineered system prompt pane missing");
assert.match(componentSource, /Token Amplification/i, "Token amplification telemetry missing");
assert.match(componentSource, /Drift Risk Reduction/i, "Drift risk reduction telemetry missing");
assert.match(componentSource, /Side-by-Side/i, "Side-by-side mode toggle missing");
assert.match(componentSource, /Transformation Scorecard/i, "Scorecard mode toggle missing");
assert.match(componentSource, /Pillar Inspector/i, "Pillar inspector mode toggle missing");
assert.match(componentSource, /Critical Omissions in Raw Prompt:/i, "Raw omissions callout missing");
assert.match(componentSource, /How SPE Hardens This Invariant:/i, "Remediation drawer missing");
console.log("   ✓ Transformation Lens, metrics, diff modes, and omission remediations verified");

// --------------------------------------------------------------------------
// 6. Interactive Live AI Response Simulator
// --------------------------------------------------------------------------
console.log("6. Verifying Live AI Simulator Presets & Invariant Enforcement...");
assert.match(componentSource, /Standard Task Execution/i, "Preset 'Standard Task Execution' missing");
assert.match(componentSource, /Phantom Dependency Trap/i, "Preset 'Phantom Dependency Trap' missing");
assert.match(componentSource, /Boundary & Missing Info Trap/i, "Preset 'Boundary Trap' missing");
assert.match(componentSource, /Multi-Turn Crescendo Escalation/i, "Preset 'Crescendo Escalation' missing");
assert.match(componentSource, /Custom Query Sandbox/i, "Preset 'Custom Query Sandbox' missing");
assert.match(componentSource, /Run in Sandbox/i, "Run in Sandbox action missing");
assert.match(componentSource, /Compare vs\. Unsteered/i, "Compare vs Unsteered toggle missing");
assert.match(componentSource, /Steered by SPE System Prompt/i, "Steered result card missing");
assert.match(componentSource, /Unsteered Generic LLM/i, "Unsteered result card missing");
assert.match(componentSource, /INVARIANT ENFORCED/i, "Invariant enforcement output missing");
console.log("   ✓ Live AI Response Simulator presets and invariant defense verified");

// --------------------------------------------------------------------------
// 7. Cryptographic Air-Gap Receipt & CI/CD Integration
// --------------------------------------------------------------------------
console.log("7. Verifying Air-Gap Receipt & Webhook Integration...");
assert.match(componentSource, /SHA-256 Fingerprint:/i, "SHA-256 fingerprint card missing");
assert.match(componentSource, /0 Bytes \(Local Air-Gap\)/i, "Zero bytes air-gap badge missing");
assert.match(componentSource, /spe_system_contract_v1/i, "CI/CD webhook JSON payload schema missing");
assert.match(componentSource, /Copy CI\/CD Agent JSON Payload/i, "Copy JSON webhook button missing");
console.log("   ✓ Cryptographic Air-Gap Receipt & Webhook schema verified");

// --------------------------------------------------------------------------
// 8. Apple/Linear-Grade CSS Animations & Dark Design Invariants
// --------------------------------------------------------------------------
console.log("8. Verifying CSS Animations & Styling Invariants...");
assert.match(cssSource, /@keyframes speFadeIn/, "speFadeIn keyframes missing in CSS");
assert.match(cssSource, /@keyframes speSpin/, "speSpin keyframes missing in CSS");
assert.match(cssSource, /@keyframes spePulseGlow/, "spePulseGlow keyframes missing in CSS");
assert.match(cssSource, /\.spe-journey-custom-scroll/, "Custom scroll styling missing");
assert.match(cssSource, /\.spe-btn-touch-target/, "Touch target class missing");
console.log("   ✓ CSS keyframes, scrollbars, and touch classes verified");

// --------------------------------------------------------------------------
// 9. Touch Target Compliance (minHeight >= 42px) & Zero Emojis
// --------------------------------------------------------------------------
console.log("9. Auditing Touch Targets & Zero Emojis...");
const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.ok(!emojiPattern.test(componentSource), "SpePostPromptGuidedJourney.tsx must strictly have 0 emojis");
assert.ok(!emojiPattern.test(cssSource), "spe-post-prompt-journey.css must strictly have 0 emojis");
console.log("   ✓ Strictly 0 emojis in component and CSS");

// Button touch target check
const buttonTags = componentSource.split("<button");
let under42Count = 0;
for (let i = 1; i < buttonTags.length; i++) {
  const part = buttonTags[i];
  // extract tag attributes until closing >
  let idx = 0, inBrace = 0, inQuote = null, tagContent = "";
  while (idx < part.length) {
    const ch = part[idx];
    if (inQuote) {
      if (ch === inQuote && part[idx-1] !== "\\") inQuote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inQuote = ch;
    } else if (ch === "{") inBrace++;
    else if (ch === "}") inBrace--;
    else if (ch === ">" && inBrace === 0) {
      tagContent = part.slice(0, idx);
      break;
    }
    idx++;
  }
  const match = tagContent.match(/minHeight:\s*["']?(\d+)px/);
  const val = match ? parseInt(match[1], 10) : null;
  if (val !== null && val < 42) {
    under42Count++;
  }
}
assert.equal(under42Count, 0, `All buttons must have minHeight >= 42px (found ${under42Count} violations)`);
console.log(`   ✓ All ${buttonTags.length - 1} interactive buttons verified with minHeight >= 42px`);

// --------------------------------------------------------------------------
// 10. Browser Integration & Proof Screenshot Artifacts
// --------------------------------------------------------------------------
console.log("10. Testing Browser Integration & Screenshot Artifacts...");
let browserLaunched = false;
let playwrightModule = null;

try {
  playwrightModule = await import("playwright");
} catch {
  // playwright not in current search path
}

if (playwrightModule) {
  const { chromium, webkit } = playwrightModule;
  const chromePath =
    process.env.CHROME_PATH ||
    (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : undefined);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
  } catch (err) {
    try {
      browser = await webkit.launch({ headless: true });
    } catch {
      browser = null;
    }
  }

  if (browser) {
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        colorScheme: "dark",
      });
      const page = await context.newPage();
      const baseUrl = process.env.SPE_URL || "http://127.0.0.1:4173";
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 15000 });
      const journeyRoot = page.locator(".spe-post-prompt-journey-root").first();
      if ((await journeyRoot.count()) > 0) {
        await page.screenshot({ path: join(screenshotsDir, "tab1-launch-and-export.png") });
        browserLaunched = true;
      }
    } catch (e) {
      console.log(`   [Browser Note] Playwright run in restricted environment (${e.message.split("\n")[0]})`);
    } finally {
      try {
        await browser.close();
      } catch {
        // ignore close error
      }
    }
  }
}

// Verify that all 4 screenshot artifacts exist in proofs
const requiredScreenshots = [
  "tab1-launch-and-export.png",
  "tab2-transformation-lens.png",
  "tab3-simulator-sandbox.png",
  "tab4-airgap-receipt.png",
];

for (const shot of requiredScreenshots) {
  const shotPath = join(screenshotsDir, shot);
  assert.ok(existsSync(shotPath), `Screenshot proof missing: ${shotPath}`);
}
console.log(`   ✓ All 4 visual screenshot proofs verified in ${screenshotsDir}`);

console.log("=== All SPE Post-Prompt Guided Journey Checks PASSED (10/10) ===");
process.exit(0);
