/**
 * SPE Ω — Two-Sided Evidence Adjudicator (TSEA) & Evaluator Authority Firewall (EAF) Test Battery
 */

import assert from "node:assert/strict";
import {
  registerEvaluatorAuthority,
  verifyEvaluatorIntegrity,
} from "../src/engine/evaluatorAuthorityFirewall.ts";
import {
  synthesizeHostileMutants,
  evaluateSide1FalseAcceptance,
  evaluateSide2FalseRejection,
  selectMinimumDecisiveProbe,
  adjudicateTwoSidedEvidence,
} from "../src/engine/twoSidedEvidenceAdjudicator.ts";

console.log("⚖️ Running Two-Sided Evidence Adjudicator Test Battery...\n");

// ─── GATE 1: Evaluator Authority Firewall (Anti-Reward Hacking) ───────────────
console.log("Gate 1: Verifying Evaluator Authority Firewall (EAF)...");

const originalFixtures = [
  {
    fixtureId: "test_invariant_security",
    path: "tests/fixtures/security_test.ts",
    content: "expect(result.tokenSecret).toBeUndefined(); expect(result.authorized).toBe(true);",
    isCriticalAssertion: true,
  },
  {
    fixtureId: "test_boundary_payment",
    path: "tests/fixtures/payment_test.ts",
    content: "expect(result.balance).toBeGreaterThanOrEqual(0);",
    isCriticalAssertion: true,
  },
];

const envelope = registerEvaluatorAuthority("AUTH-SUITE-2026", originalFixtures);
assert.equal(envelope.fixtures.length, 2);
assert.equal(typeof envelope.combinedFixtureDigest, "string");

// Sub-gate 1.1: Unmodified fixtures pass cleanly
const cleanVerdict = verifyEvaluatorIntegrity(envelope, originalFixtures);
assert.equal(cleanVerdict.authorityPreserved, true);
assert.equal(cleanVerdict.verdict, "AUTHORITY_PRESERVED");
console.log("  ✓ Unmodified evaluator fixtures verified (Authority Preserved).");

// Sub-gate 1.2: Agent attempting to weaken assertion is blocked (Reward Hacking defense)
const tamperedFixtures = [
  {
    fixtureId: "test_invariant_security",
    path: "tests/fixtures/security_test.ts",
    content: "assert True # tampered by agent to pass without checking secret",
    isCriticalAssertion: true,
  },
  originalFixtures[1],
];

const tamperedVerdict = verifyEvaluatorIntegrity(envelope, tamperedFixtures);
assert.equal(tamperedVerdict.authorityPreserved, false);
assert.equal(tamperedVerdict.verdict, "AUTHORITY_BREACH_DETECTED");
assert.ok(tamperedVerdict.violations.some((v) => v.violationType === "THRESHOLD_RELAXED"));
console.log("  ✓ Hostile oracle weakening / reward hacking detected and blocked.");

// ─── GATE 2: Side 1 — Anti-False-Acceptance (Hostile Mutant Testing) ──────────
console.log("\nGate 2: Verifying Side 1 Anti-False-Acceptance (Kill Rate >= 0.95)...");

const sampleCandidateCode = `
function transferFunds(account, amount) {
  if (amount <= 0 || account.balance < amount) {
    return { success: false, reason: "INVALID_AMOUNT" };
  }
  account.balance -= amount;
  account.updatedAt = Date.now();
  return { success: true, newBalance: account.balance };
}
`;

const mutants = synthesizeHostileMutants(sampleCandidateCode);
assert.ok(mutants.length >= 5);

// Test runner that correctly tests mutants
const strictTestRunner = (code) => {
  // If the mutant is broken, a test should FAIL (return false).
  // A test passes only on correct code with proper conditions, balance mutation, and return.
  if (
    code.includes("!==") ||
    code.includes(">=") ||
    code.includes("return null") ||
    code.includes("-99999") ||
    code.includes("MUTANT_FAULT_INJECTION") ||
    !code.includes("account.balance -=")
  ) {
    return false; // Mutant caught!
  }
  return true;
};

const side1Result = evaluateSide1FalseAcceptance(mutants, strictTestRunner);
assert.equal(side1Result.side1Qualified, true);
assert.ok(side1Result.mutationKillRate >= 0.95);
console.log(`  ✓ Hostile mutation kill rate: ${side1Result.mutationKillRate * 100}% (>= 95% qualification threshold).`);

// Lucky pass detection when test suite is too weak
const leakyTestRunner = (code) => true; // Always passes everything!
const leakyResult = evaluateSide1FalseAcceptance(mutants, leakyTestRunner);
assert.equal(leakyResult.side1Qualified, false);
assert.equal(leakyResult.mutantsSurvived, mutants.length);
console.log("  ✓ Lucky pass vulnerability detected when verifier is defective.");

// ─── GATE 3: Side 2 — Anti-False-Rejection (Inferred Constraint Relaxation) ───
console.log("\nGate 3: Verifying Side 2 Anti-False-Rejection (ACL 2026 Protocol)...");

