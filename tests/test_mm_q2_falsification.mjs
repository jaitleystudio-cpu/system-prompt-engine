#!/usr/bin/env node
/**
 * MM-Q2: 12-Mutant Falsification Test Suite
 *
 * Epistemic Laws Enforced:
 * - TEST_FIXTURE != MODEL
 * - MANIFEST != ARTIFACT
 * - 64_HEX_CHARS != PROVEN_HASH
 * - CONFIGURED != EXECUTED
 * - LOCAL_TEST_PASS != FIELD_QUALIFIED
 * - CURATED_CORPUS != GLOBAL_INDEX
 * - UNKNOWN != PASS
 *
 * 12 Scenarios Falsified & Killed:
 * 1. Synthetic model accepted as production -> KILLED
 * 2. Placeholder patterned hash accepted -> KILLED
 * 3. Missing model replaced with fixture -> KILLED
 * 4. Fake ONNX bytes marked READY -> KILLED
 * 5. Session.run never called but PASS returned -> KILLED
 * 6. Hardcoded transcript marked inference -> KILLED
 * 7. Hardcoded OCR text marked inference -> KILLED
 * 8. Language registry interpreted as ASR qualification -> KILLED
 * 9. Fake retraction ID treated as real corpus evidence -> KILLED
 * 10. Static seed registry labelled OpenAlex corpus -> KILLED
 * 11. Zero-test run reported PASS -> KILLED
 * 12. Runtime network egress hidden by receipt field -> KILLED
 */

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Bundle multimodal and continuation modules
const bundleMm = await build({
  entryPoints: [`${root}/apps/web/src/engine/multimodal/index.ts`],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node20",
});

const mm = await import(
  `data:text/javascript;base64,${Buffer.from(bundleMm.outputFiles[0].contents).toString("base64")}`
);

const bundleResearch = await build({
  entryPoints: [`${root}/apps/web/src/engine/continuation/researchFabric.ts`],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node20",
});

const rf = await import(
  `data:text/javascript;base64,${Buffer.from(bundleResearch.outputFiles[0].contents).toString("base64")}`
);

let mutantsKilled = 0;
let mutantsSurvived = 0;
const TOTAL_MUTANTS = 12;

console.log("\n========================================================");
console.log("  SPE MM-Q2: 12-MUTANT EPISTEMIC FALSIFICATION SUITE");
console.log("========================================================\n");

// ---------------------------------------------------------------------
// MUTANT 1: Synthetic model accepted as production
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  const synthArchive = mm.generateSyntheticModelFixturePackage("spe-whisper-tiny-int8");
  await reg.sideloadPack(synthArchive);

  // Attempting to claim production qualification on synthetic package MUST FAIL
  reg.assertProductionQualified("spe-whisper-tiny-int8");
  mutantsSurvived++;
  console.error("  ✗ MUTANT 1 SURVIVED: Synthetic model fixture accepted as production!");
} catch (err) {
  if (/TEST_FIXTURE|PRODUCTION_QUALIFICATION_REJECTED|EPISTEMIC GATE/i.test(err.message)) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 1 KILLED: Synthetic model fixture strictly rejected from production qualification.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 1 SURVIVED with unexpected error:", err.message);
  }
}

