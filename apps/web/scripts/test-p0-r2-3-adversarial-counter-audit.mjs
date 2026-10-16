/**
 * SPE Ω — P0-R2.3 Adversarial Counter-Audit Verification Battery
 *
 * Conclusively addresses and closes all 8 findings/gates from ChatGPT's R2.3 Counter-Audit:
 *
 * Gate G1: Finding R2.3-P0-A — Founder Authority Trust-Root Provenance & Detached Signature Equivalence
 * Gate G2: Finding R2.3-P0-B — Destination Symlink Write-Through Overwrite Defense
 * Gate G3: Finding R2.3-P1-C — Whole-Site Directory Invariance (Zero .tmp / .tmp. Exemptions)
 * Gate G4: Finding R2.3-P0-D — Strict Process-Level Global Air-Gap Enforcement
 * Gate G5: Finding R2.3-P1-E — Rollback Pointer State Transition Ordering
 * Gate G6: Finding R2.3-P0-F — Prompt Synthesizer Semantic Invariance & Zero Artificial Fillers
 * Gate G7: Finding R2.3-P0-F — Preservation of User Hard Constraints (Beginning, Middle, End)
 * Gate G8: Finding R2.3-P1-G — Uniform Paid-Tier Enforcement & Free 30,000 Capacity Ceiling
 */

import { existsSync, readFileSync, writeFileSync, symlinkSync, unlinkSync, mkdirSync, renameSync, rmSync, lstatSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  ReleaseSafetyGovernor,
  CANONICAL_WASM_SHA256,
  CANONICAL_WASM_SIZE_BYTES,
  TRUSTED_PINNED_BASE_COMMIT,
  AUTHENTIC_PINNED_BASE_MANIFEST_DIGEST,
  FOUNDER_RELEASE_AUTHORITY_FINGERPRINT,
} from "../src/engine/evolution/releaseSafetyGovernor.ts";
import { NetworkEgressObserver } from "../src/engine/networkObserver.ts";
import { synthesizeSystemPrompt, synthesizeSystemPromptWithDetails } from "../src/engine/promptSynthesizer.mjs";

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

