/**
 * Verification test battery for SPE Ω Model Governance & Currency Authority
 *
 * Verifies:
 * 1. Authoritative model catalog grounded in official provider documentation.
 * 2. Rejection of invented / speculative model identifiers.
 * 3. Invariant Preservation: User's requested model is NEVER silently substituted.
 * 4. Explicit user consent requirement for model adaptation.
 * 5. Capability-based suitability evaluation instead of calendar year alone.
 */

import {
  FRONTIER_ACTIVE_YEAR,
  AUTHORITATIVE_PROVIDER_MODELS,
  isModelAuthoritative,
  isSpeculativeOrInventedModel,
  governModelSelection,
  autoUpgradeLegacyModel,
  assertModelCurrency,
  getDefaultFrontierModel,
  getActiveFrontierModels,
} from "../src/engine/modelCurrencyGovernor.ts";

console.log("========================================================================");
console.log("⚖️  SPE Ω — MODEL GOVERNANCE & INVARIANT PRESERVATION TEST BATTERY");
console.log("========================================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ▶ Gate 1: Authoritative Catalog Integrity
console.log("\n▶ Gate 1: Authoritative Catalog Grounded in Official Provider Docs");
assert(FRONTIER_ACTIVE_YEAR === 2026, "Frontier active year pinned to 2026");
assert(AUTHORITATIVE_PROVIDER_MODELS.length >= 20, `Authoritative model count is ${AUTHORITATIVE_PROVIDER_MODELS.length} (>= 20)`);

const realModels = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "gpt-4o",
  "o3-mini",
  "gemini-2.0-flash",
  "deepseek-chat",
  "deepseek-reasoner",
  "meta-llama/llama-3.3-70b-instruct",
  "grok-2-1212",
  "mistral-large-2411",
];

const allRealValid = realModels.every((id) => isModelAuthoritative(id));
assert(allRealValid, "All documented production models pass authoritative provider check");

// ▶ Gate 2: Rejection of Invented / Speculative Identifiers
console.log("\n▶ Gate 2: Rejection of Invented / Speculative Identifiers");
const trulyInventedModels = [
  "magic-gpt-10-ultra",
  "fictional-hyper-ai-9000",
  "claude-9-infinity",
  "gemini-99-super",
  "deepseek-quantum-1",
  "llama-999-trillion",
];

const allInventedFlagged = trulyInventedModels.every((id) => isSpeculativeOrInventedModel(id));
assert(allInventedFlagged, "All truly invented model identifiers flagged as invented");

const allInventedRejected = trulyInventedModels.every((id) => !isModelAuthoritative(id));
assert(allInventedRejected, "All truly invented model identifiers rejected from authoritative catalog");

// ▶ Gate 2b: Documented Model Family Recognition (gpt-5 Regression Test)
console.log("\n▶ Gate 2b: Documented Model Family Recognition (gpt-5 Regression Test)");
assert(!isSpeculativeOrInventedModel("gpt-5"), "REGRESSION TEST: 'gpt-5' is NOT classified as fictitious or speculative");
assert(!isSpeculativeOrInventedModel("gpt-5-codex"), "REGRESSION TEST: 'gpt-5-codex' is NOT classified as fictitious");
assert(isModelAuthoritative("gpt-5"), "REGRESSION TEST: 'gpt-5' is authoritative documented provider family");

const gpt5Decision = governModelSelection("gpt-5");
assert(gpt5Decision.status === "DOCUMENTED_UNAVAILABLE", "gpt-5 is honestly classified as DOCUMENTED_UNAVAILABLE");
assert(gpt5Decision.targetPreserved === true, "gpt-5 user target preserved verbatim (no silent substitution)");
assert(!gpt5Decision.advisory?.includes("speculative"), "Advisory does NOT misclassify gpt-5 as speculative/fictitious");
assert(gpt5Decision.suggestedAlternative === "gpt-4o", "Suggests active frontier alternative gpt-4o");

// Adaptation with consent
const gpt5Adapted = governModelSelection("gpt-5", { explicitUserConsent: true });
assert(gpt5Adapted.status === "ADAPTED_WITH_CONSENT", "gpt-5 adapts to active alternative when explicit consent is provided");
assert(gpt5Adapted.effectiveModelId === "gpt-4o", "Adapted to active alternative gpt-4o per user consent");

// ▶ Gate 3: Invariant Preservation — NO Silent Replacement of User Targets
console.log("\n▶ Gate 3: Invariant Preservation — NO Silent Replacement of User Targets");

// User requests GPT-4o for reproducibility
const gpt4oDecision = governModelSelection("gpt-4o");
assert(gpt4oDecision.targetPreserved === true, "User target 'gpt-4o' strictly preserved (not silently substituted)");
assert(gpt4oDecision.effectiveModelId === "gpt-4o", "Effective model matches requested target verbatim");

// User requests Claude 3 Opus
const opusDecision = governModelSelection("claude-3-opus-20240229");
assert(opusDecision.targetPreserved === true, "User target 'claude-3-opus' preserved verbatim");
assert(opusDecision.effectiveModelId === "claude-3-opus-20240229", "Effective model is Claude 3 Opus");

