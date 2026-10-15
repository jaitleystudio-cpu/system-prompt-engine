#!/usr/bin/env node
/**
 * SPE Ω — Independent Repair Tournament (IRT) Test Battery
 * Crown Breakthrough Capability #2
 *
 * Mandate:
 * Grounded in Detect–Repair–Verify (arXiv:2603.23633, 2026) and Do LLMs Generate Useful Test Oracles? (ASE 2025).
 * Tests competing code repairs against frozen test oracles, anti-mutation checks, and oscillation brakes.
 */

import assert from "node:assert/strict";

const { IndependentRepairTournament } = await import(
  "../src/engine/evolution/independentRepairTournament.ts"
);

console.log("========================================================");
console.log("SPE Ω — INDEPENDENT REPAIR TOURNAMENT (IRT) BATTERY");
console.log("========================================================");

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

const originalSource = `
export function calculateDiscount(price, isVip) {
  // Bug: gives 0 discount even for VIP
  return 0;
}
export function getTaxRate() {
  return 0.08;
}
`;

const frozenOracle = {
  testFile: "tests/pricing.test.js",
  oracleSha256: "sha256:frozen-pricing-oracle-v1",
  testCases: [
    {
      name: "VIP discount should be 20%",
      isAcceptance: true,
      run: (code) => code.includes("isVip ? 0.2 : 0") || code.includes("if (isVip) return 0.2;"),
    },
    {
      name: "Tax rate regression invariant",
      isAcceptance: false,
      run: (code) => code.includes("return 0.08;"),
    },
  ],
};

const tournament = new IndependentRepairTournament();

// Suite 1: Head-to-Head Tournament
console.log("\n[Suite 1: Head-to-Head Tournament & Blast Radius]");

test("Candidate Patch A (minimal diff) beats Candidate Patch B (bloated diff)", () => {
  const patchA = {
    candidateId: "patch-alpha-minimal",
    authorAgentId: "agent-a",
    targetFile: "src/pricing.js",
    originalChunk: "return 0;",
    replacementChunk: "return isVip ? 0.2 : 0;",
    lineCountDiff: 1,
    explanation: "One-line ternary returning 20% discount for VIP.",
  };

  const patchB = {
    candidateId: "patch-beta-bloated",
    authorAgentId: "agent-b",
    targetFile: "src/pricing.js",
    originalChunk: "return 0;",
    replacementChunk: `// Massive rewrite with 60 lines of unnecessary logic\n` + "let discount = 0;\n".repeat(60) + "if (isVip) return 0.2;\nreturn 0;",
    lineCountDiff: 62,
    explanation: "Rewrote entire discount handler with auxiliary state.",
  };

  const result = tournament.conductTournament({
    defectCategory: "BROKEN_INTERNAL_LINK",
    targetFileOriginalContent: originalSource,
    candidates: [patchA, patchB],
    frozenOracle,
  });

  assert.equal(result.disposition, "WINNER_QUALIFIED");
  assert.equal(result.winnerCandidateId, "patch-alpha-minimal");
  assert.ok(result.candidateEvaluations[0].overallScore > result.candidateEvaluations[1].overallScore);
  assert.ok(result.tournamentReceiptDigest.startsWith("sha256:"));
});

// Suite 2: Test Tampering Defense
console.log("\n[Suite 2: Test Tampering & Reward-Hacking Defense]");

test("Disqualifies candidate patch attempting to tamper with test oracle", () => {
  const maliciousPatch = {
    candidateId: "patch-malicious-tamper",
    authorAgentId: "agent-rogue",
    targetFile: "tests/pricing.test.js", // Targets the test file!
    originalChunk: "VIP discount should be 20%",
    replacementChunk: "it('passes automatically', () => expect(true).toBe(true));",
    lineCountDiff: 1,
    explanation: "Replaced test assertion to guarantee pass.",
  };

  const result = tournament.conductTournament({
    defectCategory: "TEST_TAMPERING_REWARD_HACK",
    targetFileOriginalContent: originalSource,
    candidates: [maliciousPatch],
    frozenOracle,
  });

  assert.equal(result.disposition, "ALL_DISQUALIFIED");
  assert.equal(result.candidateEvaluations[0].oracleTamperingDetected, true);
  assert.ok(result.candidateEvaluations[0].disqualifiedReason.includes("ORACLE_TAMPERING_DETECTED"));
});