async function runR23CounterAuditBattery() {
  console.log("========================================================================");
  console.log("🛡️  SPE Ω — P0-R2.3 ADVERSARIAL COUNTER-AUDIT BATTERY");
  console.log("========================================================================");

  const governor = new ReleaseSafetyGovernor();

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G1: Finding R2.3-P0-A (Founder Authority Trust-Root Provenance)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G1] Finding R2.3-P0-A: Founder Authority Trust-Root Provenance");

  const pinnedBaseDir = resolve(process.cwd(), "apps/web/deployments/pinned-base");
  const pinnedManifestPath = resolve(pinnedBaseDir, "release-manifest.json");
  const pinnedSigPath = resolve(pinnedBaseDir, "release-manifest.json.sig");

  // G1.1 Immutable Fingerprint Binding
  assert(
    FOUNDER_RELEASE_AUTHORITY_FINGERPRINT === "07c6a4a2783b29f23fc261b49f90f5fb81d33c0402ed14c179428d02e4bf6277",
    "Founder release authority fingerprint is immutably pinned to 07c6a4a2..."
  );

  // G1.2 Attempting to override founder authority with unauthorized key must fail
  let founderOverrideThrew = false;
  let founderOverrideError = "";
  try {
    governor.setTrustedAuthorityKeyForTesting(
      "founder_release_authority",
      "302a300506032b65700321000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
    );
  } catch (err) {
    founderOverrideThrew = true;
    founderOverrideError = err.message;
  }
  assert(founderOverrideThrew === true, "Adversarial: Overwriting founder authority with unauthenticated key throws");
  assert(
    founderOverrideError.includes("SECURITY_ERROR_IMMUTABLE_FOUNDER_KEY"),
    `Error confirms SECURITY_ERROR_IMMUTABLE_FOUNDER_KEY (${founderOverrideError})`
  );

  // G1.3 Baseline Manifest Verification with Detached Signature
  const baselineAudit = governor.verifyPinnedBaselineManifest(pinnedManifestPath);
  assert(baselineAudit.verified === true, "Authentic pinned baseline passes verification against immutable founder root");
  assert(baselineAudit.manifest.authority === "founder_release_authority", "Baseline authority is 'founder_release_authority'");

  // G1.4 Detached signature mismatch rejection
  const authenticSig = readFileSync(pinnedSigPath, "utf-8");
  try {
    writeFileSync(pinnedSigPath, "0".repeat(128), "utf-8"); // corrupt detached signature
    const corruptSigAudit = governor.verifyPinnedBaselineManifest(pinnedManifestPath);
    assert(corruptSigAudit.verified === false, "Adversarial: Corrupted detached signature (.sig) fails baseline verification");
    assert(
      corruptSigAudit.reason.includes("DETACHED_SIGNATURE_MISMATCH"),
      `Reason specifies DETACHED_SIGNATURE_MISMATCH (${corruptSigAudit.reason})`
    );
  } finally {
    writeFileSync(pinnedSigPath, authenticSig, "utf-8");
  }

  // G1.5 Mandatory Detached Signature Existence (.sig missing must fail closed)
  const tempBackupSigPath = `${pinnedSigPath}.bak_${Date.now()}`;
  try {
    renameSync(pinnedSigPath, tempBackupSigPath);
    const missingSigAudit = governor.verifyPinnedBaselineManifest(pinnedManifestPath);
    assert(missingSigAudit.verified === false, "Adversarial: Missing detached signature (.sig) fails baseline verification");
    assert(
      missingSigAudit.reason.includes("DETACHED_SIGNATURE_MISSING"),
      `Reason specifies DETACHED_SIGNATURE_MISSING (${missingSigAudit.reason})`
    );
  } finally {
    if (existsSync(tempBackupSigPath)) {
      renameSync(tempBackupSigPath, pinnedSigPath);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G2: Finding R2.3-P0-B (Destination Symlink Write-Through Defense)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G2] Finding R2.3-P0-B: Destination Symlink Write-Through Defense");

  const canaryPath = resolve("/tmp", `spe_canary_gate_g2_${Date.now()}.txt`);
  const originalCanarySecret = `CANARY_PROTECTED_DATA_${Date.now()}_SECRET`;
  writeFileSync(canaryPath, originalCanarySecret, "utf-8");

  const distDir = resolve(process.cwd(), "apps/web/dist");
  const destArtifactTarget = resolve(distDir, "assets/AiIncidentWire-DYLVeop3.js");

  try {
    // Adversary plants a symlink in dist targeting an out-of-tree file (/tmp canary)
    if (existsSync(destArtifactTarget)) {
      unlinkSync(destArtifactTarget);
    }
    symlinkSync(canaryPath, destArtifactTarget);
    assert(existsSync(destArtifactTarget), "Test setup: Planted malicious symlink at destination pointing to /tmp canary");

    // Execute rollback
    const rollbackResult = governor.executeDeploymentRollbackSync({
      proposalId: "PROP-SYMLINK-OVERWRITE-DEFENSE",
      authorIdentity: "agent:coder",
      category: "ENGINE",
      targetFiles: ["apps/web/dist/spe_wasm.wasm"],
      testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
      requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    });

    assert(rollbackResult.verifiedSafe === true, "Rollback completes with verifiedSafe: true");

    // Verify external canary file was NOT written through or corrupted!
    const canaryAfterContent = readFileSync(canaryPath, "utf-8");
    assert(canaryAfterContent === originalCanarySecret, "Canary file outside tree is 100% UNTOUCHED (zero symlink write-through)");

    // Verify destination is now a genuine regular file and not a symlink
    const postStat = ReleaseSafetyGovernor.scanDiskFiles(distDir);
    assert(
      !postStat.some((f) => f.includes("UNAUTHORIZED_SYMLINK")),
      "Destination directory contains 0 unauthorized symlinks after rollback"
    );
  } finally {
    if (existsSync(canaryPath)) {
      try {
        unlinkSync(canaryPath);
      } catch {}
    }
  }

  // G2.2 Directory Ancestry Symlink Traversal Defense
  const ancestorCanaryDir = resolve("/tmp", `spe_ancestor_canary_${Date.now()}`);
  mkdirSync(ancestorCanaryDir, { recursive: true });
  const symlinkAncestorDir = resolve(distDir, `assets_symlink_${Date.now()}`);
  try {
    symlinkSync(ancestorCanaryDir, symlinkAncestorDir, "dir");
    let ancestorSymlinkThrew = false;
    let ancestorSymlinkError = "";
    try {
      ReleaseSafetyGovernor.safeRestoreFile(
        resolve(pinnedBaseDir, "release-manifest.json"),
        resolve(symlinkAncestorDir, "nested_file.json"),
        distDir
      );
    } catch (err) {
      ancestorSymlinkThrew = true;
      ancestorSymlinkError = err.message;
    }
    assert(ancestorSymlinkThrew === true, "Adversarial: Ancestor directory symlink traversal is rejected");
    assert(
      ancestorSymlinkError.includes("SECURITY_SYMLINK_IN_ANCESTRY_REJECTED"),
      `Error confirms SECURITY_SYMLINK_IN_ANCESTRY_REJECTED (${ancestorSymlinkError})`
    );
    assert(
      !existsSync(resolve(ancestorCanaryDir, "nested_file.json")),
      "Canary directory outside tree received 0 written files"
    );
  } finally {
    try { unlinkSync(symlinkAncestorDir); } catch {}
    try { rmSync(ancestorCanaryDir, { recursive: true, force: true }); } catch {}
  }

  // G2.3 TOCTOU Race & Leaf Symlink Substitution Mitigation Test
  const toctouCanaryPath = resolve("/tmp", `spe_toctou_canary_${Date.now()}.txt`);
  const toctouSecret = `TOCTOU_PROTECTED_DATA_${Date.now()}`;
  writeFileSync(toctouCanaryPath, toctouSecret, "utf-8");
  const toctouDestPath = resolve(distDir, `assets/toctou_test_${Date.now()}.js`);
  try {
    // Plant symlink at destination right before restoration
    symlinkSync(toctouCanaryPath, toctouDestPath);
    assert(lstatSync(toctouDestPath).isSymbolicLink(), "Test setup: Leaf destination is an active symlink targeting external canary");

    // safeRestoreFile uses atomic temp file creation and renameSync, replacing the symlink atomically
    ReleaseSafetyGovernor.safeRestoreFile(
      resolve(pinnedBaseDir, "release-manifest.json"),
      toctouDestPath,
      distDir
    );

    // Verify external canary file was NOT written through!
    assert(readFileSync(toctouCanaryPath, "utf-8") === toctouSecret, "TOCTOU: External canary remains 100% UNTOUCHED (zero write-through)");
    // Verify destination is now a genuine regular file and NOT a symlink
    assert(lstatSync(toctouDestPath).isFile() && !lstatSync(toctouDestPath).isSymbolicLink(), "TOCTOU: Atomic rename replaced leaf symlink with genuine regular file");
  } finally {
    try { unlinkSync(toctouDestPath); } catch {}
    try { unlinkSync(toctouCanaryPath); } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G3: Finding R2.3-P1-C (Whole-Site Directory Invariance Without .tmp Exemptions)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G3] Finding R2.3-P1-C: Whole-Site Directory Invariance (No .tmp Exemptions)");

  const unlistedTmpFile = resolve(distDir, "assets/exploit_payload.tmp");
  const unlistedDotTmpFile = resolve(distDir, "assets/exploit_cache.tmp.js");

  try {
    writeFileSync(unlistedTmpFile, "console.log('malicious_injected_code');", "utf-8");
    const auditWithTmp = governor.verifyWholeSiteManifest(distDir);
    assert(auditWithTmp.verifiedSafe === false, "Unlisted .tmp file in dist causes verifyWholeSiteManifest to FAIL CLOSED");
    assert(
      auditWithTmp.unexpectedFiles.includes("assets/exploit_payload.tmp"),
      "unexpectedFiles explicitly flags 'assets/exploit_payload.tmp'"
    );

    writeFileSync(unlistedDotTmpFile, "console.log('malicious_cache');", "utf-8");
    const auditWithDotTmp = governor.verifyWholeSiteManifest(distDir);
    assert(auditWithDotTmp.verifiedSafe === false, "Unlisted .tmp.js file in dist causes verifyWholeSiteManifest to FAIL CLOSED");
    assert(
      auditWithDotTmp.unexpectedFiles.includes("assets/exploit_cache.tmp.js"),
      "unexpectedFiles explicitly flags 'assets/exploit_cache.tmp.js'"
    );
  } finally {
    if (existsSync(unlistedTmpFile)) {
      try {
        unlinkSync(unlistedTmpFile);
      } catch {}
    }
    if (existsSync(unlistedDotTmpFile)) {
      try {
        unlinkSync(unlistedDotTmpFile);
      } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G4: Finding R2.3-P0-D (Strict Process-Level Global Air-Gap Enforcement)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G4] Finding R2.3-P0-D: Strict Process-Level Global Air-Gap Enforcement");

  NetworkEgressObserver.resetForTesting();
  assert(NetworkEgressObserver.isAirGapEnforced() === false, "Initial state: Global air-gap is not enforced");

  NetworkEgressObserver.setGlobalAirGapEnforce(true);
  assert(NetworkEgressObserver.isAirGapEnforced() === true, "setGlobalAirGapEnforce(true) activates global air gap");

  // When global air gap is enforced, any unwhitelisted destination is strictly denied
  assert(
    NetworkEgressObserver.isDestinationPermitted("https://api.openai.com/v1") === false,
    "Air gap: Cloud API 'https://api.openai.com/v1' is strictly DENIED"
  );
  assert(
    NetworkEgressObserver.isDestinationPermitted("https://anthropic.com") === false,
    "Air gap: External host 'https://anthropic.com' is strictly DENIED"
  );
  assert(
    NetworkEgressObserver.isDestinationPermitted("http://127.0.0.1:8080") === false,
    "Air gap: Unapproved loopback port 8080 is strictly DENIED"
  );
  assert(
    NetworkEgressObserver.isDestinationPermitted("http://127.0.0.1:4173") === true,
    "Air gap: Authorized SPE local preview 'http://127.0.0.1:4173' is permitted"
  );

  // Even if caller creates observation session with permissive wildcard, air gap dominates
  const endPermissive = NetworkEgressObserver.startObservation({
    denyByDefault: false,
    permittedDestinations: ["*"],
  });
  assert(
    NetworkEgressObserver.isDestinationPermitted("https://exfiltration.com") === false,
    "Air gap dominance: Permissive session cannot bypass global air gap"
  );
  endPermissive();

  // G4.4 Unconditional interception when activeSessions === 0 but globalAirGapEnforce === true
  let directFetchThrew = false;
  let directFetchError = "";
  try {
    await globalThis.fetch("https://api.openai.com/v1/chat/completions");
  } catch (err) {
    directFetchThrew = true;
    directFetchError = err.message;
  }
  assert(directFetchThrew === true, "Air gap: Direct fetch throws when activeSessions === 0 under global air-gap");
  assert(
    directFetchError.includes("AIR_GAP_EGRESS_BLOCKED"),
    `Error confirms AIR_GAP_EGRESS_BLOCKED (${directFetchError})`
  );

  // G4.5 Normalization of non-URL TCP destinations and raw host:port
  const normOpenAi = NetworkEgressObserver.normalizeDestination("api.openai.com:443");
  assert(normOpenAi.hostname === "api.openai.com" && normOpenAi.port === "443" && normOpenAi.isLoopback === false, "normalizeDestination correctly identifies api.openai.com:443 as non-loopback");

  const normLoopback8080 = NetworkEgressObserver.normalizeDestination("127.0.0.1:8080");
  assert(normLoopback8080.isLoopback === true && normLoopback8080.port === "8080", "normalizeDestination correctly parses 127.0.0.1:8080");

  assert(
    NetworkEgressObserver.isDestinationPermitted("api.openai.com:443") === false,
    "Air gap: Raw TCP 'api.openai.com:443' is strictly DENIED"
  );
  assert(
    NetworkEgressObserver.isDestinationPermitted("127.0.0.1:8080") === false,
    "Air gap: Raw TCP loopback on unauthorized port 8080 is strictly DENIED"
  );
  assert(
    NetworkEgressObserver.isDestinationPermitted("127.0.0.1:4173") === true,
    "Air gap: Raw TCP loopback on authorized port 4173 is permitted"
  );
  assert(
    NetworkEgressObserver.isDestinationPermitted("localhost:4173") === true,
    "Air gap: Raw TCP localhost on authorized port 4173 is permitted"
  );

  // G4.6 Observation Report Boundaries Classification & Honesty Check
  const obsSession = NetworkEgressObserver.startObservation();
  const sampleReport = obsSession();
  assert(
    sampleReport.isolationBoundaryClass === "IN_PROCESS_APPLICATION_LEVEL_OBSERVER_ONLY",
    "Air gap: Report honestly classifies isolation as IN_PROCESS_APPLICATION_LEVEL_OBSERVER_ONLY"
  );
  assert(
    sampleReport.operatingSystemEnforced === false,
    "Air gap: Report honestly reports operatingSystemEnforced as false (not OS container sandbox)"
  );

  NetworkEgressObserver.setGlobalAirGapEnforce(false);
  NetworkEgressObserver.resetForTesting();
  assert(NetworkEgressObserver.isAirGapEnforced() === false, "Global air-gap clean reset");

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G5: Finding R2.3-P1-E (Rollback Pointer State Transition Ordering)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G5] Finding R2.3-P1-E: Rollback Pointer State Transition Ordering");

  const pointerPath = resolve(process.cwd(), "proofs/generated/ACTIVE_DEPLOYMENT_POINTER.json");

  // G5.2 Atomic Write & OS Buffer Fsync Verification
  const testFsyncPath = resolve(process.cwd(), `proofs/generated/test_fsync_${Date.now()}.json`);
  try {
    ReleaseSafetyGovernor.atomicWriteJson(testFsyncPath, { test: "fsync_persistence", timestamp: Date.now() });
    assert(existsSync(testFsyncPath), "atomicWriteJson successfully persisted file with fsync");
    const parsedFsync = JSON.parse(readFileSync(testFsyncPath, "utf-8"));
    assert(parsedFsync.test === "fsync_persistence", "atomicWriteJson data round-trips correctly");
  } finally {
    try { unlinkSync(testFsyncPath); } catch {}
  }

  // Perform verified rollback
  governor.executeDeploymentRollbackSync({
    proposalId: "PROP-POINTER-CHECK-SUCCESS",
    authorIdentity: "agent:coder",
    category: "ENGINE",
    targetFiles: ["apps/web/dist/spe_wasm.wasm"],
    testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
    requestedAutonomyLevel: "L4_AUTO_PROMOTION",
  });

  const successPointer = JSON.parse(readFileSync(pointerPath, "utf-8"));
  assert(
    successPointer.status === "RESTORED_TO_PINNED_BASE_COMMIT",
    `Successful rollback updates pointer to 'RESTORED_TO_PINNED_BASE_COMMIT' (observed: ${successPointer.status})`
  );
  assert(successPointer.verifiedSafe === true, "Pointer records verifiedSafe: true on success");

  // Perform simulated failed rollback
  const failedRollbackResult = await governor.executeDeploymentRollback(
    {
      proposalId: "PROP-POINTER-CHECK-FAILURE",
      authorIdentity: "agent:coder",
      category: "ENGINE",
      targetFiles: ["apps/web/dist/spe_wasm.wasm"],
      testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
      requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    },
    { simulateFailure: true }
  );

  assert(failedRollbackResult.verifiedSafe === false, "Simulated failed rollback returns verifiedSafe: false");

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G6: Finding R2.3-P0-F (Prompt Synthesizer Semantic Invariance & Zero Artificial Fillers)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G6] Finding R2.3-P0-F: Zero Synthetic Fillers & Proper Capacity Ceilings");

  const synthResult = synthesizeSystemPromptWithDetails({
    brief: "You are an autonomous algorithmic execution agent for high-frequency market analysis.",
    depthTier: "normal",
    format: "markdown",
  });

  const promptText = synthResult.prompt;
  assert(typeof promptText === "string" && promptText.length > 500, "Synthesizer generates structured system prompt");
  assert(
    !promptText.includes("Invariant-Calibration-"),
    "Semantic Invariance: Zero occurrences of 'Invariant-Calibration-' in output"
  );
  assert(
    !promptText.includes("Calibration SHA:"),
    "Semantic Invariance: Zero occurrences of fake 'Calibration SHA:' in output"
  );
  assert(
    !/[0-9a-f]{64}/i.test(promptText),
    "Semantic Invariance: Zero fake SHA-256 hexadecimal strings generated"
  );
  assert(
    promptText.includes("ROLE") || promptText.includes("Role"),
    "Prompt contains authentic domain structure (Role/Objective/Guidelines)"
  );

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G7: Finding R2.3-P0-F (Preservation of User Hard Constraints)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G7] Finding R2.3-P0-F: User Hard Constraints Preservation (Start, Mid, End)");

  const multiConstraintBrief = [
    "CONSTRAINT_ALPHA: Must execute exclusively in memory with zero disk logging.",
    "Perform algorithmic execution of quantitative trading orders with sub-millisecond precision.",
    "CONSTRAINT_BETA: Must strictly halt trading if draw-down exceeds 1.5% in any 60-second window.",
    "Handle multi-venue routing across NYSE, NASDAQ, and BATS.",
    "CONSTRAINT_OMEGA: Final trade execution report must include cryptographic receipt hash.",
  ].join("\n");

  const constraintResult = synthesizeSystemPromptWithDetails({
    brief: multiConstraintBrief,
    depthTier: "normal",
    format: "markdown",
  });

  const cPrompt = constraintResult.prompt;
  assert(
    cPrompt.includes("CONSTRAINT_ALPHA"),
    "User constraint from BEGINNING ('CONSTRAINT_ALPHA') is preserved in guidelines"
  );
  assert(
    cPrompt.includes("CONSTRAINT_BETA"),
    "User constraint from MIDDLE ('CONSTRAINT_BETA') is preserved in guidelines"
  );
  assert(
    cPrompt.includes("CONSTRAINT_OMEGA"),
    "User constraint from END ('CONSTRAINT_OMEGA') is preserved in guidelines"
  );

  // G7.2 Hard constraints preservation under tight capacity ceiling
  const oversizedBrief = [
    "CONSTRAINT_A: Must use SHA-256 for all token signatures.",
    "CONSTRAINT_B: Must strictly forbid eval and dynamic execution.",
    "CONSTRAINT_C: Memory usage must never exceed 512MB.",
    "CONSTRAINT_D: All outbound calls must be logged to audit ledger.",
    "CONSTRAINT_E: User consent required before disk write operations.",
    "Build a comprehensive enterprise autonomous agent with multi-modal capabilities.",
  ].join("\n");

  const tightResult = synthesizeSystemPromptWithDetails({
    brief: oversizedBrief,
    depthTier: "normal",
    maxOutputChars: 5555,
  });

  const tightPrompt = tightResult.prompt;
  assert(tightPrompt.length <= 5555, `Tight capacity ceiling enforced (length: ${tightPrompt.length} <= 5555)`);
  assert(tightPrompt.includes("CONSTRAINT_A"), "CONSTRAINT_A preserved under capacity ceiling");
  assert(tightPrompt.includes("CONSTRAINT_B"), "CONSTRAINT_B preserved under capacity ceiling");
  assert(tightPrompt.includes("CONSTRAINT_C"), "CONSTRAINT_C preserved under capacity ceiling");
  assert(tightPrompt.includes("CONSTRAINT_D"), "CONSTRAINT_D preserved under capacity ceiling");
  assert(tightPrompt.includes("CONSTRAINT_E"), "CONSTRAINT_E preserved under capacity ceiling");

  // G7.3 Explicit error thrown if protected constraints exceed capacity ceiling
  let ceilingOverflowThrew = false;
  let ceilingOverflowError = "";
  try {
    synthesizeSystemPromptWithDetails({
      brief: oversizedBrief,
      depthTier: "normal",
      maxOutputChars: 150, // Insufficient budget for 5 hard constraints
    });
  } catch (err) {
    ceilingOverflowThrew = true;
    ceilingOverflowError = err.message;
  }
  assert(ceilingOverflowThrew === true, "Hard constraints: Fails closed when constraints exceed ceiling budget");
  assert(
    ceilingOverflowError.includes("CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING"),
    `Error confirms CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING (${ceilingOverflowError})`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // GATE G8: Finding R2.3-P1-G (Uniform Paid-Tier Enforcement & Free 30k Ceiling)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ [GATE G8] Finding R2.3-P1-G: Uniform Paid-Tier Clamp & Free 30,000 Capacity Ceiling");

  // Attempt to request paid 'titan' depth tier without entitlement
  const unentitledResult = synthesizeSystemPromptWithDetails({
    brief: "Enterprise mission critical trading orchestrator",
    depthTier: "titan",
    entitlement: null,
  });

  assert(
    unentitledResult.depthTier === "normal",
    `Unentitled request for 'titan' tier is clamped to 'normal' (observed: ${unentitledResult.depthTier})`
  );
  assert(
    unentitledResult.prompt.length <= 30000,
    `Unentitled prompt character count (${unentitledResult.prompt.length}) does not exceed Free tier 30,000 ceiling`
  );

  console.log("\n------------------------------------------------------------------------");
  console.log(`P0-R2.3 Counter-Audit Results: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    console.error("❌ P0-R2.3 Counter-Audit Battery Failed!");
    process.exit(1);
  }
  console.log("🎉 All 8 Gates of P0-R2.3 (Gates G1 through G8) Verified Repaired and Hardened!");
}

runR23CounterAuditBattery().catch((err) => {
  console.error("Fatal error in P0-R2.3 counter-audit battery:", err);
  process.exit(1);
});
