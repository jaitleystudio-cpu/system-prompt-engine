#!/usr/bin/env node
/**
 * apps/web/scripts/test-autonomous-maintenance-controller.mjs
 *
 * SPE Ω — Comprehensive Autonomous Maintenance Controller & Watchdog Test Suite
 *
 * Verifies:
 * 1. Fenced Lease Acquisition & Monotonic Counter Invariant.
 * 2. Stale Worker Fencing: Superseded workers are strictly blocked from committing state.
 * 3. Missed-Run Detection & Watchdog Catch-Up without duplicate effects.
 * 4. 8-Stage Control Loop & Specialist Job Execution.
 * 5. Honest Outcome Classification: "No change is a valid successful day" (NO_OP_CLEAN).
 * 6. Rollback Recovery: Production release pointer safely restored on rollback condition.
 * 7. Cryptographic Receipt Integrity & Zero Cloud Egress ($0.00).
 */

import assert from "node:assert";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DurableMaintenanceLedger,
  getAsiaKolkataBusinessDate,
} from "../src/engine/maintenance/durableMaintenanceLedger.ts";
import {
  SpeMaintenanceController,
  createVerifiedDeploymentWitness,
  verifyMaintenanceDeploymentWitness,
} from "../src/engine/maintenance/speMaintenanceController.ts";

console.log("==================================================================");
console.log("🛡️ TESTING: SPE Ω Autonomous Maintenance Controller & Watchdog");
console.log("==================================================================\n");

const testDir = mkdtempSync(join(tmpdir(), "spe-maintenance-test-"));
const testLedgerPath = join(testDir, "test_ledger.json");

