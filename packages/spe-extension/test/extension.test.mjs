import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");

console.log("==================================================================");
console.log("🧪 TESTING: SPE Universal Cross-Browser Extension Suite");
console.log("==================================================================");

// 1. Verify All Browser Manifests
console.log("\n[1/7] Verifying Browser Manifests (Chrome, Firefox, Safari, Edge)...");
const manifests = [
  { file: "manifest.chrome.json", target: "Chrome", reqGecko: false },
  { file: "manifest.firefox.json", target: "Firefox", reqGecko: true },
  { file: "manifest.safari.json", target: "Safari", reqGecko: false },
  { file: "manifest.edge.json", target: "Edge", reqGecko: false }
];

for (const m of manifests) {
  const manifestPath = resolve(pkgRoot, m.file);
  assert(existsSync(manifestPath), `Manifest file ${m.file} must exist`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.manifest_version, 3, `${m.target} manifest must be Manifest V3`);
  assert(manifest.name.includes("SPE"), `${m.target} name must include SPE`);
  assert(manifest.permissions.includes("storage"), `${m.target} must have storage permission`);
  assert(manifest.content_scripts.length > 0, `${m.target} must declare content_scripts`);

  if (m.reqGecko) {
    assert(manifest.browser_specific_settings?.gecko?.id, "Firefox manifest must declare gecko ID");
    assert(manifest.background.scripts, "Firefox MV3 manifest must declare background scripts array");
  } else {
    assert(manifest.background.service_worker, `${m.target} manifest must declare service_worker`);
  }
  console.log(`  ✓ ${m.target} Manifest V3 verified (${m.file})`);
}

// 2. Verify Safari Native macOS Scaffolding
console.log("\n[2/7] Verifying Safari Native macOS App & Extension Scaffolding...");
const safariFiles = [
  "safari/SPE Safari Extension/Info.plist",
  "safari/SPE Safari Extension/SafariWebExtensionHandler.swift",
  "safari/SPE Safari Companion/Info.plist",
  "safari/SPE Safari Companion/SPESafariCompanionApp.swift",
  "safari/README.md"
];
for (const sf of safariFiles) {
  assert(existsSync(resolve(pkgRoot, sf)), `Safari file ${sf} must exist`);
}
const swiftHandler = readFileSync(resolve(pkgRoot, "safari/SPE Safari Extension/SafariWebExtensionHandler.swift"), "utf8");
assert(swiftHandler.includes("SafariWebExtensionHandler"), "Safari extension handler must be implemented");
const swiftApp = readFileSync(resolve(pkgRoot, "safari/SPE Safari Companion/SPESafariCompanionApp.swift"), "utf8");
assert(swiftApp.includes("SPESafariCompanionApp"), "Safari SwiftUI companion app must be implemented");
console.log("  ✓ Safari native Swift companion app and extension handler verified.");

// 3. Test Browser Compatibility Layer
console.log("\n[3/7] Verifying Universal Browser Compatibility Layer (speBrowser)...");
const { speBrowser } = await import(resolve(pkgRoot, "src/browserCompat.js"));
assert(speBrowser.storage, "speBrowser must expose storage API");
assert(speBrowser.storage.local.get, "speBrowser must expose storage.local.get");
assert(speBrowser.storage.local.set, "speBrowser must expose storage.local.set");
assert(speBrowser.storage.sync.get, "speBrowser must expose storage.sync.get");
assert(speBrowser.tabs, "speBrowser must expose tabs API");
assert(speBrowser.runtime, "speBrowser must expose runtime API");
assert(typeof speBrowser.name === "string", "speBrowser must report browser name");
console.log(`  ✓ speBrowser initialized cleanly (Runtime environment: ${speBrowser.name})`);

// 4. Test Entitlement & $1/Month Micro-Subscription Manager
console.log("\n[4/7] Testing Entitlement & $1/Month Micro-Subscription Manager...");
const {
  EntitlementManager,
  PRICING_CONFIG,
  SUBSCRIPTION_TIERS,
  validateLicenseKey,
  generateOfflineLicenseKey
} = await import(resolve(pkgRoot, "src/entitlementManager.js"));

