import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");

console.log("==================================================================");
console.log("🧪 TESTING: SPE Browser Companion Extension Suite");
console.log("==================================================================");

// 1. Verify Manifest V3
console.log("\n[1/5] Verifying Manifest V3 schema and security...");
const manifest = JSON.parse(readFileSync(resolve(pkgRoot, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3, "Must be Manifest V3");
assert(manifest.name.includes("SPE"), "Extension name must include SPE");
assert(manifest.permissions.includes("storage"), "Must request storage permission");
assert(manifest.background.service_worker, "Must define background service worker");
assert(manifest.content_scripts.length > 0, "Must define content scripts for chat interfaces");

const matches = manifest.content_scripts[0].matches;
assert(matches.some(m => m.includes("chatgpt.com")), "Must support ChatGPT");
assert(matches.some(m => m.includes("claude.ai")), "Must support Claude");
assert(matches.some(m => m.includes("gemini.google.com")), "Must support Gemini");
console.log("✓ Manifest V3 validated with support for ChatGPT, Claude, and Gemini.");

// 2. Verify Prompts Data
console.log("\n[2/5] Verifying Power Prompts Vault...");
const { POWER_PROMPTS_VAULT } = await import(resolve(pkgRoot, "src/promptsData.js"));
assert(Array.isArray(POWER_PROMPTS_VAULT), "Vault must be an array");
assert(POWER_PROMPTS_VAULT.length >= 8, "Must contain at least 8 curated power prompts");

const categories = new Set(POWER_PROMPTS_VAULT.map(p => p.category));
assert(categories.has("SEO"), "Must cover SEO category");
assert(categories.has("Marketing"), "Must cover Marketing category");
assert(categories.has("Coding"), "Must cover Coding category");
assert(categories.has("Business"), "Must cover Business category");
assert(categories.has("Writing"), "Must cover Writing category");
console.log(`✓ Vault validated with ${POWER_PROMPTS_VAULT.length} prompts across ${categories.size} categories.`);

// 3. Verify Prompt Templates and Variable Consistency
console.log("\n[3/5] Testing variable binding and compilation...");
for (const prompt of POWER_PROMPTS_VAULT) {
  assert(prompt.id, "Prompt must have unique ID");
  assert(prompt.title, "Prompt must have title");
  assert(prompt.tagline, "Prompt must have human tagline");
  assert(prompt.template.length > 50, "Template must be substantial");
  assert(prompt.variables && prompt.variables.length > 0, "Prompt must define variables");
  
  // Verify each declared variable is in template
  for (const v of prompt.variables) {
    assert(
      prompt.template.includes(`{${v.name}}`),
      `Prompt ${prompt.id} template must contain placeholder {${v.name}}`
    );
  }
}
console.log("✓ All prompt templates and dynamic variables verified.");

// 4. Verify Assets & Script Content
console.log("\n[4/5] Verifying required assets, CSS, and content script...");
assert(existsSync(resolve(pkgRoot, "icons/icon16.png")), "16px icon must exist");
assert(existsSync(resolve(pkgRoot, "icons/icon48.png")), "48px icon must exist");
assert(existsSync(resolve(pkgRoot, "icons/icon128.png")), "128px icon must exist");
assert(existsSync(resolve(pkgRoot, "content.js")), "content.js must exist");
assert(existsSync(resolve(pkgRoot, "content.css")), "content.css must exist");
assert(existsSync(resolve(pkgRoot, "popup.html")), "popup.html must exist");
assert(existsSync(resolve(pkgRoot, "popup.js")), "popup.js must exist");

const contentJs = readFileSync(resolve(pkgRoot, "content.js"), "utf8");
assert(contentJs.includes("classifyOutcomeIntent"), "content.js must contain outcome classifier");
assert(contentJs.includes("spe-lift-container"), "content.js must contain specification lift container");
assert(contentJs.includes("setupInputObserver"), "content.js must contain debounced input observer");

const contentCss = readFileSync(resolve(pkgRoot, "content.css"), "utf8");
assert(contentCss.includes("spe-lift-container"), "content.css must define lift container styles");
assert(contentCss.includes("spe-lift-badge"), "content.css must define lift badge styles");
console.log("✓ All assets and files exist and pass integrity check.");

// 5. Test Outcome Intent Classifier (Positive vs Negative Discovery)
console.log("\n[5/5] Verifying Outcome Intent Classifier (OpenAI Discovery Standard)...");
const { classifyOutcomeIntent, OUTCOME_CAPABILITIES } = await import(resolve(pkgRoot, "src/outcomeIntentClassifier.js"));

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
  assert(res.liftedSpecificationPrompt.length > 200, "Should generate detailed specification prompt");
  console.log(`  ✓ Positive Trigger: "${b.text}" -> [${res.capabilityId}]`);
}

// Negative tests: Trivial inputs must return PASS_THROUGH
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
  console.log(`  ✓ Negative Pass-Through: "${q}" -> PASS_THROUGH (${res.reason})`);
}

console.log("✓ Outcome Intent Classifier passed 100% of positive and negative tests.");

console.log("\n🎉 ALL SPE BROWSER COMPANION TESTS PASSED!\n");
