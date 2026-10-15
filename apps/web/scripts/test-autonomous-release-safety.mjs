/**
 * SPE Ω — Autonomous Release Safety & Blocker Verification Battery
 *
 * Attacks and verifies all 6 autonomous release safety blockers:
 * 1. Global emergency STOP: fail-closed release halt.
 * 2. Independent release acceptance: author cannot self-certify or approve own change.
 * 3. Single change-arbitration authority: resolves SEO vs Hero component conflicts.
 * 4. Production artifact verification: proves bit-for-bit canonical WASM integrity.
 * 5. Automatic rollback: fault injection detects regression and triggers rollback to pinned commit.
 * 6. Hard operating-cost limits: enforces $0 spend and zero network egress.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ReleaseSafetyGovernor,
  CANONICAL_WASM_SHA256,
  CANONICAL_WASM_SIZE_BYTES,
  TRUSTED_PINNED_BASE_COMMIT,
} from "../src/engine/evolution/releaseSafetyGovernor.ts";

console.log("========================================================================");
console.log("🛡️  SPE Ω — AUTONOMOUS RELEASE SAFETY & ADVERSARIAL BLOCKER BATTERY");
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

async function runReleaseSafetyBattery() {
  const governor = new ReleaseSafetyGovernor();

  // ─── GATE 1: Global Emergency STOP (Fail-Closed) ───────────────────────────
  console.log("\n▶ Gate 1: Global Emergency STOP Verification");
  assert(governor.isEmergencyStopActive() === false, "Baseline state: Emergency STOP is inactive");

  // Inject emergency stop via environment
  process.env.SPE_EMERGENCY_STOP = "1";
  assert(governor.isEmergencyStopActive() === true, "Environment SPE_EMERGENCY_STOP=1 activates fail-closed STOP");

  const stopDecision = governor.evaluateReleaseCandidate(
    {
      proposalId: "PROP-FAIL-01",
      authorIdentity: "agent:antigravity",
      category: "ENGINE",
      targetFiles: ["apps/web/src/App.tsx"],
      testResults: { passed: true, passCount: 10, failCount: 0, regressionsDetected: 0 },
      requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    },
    "founder_release_authority"
  );

  assert(stopDecision.status === "EMERGENCY_STOPPED", "When emergency STOP is active, candidate promotion is immediately halted");
  assert(stopDecision.authorizedBy === "FAIL_CLOSED_EMERGENCY_BREAKER", "Authorized by fail-closed breaker");

  // Deactivate env stop
  delete process.env.SPE_EMERGENCY_STOP;
  assert(governor.isEmergencyStopActive() === false, "Emergency STOP deactivates cleanly when flag removed");

  // ─── GATE 2: Independent Release Acceptance & Self-Approval Prevention ─────
  console.log("\n▶ Gate 2: Independent Release Acceptance & Anti-Self-Certification");

  // Attack 2A: Author attempts to approve its own change
  const selfApproval = governor.verifyReleaseAuthority("agent:antigravity", "agent:antigravity");
  assert(selfApproval.allowed === false, "Self-approval rejected: author cannot approve own changes");
  assert(selfApproval.reason.includes("SELF_CERTIFICATION_PROHIBITED"), "Correct rejection code SELF_CERTIFICATION_PROHIBITED");

  // Attack 2B: Collusion between peer agents
  const peerCollusion = governor.verifyReleaseAuthority("agent:antigravity", "agent:subagent-01");
  assert(peerCollusion.allowed === false, "Peer agent collusion blocked: autonomous agent cannot approve peer agent");

  // Legitimate Independent Release Authority
  const independentApproval = governor.verifyReleaseAuthority("agent:antigravity", "founder_release_authority");
  assert(independentApproval.allowed === true, "Independent founder release authority accepted");

  // ─── GATE 3: Change-Arbitration Authority (SEO vs Hero Mutex) ───────────────
  console.log("\n▶ Gate 3: Change-Arbitration Authority (SEO vs Hero Mutex)");

  assert(governor.acquireChangeLock("SEO_SITEMAP") === true, "SEO sitemap acquired change lock");
  assert(governor.acquireChangeLock("HERO_UI") === false, "Hero UI change lock blocked while SEO lock is active (prevents conflicting mutations)");

  governor.releaseChangeLock("SEO_SITEMAP");
  assert(governor.acquireChangeLock("HERO_UI") === true, "Hero UI change lock successfully acquired after SEO lock released");
  governor.releaseChangeLock("HERO_UI");

  // ─── GATE 4: Production Artifact Verification (Bit-for-Bit WASM) ───────────
  console.log("\n▶ Gate 4: Production Artifact Verification (Bit-for-Bit WASM)");
  const wasmPath = resolve(process.cwd(), "apps/web/public/spe_wasm.wasm");
  const wasmBuffer = readFileSync(wasmPath);

  const wasmAudit = governor.verifyProductionArtifactIntegrity(wasmBuffer);
  assert(wasmAudit.verified === true, "Production WASM artifact verified bit-for-bit bit-identical");
  assert(wasmAudit.observedHash === CANONICAL_WASM_SHA256, `WASM hash matches pinned canonical: ${CANONICAL_WASM_SHA256.slice(0, 16)}...`);
  assert(wasmBuffer.byteLength === CANONICAL_WASM_SIZE_BYTES, `WASM byte count exactly ${CANONICAL_WASM_SIZE_BYTES} bytes`);

  // ─── GATE 5: Rollback Fault Injection & Automated Self-Healing ──────────────
  console.log("\n▶ Gate 5: Rollback Fault Injection & Automated Self-Healing");

  // Inject a candidate that causes 2 test regressions
  const badCandidate = {
    proposalId: "PROP-BAD-CANDIDATE-01",
    authorIdentity: "agent:autonomous_coder",
    category: "ENGINE",
    targetFiles: ["apps/web/src/engine/core-a.ts"],
    testResults: {
      passed: false,
      passCount: 26,
      failCount: 2,
      regressionsDetected: 2,
    },
    requestedAutonomyLevel: "L4_AUTO_PROMOTION",
  };

  const rollbackDecision = governor.evaluateReleaseCandidate(badCandidate, "independent_quality_oracle");
  assert(rollbackDecision.status === "ROLLED_BACK", "Corrupted release candidate rejected and marked ROLLED_BACK");
  assert(rollbackDecision.rollbackReceipt.triggered === true, "Automated rollback triggered");
  assert(rollbackDecision.rollbackReceipt.restoredTarget === TRUSTED_PINNED_BASE_COMMIT, `Restores to pinned trusted commit ${TRUSTED_PINNED_BASE_COMMIT}`);

  // ─── GATE 6: Operating-Cost Budgets ($0 Cloud Spend & Zero Egress) ──────────
  console.log("\n▶ Gate 6: Operating-Cost Budgets ($0 Spend & Zero Network Egress)");

  // Attempt cloud egress
  const egressViolation = governor.verifyOperatingCostBudget({
    cpuTimeMs: 500,
    memoryMb: 80,
    cloudEgressPackets: 4,
    cloudSpendUsd: 0,
  });
  assert(egressViolation.allowed === false, "Non-zero network egress packets rejected by operating cost budget");

  // Attempt cloud compute spend
  const spendViolation = governor.verifyOperatingCostBudget({
    cpuTimeMs: 500,
    memoryMb: 80,
    cloudEgressPackets: 0,
    cloudSpendUsd: 0.05,
  });
  assert(spendViolation.allowed === false, "Non-zero cloud spend ($0.05) rejected by operating cost budget");

  // Valid local execution
  const localExecution = governor.verifyOperatingCostBudget({
    cpuTimeMs: 850,
    memoryMb: 95,
    cloudEgressPackets: 0,
    cloudSpendUsd: 0,
  });
  // ─── GATE 7: Evolution Cross-Process Mutex Lock (.spe_evolution_lock) ───────
  console.log("\n▶ Gate 7: Cross-Process Evolution Lock (.spe_evolution_lock)");
  const {
    acquireEvolutionLock,
    releaseEvolutionLock,
    EVOLUTION_LOCK_FILE,
  } = await import("../src/engine/evolution/nightlyScheduler.ts");

  const testLockPath = resolve(process.cwd(), ".spe_test_evolution_lock");
  try {
    releaseEvolutionLock(testLockPath);
    // 1. First process acquires lock
    const lock1 = acquireEvolutionLock(testLockPath);
    assert(lock1.acquired === true, "First evolution process successfully acquires lock");
    assert(existsSync(testLockPath) === true, "Lockfile created on disk");

    // 2. Second competing process attempts to acquire same lock
    const lock2 = acquireEvolutionLock(testLockPath);
    assert(lock2.acquired === false, "Second competing process blocked with concurrency conflict");
    assert(lock2.reason?.includes("Concurrency Conflict") === true, "Reason explicitly cites Concurrency Conflict");

    // 3. First process releases lock
    releaseEvolutionLock(testLockPath);
    assert(existsSync(testLockPath) === false, "Lockfile cleanly released from disk");

    // 4. Now second process can acquire lock cleanly
    const lock3 = acquireEvolutionLock(testLockPath);
    assert(lock3.acquired === true, "Lock successfully acquired after prior release");
    releaseEvolutionLock(testLockPath);
  } finally {
    releaseEvolutionLock(testLockPath);
  }

  console.log("\n------------------------------------------------------------------------");
  console.log(`Results: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log("🎉 All Autonomous Release Safety & Concurrency Blockers Successfully Addressed & Verified!");
}

runReleaseSafetyBattery().catch((err) => {
  console.error("Release safety battery failed with error:", err);
  process.exit(1);
});