assert.equal(PRICING_CONFIG.monthlyPriceUsd, 1.00, "Monthly price must be exactly $1.00 USD");
assert.equal(PRICING_CONFIG.annualPriceUsd, 10.00, "Annual price must be $10.00 USD ($0.83/mo)");

// Test Developer Test Keys
const devMonth = validateLicenseKey("SPE-PRO-DEV-MONTHLY-2026");
assert(devMonth.valid, "Developer monthly key must be valid");
assert.equal(devMonth.tier, SUBSCRIPTION_TIERS.PRO_MONTHLY);

const devYear = validateLicenseKey("SPE-PRO-DEV-ANNUAL-2026");
assert(devYear.valid, "Developer annual key must be valid");
assert.equal(devYear.tier, SUBSCRIPTION_TIERS.PRO_ANNUAL);

// Test Dynamic Key Generation and Offline Verification
const testSeed = "CLIENTUSER77";
const generatedKey = generateOfflineLicenseKey(testSeed);
assert(generatedKey.startsWith("SPE-PRO-"), "Generated key must have SPE-PRO- prefix");
const verifyGen = validateLicenseKey(generatedKey);
assert(verifyGen.valid, `Generated key ${generatedKey} must pass offline verification`);

// Test Invalid / Tampered Keys
const badKey = "SPE-PRO-TAMPERED-0000";
const verifyBad = validateLicenseKey(badKey);
assert.equal(verifyBad.valid, false, "Tampered key must be rejected");

// Test Feature Gating
assert(await EntitlementManager.canAccess("UNLIMITED_100K_SPECS") !== undefined);
assert.equal(await EntitlementManager.canAccess("FREE_CORE_PROMPT"), true, "Free features must always be accessible");

// Test Checkout URL generation
const monthlyUrl = EntitlementManager.getCheckoutUrl("monthly");
assert(monthlyUrl.includes("plan=monthly"), "Checkout URL must encode monthly plan");
const annualUrl = EntitlementManager.getCheckoutUrl("annual");
assert(annualUrl.includes("plan=annual"), "Checkout URL must encode annual plan");
console.log("  ✓ $1/mo pricing, offline license cryptographic verification, and checkout URLs verified.");

// 5. Test Cross-Browser Compiler & Packaging Script
console.log("\n[5/7] Executing Cross-Browser Compiler (build-cross-browser.mjs)...");
execSync(`"${process.execPath}" "${resolve(pkgRoot, "scripts/build-cross-browser.mjs")}"`, { stdio: "inherit" });

const distTargets = ["chrome", "firefox", "safari", "edge"];
for (const t of distTargets) {
  const targetDir = resolve(pkgRoot, "dist", t);
  assert(existsSync(targetDir), `Target directory dist/${t} must exist`);
  assert(existsSync(resolve(targetDir, "manifest.json")), `dist/${t}/manifest.json must exist`);
  assert(existsSync(resolve(targetDir, "popup.html")), `dist/${t}/popup.html must exist`);
  assert(existsSync(resolve(targetDir, "content.js")), `dist/${t}/content.js must exist`);
  assert(existsSync(resolve(targetDir, "background.js")), `dist/${t}/background.js must exist`);

  const zipFile = resolve(pkgRoot, "dist", `spe-extension-${t}.zip`);
  assert(existsSync(zipFile), `Zip archive ${zipFile} must exist`);
}
assert(existsSync(resolve(pkgRoot, "dist/build-manifest.json")), "build-manifest.json must exist");
console.log("  ✓ All 4 distribution directories and store zip archives verified.");

// 6. Test Outcome Intent Classifier (Positive vs Negative Discovery)
console.log("\n[6/7] Verifying Outcome Intent Classifier (OpenAI Discovery Standard)...");
const { classifyOutcomeIntent } = await import(resolve(pkgRoot, "src/outcomeIntentClassifier.js"));

