/**
 * Verification test battery for SPE Ω Frontier Model Currency Governor (FMCG)
 * Verifies Zero-Stale-Model Invariant and 2026 active frontier model enforcement.
 */

import {
  FRONTIER_ACTIVE_YEAR,
  FRONTIER_MODELS_2026,
  isModelCurrent,
  autoUpgradeLegacyModel,
  assertModelCurrency,
  getDefaultFrontierModel,
  getActiveFrontierModels,
} from "../src/engine/modelCurrencyGovernor.ts";
import {
  getAllModels,
  getModelById,
  getModelAtlasStats,
} from "../src/engine/modelAtlas/modelAtlasService.ts";

console.log("🧪 Running SPE Frontier Model Currency Governor (FMCG) Verification Battery...\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ▶ Gate 1: 2026 Active Frontier Year & Registry Integrity
console.log("▶ Gate 1: 2026 Active Frontier Year & Registry Integrity");
assert(FRONTIER_ACTIVE_YEAR === 2026, "Frontier active year is pinned to 2026");
assert(FRONTIER_MODELS_2026.length >= 18, `Frontier active model count is ${FRONTIER_MODELS_2026.length} (>= 18)`);
const all2026 = FRONTIER_MODELS_2026.every(
  (m) => m.releaseDate.startsWith("2026") && m.generation === "2026-frontier" && !m.isLegacy
);
assert(all2026, "All active frontier models have 2026 release dates and '2026-frontier' generation");

// ▶ Gate 2: Currency Check on 2026 Frontier Models
console.log("\n▶ Gate 2: Currency Check on 2026 Frontier Models");
const frontierSample = [
  "claude-4-5-sonnet",
  "claude-4-5-opus",
  "claude-4-5-haiku",
  "gpt-5",
  "gpt-5-codex",
  "o4-mini",
  "o3-pro",
  "gemini-3-pro",
  "gemini-3-flash",
  "grok-4",
  "deepseek-r2",
  "deepseek-v4",
  "llama-4-405b",
  "llama-4-70b",
  "midjourney-v7",
  "flux-2-pro",
];
const allFrontierValid = frontierSample.every((id) => isModelCurrent(id));
assert(allFrontierValid, "All 2026 frontier models pass currency check");

// ▶ Gate 3: Currency Check Rejection of Obsolete 2024/2025 Models
console.log("\n▶ Gate 3: Currency Check Rejection of Obsolete 2024/2025 Models");
const obsoleteModels = [
  "claude-3-opus",
  "claude-3-5-sonnet",
  "claude-3-7-sonnet",
  "gpt-4",
  "gpt-4o",
  "gpt-4.5-preview",
  "o1",
  "o3-mini",
  "gemini-1-5-pro",
  "gemini-2-0-flash",
  "grok-2",
  "grok-3",
  "deepseek-r1",
  "deepseek-v3",
  "llama-3-3-70b",
];
const allObsoleteRejected = obsoleteModels.every((id) => !isModelCurrent(id));
assert(allObsoleteRejected, "All obsolete 2024/2025 models are rejected as active frontier");

// ▶ Gate 4: Lossless Legacy-to-Frontier Upgrades
console.log("\n▶ Gate 4: Lossless Legacy-to-Frontier Upgrades");
const upgradeExpectations = [
  ["claude-3-7-sonnet", "claude-4-5-sonnet"],
  ["claude-3.7-sonnet", "claude-4-5-sonnet"],
  ["claude-3-5-sonnet", "claude-4-5-sonnet"],
  ["gpt-4.5-preview", "gpt-5"],
  ["gpt-4o", "gpt-5"],
  ["o3-mini", "o4-mini"],
  ["gemini-1.5-pro", "gemini-3-pro"],
  ["gemini-2.0-flash", "gemini-3-flash"],
  ["grok-3", "grok-4"],
  ["deepseek-r1", "deepseek-r2"],
  ["deepseek-v3", "deepseek-v4"],
  ["llama-3.3-70b", "llama-4-70b"],
  ["midjourney-v6.1", "midjourney-v7"],
];
let allUpgradesCorrect = true;
for (const [legacyId, expected2026] of upgradeExpectations) {
  const result = autoUpgradeLegacyModel(legacyId);
  if (!result.wasLegacy || result.upgradedId !== expected2026) {
    allUpgradesCorrect = false;
    console.error(`Mismatch for ${legacyId}: got ${result.upgradedId}, expected ${expected2026}`);
  }
}
assert(allUpgradesCorrect, "All obsolete models transparently upgrade to 2026 successors");

// ▶ Gate 5: Strict Currency Assertion Gate
console.log("\n▶ Gate 5: Strict Currency Assertion Gate");
let assertionPassed = true;
try {
  assertModelCurrency("claude-4-5-sonnet");
  assertModelCurrency("gpt-5");
  assertModelCurrency("gemini-3-pro");
} catch {
  assertionPassed = false;
}
assert(assertionPassed, "2026 frontier models satisfy currency assertion");

let assertionRejected = false;
try {
  assertModelCurrency("claude-3-7-sonnet");
} catch (e) {
  assertionRejected = e.message.includes("CURRENCY_GATE_VIOLATION");
}
assert(assertionRejected, "Obsolete model throws CURRENCY_GATE_VIOLATION with upgrade advice");

// ▶ Gate 6: Model Atlas Service Default Filter (Active Only)
console.log("\n▶ Gate 6: Model Atlas Service Default Filter (Active Only)");
const defaultModels = getAllModels();
const allDefaultAreActive = defaultModels.every((m) => !m.isLegacy && m.generation === "2026-frontier");
assert(allDefaultAreActive, "getAllModels() returns strictly 2026 frontier models by default");

const allIncludingLegacy = getAllModels({ includeLegacy: true });
assert(
  allIncludingLegacy.length > defaultModels.length,
  `getAllModels({ includeLegacy: true }) preserves audit history (${allIncludingLegacy.length} total)`
);

// ▶ Gate 7: Transparent Model Lookup Auto-Upgrade
console.log("\n▶ Gate 7: Transparent Model Lookup Auto-Upgrade");
const retrieved = getModelById("claude-3-7-sonnet");
assert(retrieved && retrieved.id === "claude-4-5-sonnet", "getModelById('claude-3-7-sonnet') resolves to Claude 4.5 Sonnet");

const retrievedGpt = getModelById("gpt-4o");
assert(retrievedGpt && retrievedGpt.id === "gpt-5", "getModelById('gpt-4o') resolves to GPT-5");

// ▶ Gate 8: Model Atlas Stats Reporting
console.log("\n▶ Gate 8: Model Atlas Stats Reporting");
const stats = getModelAtlasStats();
assert(stats.frontierCount >= 18, `Atlas reports ${stats.frontierCount} active frontier models`);
assert(stats.lastUpdated.startsWith("2026"), `Atlas lastUpdated is in 2026 (${stats.lastUpdated})`);

console.log("\n═══════════════════════════════════════════════════════════════");
if (failed === 0) {
  console.log(`🎉 ALL ${passed} FRONTIER MODEL CURRENCY GATES PASSED CLEANLY!`);
  process.exit(0);
} else {
  console.error(`💥 ${failed} GATES FAILED!`);
  process.exit(1);
}
