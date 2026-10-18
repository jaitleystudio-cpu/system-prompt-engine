#!/usr/bin/env node
/**
 * SPE Omega P0 — prevent unexecuted plans from manufacturing proof.
 *
 * Run from apps/web:
 *   node --experimental-strip-types scripts/test-unexecuted-proof-boundary.mjs
 *
 * These tests exercise fail-closed behavior only. They DO NOT prove the
 * connected Living .spe runtime, real AI provider, or browser execution.
 */
import assert from "node:assert/strict";
import { RootCauseRepairEngine } from "../src/engine/evolution/rootCauseRepairEngine.ts";
import { ProofCarryingEvolutionController } from "../src/engine/evolution/proofCarryingEvolution.ts";

const repair = new RootCauseRepairEngine();
const candidate = repair.diagnoseAndPrepareRepair({
  category: "BROKEN_INTERNAL_LINK",
  reportedSymptom: "The link /old-route has no resolved view.",
  context: { brokenHref: "/old-route", authoritativeDestination: "/create" },
});
assert.ok(candidate.failingTestCode.length > 0, "A reproduction test is proposed");
assert.equal(
  candidate.failingTestBeforeFix.reproduced,
  false,
  "Generating a test must not certify that the test was executed",
);
assert.match(candidate.failingTestBeforeFix.failingOutput, /NOT_EXECUTED/);

const proof = new ProofCarryingEvolutionController();
const unexecutedProposal = {
  observedEvidence: { confidenceScore: 1, isFinalized: true },
  failingTestBeforeFix: candidate.failingTestBeforeFix,
};
const releaseVerdict = proof.evaluateReleaseAuthority(unexecutedProposal);
assert.equal(releaseVerdict.status, "REJECTED");
assert.equal(releaseVerdict.authorizedForLiveDeploy, false);

const rollback = proof.executeRollbackDemonstration({
  rollbackReference: {
    snapshotCommit: "a".repeat(40),
    rollbackRecipe: "git revert ...",
    verifiedRollbackCapable: false,
  },
});
assert.equal(rollback.success, false, "A rollback description is not an executed rollback");
assert.equal(rollback.restoredCommit, "", "Do not claim any revision was actually restored");
assert.equal(rollback.receiptId, "", "Do not mint synthetic execution receipts");
assert.match(rollback.details, /NOT_EXECUTED/);

// A malicious or buggy model may set every boolean to true. That still must
// not give this legacy staging controller authority to perform a live release.
const selfAssertedPass = {
  defectCategory: "BROKEN_INTERNAL_LINK",
  riskLevel: "LOW",
  observedEvidence: { confidenceScore: 1, isFinalized: true },
  failingTestBeforeFix: { testName: "fake", failingOutput: "claimed", reproduced: true },
  qualificationResults: {
    oracleIntegrityPreserved: true,
    targetedUnitTestsPassed: true,
    regressionSuitePassed: true,
    securityPolicyPassed: true,
    visualA11yPassed: true,
    seoPolicyPassed: true,
    antiMutationKillRate: 1,
  },
  rollbackReference: { verifiedRollbackCapable: true },
};
const selfAssertionVerdict = proof.evaluateReleaseAuthority(selfAssertedPass);
assert.equal(selfAssertionVerdict.status, "PATCH_PREPARED");
assert.equal(selfAssertionVerdict.authorizedForLiveDeploy, false);
assert.match(selfAssertionVerdict.auditLog.join(" "), /RELEASE_AUTHORITY_HOLD/);

const missingReproduction = proof.evaluateReleaseAuthority({
  ...selfAssertedPass,
  failingTestBeforeFix: undefined,
});
assert.equal(missingReproduction.status, "REJECTED");
assert.equal(missingReproduction.authorizedForLiveDeploy, false);

console.log("PASS: unexecuted reproduction, rollback, and self-asserted release claims remain unqualified");