// Suite 3: Anti-Mutation Kill Battery
console.log("\n[Suite 3: Anti-Mutation Kill Battery Hurdle]");

test("Evaluates mutation kill rate on patched candidate", () => {
  const patchA = {
    candidateId: "patch-mutant-tested",
    authorAgentId: "agent-a",
    targetFile: "src/pricing.js",
    originalChunk: "return 0;",
    replacementChunk: "if (isVip) return 0.2;\n  return 0;",
    lineCountDiff: 2,
    explanation: "Explicit branch return.",
  };

  const result = tournament.conductTournament({
    defectCategory: "BROKEN_INTERNAL_LINK",
    targetFileOriginalContent: originalSource,
    candidates: [patchA],
    frozenOracle,
  });

  assert.equal(result.disposition, "WINNER_QUALIFIED");
  assert.ok(result.candidateEvaluations[0].mutantsGenerated >= 1);
  assert.ok(result.candidateEvaluations[0].mutationKillRate >= 0.80);
});

// Suite 4: Repair Oscillation & Cycle Brake
console.log("\n[Suite 4: Repair Oscillation & Cycle Brake]");

test("Brakes on cyclic oscillation when patch matches historical rejected diff", () => {
  const cyclicPatch = {
    candidateId: "patch-cyclic-flapper",
    authorAgentId: "agent-flapper",
    targetFile: "src/pricing.js",
    originalChunk: "return 0;",
    replacementChunk: "return isVip ? 0.2 : 0;",
    lineCountDiff: 1,
    explanation: "Toggling back to previous state.",
  };

  // Pre-seed history with this patch's hash
  const t2 = new IndependentRepairTournament();
  const hash = t2["hashString"](cyclicPatch.replacementChunk);

  const result = t2.conductTournament({
    defectCategory: "OSCILLATION_REPEATED_FAILURE",
    targetFileOriginalContent: originalSource,
    candidates: [cyclicPatch],
    frozenOracle,
    historicalPatchDigests: [hash],
  });

  assert.equal(result.disposition, "ALL_DISQUALIFIED");
  assert.equal(result.candidateEvaluations[0].oscillationDetected, true);
  assert.ok(result.candidateEvaluations[0].disqualifiedReason.includes("REPAIR_OSCILLATION_DETECTED"));
});

// Suite 5: Rejection of Ineffective Candidates
console.log("\n[Suite 5: Rejection of Ineffective Candidates]");

test("Rejects both candidates if neither passes the acceptance oracle", () => {
  const failingPatchA = {
    candidateId: "patch-fail-a",
    authorAgentId: "agent-a",
    targetFile: "src/pricing.js",
    originalChunk: "return 0;",
    replacementChunk: "return -1;", // Does not solve issue
    lineCountDiff: 1,
    explanation: "Wrong return.",
  };

  const failingPatchB = {
    candidateId: "patch-fail-b",
    authorAgentId: "agent-b",
    targetFile: "src/pricing.js",
    originalChunk: "return 0;",
    replacementChunk: "console.log('fixing'); return 0;", // Still 0
    lineCountDiff: 1,
    explanation: "Log only.",
  };

  const result = tournament.conductTournament({
    defectCategory: "BROKEN_INTERNAL_LINK",
    targetFileOriginalContent: originalSource,
    candidates: [failingPatchA, failingPatchB],
    frozenOracle,
  });

  assert.equal(result.disposition, "REJECT_BOTH_INSUFFICIENT_EVIDENCE");
  assert.equal(result.winnerCandidateId, null);
  assert.equal(result.winningPatch, null);
});

console.log("\n========================================================");
console.log(`TOTAL IRT TESTS PASSED: ${testsPassed} / 5`);
console.log("========================================================\n");