const constraints = [
  {
    constraintId: "HARD_SEC_NO_SECRET_LEAK",
    isHardInvariant: true,
    description: "System must never output customer private key",
    violatedByCandidate: false,
    relaxableWithoutIntentViolation: false,
  },
  {
    constraintId: "HARD_LOGIC_NON_NEGATIVE",
    isHardInvariant: true,
    description: "Account balance must never be negative",
    violatedByCandidate: false,
    relaxableWithoutIntentViolation: false,
  },
  {
    constraintId: "SOFT_SYNTAX_JSON_KEY_ORDER",
    isHardInvariant: false,
    description: "Expected exact field ordering '{\"a\": 1, \"b\": 2}'",
    violatedByCandidate: true, // Candidate output '{"b": 2, "a": 1}'
    relaxableWithoutIntentViolation: true,
  },
];

// Scenario A: Test failed, but ONLY soft incidental constraint was broken
const falseRejectionCheck = evaluateSide2FalseRejection({
  rawEvaluationPassed: false,
  constraints,
  candidateOutput: '{"b": 2, "a": 1}',
});

assert.equal(falseRejectionCheck.isFalseRejectionDetected, true);
assert.equal(falseRejectionCheck.remediatedVerdict, "FALSE_REJECTION_REMEDIATED");
console.log("  ✓ False rejection detected: valid solution recovered after relaxing unstated syntactic constraint.");

// Scenario B: Test failed and HARD invariant was broken
const hardViolatingConstraints = [
  {
    ...constraints[0],
    violatedByCandidate: true, // Leaked secret!
  },
  constraints[1],
  constraints[2],
];

const trueFailureCheck = evaluateSide2FalseRejection({
  rawEvaluationPassed: false,
  constraints: hardViolatingConstraints,
  candidateOutput: "leaked_secret_here",
});

assert.equal(trueFailureCheck.isFalseRejectionDetected, false);
assert.equal(trueFailureCheck.remediatedVerdict, "CONFIRMED_TRUE_FAILURE");
console.log("  ✓ Confirmed True Failure when hard security boundary is breached.");

// ─── GATE 4: Minimum Decisive Experiment Selection (MDES) ─────────────────────
console.log("\nGate 4: Verifying Minimum Decisive Experiment Selection (MDES)...");

const candidateProbes = [
  {
    probeId: "PROBE-HEAVY-FUZZ",
    hypothesis: "Test 100,000 random permutations",
    stimulusCode: "runHeavyFuzz()",
    expectedInformationGainDeltaH: 0.85,
    estimatedCostTokens: 50000,
    costEfficiency: 0.85 / 50000, // 0.000017
  },
  {
    probeId: "PROBE-DECISIVE-METAMORPHIC",
    hypothesis: "Targeted boundary perturbation on amount = -1 and null",
    stimulusCode: "testBoundary(-1, null)",
    expectedInformationGainDeltaH: 0.82,
    estimatedCostTokens: 250,
    costEfficiency: 0.82 / 250, // 0.00328 (192x higher efficiency!)
  },
];

const selectedProbe = selectMinimumDecisiveProbe(candidateProbes);
assert.ok(selectedProbe);
assert.equal(selectedProbe.probeId, "PROBE-DECISIVE-METAMORPHIC");
console.log(`  ✓ MDES selected optimal probe "${selectedProbe.probeId}" with ${Math.round(selectedProbe.costEfficiency * 100000) / 100} efficiency score.`);

// ─── GATE 5: End-to-End Two-Sided Adjudication Pipeline ───────────────────────
console.log("\nGate 5: Verifying End-to-End Two-Sided Adjudication Pipeline...");

const endToEndVerdict = adjudicateTwoSidedEvidence({
  adjudicationId: "ADJUDICATE-2026-001",
  authorityEnvelope: envelope,
  observedFixtures: originalFixtures,
  candidateCode: sampleCandidateCode,
  testRunner: strictTestRunner,
  rawEvaluationPassed: false,
  constraints,
  candidateProbes,
});

assert.equal(endToEndVerdict.firewallVerdict.authorityPreserved, true);
assert.equal(endToEndVerdict.side1Report.side1Qualified, true);
assert.equal(endToEndVerdict.finalEpistemicStatus, "REMEDIATED_FALSE_REJECTION");
assert.equal(endToEndVerdict.selectedDecisiveProbe?.probeId, "PROBE-DECISIVE-METAMORPHIC");
assert.equal(typeof endToEndVerdict.adjudicationDigest, "string");
assert.equal(endToEndVerdict.adjudicationDigest.length, 64);

console.log("  ✓ End-to-end adjudication completed with final status: REMEDIATED_FALSE_REJECTION.");
console.log("\n🎉 ALL TWO-SIDED EVIDENCE ADJUDICATOR GATES PASSED (100% QUALIFIED).\n");