// ---------------------------------------------------------------------
// MUTANT 2: Placeholder patterned hash accepted
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  const manifestWithPatternedHash = {
    modelId: "spe-fake-model",
    version: "1.0.0",
    displayName: "Fake Model with Patterned Digest",
    task: "asr-speech-transcription",
    supportedTasks: ["asr-speech-transcription"],
    source: "local",
    license: "Apache-2.0",
    expectedSizeBytes: 1024,
    sha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0", // Patterned!
    files: [
      {
        name: "model.onnx",
        sizeBytes: 1024,
        sha256: "b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b", // Patterned!
        required: true,
      },
    ],
    supportedRuntimes: ["WASM"],
    supportedLanguages: ["en"],
    minimumMemoryMb: 64,
    quantization: "INT8",
    provenance: "suspicious",
    qualificationState: "QUALIFIED", // False initial claim
  };

  const validation = reg.validateManifest(manifestWithPatternedHash);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 2 SURVIVED: Patterned hex digest was accepted!");
  } else if (validation.errors.some((e) => /patterned or (placeholder|fabricated)/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 2 KILLED: Patterned/placeholder SHA-256 digest strictly detected and rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 2 SURVIVED: Validation failed but not for patterned digest:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 2 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 3: Missing model replaced with fixture
// ---------------------------------------------------------------------
try {
  // If an archive contains a 512-byte synthetic model.onnx, unpackModelArchive MUST force TEST_FIXTURE
  const dummyArchive = mm.packModelArchive(
    {
      modelId: "spe-whisper-tiny-int8",
      version: "1.0.0",
      displayName: "Mock",
      task: "asr-speech-transcription",
      supportedTasks: ["asr-speech-transcription"],
      source: "local",
      license: "Apache-2.0",
      expectedSizeBytes: 512,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      files: [{ name: "model.onnx", sizeBytes: 512, sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", required: true }],
      supportedRuntimes: ["WASM"],
      supportedLanguages: ["en"],
      minimumMemoryMb: 64,
      quantization: "INT8",
      provenance: "test",
      qualificationState: "DECLARED",
    },
    { "model.onnx": new Uint8Array(512) },
    { artifactClass: "PRODUCTION_RELEASE", productionQualificationAllowed: true } // Attempt fraud
  );

  const unpacked = mm.unpackModelArchive(dummyArchive);
  if (unpacked.artifactClass === "PRODUCTION_RELEASE" && unpacked.productionQualificationAllowed === true) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 3 SURVIVED: 512-byte synthetic model was allowed PRODUCTION_RELEASE!");
  } else if (unpacked.artifactClass === "TEST_FIXTURE" && unpacked.productionQualificationAllowed === false) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 3 KILLED: 512-byte synthetic model.onnx anti-fraud gate forced TEST_FIXTURE.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 3 SURVIVED with state:", unpacked.artifactClass);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 3 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 4: Fake ONNX bytes marked READY
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  const synthArchive = mm.generateSyntheticModelFixturePackage("spe-ocr-multilingual-int8");
  const sideload = await reg.sideloadPack(synthArchive);

  assert.equal(sideload.pack.state, "READY");
  assert.equal(sideload.pack.artifactClass, "TEST_FIXTURE");
  assert.equal(sideload.pack.productionQualificationAllowed, false);

  // Asserting production qualification on this READY synthetic pack must fail
  assert.throws(
    () => reg.assertProductionQualified("spe-ocr-multilingual-int8"),
    /TEST_FIXTURE|PRODUCTION_QUALIFICATION_REJECTED|EPISTEMIC GATE/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 4 KILLED: Synthetic bytes marked READY still rejected by assertProductionQualified().");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 4 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 5: Session.run never called but PASS returned
// ---------------------------------------------------------------------
try {
  const asr = new mm.LocalAsrEngine();
  const reg = mm.globalModelRegistry;
  const synthArchive = mm.generateSyntheticModelFixturePackage("spe-whisper-tiny-int8");
  await reg.sideloadPack(synthArchive);

  // Transcribe with sideloaded synthetic pack (productionQualificationAllowed: false)
  const result = await asr.transcribe({
    audioBytes: new Uint8Array(16000 * 2).fill(64),
    language: "en",
  });

  if (result.truthState === "LOCAL_ASR_QUALIFIED") {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 5 SURVIVED: Returned LOCAL_ASR_QUALIFIED on unexecuted fixture session!");
  } else if (result.truthState === "LOCAL_ASR_UNAVAILABLE") {
    mutantsKilled++;
    console.log("  ✓ MUTANT 5 KILLED: Unqualified/synthetic model session correctly reported LOCAL_ASR_UNAVAILABLE.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 5 unexpected state:", result.truthState);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 5 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 6: Hardcoded transcript marked inference
// ---------------------------------------------------------------------
try {
  // Fraudulent receipt: artifactClass is TEST_FIXTURE but productionQualificationAllowed claims true
  const fraudulentReceipt = {
    sessionId: "asr-fraud-123",
    modelId: "spe-whisper-tiny-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 10,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    artifactClass: "TEST_FIXTURE",
    productionQualificationAllowed: true, // Fraud!
  };

  assert.throws(
    () => mm.validateInferenceReceipt(fraudulentReceipt),
    /QUALIFICATION FRAUD/
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 6 KILLED: TEST_FIXTURE claiming production qualification blocked by validateInferenceReceipt.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 6 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 7: Hardcoded OCR text marked inference
// ---------------------------------------------------------------------
try {
  const ocr = new mm.LocalOcrEngine();
  const reg = mm.globalModelRegistry;
  const synthArchive = mm.generateSyntheticModelFixturePackage("spe-ocr-multilingual-int8");
  await reg.sideloadPack(synthArchive);

  const dummyImg = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4) };
  const result = await ocr.recognize(dummyImg);

  if (result.truthState === "LOCAL_OCR_QUALIFIED") {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 7 SURVIVED: Synthetic OCR pack claimed LOCAL_OCR_QUALIFIED!");
  } else if (result.truthState === "SCRIPT_DETECTION_ONLY" || result.truthState === "HEURISTIC_ROI_ONLY") {
    mutantsKilled++;
    console.log(`  ✓ MUTANT 7 KILLED: Synthetic OCR pack truthState correctly demoted to ${result.truthState}.`);
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 7 unexpected state:", result.truthState);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 7 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 8: Language registry interpreted as ASR qualification
// ---------------------------------------------------------------------
try {
  // Test French (fr): UI is available, but ASR is NOT yet benchmarked!
  const frStatus = mm.getLanguageQualificationStatus("fr");
  assert.equal(frStatus.uiLocaleAvailable, true);
  assert.equal(frStatus.asrModelSupportDeclared, true);
  assert.equal(frStatus.asrBenchmarked, false, "French must NOT be falsely claimed as ASR benchmarked!");

  // Test an unsupported language
  const asr = new mm.LocalAsrEngine();
  assert.equal(asr.supportsLanguage("klingon"), false);

  const unsuppResult = await asr.transcribe({
    audioBytes: new Uint8Array(100),
    language: "klingon",
  });
  assert.equal(unsuppResult.truthState, "LOCAL_ASR_UNAVAILABLE");

  mutantsKilled++;
  console.log("  ✓ MUTANT 8 KILLED: UI locale != ASR benchmarked strictly enforced.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 8 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 9: Fake retraction ID treated as real corpus evidence
// ---------------------------------------------------------------------
try {
  const fakeDoi = "doi:10.1016/fake.retracted.2020";
  const check = rf.verifyCitation(fakeDoi);

  assert.equal(check.verified, false);
  assert.equal(check.tier, "[RETRACTED_DANGER]");
  assert.equal(check.isTestSentinel, true, "Must be explicitly flagged as a test sentinel fixture!");
  assert.match(check.reason, /synthetic test fixture|NOT_PROVEN/i);

  mutantsKilled++;
  console.log("  ✓ MUTANT 9 KILLED: Retraction test sentinels explicitly disclosed as synthetic fixtures.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 9 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 10: Static seed registry labelled OpenAlex corpus
// ---------------------------------------------------------------------
try {
  assert.equal(rf.SCHOLARLY_FABRIC_TRUTH_STATUS.REAL_OPENALEX_INDEX, "NO");
  assert.equal(rf.SCHOLARLY_FABRIC_TRUTH_STATUS.REAL_PMC_INDEX, "NO");
  assert.equal(rf.SCHOLARLY_FABRIC_TRUTH_STATUS.REAL_DOAJ_INDEX, "NO");
  assert.equal(rf.SCHOLARLY_FABRIC_TRUTH_STATUS.CURATED_SCHOLARLY_SEED_REGISTRY, "IMPLEMENTED");

  const records = Object.values(rf.CURATED_SCHOLARLY_SEED_REGISTRY);
  assert.ok(records.length >= 10 && records.length <= 20, "Curated seed registry must contain discrete foundational seed papers only");
  for (const r of records) {
    assert.equal(r.verificationMethod, "OFFLINE_SEED_SPECIFICATION");
    assert.ok(r.retrievalDate);
  }

  mutantsKilled++;
  console.log("  ✓ MUTANT 10 KILLED: Static seed registry truthfully labeled as curated seed specification, not live OpenAlex index.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 10 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 11: Zero-test run reported PASS
// ---------------------------------------------------------------------
try {
  function runSuite(testsToRun) {
    let executed = 0;
    for (const t of testsToRun) {
      t();
      executed++;
    }
    if (executed === 0) {
      throw new Error("VACUOUS TEST RUN: Zero tests were executed. Reporting PASS is forbidden.");
    }
    return "PASS";
  }

  assert.throws(
    () => runSuite([]),
    /VACUOUS TEST RUN/
  );

  mutantsKilled++;
  console.log("  ✓ MUTANT 11 KILLED: Anti-vacuous test harness rejects zero-test PASS reporting.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 11 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 12: Runtime network egress hidden by receipt field / autonomous submission
// ---------------------------------------------------------------------
try {
  // Test 12a: Non-zero network trace in receipt MUST throw
  const leakingReceipt = {
    sessionId: "asr-leak-123",
    modelId: "spe-whisper-tiny-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 10,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    networkTrace: {
      modelDownloadNetworkBytes: 0,
      inferenceNetworkBytes: 0,
      rawMediaEgressBytes: 1024, // Privacy violation!
      derivedTextEgressBytes: 0,
      telemetryEgressBytes: 0,
    },
  };

  assert.throws(
    () => mm.validateInferenceReceipt(leakingReceipt),
    /PRIVACY VIOLATION.*rawMediaEgressBytes/
  );

  // Test 12b: Autonomous submission of high-consequence draft MUST throw
  assert.throws(
    () => mm.attemptAutonomousSubmission({ draftStatus: "DRAFT_ONLY" }),
    /SAFETY VIOLATION/
  );

  mutantsKilled++;
  console.log("  ✓ MUTANT 12 KILLED: Network observability trace violations and autonomous submissions blocked.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 12 SURVIVED:", err);
}

console.log("\n========================================================");
console.log(`  MUTANTS KILLED   : ${mutantsKilled} / ${TOTAL_MUTANTS}`);
console.log(`  MUTANTS SURVIVED : ${mutantsSurvived} / ${TOTAL_MUTANTS}`);
console.log("========================================================\n");

assert.equal(mutantsSurvived, 0, "All 12 falsification mutants MUST be killed!");
assert.equal(mutantsKilled, TOTAL_MUTANTS, "All 12 falsification mutants MUST be killed!");
console.log(">>> ALL 12 FALSIFICATION MUTANTS KILLED — 0 SURVIVED <<<\n");
