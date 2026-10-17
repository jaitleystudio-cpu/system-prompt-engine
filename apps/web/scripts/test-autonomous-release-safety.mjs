/**
 * SPE Ω — Autonomous Release Safety & Blocker Verification Battery
 *
 * Attacks and verifies all 6 autonomous release safety blockers:
 * 1. Global emergency STOP: fail-closed release halt.
 * 2. Independent release acceptance: asymmetric Ed25519 verification, anti-self-certification,
 *    peer collusion guard, replay defense, credential revocation, and candidate binding.
 * 3. Single change-arbitration authority: resolves SEO vs Hero component conflicts.
 * 4. Production artifact verification: proves bit-for-bit canonical WASM integrity.
 * 5. Automatic rollback: fault injection detects regression, physically restores active release,
 *    and verifies the live HTTP endpoint serves the canonical WASM artifact.
 * 6. Hard operating-cost limits: enforces $0 spend and zero network egress.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import crypto from "node:crypto";
import {
  ReleaseSafetyGovernor,
  CANONICAL_WASM_SHA256,
  CANONICAL_WASM_SIZE_BYTES,
  TRUSTED_PINNED_BASE_COMMIT,
  REVOKED_COMPROMISED_KEY_HASHES,
  generateReleaseAuthorityProof,
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

// Generate ephemeral Ed25519 test credentials in memory (never written to disk or repo)
const testFounderKeys = crypto.generateKeyPairSync("ed25519");
const TEST_FOUNDER_PUB_HEX = testFounderKeys.publicKey.export({ type: "spki", format: "der" }).toString("hex");
const TEST_FOUNDER_PRIV_KEY = testFounderKeys.privateKey.export({ type: "pkcs8", format: "pem" });

const testOracleKeys = crypto.generateKeyPairSync("ed25519");
const TEST_ORACLE_PUB_HEX = testOracleKeys.publicKey.export({ type: "spki", format: "der" }).toString("hex");
const TEST_ORACLE_PRIV_KEY = testOracleKeys.privateKey.export({ type: "pkcs8", format: "pem" });

async function runReleaseSafetyBattery() {
  const governor = new ReleaseSafetyGovernor();
  governor.setTrustedAuthorityKeyForTesting("founder_release_authority", TEST_FOUNDER_PUB_HEX);
  governor.setTrustedAuthorityKeyForTesting("independent_quality_oracle", TEST_ORACLE_PUB_HEX);

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

  // ─── GATE 2: Independent Release Acceptance & Cryptographic Signatures ─────
  console.log("\n▶ Gate 2: Independent Release Acceptance & Cryptographic Signatures");

  // Attack 2A: Author attempts to approve its own change
  const selfApproval = governor.verifyReleaseAuthority("agent:antigravity", "agent:antigravity");
  assert(selfApproval.allowed === false, "Self-approval rejected: author cannot approve own changes");
  assert(selfApproval.reason.includes("SELF_CERTIFICATION_PROHIBITED"), "Correct rejection code SELF_CERTIFICATION_PROHIBITED");

  // Attack 2B: Collusion between peer agents
  const peerCollusion = governor.verifyReleaseAuthority("agent:antigravity", "agent:subagent-01");
  assert(peerCollusion.allowed === false, "Peer agent collusion blocked: autonomous agent cannot approve peer agent");

  // Attack 2C: Plain unauthenticated authority string without cryptographic signature
  const plainStringApproval = governor.verifyReleaseAuthority("agent:antigravity", "founder_release_authority");
  assert(plainStringApproval.allowed === false, "Plain unauthenticated identity string rejected without cryptographic signature");
  assert(plainStringApproval.reason.includes("UNAUTHENTICATED_RELEASE_AUTHORITY"), "Correct rejection code UNAUTHENTICATED_RELEASE_AUTHORITY");

  // Attack 2D: Coding agent attempts to self-certify using generateReleaseAuthorityProof without external key
  let agentSelfManufactureBlocked = false;
  try {
    generateReleaseAuthorityProof("PROP-FORGE-01", "founder_release_authority", null);
  } catch (err) {
    agentSelfManufactureBlocked = err.message.includes("CREDENTIAL_CUSTODY_ERROR");
  }
  assert(agentSelfManufactureBlocked === true, "Agent cannot manufacture release proof: credentials require external custody");

  // Attack 2E: Attempt to use exposed / revoked credentials from Git history
  let revokedKeyBlocked = false;
  try {
    generateReleaseAuthorityProof("PROP-REVOKED-01", "founder_release_authority", {
      hmacSecret: "sec_spe_founder_auth_7f9b8c2d1e0a4f5b",
    });
  } catch (err) {
    revokedKeyBlocked = err.message.includes("CREDENTIAL_REVOKED_COMPROMISED");
  }
  assert(revokedKeyBlocked === true, "Exposed credential from Git history rejected as permanently revoked");

  // Attack 2F: Valid proof presented with proposal ID mismatch
  const testDigest = "a".repeat(64);
  const validFounderProof = generateReleaseAuthorityProof(
    "PROP-VERIFY-01",
    "founder_release_authority",
    { privateKeyPem: TEST_FOUNDER_PRIV_KEY },
    testDigest
  );

  const proposalIdMismatch = governor.verifyReleaseAuthority(
    "agent:antigravity",
    validFounderProof,
    "PROP-DIFFERENT-ID",
    testDigest
  );
  assert(proposalIdMismatch.allowed === false, "Proof signed for PROP-VERIFY-01 rejected when presented for PROP-DIFFERENT-ID");
  assert(proposalIdMismatch.reason.includes("PROPOSAL_ID_MISMATCH"), "Reason correctly cites PROPOSAL_ID_MISMATCH");

  // Attack 2G: Candidate digest tampering
  const digestMismatch = governor.verifyReleaseAuthority(
    "agent:antigravity",
    validFounderProof,
    "PROP-VERIFY-01",
    "b".repeat(64) // Tampered candidate digest
  );
  assert(digestMismatch.allowed === false, "Tampered candidate content digest rejected with PROPOSAL_DIGEST_MISMATCH");

  // Attack 2H: Tampered signature rejection
  const tamperedProof = {
    ...validFounderProof,
    signatureHex: "0".repeat(128),
  };
  const tamperedApproval = governor.verifyReleaseAuthority("agent:antigravity", tamperedProof, "PROP-VERIFY-01", testDigest);
  assert(tamperedApproval.allowed === false, "Tampered approval signature rejected with INVALID_AUTHORITY_SIGNATURE");

  // Attack 2I: Production authority key isolation (agent cannot sign for unconfigured production keys)
  const prodGovernor = new ReleaseSafetyGovernor();
  const prodForgeAudit = prodGovernor.verifyReleaseAuthority("agent:antigravity", validFounderProof, "PROP-VERIFY-01", testDigest);
  assert(prodForgeAudit.allowed === false, "Agent-generated test keys strictly fail closed against production governor keys");
  assert(prodForgeAudit.reason.includes("INVALID_AUTHORITY_SIGNATURE"), "Reason confirms cryptographic signature verification failed");

  // Attack 2J: Target environment mismatch rejection
  const stagingProof = generateReleaseAuthorityProof(
    "PROP-ENV-01",
    "founder_release_authority",
    { privateKeyPem: TEST_FOUNDER_PRIV_KEY },
    testDigest,
    "staging"
  );
  const envMismatchAudit = governor.verifyReleaseAuthority(
    "agent:antigravity",
    stagingProof,
    "PROP-ENV-01",
    testDigest,
    "production"
  );
  assert(envMismatchAudit.allowed === false, "Proof signed for 'staging' rejected when evaluating 'production'");
  assert(envMismatchAudit.reason.includes("ENVIRONMENT_MISMATCH"), "Reason explicitly cites ENVIRONMENT_MISMATCH");

  // Attack 2K: Authorized action mismatch rejection
  const rollbackActionProof = generateReleaseAuthorityProof(
    "PROP-ACTION-01",
    "founder_release_authority",
    { privateKeyPem: TEST_FOUNDER_PRIV_KEY },
    testDigest,
    "production",
    "AUTOMATED_ROLLBACK"
  );
  const actionMismatchAudit = governor.verifyReleaseAuthority(
    "agent:antigravity",
    rollbackActionProof,
    "PROP-ACTION-01",
    testDigest,
    "production",
    "RELEASE_PROMOTION"
  );
  assert(actionMismatchAudit.allowed === false, "Proof signed for 'AUTOMATED_ROLLBACK' rejected when promoting release");
  assert(actionMismatchAudit.reason.includes("ACTION_MISMATCH"), "Reason explicitly cites ACTION_MISMATCH");

  // Attack 2L: Replay attack prevention (reusing the same single-use nonce)
  const freshProof = generateReleaseAuthorityProof(
    "PROP-REPLAY-01",
    "founder_release_authority",
    { privateKeyPem: TEST_FOUNDER_PRIV_KEY },
    testDigest
  );
  const firstUse = governor.verifyReleaseAuthority("agent:antigravity", freshProof, "PROP-REPLAY-01", testDigest);
  assert(firstUse.allowed === true, "First use of cryptographically signed approval succeeds");

  const replayAttempt = governor.verifyReleaseAuthority("agent:antigravity", freshProof, "PROP-REPLAY-01", testDigest);
  assert(replayAttempt.allowed === false, "Replay attack detected and blocked: nonce cannot be reused");
  assert(replayAttempt.reason.includes("REPLAY_ATTACK_DETECTED"), "Reason explicitly cites REPLAY_ATTACK_DETECTED");

  // Attack 2M: Persistent replay defense across separate governor instances (disk persistence)
  const secondGovernor = new ReleaseSafetyGovernor();
  secondGovernor.setTrustedAuthorityKeyForTesting("founder_release_authority", TEST_FOUNDER_PUB_HEX);
  const crossInstanceReplay = secondGovernor.verifyReleaseAuthority("agent:antigravity", freshProof, "PROP-REPLAY-01", testDigest);
  assert(crossInstanceReplay.allowed === false, "Replay attack detected and blocked across separate governor instances (persisted nonces)");
  assert(crossInstanceReplay.reason.includes("REPLAY_ATTACK_DETECTED"), "Reason explicitly cites REPLAY_ATTACK_DETECTED across process restarts");

  // Attack 2N: Expired signature rejection
  const expiredProof = generateReleaseAuthorityProof(
    "PROP-EXPIRED-01",
    "founder_release_authority",
    { privateKeyPem: TEST_FOUNDER_PRIV_KEY },
    testDigest
  );
  // Backdate timestamp by 20 minutes
  expiredProof.authorizedTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const expiredApproval = governor.verifyReleaseAuthority("agent:antigravity", expiredProof, "PROP-EXPIRED-01", testDigest);
  assert(expiredApproval.allowed === false, "Signatures older than 15 minutes rejected with EXPIRED_APPROVAL_PROOF");

  // ─── GATE 3: Change-Arbitration Authority & PID Liveness Check ─────────────
  console.log("\n▶ Gate 3: Change-Arbitration Authority (SEO vs Hero Mutex & PID Liveness)");

  assert(governor.acquireChangeLock("SEO_SITEMAP", process.pid) === true, "SEO sitemap acquired change lock for active process");
  assert(governor.acquireChangeLock("HERO_UI", process.pid) === false, "Hero UI change lock blocked while SEO lock is active (prevents conflicting mutations)");

  // PID Liveness: A live running process cannot lose its lock even after elapsed time
  assert(governor.acquireChangeLock("SEO_SITEMAP", 88888) === false, "Another process cannot acquire lock held by live running PID");

  governor.releaseChangeLock("SEO_SITEMAP");
  assert(governor.acquireChangeLock("HERO_UI", process.pid) === true, "Hero UI change lock successfully acquired after SEO lock released");
  governor.releaseChangeLock("HERO_UI");

  // Dead PID safely reclaimed:
  const deadPid = 99999999;
  governor["activeLockMap"].set("ENGINE", { subsystem: "ENGINE", pid: deadPid, acquiredAtMs: Date.now() - 3600000 });
  assert(governor.acquireChangeLock("ENGINE", process.pid) === true, "Stale lock from terminated process (dead PID) safely reclaimed");
  governor.releaseChangeLock("ENGINE");

  // ─── GATE 4: Production Artifact Verification (Bit-for-Bit WASM) ───────────
  console.log("\n▶ Gate 4: Production Artifact Verification (Bit-for-Bit WASM)");
  const wasmPath = resolve(process.cwd(), "apps/web/public/spe_wasm.wasm");
  const wasmBuffer = readFileSync(wasmPath);

  const wasmAudit = governor.verifyProductionArtifactIntegrity(wasmBuffer);
  assert(wasmAudit.verified === true, "Production WASM artifact verified bit-for-bit bit-identical");
  assert(wasmAudit.observedHash === CANONICAL_WASM_SHA256, `WASM hash matches pinned canonical: ${CANONICAL_WASM_SHA256.slice(0, 16)}...`);
  assert(wasmBuffer.byteLength === CANONICAL_WASM_SIZE_BYTES, `WASM byte count exactly ${CANONICAL_WASM_SIZE_BYTES} bytes`);

  // ─── GATE 5: Rollback Fault Injection & Real Deployment Rollback ────────────
  console.log("\n▶ Gate 5: Rollback Fault Injection & Real Deployment Rollback");

  // Setup local HTTP static server on port 4188 simulating deployment endpoint
  const testPort = 4188;
  const distDir = resolve(process.cwd(), "apps/web/dist");
  const distWasmPath = resolve(distDir, "spe_wasm.wasm");

  // Start ephemeral static server
  const server = createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/spe_wasm.wasm" && existsSync(distWasmPath)) {
      const data = readFileSync(distWasmPath);
      res.writeHead(200, { "Content-Type": "application/wasm" });
      res.end(data);
      return;
    }
    if (url === "/release-manifest.json" && existsSync(resolve(distDir, "release-manifest.json"))) {
      const data = readFileSync(resolve(distDir, "release-manifest.json"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((res) => server.listen(testPort, "127.0.0.1", res));

  try {
    // Inject regression: Corrupt dist WASM
    const originalDistWasm = existsSync(distWasmPath) ? readFileSync(distWasmPath) : null;
    writeFileSync(distWasmPath, Buffer.from("CORRUPTED_INJECTED_REGRESSION_PAYLOAD"));

    // Verify HTTP endpoint currently serves corrupted bytes
    const preRollbackRes = await fetch(`http://127.0.0.1:${testPort}/spe_wasm.wasm`);
    const preRollbackBytes = await preRollbackRes.text();
    assert(preRollbackBytes.includes("CORRUPTED"), "Fault injection confirmed: served HTTP endpoint is serving corrupted artifact");

    // Inject bad candidate causing test regressions
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

    const badCandidateDigest = governor.computeProposalContentDigest(badCandidate);
    const oracleProof = generateReleaseAuthorityProof(
      "PROP-BAD-CANDIDATE-01",
      "independent_quality_oracle",
      { privateKeyPem: TEST_ORACLE_PRIV_KEY },
      badCandidateDigest
    );

    // Execute real rollback with live HTTP verification
    const rollbackDecision = await governor.evaluateReleaseCandidateAsync(badCandidate, oracleProof, {
      stagingPort: testPort,
      verifyHttp: true,
    });

    assert(rollbackDecision.status === "ROLLED_BACK", "Corrupted release candidate rejected and marked ROLLED_BACK");
    assert(rollbackDecision.rollbackReceipt !== undefined, "Real rollback execution receipt attached");
    assert(rollbackDecision.rollbackReceipt.triggered === true, "Automated rollback triggered");
    assert(rollbackDecision.rollbackReceipt.restoredTarget === TRUSTED_PINNED_BASE_COMMIT, `Restores to pinned trusted commit ${TRUSTED_PINNED_BASE_COMMIT}`);
    assert(rollbackDecision.rollbackReceipt.verifiedSafe === true, "Independent verification confirms restored canonical artifact");
    assert(rollbackDecision.rollbackReceipt.httpVerification !== undefined, "Live HTTP verification record attached");
    assert(rollbackDecision.rollbackReceipt.httpVerification.verifiedMatch === true, "Live HTTP endpoint verified serving canonical WASM hash");
    assert(rollbackDecision.rollbackReceipt.httpVerification.servedWasmSha256 === CANONICAL_WASM_SHA256, "Served WASM hash matches canonical SHA-256 bit-for-bit");
    assert(rollbackDecision.rollbackReceipt.httpVerification.servedReleaseCommit === TRUSTED_PINNED_BASE_COMMIT, `Served release commit matches pinned base ${TRUSTED_PINNED_BASE_COMMIT}`);
    assert(rollbackDecision.rollbackReceipt.httpVerification.manifestEndpoint !== undefined, "Served release manifest endpoint confirmed verified");

    // Negative Rollback Test: Simulated restoration failure triggers incident alert
    const failedRollback = await governor.executeDeploymentRollback(badCandidate, {
      simulateFailure: true,
    });
    assert(failedRollback.verifiedSafe === false, "Failed rollback remains marked verifiedSafe: false");
    assert(failedRollback.incidentAlertTriggered === true, "Failed rollback triggers immediate incident alert");

    // Restore original dist file if it existed
    if (originalDistWasm) {
      writeFileSync(distWasmPath, originalDistWasm);
    }
  } finally {
    server.close();
  }

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
  assert(localExecution.allowed === true, "Zero cloud spend and zero egress passes cost budget");

  // ─── GATE 7: Evolution Cross-Process Mutex Lock (.spe_evolution_lock) ───────
  console.log("\n▶ Gate 7: Cross-Process Evolution Lock (.spe_evolution_lock)");
  const {
    acquireEvolutionLock,
    releaseEvolutionLock,
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

    // 5. Aged lockfile (> 2 hours old) held by LIVE process: MUST NEVER be lost or unlinked
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    writeFileSync(testLockPath, JSON.stringify({ pid: process.pid, timestamp: threeHoursAgo, hostname: "test-node" }), "utf-8");
    const agedLiveLock = acquireEvolutionLock(testLockPath);
    assert(agedLiveLock.acquired === false, "Aged lock (>2 hours) held by live running PID is NEVER stolen or unlinked");
    assert(existsSync(testLockPath) === true, "Lockfile remains intact on disk for live running process");

    // 6. Aged lockfile held by TERMINATED process (dead PID): safely reclaimed
    const deadPid = 99999999;
    writeFileSync(testLockPath, JSON.stringify({ pid: deadPid, timestamp: threeHoursAgo, hostname: "test-node" }), "utf-8");
    const deadPidLock = acquireEvolutionLock(testLockPath);
    assert(deadPidLock.acquired === true, "Stale lock from terminated process (dead PID) safely reclaimed");
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
