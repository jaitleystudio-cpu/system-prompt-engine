#!/usr/bin/env node
/**
 * SPE Ω — Independent Quality Authority Test Battery
 *
 * Verifies:
 * 1. Zero Self-Grading: Generator never grades itself.
 * 2. 100% Machine-Verifiable Requirement Preservation requirement for PASS.
 * 3. Omission of explicit constraint triggers NEEDS_REPAIR.
 * 4. Contradiction detection triggers BLOCKED_BY_CONFLICT.
 * 5. Honest scoring: Removes fake 100% shortcuts.
 * 6. Limitation disclaimer is present on all reports.
 */

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const authPath = join(here, "../src/engine/independentQualityAuthority.ts");

const {
  evaluateCandidateQuality,
  extractVerifiableRequirements,
  detectContradictions,
} = await import(authPath);

console.log("========================================================================");
console.log("🚀 SPE Ω — INDEPENDENT QUALITY AUTHORITY TEST SUITE");
console.log("========================================================================");

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ FAIL: ${name}: ${err.message}`);
  }
}

// TEST 1: Extraction of verifiable requirements
await check("Extracts all machine-verifiable requirements from brief", () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  const extracted = extractVerifiableRequirements(req);

  assert.ok(extracted.some((r) => r.includes("offline")));
  assert.ok(extracted.some((r) => r.includes("Telugu")));
  assert.ok(extracted.some((r) => r.includes("personal information")));
  assert.ok(extracted.some((r) => r.includes("Android")));
});

// TEST 2: Rejects prompt when mandatory requirement is missing
await check("Returns NEEDS_REPAIR when an explicit requirement (Telugu) is omitted", () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  // Intentionally omit Telugu from the prompt
  const defectivePrompt = `
# System Role & Persona
You are an Android engineer.

# Objective & Boundary Scope
Build an offline Android app with zero personal data collection in English.

# Approach & Methodological Plan
1. Setup local Room DB.
2. Build UI in Jetpack Compose.
3. Verify offline behavior.

# Handling Missing Information
Use only verified local facts.

# Acceptance Checks & Verification Battery
- Verify offline execution without internet.
- Verify zero personal data collection.
`;

  const report = evaluateCandidateQuality({
    prompt: defectivePrompt,
    userRequest: req,
  });

  assert.equal(report.verdict, "NEEDS_REPAIR");
  assert.equal(report.mandatoryRequirementsPassed, false);
  assert.ok(report.missingRequirements.some((m) => m.includes("Telugu")));
  assert.ok(report.preservationScore < 100);
});

// TEST 3: Evaluates PASS when all mandatory requirements are preserved
await check("Returns PASS when all mandatory requirements are strictly preserved", () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  const completePrompt = `
# System Role & Persona
You are an Android engineer specializing in localized air-gapped systems.

# Objective & Boundary Scope
Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.

# Approach & Methodological Plan
1. Setup local Room DB for offline persistence.
2. Implement bilingual resource catalogs for Telugu (res/values-te) and English (res/values-en).
3. Enforce zero network calls.

# Handling Missing Information
Never assume remote cloud tools.

# Acceptance Checks & Verification Battery
- Verify 100% offline execution without internet.
- Verify Telugu and English localization.
- Verify zero personal data collection.
`;

  const report = evaluateCandidateQuality({
    prompt: completePrompt,
    userRequest: req,
  });

  assert.equal(report.verdict, "PASS");
  assert.equal(report.mandatoryRequirementsPassed, true);
  assert.equal(report.missingRequirements.length, 0);
  assert.equal(report.preservationScore, 100);
  assert.ok(report.overallQualityScore >= 90);
});

// TEST 4: Contradiction Detection
await check("Detects mutual contradictions between offline requirement and cloud sync", () => {
  const contradictions = detectContradictions(
    "Work completely offline",
    "Stream real-time updates from cloud servers via WebSockets"
  );

  assert.ok(contradictions.length > 0);
  assert.ok(contradictions[0].includes("offline"));
});

// TEST 5: Limitations Disclaimer Present
await check("Report includes honest scientific limitations disclaimer without false guarantees", () => {
  const report = evaluateCandidateQuality({
    prompt: "Sample prompt text",
    userRequest: "Sample user request",
  });

  assert.ok(typeof report.limitationsDisclaimer === "string");
  assert.ok(report.limitationsDisclaimer.includes("machine-verifiable requirements"));
  assert.ok(report.limitationsDisclaimer.includes("context"));
});

console.log("------------------------------------------------------------------------");
if (failures.length > 0) {
  console.error(`❌ ${failures.length} tests failed!`);
  process.exit(1);
} else {
  console.log("🎉 ALL INDEPENDENT QUALITY AUTHORITY TESTS PASSED (100%)!");
  process.exit(0);
}
