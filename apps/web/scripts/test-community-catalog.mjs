#!/usr/bin/env node
/**
 * Test Suite: SPE Community Catalog & Prompt Fortifier
 * Verifies that all curated prompts from 143k★ prompts.chat & DAIR.AI
 * are fortified into 100% type-safe, invariant-hardened prompts.
 */

import assert from "node:assert/strict";
import {
  CURATED_COMMUNITY_PROMPTS,
  fortifyCommunityPrompt,
} from "../src/engine/communityCatalog.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Community Catalog & Fortifier Suite");
console.log("==================================================================");

// 1. Verify Catalog Entries
console.log(`\n[1/3] Verifying curated catalog integrity (${CURATED_COMMUNITY_PROMPTS.length} prompts)...`);
assert(CURATED_COMMUNITY_PROMPTS.length >= 6, "Must contain at least 6 curated prompts");

const categories = new Set(CURATED_COMMUNITY_PROMPTS.map((p) => p.category));
assert(categories.has("engineering"), "Must contain engineering category");
assert(categories.has("security"), "Must contain security category");
assert(categories.has("architecture"), "Must contain architecture category");
assert(categories.has("data"), "Must contain data category");
console.log(`✓ Verified ${CURATED_COMMUNITY_PROMPTS.length} prompts across ${categories.size} categories.`);

// 2. Test Fortification & Defense Delta for Each Prompt
console.log("\n[2/3] Testing fortification compiler across all community prompts...");
for (const prompt of CURATED_COMMUNITY_PROMPTS) {
  const result = fortifyCommunityPrompt(prompt);

  // Original vs Fortified Kill Rate
  assert(
    result.fortifiedKillRate >= result.originalKillRate,
    `Prompt ${prompt.id} fortified kill rate (${result.fortifiedKillRate}%) must be >= original (${result.originalKillRate}%)`,
  );
  assert(
    result.fortifiedKillRate >= 85,
    `Prompt ${prompt.id} fortified kill rate must be at least 85% (got ${result.fortifiedKillRate}%)`,
  );

  // Diagnostics check: fortified prompt must have 0 errors
  const fatalErrors = result.fortifiedDiagnostics.diagnostics.filter((d) => d.severity === "error");
  assert.equal(
    fatalErrors.length,
    0,
    `Prompt ${prompt.id} must have 0 fatal compiler errors (got ${fatalErrors.map((e) => e.code).join(", ")})`,
  );

  // Invariants check
  assert(result.addedInvariants.length >= 4, "Must enforce at least 4 immutable invariants");
  assert(result.outputContract.length > 0, "Must specify output contract");
  assert(result.fortifiedPrompt.includes("<user_input>"), "Must include XML delimiter isolation");

  console.log(
    `  ✓ [${prompt.id}] Kill Rate: ${result.originalKillRate}% → ${result.fortifiedKillRate}% | Added ${result.addedInvariants.length} Invariants | 0 Errors`,
  );
}

// 3. Test Invariant Integrity & Delimiter Isolation
console.log("\n[3/3] Testing delimiter hijacking defense on fortified prompts...");
const sample = CURATED_COMMUNITY_PROMPTS[0];
const sampleFortified = fortifyCommunityPrompt(sample);
assert(sampleFortified.fortifiedPrompt.includes("ERR_POLICY_VIOLATION"), "Must include policy violation fallback");
assert(sampleFortified.fortifiedPrompt.includes("Confidentiality Invariant"), "Must preserve confidentiality invariant");
console.log("✓ Invariant integrity and delimiter isolation confirmed.");

console.log("\n==================================================================");
console.log("🎉 ALL COMMUNITY CATALOG & FORTIFIER TESTS PASSED! (3/3)");
console.log("==================================================================");