// ▶ Gate 4: Capability-Based Suitability & Consent-Gated Adaptation
console.log("\n▶ Gate 4: Capability-Based Suitability & Consent-Gated Adaptation");

// Task requires thinking, but GPT-4o does not have thinking
const gpt4oThinkingCheck = governModelSelection("gpt-4o", {
  requiredCapabilities: ["supportsThinking"],
});
assert(gpt4oThinkingCheck.capabilityAudit.satisfied === false, "Detected GPT-4o lacks required capability 'supportsThinking'");
assert(gpt4oThinkingCheck.targetPreserved === true, "Without user consent, target remains GPT-4o with transparent advisory");
assert(gpt4oThinkingCheck.suggestedAlternative === "o3-mini", "Suggested compatible alternative is o3-mini");

// With explicit user consent, adaptation is authorized
const gpt4oAuthorizedAdaptation = governModelSelection("gpt-4o", {
  requiredCapabilities: ["supportsThinking"],
  explicitUserConsent: true,
});
assert(gpt4oAuthorizedAdaptation.targetPreserved === false, "With explicit consent, adaptation applied");
assert(gpt4oAuthorizedAdaptation.effectiveModelId === "o3-mini", "Adapted to o3-mini per explicit consent");
assert(gpt4oAuthorizedAdaptation.status === "ADAPTED_WITH_CONSENT", "Status marked ADAPTED_WITH_CONSENT");

// ▶ Gate 5: Rejection of Invented Models in Currency Assertion
console.log("\n▶ Gate 5: Rejection of Invented Models in Currency Assertion");
let assertedError = false;
try {
  assertModelCurrency("fictional-hyper-ai-9000", "TestExecution");
} catch (err) {
  assertedError = err.message.includes("Speculative or invented model identifier 'fictional-hyper-ai-9000' rejected");
}
assert(assertedError, "assertModelCurrency throws on truly invented model 'fictional-hyper-ai-9000'");

let authoritativeAssertPass = false;
try {
  assertModelCurrency("claude-3-7-sonnet-20250219", "TestExecution");
  authoritativeAssertPass = true;
} catch {
  authoritativeAssertPass = false;
}
assert(authoritativeAssertPass, "assertModelCurrency passes cleanly on documented model 'claude-3-7-sonnet-20250219'");

let gpt5AssertPass = false;
try {
  assertModelCurrency("gpt-5", "TestExecution");
  gpt5AssertPass = true;
} catch {
  gpt5AssertPass = false;
}
assert(gpt5AssertPass, "assertModelCurrency passes on documented provider family 'gpt-5'");

// ▶ Gate 6: Documented Older Model Preservation & Consent Gating
console.log("\n▶ Gate 6: Documented Older Model Preservation & Consent Gating");
// User deliberately targets older GPT-4 for reproducibility
const gpt4Preserved = governModelSelection("gpt-4");
assert(gpt4Preserved.targetPreserved === true, "Older model target 'gpt-4' strictly preserved verbatim");
assert(gpt4Preserved.effectiveModelId === "gpt-4", "Effective model remains 'gpt-4' without silent substitution");
assert(gpt4Preserved.status === "AUTHORIZED_PRESERVED_OLDER", "Status is AUTHORIZED_PRESERVED_OLDER");
assert(gpt4Preserved.suggestedAlternative === "gpt-4o", "Recommends active successor gpt-4o");
assert(gpt4Preserved.advisory?.includes("Preserved verbatim for reproducibility"), "Transparent advisory explains reproducibility preservation");

// With explicit user consent, older GPT-4 adapts to active successor GPT-4o
const gpt4Adapted = governModelSelection("gpt-4", { explicitUserConsent: true });
assert(gpt4Adapted.targetPreserved === false, "Target modified with explicit consent");
assert(gpt4Adapted.effectiveModelId === "gpt-4o", "Adapted to active successor gpt-4o with consent");
assert(gpt4Adapted.status === "ADAPTED_WITH_CONSENT", "Status marked ADAPTED_WITH_CONSENT");

// Documented Claude 2.0 preservation
const claude2Preserved = governModelSelection("claude-2");
assert(claude2Preserved.targetPreserved === true, "Older model target 'claude-2' preserved verbatim");
assert(claude2Preserved.status === "AUTHORIZED_PRESERVED_OLDER", "Status marked AUTHORIZED_PRESERVED_OLDER");

// ▶ Gate 7: Strict Canonical Matching (Zero Loose Substring Matches)
console.log("\n▶ Gate 7: Strict Canonical Matching (Zero Loose Substring Matches)");
assert(isModelAuthoritative("gpt") === false, "Substring 'gpt' rejected from authoritative catalog");
assert(isModelAuthoritative("sonnet") === false, "Substring 'sonnet' rejected from authoritative catalog");
assert(isModelAuthoritative("llama") === false, "Substring 'llama' rejected from authoritative catalog");

console.log("\n------------------------------------------------------------------------");
console.log(`Results: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) {
  process.exit(1);
}
console.log("🎉 Model Governance & Invariant Preservation Verified!");