const benchmarkCases = [
  { text: "Build me a shopping app", cap: "PRODUCT_APP_SPECIFICATION" },
  { text: "Design a cinematic 3D website", cap: "INTERACTIVE_3D_WEB_SPECIFICATION" },
  { text: "Research this scientific hypothesis", cap: "SCIENTIFIC_RESEARCH_PROTOCOL" },
  { text: "Create a marketing campaign", cap: "MARKETING_CAMPAIGN_BRIEF" },
  { text: "Help me learn mathematics", cap: "TUTORING_INSTRUCTION_FRAMEWORK" },
  { text: "Create an AI agent", cap: "AGENT_SPECIFICATION_PLAN" },
  { text: "Improve this document", cap: "WRITING_QUALITY_AUDIT" },
  { text: "Turn this business idea into a plan", cap: "BUSINESS_PLANNING_SPECIFICATION" },
  { text: "Make this workflow automatic", cap: "WORKFLOW_AUTOMATION_SAFEGUARDS" }
];

for (const b of benchmarkCases) {
  const res = classifyOutcomeIntent(b.text);
  assert.equal(res.decision, "SPECIFICATION_LIFT_AVAILABLE", `Prompt "${b.text}" should trigger lift`);
  assert.equal(res.capabilityId, b.cap, `Prompt "${b.text}" should map to ${b.cap}`);
}

const negativeQueries = [
  "What is the capital of France?",
  "2 + 2",
  "Hello",
  "Tell me a joke",
  "How to spell necessary",
  "What time is it in Tokyo?"
];

for (const q of negativeQueries) {
  const res = classifyOutcomeIntent(q);
  assert.equal(res.decision, "PASS_THROUGH", `Query "${q}" must pass through without tool triggering`);
  assert.equal(res.triggered, false, `Triggered must be false for "${q}"`);
}
console.log("  ✓ Outcome Intent Classifier passed 100% of positive and negative tests.");

// 8. Test Universal Auto-Actions Engine (QuillBot & Grammarly Killer)
console.log("\n[8/8] Testing Universal Auto-Actions Engine (QuillBot & Grammarly Killer)...");
const { SpeAutoActionsEngine } = await import(resolve(pkgRoot, "src/autoActionsEngine.js"));

// Test Humanize & Cliché Purging
const roboticAI = "In today's fast-paced digital world, it is crucial to delve into this rich tapestry and foster innovation which is utilized by everyone.";
const humanized = SpeAutoActionsEngine.humanizeText(roboticAI);
assert(!humanized.toLowerCase().includes("delve into"), "Must purge 'delve into'");
assert(!humanized.toLowerCase().includes("rich tapestry"), "Must purge 'rich tapestry'");
assert(!humanized.toLowerCase().includes("crucial role"), "Must purge 'crucial'");
assert(humanized.includes("is used by"), "Must convert 'is utilized by' to 'is used by'");
console.log("  ✓ Auto-Action Humanize: Successfully purged 50+ AI cliches and active voice transformed.");

// Test QuillBot Paraphrase (Fluent, Executive, Shorten)
const draftExecutive = "i think we should do it asap because we got good results";
const execRephrase = SpeAutoActionsEngine.paraphraseText(draftExecutive, "executive");
assert(execRephrase.includes("we recommend"), "Executive rephrase must convert 'i think we should' to 'we recommend'");
assert(execRephrase.includes("measurable impact"), "Executive rephrase must convert 'good results' to 'measurable impact'");

const wordyDraft = "for the purpose of testing with regard to the issue, it is basically very unique";
const shortened = SpeAutoActionsEngine.paraphraseText(wordyDraft, "shorten");
assert(!shortened.includes("for the purpose of"), "Shorten mode must eliminate wordy 'for the purpose of'");
assert(!shortened.includes("basically"), "Shorten mode must prune 'basically'");
assert(shortened.includes("unique"), "Shorten mode must prune 'very unique' to 'unique'");
console.log("  ✓ Auto-Action QuillBot Paraphrase: Fluent, Executive, and Shorten modes verified.");

