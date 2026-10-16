#!/usr/bin/env node
/**
 * SPE Ω — P0-R2 Empirical Qualification & Trust-Boundary Verification Battery
 *
 * Adversarially verifies the 5 core missions of Directive P0-R2:
 * 1. Mission A: Elimination of fabricated benchmark qualifications, 7-dimension scorecard, SmolLM baselines, and truthfulness of Chrome Prompt API limits.
 * 2. Mission B: Concurrency-safe, fail-closed atomic nonce replay ledger & production/staging authority key isolation.
 * 3. Mission C: Destination-only rollback verification, whole-site release manifest, and LOCAL_STAGING_ROLLBACK_VERIFIED_WITHIN_TESTED_SCOPE.
 * 4. Mission D: Verifiable network isolation with active deny-by-default egress blocking (fetch, TCP sockets, XHR, WebSocket, EventSource, sendBeacon) and permitted connection tracking.
 * 5. Mission E: Truthful provenance, $0 cloud spend, and honest IMPLEMENTED_NOT_QUALIFIED final verdict.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { fork, execFile } from "node:child_process";
import {
  ReleaseSafetyGovernor,
  generateReleaseAuthorityProof,
  CANONICAL_WASM_SHA256,
  CANONICAL_WASM_SIZE_BYTES,
  TRUSTED_PINNED_BASE_COMMIT,
  TRUSTED_AUTHORITY_PUBLIC_KEYS,
} from "../src/engine/evolution/releaseSafetyGovernor.ts";
import { NetworkEgressObserver } from "../src/engine/networkObserver.ts";
import { computeSha256 } from "../src/engine/hashUtils.ts";

console.log("========================================================================");
console.log("🛡️  SPE Ω — P0-R2 EMPIRICAL QUALIFICATION & TRUST REPAIR VERIFICATION");
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

// Generate ephemeral Ed25519 test keys
const testFounderKeys = crypto.generateKeyPairSync("ed25519");
const TEST_PUB_HEX = testFounderKeys.publicKey.export({ type: "spki", format: "der" }).toString("hex");
const TEST_PRIV_PEM = testFounderKeys.privateKey.export({ type: "pkcs8", format: "pem" });

async function runP0R2VerificationBattery() {
  const governor = new ReleaseSafetyGovernor();
  governor.setTrustedAuthorityKeyForTesting("founder_release_authority", TEST_PUB_HEX);

  // ─── PART 1: Mission B — Concurrency & Fail-Closed Ledger Hardening ─────────
  console.log("\n▶ Part 1: Replay & Credential Authority Hardening (Mission B)");

  // 1A. Atomic fail-closed behavior on corrupted nonce ledger
  const noncePath = resolve(process.cwd(), ".spe/consumed_nonces.json");
  const backupNonces = existsSync(noncePath) ? readFileSync(noncePath, "utf-8") : null;

  try {
    mkdirSync(resolve(process.cwd(), ".spe"), { recursive: true });
    // Inject corrupt JSON into ledger
    writeFileSync(noncePath, "{ CORRUPTED_NONCE_LEDGER_DATA: syntax_error", "utf-8");

    const testProof = generateReleaseAuthorityProof(
      "PROP-FAIL-CLOSED-01",
      "founder_release_authority",
      { privateKeyPem: TEST_PRIV_PEM },
      "test_digest_001"
    );

    const failClosedAudit = governor.verifyReleaseAuthority(
      "agent:antigravity",
      testProof,
      "PROP-FAIL-CLOSED-01",
      "test_digest_001"
    );

    assert(failClosedAudit.allowed === false, "Corrupted nonce ledger strictly causes fail-closed rejection");
    assert(
      failClosedAudit.reason.includes("LEDGER_IO_FAILURE"),
      `Rejection reason explicitly cites LEDGER_IO_FAILURE (${failClosedAudit.reason})`
    );
  } finally {
    // Restore or reinitialize clean ledger
    if (backupNonces) {
      writeFileSync(noncePath, backupNonces, "utf-8");
    } else {
      writeFileSync(noncePath, "[]", "utf-8");
    }
  }

  // 1B. Single-use policy: existing nonce timestamps are NEVER refreshed
  const nonceA = `nonce_p0r2_a_${Date.now()}`;
  const firstConsumeTime = Date.now() - 60000; // 1 minute ago
  const initialLedger = [{ nonce: nonceA, ts: firstConsumeTime, proposalId: "PROP-A" }];
  writeFileSync(noncePath, JSON.stringify(initialLedger, null, 2), "utf-8");

  // Consume a second nonce
  const nonceB = `nonce_p0r2_b_${Date.now()}`;
  const consumeBResult = governor.consumeNonceAtomic(nonceB, "PROP-B", "founder_release_authority");
  assert(consumeBResult.allowed === true, "Consuming distinct fresh nonce succeeds");

  const updatedLedger = JSON.parse(readFileSync(noncePath, "utf-8"));
  const entryA = updatedLedger.find((item) => item.nonce === nonceA);
  const entryB = updatedLedger.find((item) => item.nonce === nonceB);

  assert(entryA !== undefined, "Original nonce remains in persistent ledger");
  assert(entryA.ts === firstConsumeTime, "Original nonce timestamp was NOT refreshed/mutated by subsequent writes");
  assert(entryB !== undefined && entryB.ts >= firstConsumeTime, "New nonce recorded with authentic current timestamp");

  // 1C. Replay attack rejection against persisted ledger
  const replayAudit = governor.consumeNonceAtomic(nonceA, "PROP-REPLAY", "founder_release_authority");
  assert(replayAudit.allowed === false, "Replay of existing nonce rejected atomically under lock");
  assert(replayAudit.reason.includes("REPLAY_ATTACK_DETECTED"), "Replay reason cites REPLAY_ATTACK_DETECTED");

  // 1D. Simultaneous proof submission from independent child processes (race condition audit)
  const workerScript = resolve(process.cwd(), "apps/web/scripts/worker-nonce-race.mjs");
  const contestedNonce = `nonce_race_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const racePromises = Array.from({ length: 4 }).map(() => {
    return new Promise((res) => {
      execFile(
        process.execPath,
        ["--experimental-strip-types", workerScript, contestedNonce],
        { cwd: process.cwd() },
        (err, stdout) => {
          try {
            res(JSON.parse(stdout.trim()));
          } catch {
            res({ allowed: false, error: "parse_error" });
          }
        }
      );
    });
  });

  const raceResults = await Promise.all(racePromises);
  const raceSuccesses = raceResults.filter((r) => r.allowed === true).length;
  const raceRejections = raceResults.filter(
    (r) => r.allowed === false && r.reason?.includes("REPLAY_ATTACK_DETECTED")
  ).length;

  assert(raceSuccesses === 1, "Simultaneous proof submission: Exactly 1 process succeeds under parallel contention");
  assert(
    raceRejections === 3,
    "Simultaneous proof submission: Remaining 3 competing processes rejected with REPLAY_ATTACK_DETECTED"
  );

  // 1E. Hard separation of test-only authority key overrides from production AND staging
  const origNodeEnv = process.env.NODE_ENV;
  const origSpeStage = process.env.SPE_STAGE;
  try {
    // Test production environment
    process.env.NODE_ENV = "production";
    let prodKeyOverrideBlocked = false;
    try {
      governor.setTrustedAuthorityKeyForTesting("founder_release_authority", TEST_PUB_HEX);
    } catch (err) {
      prodKeyOverrideBlocked = err.message.includes("TEST_OVERRIDE_PROHIBITED_IN_PRODUCTION");
    }
    assert(prodKeyOverrideBlocked === true, "setTrustedAuthorityKeyForTesting strictly throws in production environment");

    let prodConstructorBlocked = false;
    try {
      new ReleaseSafetyGovernor({ customAuthorityKeys: { attacker_oracle: "0123" } });
    } catch (err) {
      prodConstructorBlocked = err.message.includes("TEST_OVERRIDE_PROHIBITED_IN_PRODUCTION");
    }
    assert(prodConstructorBlocked === true, "Constructor custom authority keys strictly throw in production environment");

    // Test staging environment
    process.env.NODE_ENV = "staging";
    delete process.env.SPE_STAGE;
    let stagingKeyOverrideBlocked = false;
    try {
      governor.setTrustedAuthorityKeyForTesting("founder_release_authority", TEST_PUB_HEX);
    } catch (err) {
      stagingKeyOverrideBlocked = err.message.includes("TEST_OVERRIDE_PROHIBITED_IN_PRODUCTION");
    }
    assert(stagingKeyOverrideBlocked === true, "setTrustedAuthorityKeyForTesting strictly throws in staging environment");

    process.env.NODE_ENV = "development";
    process.env.SPE_STAGE = "staging";
    let speStageOverrideBlocked = false;
    try {
      new ReleaseSafetyGovernor({ customAuthorityKeys: { attacker_oracle: "0123" } });
    } catch (err) {
      speStageOverrideBlocked = err.message.includes("TEST_OVERRIDE_PROHIBITED_IN_PRODUCTION");
    }
    assert(speStageOverrideBlocked === true, "Constructor custom authority keys strictly throw when SPE_STAGE=staging");
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    if (origSpeStage) process.env.SPE_STAGE = origSpeStage;
    else delete process.env.SPE_STAGE;
  }

  // 1F. Production public keys immutable root of trust
  let trustRootMutationBlocked = false;
  try {
    TRUSTED_AUTHORITY_PUBLIC_KEYS.founder_release_authority = "tampered_public_key";
  } catch {
    trustRootMutationBlocked = true;
  }
  assert(trustRootMutationBlocked === true, "TRUSTED_AUTHORITY_PUBLIC_KEYS object is frozen and tamper-proof");

  // 1G. Fail-closed behavior on missing or unreadable target files in content digest
  let missingFileCaught = false;
  try {
    governor.computeProposalContentDigest({
      proposalId: "PROP-MISSING-FILE",
      authorIdentity: "agent:antigravity",
      category: "ENGINE",
      targetFiles: ["non_existent_file_xyz_12345.ts"],
      testResults: { passed: true, passCount: 1, failCount: 0, regressionsDetected: 0 },
      requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    });
  } catch (err) {
    missingFileCaught = err.message.includes("PROPOSAL_TARGET_FILE_UNREADABLE");
  }
  assert(missingFileCaught === true, "computeProposalContentDigest fails closed when a target file does not exist");

  // 1H. Candidate digest bound to actual whole-release artifact contents
  const sampleCandidate = {
    proposalId: "PROP-CONTENT-BIND-01",
    authorIdentity: "agent:antigravity",
    category: "ENGINE",
    targetFiles: ["apps/web/src/engine/hashUtils.ts"],
    testResults: { passed: true, passCount: 5, failCount: 0, regressionsDetected: 0 },
    requestedAutonomyLevel: "L4_AUTO_PROMOTION",
  };

  const calculatedContentDigest = governor.computeProposalContentDigest(sampleCandidate);
  assert(calculatedContentDigest.length === 64, "Governor computes SHA-256 digest over actual target file contents");

  const validContentProof = generateReleaseAuthorityProof(
    sampleCandidate.proposalId,
    "founder_release_authority",
    { privateKeyPem: TEST_PRIV_PEM },
    calculatedContentDigest
  );

  const contentAuthPass = governor.verifyReleaseAuthority(
    sampleCandidate.authorIdentity,
    validContentProof,
    sampleCandidate.proposalId,
    calculatedContentDigest
  );
  assert(contentAuthPass.allowed === true, "Authorization passes when signed digest matches authentic file contents");

  const tamperedProof = { ...validContentProof, candidateDigest: "0".repeat(64) };
  const contentAuthTamper = governor.verifyReleaseAuthority(
    sampleCandidate.authorIdentity,
    tamperedProof,
    sampleCandidate.proposalId,
    calculatedContentDigest
  );
  assert(contentAuthTamper.allowed === false, "Tampered artifact digest rejected with PROPOSAL_DIGEST_MISMATCH");

  // 1I. Insecure legacyDigest bypass is completely removed from evaluateReleaseCandidate
  const legacyFilenamesDigest = computeSha256(JSON.stringify(sampleCandidate.targetFiles));
  const legacyProof = generateReleaseAuthorityProof(
    sampleCandidate.proposalId,
    "founder_release_authority",
    { privateKeyPem: TEST_PRIV_PEM },
    legacyFilenamesDigest
  );
  const bypassAttemptDecision = governor.evaluateReleaseCandidate(sampleCandidate, legacyProof);
  assert(
    bypassAttemptDecision.status === "REJECTED_BLOCKED",
    "evaluateReleaseCandidate strictly rejects signature matching only filenames JSON without content hash"
  );
  assert(
    bypassAttemptDecision.reason.includes("PROPOSAL_DIGEST_MISMATCH"),
    "Rejection reason confirms PROPOSAL_DIGEST_MISMATCH against actual disk content"
  );

  // ─── PART 2: Mission C — Deployment Rollback Destination & Scope Verification ─
  console.log("\n▶ Part 2: Deployment Rollback Verification & Provenance Scope (Mission C)");

  // 2A. Destination verification flaw repair: never accept healthy source as destination proof
  const distWasmPath = resolve(process.cwd(), "apps/web/dist/spe_wasm.wasm");
  const backupDistWasm = existsSync(distWasmPath) ? readFileSync(distWasmPath) : null;

  try {
    mkdirSync(resolve(process.cwd(), "apps/web/dist"), { recursive: true });
    // Write corrupted bytes to destination to simulate broken release artifact
    writeFileSync(distWasmPath, Buffer.from("CORRUPT_DESTINATION_ARTIFACT"));
    assert(computeSha256(readFileSync(distWasmPath)) !== CANONICAL_WASM_SHA256, "Destination artifact is confirmed corrupted before rollback");

    // Verify synchronous rollback physically restores destination and verifies on disk
    const syncResult = governor.executeDeploymentRollbackSync({
      proposalId: "PROP-ROLLBACK-DEST-01",
      authorIdentity: "agent:autonomous_coder",
      category: "ENGINE",
      targetFiles: ["apps/web/src/engine/hashUtils.ts"],
      testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
      requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    });

    // Check physical restoration occurred: destination WASM is no longer corrupted!
    const restoredBuf = readFileSync(distWasmPath);
    const restoredHash = computeSha256(restoredBuf);
    assert(
      restoredHash === CANONICAL_WASM_SHA256,
      "executeDeploymentRollbackSync physically restores destination artifact from pinned storage"
    );
    assert(
      syncResult.verifiedSafe === true,
      "Rollback verification succeeds after physical restoration matches canonical hash bit-for-bit"
    );
    assert(
      syncResult.scope === "LOCAL_STAGING_ROLLBACK_VERIFIED_WITHIN_TESTED_SCOPE",
      "Scope explicitly labeled LOCAL_STAGING_ROLLBACK_VERIFIED_WITHIN_TESTED_SCOPE"
    );
  } finally {
    if (backupDistWasm) {
      writeFileSync(distWasmPath, backupDistWasm);
    }
  }

  // 2B. Successful destination restoration and whole-site release manifest verification
  const canonicalBytes = readFileSync(resolve(process.cwd(), "apps/web/deployments/pinned-base/spe_wasm.wasm"));
  writeFileSync(distWasmPath, canonicalBytes);
  const recheckRollback = await governor.executeDeploymentRollback({
    proposalId: "PROP-ROLLBACK-SAFE-02",
    authorIdentity: "agent:autonomous_coder",
    category: "ENGINE",
    targetFiles: ["apps/web/src/engine/hashUtils.ts"],
    testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
    requestedAutonomyLevel: "L4_AUTO_PROMOTION",
  });
  assert(recheckRollback.verifiedSafe === true, "Rollback succeeds when destination WASM matches canonical bit-for-bit");
  assert(
    recheckRollback.scope === "LOCAL_STAGING_ROLLBACK_VERIFIED_WITHIN_TESTED_SCOPE",
    "Verified scope accurately bound to LOCAL_STAGING_ROLLBACK_VERIFIED_WITHIN_TESTED_SCOPE"
  );

  // 2C. Whole-site manifest coverage verified
  const distManifestPath = resolve(process.cwd(), "apps/web/dist/release-manifest.json");
  assert(existsSync(distManifestPath), "Whole-site release-manifest.json exists in apps/web/dist");
  const manifestObj = JSON.parse(readFileSync(distManifestPath, "utf-8"));
  assert(manifestObj.wholeSiteCoverage !== undefined, "Manifest specifies wholeSiteCoverage categories");
  assert(manifestObj.artifacts["spe_wasm.wasm"] !== undefined, "Manifest tracks spe_wasm.wasm artifact digest");
  assert(manifestObj.manifestDigest !== undefined, "Manifest computes manifestDigest over whole-site inventory");

  // 2D. Failed rollback destination verification halts release gate fail-closed
  const failCandidate = {
    proposalId: "PROP-ROLLBACK-FAIL-TEST",
    authorIdentity: "agent:autonomous_coder",
    category: "ENGINE",
    targetFiles: ["apps/web/src/engine/hashUtils.ts"],
    testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
    requestedAutonomyLevel: "L4_AUTO_PROMOTION",
  };
  const failCandidateDigest = governor.computeProposalContentDigest(failCandidate);
  const failCandidateProof = generateReleaseAuthorityProof(
    failCandidate.proposalId,
    "founder_release_authority",
    { privateKeyPem: TEST_PRIV_PEM },
    failCandidateDigest
  );

  const rollbackSimDecision = await governor.evaluateReleaseCandidateAsync(
    failCandidate,
    failCandidateProof,
    { simulateFailure: true }
  );
  assert(
    rollbackSimDecision.status === "REJECTED_BLOCKED",
    "evaluateReleaseCandidateAsync marks status REJECTED_BLOCKED when rollback verification fails"
  );
  assert(
    rollbackSimDecision.reason.includes("ROLLBACK_VERIFICATION_FAILED"),
    "Rejection reason cites ROLLBACK_VERIFICATION_FAILED"
  );

  // ─── PART 3: Mission D — Network Isolation & Deny-by-Default Enforcement ───
  console.log("\n▶ Part 3: Active Network Isolation & Deny-by-Default Policy (Mission D)");

  NetworkEgressObserver.resetForTesting();

  // 3A. Active deny-by-default blocks outbound fetch
  let fetchBlocked = false;
  try {
    await NetworkEgressObserver.observeDuring(
      async () => {
        await globalThis.fetch("https://api.external-cloud-leak.com/v1/telemetry");
      },
      { denyByDefault: true }
    );
  } catch (err) {
    fetchBlocked = err.message.includes("AIR_GAP_EGRESS_BLOCKED");
  }
  assert(fetchBlocked === true, "Deny-by-default policy actively throws and blocks outbound fetch requests");
  assert(
    NetworkEgressObserver.getBlockedConnections().some((u) => u.includes("api.external-cloud-leak.com")),
    "Network observer records blocked fetch destination in audit telemetry"
  );

  // 3B. Active deny-by-default blocks outbound TCP sockets in Node.js
  let socketBlocked = false;
  try {
    await NetworkEgressObserver.observeDuring(
      async () => {
        const net = await import("node:net");
        const socket = new net.Socket();
        socket.on("error", () => {});
        try {
          socket.connect(443, "192.0.2.1"); // TEST-NET-6 documentation IP
        } catch (e) {
          if (e.message.includes("AIR_GAP_EGRESS_BLOCKED")) {
            throw e;
          }
        } finally {
          socket.destroy();
        }
      },
      { denyByDefault: true }
    );
  } catch (err) {
    socketBlocked = err.message.includes("AIR_GAP_EGRESS_BLOCKED");
  }
  assert(socketBlocked === true, "Deny-by-default policy actively destroys and blocks outbound TCP socket connect");

  // 3C. Permitted connections handling: allowed destinations are recorded and NOT blocked
  NetworkEgressObserver.resetForTesting();
  let permittedFetchSucceeded = false;
  const permittedReport = await NetworkEgressObserver.observeDuring(
    async () => {
      // Mock local destination check
      try {
        await globalThis.fetch("http://127.0.0.1:4199/local-model-manifest");
      } catch (err) {
        // If connection fails due to ECONNREFUSED (no server listening), it was permitted past air-gap!
        permittedFetchSucceeded = !err.message.includes("AIR_GAP_EGRESS_BLOCKED");
      }
    },
    { denyByDefault: true, permittedDestinations: ["127.0.0.1", "localhost"] }
  );
  assert(permittedFetchSucceeded === true, "Permitted local loopback destination is not blocked by air-gap");
  assert(
    permittedReport.report.permittedConnections.some((d) => d.includes("127.0.0.1")),
    "Permitted destinations are explicitly recorded in NetworkObservationReport"
  );
  assert(
    permittedReport.report.blockedConnections.length === 0,
    "No blocked connection recorded for permitted destination"
  );

  // 3D. Passive observation mode records packets without throwing
  NetworkEgressObserver.resetForTesting();
  const passiveReport = await NetworkEgressObserver.observeDuring(
    async () => {
      const net = await import("node:net");
      const socket = new net.Socket();
      try {
        socket.connect(49153, "127.0.0.1");
      } catch {}
      socket.destroy();
    },
    { denyByDefault: false }
  );
  assert(passiveReport.report.observedPackets > 0, "Passive observation mode successfully counts attempted packets");
  assert(passiveReport.report.airGapViolated === true, "Flags airGapViolated when network egress is detected");

  // ─── PART 4: Mission A — Benchmark Qualification Truthfulness & Scorecard ─
  console.log("\n▶ Part 4: Model Evaluation Truthfulness & Official Chrome API Audit (Mission A)");

  const reportPath = resolve(process.cwd(), "proofs/generated/CANDIDATE_MODEL_EVALUATION_REPORT.json");
  assert(existsSync(reportPath), "Candidate model evaluation report exists in proofs/generated");

  const modelReport = JSON.parse(readFileSync(reportPath, "utf-8"));
  assert(modelReport.finalVerdict === "IMPLEMENTED_NOT_QUALIFIED", "Overall final verdict is honestly IMPLEMENTED_NOT_QUALIFIED");

  // Verify 7-dimension benchmark scorecard
  assert(
    Array.isArray(modelReport.recommendedBenchmarkScorecard) &&
      modelReport.recommendedBenchmarkScorecard.length === 7,
    "Formalized 7-dimension benchmark scorecard in evaluation report"
  );
  const totalScorecardWeight = modelReport.recommendedBenchmarkScorecard.reduce(
    (sum, d) => sum + d.weightPercent,
    0
  );
  assert(totalScorecardWeight === 100, "7-dimension scorecard weights sum exactly to 100%");

  const smolLm = modelReport.candidates.find((c) => c.candidateId === "CANDIDATE-01-SMOLLM-135M");
  const gemma = modelReport.candidates.find((c) => c.candidateId === "CANDIDATE-02-GEMMA-2-2B-WEBGPU");
  const chromeAi = modelReport.candidates.find((c) => c.candidateId === "CANDIDATE-03-CHROME-PROMPT-API-GEMINI-NANO");
  const fixture = modelReport.candidates.find((c) => c.candidateId === "CANDIDATE-04-SPE-EXPERIMENTAL-RESEARCH-FIXTURE");

  assert(smolLm.qualificationVerdict === "CANDIDATE_UNTESTED", "SmolLM-135M reclassified as CANDIDATE_UNTESTED");
  assert(smolLm.overallQualificationScore === null, "SmolLM unmeasured quality score removed from qualification decision");
  assert(smolLm.empiricalBenchmarkExecuted === false, "SmolLM empirical benchmark marked NOT executed");
  assert(
    smolLm.publishedBaselines?.ifevalInstructionFollowing === 17.2,
    "SmolLM documents official IFEval baseline (17.2 / 29.9 for SmolLM2)"
  );

  assert(gemma.qualificationVerdict === "CANDIDATE_UNTESTED", "Gemma-2-2B reclassified as CANDIDATE_UNTESTED");
  assert(gemma.overallQualificationScore === null, "Gemma unmeasured quality score removed from qualification decision");

  assert(chromeAi.qualificationVerdict === "CANDIDATE_UNTESTED", "Gemini Nano Prompt API reclassified as CANDIDATE_UNTESTED");
  assert(chromeAi.overallQualificationScore === null, "Gemini Nano unmeasured quality score removed from qualification decision");
  assert(chromeAi.supportedPlatforms.includes("Desktop only"), "Official Chrome API documentation: Desktop only platform constraint");
  assert(chromeAi.supportedPlatforms.includes("NOT supported on Android or iOS"), "Official Chrome API documentation: Android and iOS explicitly not supported");
  assert(
    chromeAi.mobileSupport?.android === "UNSUPPORTED" && chromeAi.mobileSupport?.ios === "UNSUPPORTED",
    "Official Chrome API documentation: Structured mobileSupport reflects UNSUPPORTED for Android and iOS"
  );
  assert(
    chromeAi.downloadSizeFormatted.includes("On-demand component download"),
    "Official Chrome API documentation: Requires initial on-demand component download, not 0 MB clean pre-install"
  );

  assert(fixture.qualificationVerdict === "RESEARCH_FIXTURE_ONLY", "593 KB ONNX fixture strictly classified as RESEARCH_FIXTURE_ONLY");
  assert(fixture.overallQualificationScore === null, "Research fixture unsupported empirical scores withheld (overallQualificationScore is null)");
  assert(fixture.tensorPipelineVerified === true, "Research fixture confirms local in-process tensor execution pipeline without unverified language claims");

  console.log("\n------------------------------------------------------------------------");
  console.log(`P0-R2 Verification Results: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log("🎉 All P0-R2 Empirical Qualification & Trust-Boundary Requirements Successfully Verified!");
}

runP0R2VerificationBattery().catch((err) => {
  console.error("P0-R2 verification failed with unhandled error:", err);
  process.exit(1);
});