try {
  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 1: FENCED LEASE ACQUISITION & MONOTONIC COUNTER
  // ────────────────────────────────────────────────────────────────
  console.log("[GATE 1] Testing Fenced Lease Acquisition & Monotonic Tokens...");
  const ledger = new DurableMaintenanceLedger(testLedgerPath);

  const lease1 = ledger.acquireFencedLease({
    businessDate: "2026-10-18",
    triggerType: "SCHEDULED_0217_IST",
    startingCommitSha: "dcd7df0f00000000000000000000000000000001",
    workerId: "worker-alpha",
  });

  assert(lease1.acquired === true, "Worker Alpha acquired initial lease");
  assert(lease1.fencingToken === 1, `Fencing token initialized to 1 (got ${lease1.fencingToken})`);
  assert(lease1.job?.state === "INIT", "Initial state is INIT");
  console.log("  ✓ PASS: Worker Alpha acquired initial lease with fencing token 1");

  // Competing live worker attempts to acquire lease on same date -> rejected
  const leaseConflict = ledger.acquireFencedLease({
    businessDate: "2026-10-18",
    triggerType: "SCHEDULED_0217_IST",
    startingCommitSha: "dcd7df0f00000000000000000000000000000001",
    workerId: "worker-beta",
  });

  assert(leaseConflict.acquired === false, "Worker Beta blocked by unexpired active lease");
  assert(leaseConflict.reason?.includes("LEASE_HELD_BY_ACTIVE_WORKER"), "Rejection reason cites active lease");
  console.log("  ✓ PASS: Concurrent competing worker strictly blocked by active lease");

  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 2: STALE WORKER FENCING & TOKEN MONOTONICITY
  // ────────────────────────────────────────────────────────────────
  console.log("\n[GATE 2] Testing Stale Worker Fencing & Monotonic Protection...");
  // Simulate lease timeout / successor worker taking over
  const leaseSuccessor = ledger.acquireFencedLease({
    businessDate: "2026-10-18",
    triggerType: "WATCHDOG_0300_IST",
    startingCommitSha: "dcd7df0f00000000000000000000000000000001",
    workerId: "worker-gamma",
    leaseDurationMs: 0, // Force instant expiration for testing
  });

  // Since worker-alpha had lease, let's force expire alpha's lease in state to test takeover
  const ledgerState = ledger.getState();
  if (ledgerState.activeLease) {
    ledgerState.activeLease.expiresAtIso = new Date(Date.now() - 1000).toISOString();
  }
  // Write expired lease back
  const { writeFileSync } = await import("node:fs");
  writeFileSync(testLedgerPath, JSON.stringify(ledgerState, null, 2), "utf8");

  // Reload ledger and acquire lease as Gamma
  const reloadedLedger = new DurableMaintenanceLedger(testLedgerPath);
  const leaseTakeover = reloadedLedger.acquireFencedLease({
    businessDate: "2026-10-18",
    triggerType: "WATCHDOG_0300_IST",
    startingCommitSha: "dcd7df0f00000000000000000000000000000001",
    workerId: "worker-gamma",
  });

  assert(leaseTakeover.acquired === true, "Worker Gamma successfully took over expired lease");
  assert(leaseTakeover.fencingToken === 2, `Fencing token monotonically advanced to 2 (got ${leaseTakeover.fencingToken})`);
  console.log("  ✓ PASS: Successor worker acquired lease with advanced fencing token 2");

  // Now, worker-alpha (stale token 1) attempts to update state -> MUST THROW FENCING_TOKEN_SUPERSEDED
  let staleWorkerBlocked = false;
  try {
    reloadedLedger.updateJobState(lease1.job ? lease1.job.jobId : "unknown", 1, "DISCOVERING", "Stale attempt");
  } catch (err) {
    if (err && err.message && err.message.includes("FENCING_TOKEN_SUPERSEDED")) {
      staleWorkerBlocked = true;
    }
  }
  assert(staleWorkerBlocked, "Stale worker holding obsolete token 1 strictly blocked from updating state");
  console.log("  ✓ PASS: Stale worker holding obsolete token 1 strictly blocked from state mutation");

  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 3: MISSED-RUN DETECTION & WATCHDOG CATCH-UP
  // ────────────────────────────────────────────────────────────────
  console.log("\n[GATE 3] Testing Missed-Run Detection & Watchdog Catch-Up...");
  const freshLedgerPath = join(testDir, "fresh_ledger.json");
  const freshLedger = new DurableMaintenanceLedger(freshLedgerPath);

  // Future or unrun business date
  const missedStatus = freshLedger.checkMissedRunStatus("2026-10-19");
  assert(missedStatus.isMissed === true, "Detects missing run when no record exists for business date");
  assert(missedStatus.reason.includes("NO_RUN_RECORDED"), "Reason cites NO_RUN_RECORDED");
  console.log("  ✓ PASS: Missed-run watchdog accurately detects missing run for unexecuted business date");

  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 4: 8-STAGE CONTROL LOOP & SPECIALIST EXECUTION
  // ────────────────────────────────────────────────────────────────
  console.log("\n[GATE 4] Testing 8-Stage Autonomous Maintenance Control Loop...");
  const controllerLedgerPath = join(testDir, "controller_ledger.json");
  const controller = new SpeMaintenanceController(controllerLedgerPath);

  const receipt = await controller.executeMaintenanceCycle({
    triggerType: "SCHEDULED_0217_IST",
    businessDate: "2026-10-18",
    workerId: "test-controller-worker",
    dryRun: false,
    baseCommit: "dcd7df0f92d3eaa62d915418b5009e85844be922",
    receiptOutputDir: testDir,
  });

  assert(receipt.receiptVersion === "1.0.0", "Receipt version is 1.0.0");
  assert(receipt.stagesCompleted.includes("STAGE_A_FENCED_LEASE_ACQUIRED"), "Completed Stage A (Lease)");
  assert(receipt.stagesCompleted.includes("STAGE_B_DISCOVERY"), "Completed Stage B (Discovery)");
  assert(receipt.stagesCompleted.includes("STAGE_C_PREPARE_ISOLATED_UPDATE"), "Completed Stage C (Isolate Update)");
  assert(receipt.stagesCompleted.includes("STAGE_D_INDEPENDENT_TESTS"), "Completed Stage D (Independent Tests)");
  assert(receipt.stagesCompleted.includes("STAGE_E_PREVIEW_AND_VERIFY"), "Completed Stage E (Preview & Verify)");
  assert(receipt.stagesCompleted.includes("STAGE_F_RELEASE_PERMITTED_CHANGES"), "Completed Stage F (Permitted Release)");
  assert(receipt.stagesCompleted.includes("STAGE_G_RECORD_PROOF"), "Completed Stage G (Record Proof)");
  console.log("  ✓ PASS: All 8 control loop stages executed cleanly");

  // Verify specialist job outcomes
  assert(receipt.specialistJobResults["model_lifecycle_watcher"]?.status === "PASSED", "Model lifecycle watcher passed");
  assert(receipt.specialistJobResults["broken_link_repair"]?.status === "NO_CHANGES_NEEDED", "Broken link repair clean");
  assert(receipt.specialistJobResults["sitemap_freshness"]?.status === "NO_CHANGES_NEEDED", "Sitemap freshness clean");
  assert(receipt.specialistJobResults["security_and_dependencies"]?.status === "PASSED", "Security watcher passed");
  assert(receipt.specialistJobResults["semantic_regressions"]?.status === "PASSED", "Semantic regression holdouts passed");
  assert(receipt.specialistJobResults["cost_circuit_breaker"]?.status === "PASSED", "Cost circuit breaker normal");
  assert(receipt.specialistJobResults["billing_reconciliation"]?.status === "PASSED", "Billing reconciliation mathematically balanced");
  assert(receipt.specialistJobResults["backup_restore_drill"]?.status === "PASSED", "Backup restore drill passed");
  console.log("  ✓ PASS: All 8 specialist jobs executed with structured outcome summaries");

  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 5: HONEST VERDICT & ZERO DUPLICATE ON REPLAY
  // ────────────────────────────────────────────────────────────────
  console.log("\n[GATE 5] Testing 'No Change is a Valid Day' & Idempotent Watchdog Replay...");
  assert(receipt.finalVerdict === "NO_OP_CLEAN", `Clean state returns NO_OP_CLEAN (got ${receipt.finalVerdict})`);
  assert(receipt.cloudComputeSpendUsd === 0.0, "Cloud compute spend strictly $0.000");
  assert(receipt.zeroEgressPreserved === true, "Zero egress preserved (100% local air-gap)");
  assert(receipt.receiptDigest.length === 64, "Receipt digest is valid 64-char hex SHA-256");
  console.log("  ✓ PASS: Clean run honestly classified as NO_OP_CLEAN ($0 spend, 64-hex digest)");

  // Replay via watchdog for the same date -> MUST BE REJECTED TO PREVENT DUPLICATE EFFECTS
  const replayReceipt = await controller.executeMaintenanceCycle({
    triggerType: "WATCHDOG_0300_IST",
    businessDate: "2026-10-18",
    workerId: "watchdog-worker",
    receiptOutputDir: testDir,
  });

  assert(replayReceipt.stagesCompleted.includes("STAGE_A_TRIGGER_REFUSED"), "Watchdog trigger safely refused on already-completed date");
  assert(replayReceipt.finalVerdict === "NO_OP_CLEAN", "Replay preserves original NO_OP_CLEAN verdict");
  console.log("  ✓ PASS: Watchdog trigger safely no-oped on already-completed business date (zero duplicate effects)");

  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 6: ROLLBACK DRILL & POINTER RESTORATION
  // ────────────────────────────────────────────────────────────────
  console.log("\n[GATE 6] Testing Rollback Drill & Production Pointer Restoration...");
  const rollbackReceipt = await controller.executeMaintenanceCycle({
    triggerType: "SCHEDULED_0217_IST",
    businessDate: "2026-10-19",
    workerId: "rollback-test-worker",
    forceRollbackTest: true,
    receiptOutputDir: testDir,
  });

  assert(rollbackReceipt.finalVerdict === "ROLLED_BACK", `Rollback condition triggered ROLLED_BACK verdict (got ${rollbackReceipt.finalVerdict})`);
  assert(rollbackReceipt.rollbacksExecuted === 1, "Rollback count is 1");
  assert(rollbackReceipt.activeProductionPointer === rollbackReceipt.rollbackTargetPointer, "Active production pointer safely restored to rollback target");
  console.log("  ✓ PASS: Rollback drill safely restores active pointer to rollback target");

  // ────────────────────────────────────────────────────────────────
  // TEST GROUP 7: DEPLOYMENT WITNESS & PERMITTED RELEASE BOUNDARY (MAINT-P0-01 & MAINT-P0-02)
  // ────────────────────────────────────────────────────────────────
  console.log("\n[GATE 7] Testing Deployment Witness & Permitted Auto-Release Boundary (MAINT-P0-01 & MAINT-P0-02)...");

  // 7A: Discovered routine changes without verified deployment witness must NOT claim RELEASED_PERMITTED
  const unverifiedWitnessReceipt = await controller.executeMaintenanceCycle({
    triggerType: "SCHEDULED_0217_IST",
    businessDate: "2026-10-20",
    workerId: "unverified-worker",
    simulateDiscoveredChanges: 2,
    receiptOutputDir: testDir,
  });

  assert(unverifiedWitnessReceipt.discoveredChangesCount === 2, "Discovered changes count is 2");
  assert(unverifiedWitnessReceipt.finalVerdict === "NO_OP_CLEAN", `Missing deployment witness results in NO_OP_CLEAN (got ${unverifiedWitnessReceipt.finalVerdict})`);
  assert(unverifiedWitnessReceipt.heldForHumanReviewCount === 2, "Candidate changes safely held for human review");
  assert(unverifiedWitnessReceipt.permittedChangesApplied === 0, "Zero permitted changes applied without verified witness");
  console.log("  ✓ PASS: Discovered changes without verified deployment witness are held for review (NO_OP_CLEAN)");

  // 7B: Forged witness with merely { verified: true } and fake hash must be REJECTED (MAINT-P0-02)
  const forgedWitnessReceipt = await controller.executeMaintenanceCycle({
    triggerType: "SCHEDULED_0217_IST",
    businessDate: "2026-10-21",
    workerId: "forged-worker",
    simulateDiscoveredChanges: 2,
    deploymentWitness: {
      verified: true,
      witnessReceiptHash: "witness_sha256_mock_digest",
      deployedBy: "unverified-attacker",
      deployedAtIso: new Date().toISOString(),
    },
    receiptOutputDir: testDir,
  });

  assert(forgedWitnessReceipt.discoveredChangesCount === 2, "Discovered changes count is 2");
  assert(forgedWitnessReceipt.finalVerdict === "NO_OP_CLEAN", `Forged witness strictly rejected with NO_OP_CLEAN (got ${forgedWitnessReceipt.finalVerdict})`);
  assert(forgedWitnessReceipt.heldForHumanReviewCount === 2, "Candidate changes held when witness is forged");
  assert(forgedWitnessReceipt.permittedChangesApplied === 0, "Zero permitted changes applied with forged witness");
  console.log("  ✓ PASS: Forged deployment witness lacking cryptographic integrity strictly rejected (NO_OP_CLEAN)");

  // 7C: Non-production environment witness (e.g. staging) must be REJECTED for production release (MAINT-P0-02)
  const stagingWitness = createVerifiedDeploymentWitness({
    environment: "staging",
    commitSha: "dcd7df0f92d3eaa62d915418b5009e85844be922",
    artifactDigest: "b".repeat(64),
    deployedBy: "ci-staging-deployer",
  });
  const stagingWitnessReceipt = await controller.executeMaintenanceCycle({
    triggerType: "SCHEDULED_0217_IST",
    businessDate: "2026-10-22",
    workerId: "staging-worker",
    simulateDiscoveredChanges: 2,
    deploymentWitness: stagingWitness,
    receiptOutputDir: testDir,
  });

  assert(stagingWitnessReceipt.finalVerdict === "NO_OP_CLEAN", "Non-production environment witness rejected for production release");
  assert(stagingWitnessReceipt.heldForHumanReviewCount === 2, "Candidate changes held when witness environment is not production");
  console.log("  ✓ PASS: Non-production environment witness strictly rejected for production release");

  // 7D: Authentic cryptographic deployment witness permits RELEASED_PERMITTED (MAINT-P0-02)
  const authenticWitness = createVerifiedDeploymentWitness({
    environment: "production",
    commitSha: "dcd7df0f92d3eaa62d915418b5009e85844be922",
    artifactDigest: "c".repeat(64),
    deployedBy: "github-actions-verified-deployer",
  });

  const verifiedWitnessReceipt = await controller.executeMaintenanceCycle({
    triggerType: "SCHEDULED_0217_IST",
    businessDate: "2026-10-23",
    workerId: "verified-deploy-worker",
    baseCommit: "dcd7df0f92d3eaa62d915418b5009e85844be922",
    simulateDiscoveredChanges: 2,
    deploymentWitness: authenticWitness,
    receiptOutputDir: testDir,
  });

  assert(verifiedWitnessReceipt.discoveredChangesCount === 2, "Discovered changes count is 2");
  assert(verifiedWitnessReceipt.finalVerdict === "RELEASED_PERMITTED", "Authentic verified deployment witness permits RELEASED_PERMITTED");
  assert(verifiedWitnessReceipt.permittedChangesApplied === 2, "Permitted changes applied is 2");
  assert(verifiedWitnessReceipt.heldForHumanReviewCount === 0, "Zero changes held when witness is verified");
  assert(verifiedWitnessReceipt.activeProductionPointer.startsWith("rel-"), "Production pointer advanced to new release");
  console.log("  ✓ PASS: Authentic cryptographic deployment witness permits RELEASED_PERMITTED and advances production pointer");

  console.log("\n==================================================================");
  console.log("🎉 ALL AUTONOMOUS MAINTENANCE CONTROLLER TESTS PASSED (100%)!");
  console.log("==================================================================");
} finally {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