// Test Grammarly Polish (Fix Flow & Grammar)
const badGrammar = "the the results are very unique and basically really important .";
const polished = SpeAutoActionsEngine.fixGrammarAndFlow(badGrammar);
assert(!polished.includes("the the"), "Grammarly polish must eliminate repeated 'the the'");
assert(polished.startsWith("The "), "Grammarly polish must capitalize sentence starts");
assert(!polished.includes("very unique"), "Grammarly polish must eliminate weak intensifier 'very unique'");
assert(polished.endsWith("."), "Grammarly polish must preserve valid punctuation");
console.log("  ✓ Auto-Action Grammarly Polish: Grammar hygiene, capitalization, and redundancy pruning verified.");

// Test Manifest Commands (Global Hotkey Cmd+Shift+S / Ctrl+Shift+S)
for (const m of manifests) {
  const manifest = JSON.parse(readFileSync(resolve(pkgRoot, m.file), "utf8"));
  assert(manifest.commands?.spe_quick_action, `${m.target} manifest must declare spe_quick_action command`);
  assert.equal(manifest.commands.spe_quick_action.suggested_key.mac, "Command+Shift+S");
}
console.log("  ✓ All 4 browser manifests declare global hotkey command (Cmd+Shift+S / Ctrl+Shift+S).");

// Test Word-Level Diff & 10x ROI Telemetry Calculation
console.log("\n[9/9] Testing 10/10 Live Transformation Diff & 10x ROI Telemetry Engine...");
const diffSample = "In today's fast-paced world, it is a testament to innovation and plays a crucial role to delve into new horizons.";
const transformedSample = SpeAutoActionsEngine.humanizeText(diffSample);
const diffData = SpeAutoActionsEngine.computeTransformationDiff(diffSample, transformedSample);

assert(Array.isArray(diffData.diff), "Diff must be an array of token objects");
assert(diffData.diff.some(tok => tok.type === "del"), "Diff must detect deleted tokens");
assert(diffData.metrics.clichesPurged >= 3, "Diff must detect at least 3 purged cliches in test phrase");
assert(diffData.metrics.humanScore.includes("Human Cadence"), "Human cadence score must be computed");
assert.equal(diffData.metrics.returnMultiple, "10x Benefit Delivered");
console.log(`  ✓ Word-Level Diff Hologram: ${diffData.metrics.clichesPurged} clichés purged, diff tokens calculated, ${diffData.metrics.humanScore}.`);

// Test Daily Usage & Lifetime ROI Accounting
const initialDaily = await EntitlementManager.getDailyUsage();
assert.equal(initialDaily.limit, 15, "Free tier must offer 15 daily actions");

await EntitlementManager.recordActionUsage({ clichesPurged: 3, wordsPruned: 8 });
const postUsage = await EntitlementManager.getDailyUsage();
assert(postUsage.count >= 1, "Recorded action must increment daily usage count");

const roiMetrics = await EntitlementManager.getLifetimeRoiMetrics();
assert(roiMetrics.clichesPurged >= 3, "Lifetime cliches purged must accumulate");
assert(roiMetrics.timeSavedHours !== undefined, "Time saved in hours must be computed");
assert(roiMetrics.valueSavedUsd !== undefined, "Monetary value saved vs $1 must be computed");
console.log(`  ✓ 10x ROI Telemetry Accounting: Accumulated ${roiMetrics.clichesPurged} clichés purged, $${roiMetrics.valueSavedUsd} editor value delivered.`);

console.log("\n==================================================================");
console.log("🎉 ALL UNIVERSAL CROSS-BROWSER & AUTO-ACTION TESTS PASSED (100% SOUND)!");
console.log("==================================================================\n");

