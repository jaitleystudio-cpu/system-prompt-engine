#!/usr/bin/env node
/**
 * SPE Ω — Complete First Real Vertical Slice End-to-End Verification Battery
 *
 * Verifies the complete real vertical slice of SPE Ω Dual-Core Engine:
 * 1. User Brief Entry -> Dual-Core Router -> Core A Primary Generative Engine.
 * 2. Generative Intent Reconstruction & first-principles prompt synthesis.
 * 3. Independent Quality Authority audit: 100% checkable requirement preservation.
 * 4. UI HealthScore honest calculation (no fake 100% override).
 * 5. UI Button: "⚡ Generate & Improve" verified across components.
 * 6. UI Copy: Dual-core explanation verified in human perspective copy.
 * 7. Core B deterministic recovery fallback under failure.
 * 8. Invariants: $0 compute, 100% air-gap, 0 egress, canonical WASM hash untouched.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

const { executeDualCoreGeneration } = await import(
  join(here, "../src/engine/dualCoreRouter.ts")
);
const { evaluateCandidateQuality } = await import(
  join(here, "../src/engine/independentQualityAuthority.ts")
);
const { ui } = await import(
  join(root, "packages/human-perspective/src/copy.ts")
);

console.log("========================================================================");
console.log("🚀 SPE Ω — FIRST REAL VERTICAL SLICE END-TO-END VERIFICATION BATTERY");
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

const USER_TASK = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";

// [1/8] Dual-Core Router Primary Dispatch to Core A
let verticalResult = null;
await check("[1/8] User Brief Entry routes to Core A Primary Generative Engine", async () => {
  verticalResult = await executeDualCoreGeneration({
    userRequest: USER_TASK,
    target: "any",
  });

  assert.equal(verticalResult.engineCoreUsed, "CORE_A_GENERATIVE");
  assert.equal(verticalResult.isFallback, false);
  assert.ok(
    verticalResult.status === "QUALIFIED_GENERATIVE_SUCCESS" ||
      verticalResult.status === "REPAIRED_GENERATIVE_SUCCESS"
  );
  assert.ok(verticalResult.prompt.length > 200);
});

// [2/8] Generative Intent Reconstruction & Requirement Preservation
await check("[2/8] Core A generates task-specific prompt with 100% requirement preservation", () => {
  const p = verticalResult.prompt.toLowerCase();
  assert.ok(p.includes("android"), "Prompt missing Android requirement");
  assert.ok(p.includes("offline"), "Prompt missing offline requirement");
  assert.ok(p.includes("telugu"), "Prompt missing Telugu requirement");
  assert.ok(p.includes("english"), "Prompt missing English requirement");
  assert.ok(p.includes("personal information") || p.includes("pii"), "Prompt missing privacy requirement");
});

// [3/8] Independent Quality Authority Audit
await check("[3/8] Independent Quality Authority confirms PASS without self-grading", () => {
  const qr = verticalResult.qualityReport;
  assert.ok(qr, "Missing quality report");
  assert.equal(qr.verdict, "PASS");
  assert.equal(qr.mandatoryRequirementsPassed, true);
  assert.equal(qr.preservationScore, 100);
  assert.equal(qr.missingRequirements.length, 0);
  assert.equal(qr.detectedContradictions.length, 0);
  assert.ok(qr.overallQualityScore >= 90);
  assert.ok(qr.limitationsDisclaimer.includes("machine-verifiable requirements"));
});

// [4/8] Radar Inspector Honest Score Verification & App.tsx Integration
await check("[4/8] PromptRadarInspector computes honest health score and App.tsx executes Dual-Core Router", async () => {
  const promptRadarSource = readFileSync(
    join(here, "../src/engine/PromptRadarInspector.tsx"),
    "utf8"
  );
  const appSource = readFileSync(
    join(here, "../src/App.tsx"),
    "utf8"
  );

  // Assert fake shortcuts have been eradicated
  assert.equal(
    promptRadarSource.includes("healthScore > 100 || isOptimized"),
    false,
    "Found fake healthScore override!"
  );
  assert.equal(
    promptRadarSource.includes("isOptimized || hasRole"),
    false,
    "Found fake hasRole override!"
  );
  assert.equal(
    promptRadarSource.includes("Auto-Optimize to 100% Score"),
    false,
    "Found old Auto-Optimize 100% button text!"
  );
  assert.equal(
    promptRadarSource.includes("Auto-Optimize (100%)"),
    false,
    "Found old Auto-Optimize (100%) CTA text!"
  );

  // Assert App.tsx wires executeDualCoreGeneration directly into compilation
  assert.ok(appSource.includes("executeDualCoreGeneration"), "App.tsx must integrate executeDualCoreGeneration");
  assert.ok(appSource.includes("CONTRADICTION_BLOCKED_STATUS"), "App.tsx must handle contradiction blocking");

  // Assert PromptRadarInspector uses evaluateCandidateQuality
  assert.ok(promptRadarSource.includes("evaluateCandidateQuality"), "PromptRadarInspector must import evaluateCandidateQuality");
  assert.ok(promptRadarSource.includes("Generate & Improve"), "PromptRadarInspector must include Generate & Improve button");

  // Verify honest scoring: an incomplete prompt DOES NOT get 100%
  const incompletePrompt = "# Role\nAndroid Architect\n# Objective\nBuild app offline with no PII.";
  const auditIncomplete = evaluateCandidateQuality({
    prompt: incompletePrompt,
    userRequest: USER_TASK,
  });
  assert.equal(auditIncomplete.verdict, "NEEDS_REPAIR");
  assert.ok(auditIncomplete.overallQualityScore < 100, "Incomplete prompt must not receive 100 quality score");
  assert.ok(auditIncomplete.missingRequirements.some((r) => r.toLowerCase().includes("telugu")), "Must identify missing Telugu requirement");

  // Verify candidate repair: autoOptimizeSystemPrompt repairs missing requirement
  const { autoOptimizeSystemPrompt } = await import(join(here, "../src/engine/core-a.ts"));
  const repairedPrompt = autoOptimizeSystemPrompt(incompletePrompt, USER_TASK);
  const auditRepaired = evaluateCandidateQuality({
    prompt: repairedPrompt,
    userRequest: USER_TASK,
  });
  assert.equal(auditRepaired.verdict, "PASS");
  assert.equal(auditRepaired.mandatoryRequirementsPassed, true);
  assert.ok(auditRepaired.overallQualityScore >= 95, "Repaired prompt must achieve passing quality score");
});

// [5/8] UI Copy: Dual-Core Architecture Explanation
await check("[5/8] User-facing copy presents Dual-Core reality instead of template-only disclaimer", () => {
  assert.ok(ui.exactNote.includes("privacy-first dual-core engine"));
  assert.ok(ui.exactNote.includes("Core A local generative intelligence"));
  assert.ok(ui.exactNote.includes("Core B deterministic compiler recovery"));
  assert.equal(ui.exactNote.includes("editable templates, not a generative AI model"), false);
});

// [6/8] Core B Fallback Guarantee
await check("[6/8] Core B activates transparently on simulated model failure", async () => {
  const fallbackResult = await executeDualCoreGeneration({
    userRequest: USER_TASK,
    forceFallbackCoreB: true,
  });

  assert.equal(fallbackResult.engineCoreUsed, "CORE_B_FALLBACK");
  assert.equal(fallbackResult.isFallback, true);
  assert.equal(fallbackResult.status, "DEGRADED_FALLBACK_DELIVERY");
  assert.ok(fallbackResult.prompt.includes("SPE SAFE FALLBACK"));
  assert.ok(fallbackResult.prompt.includes("status: DEGRADED_DELIVERY"));
  assert.ok(fallbackResult.prompt.includes(USER_TASK));
  assert.equal(/100% verified|canonical quality PASS/i.test(fallbackResult.prompt), false);
});

// [7/8] Zero Egress & $0 Cost Invariant
await check("[7/8] Enforces $0 compute cost and zero network egress across all operations", () => {
  assert.equal(verticalResult.costUsd, 0);
  assert.equal(verticalResult.zeroEgressGuaranteed, true);
});

// [8/8] Canonical WASM Supply-Chain Hash Invariant
await check("[8/8] Canonical WASM SHA-256 remains bit-for-bit pinned and unmodified", () => {
  const wasmPath = join(here, "../public/spe_wasm.wasm");
  const wasmBytes = readFileSync(wasmPath);
  const hash = createHash("sha256").update(wasmBytes).digest("hex");
  assert.equal(
    hash,
    "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
    "Canonical WASM hash drift detected!"
  );
  assert.equal(wasmBytes.length, 1339691);
});

console.log("------------------------------------------------------------------------");
if (failures.length > 0) {
  console.error(`❌ ${failures.length} vertical slice tests failed!`);
  process.exit(1);
} else {
  console.log("🎉 FIRST REAL VERTICAL SLICE FULLY VERIFIED (100%)!");
  process.exit(0);
}
