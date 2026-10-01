#!/usr/bin/env node
/**
 * MM-Q3: 15-Mutant Epistemic Falsification Test Suite
 *
 * Epistemic Laws Enforced:
 * 1. REAL_MODEL_BYTES != FIXTURE_BYTES
 * 2. SESSION_CREATED != SESSION_RUN_PROVEN
 * 3. MOCK_SESSION != REAL_NEURAL_EXECUTION
 * 4. HARDCODED_TRANSCRIPT != NEURAL_INFERENCE
 * 5. HARDCODED_OCR_TEXT != NEURAL_INFERENCE
 * 6. TOKENIZER_COMPATIBILITY != BLIND_BYTE_MATCH
 * 7. MONOLINGUAL_PASS != CODE_SWITCH_PASS
 * 8. FIXTURE_WER != REAL_BENCHMARK_WER
 * 9. STRING_LABEL_HASH != ARTIFACT_DIGEST
 * 10. UNVERIFIED_RUNTIME != QUALIFIED_BROWSER
 *
 * 15 Scenarios Falsified & Killed:
 * 1. Model file missing -> KILLED
 * 2. Zero-byte model -> KILLED
 * 3. Wrong model hash -> KILLED
 * 4. SHA computed from string label -> KILLED
 * 5. Synthetic fixture used as production model -> KILLED
 * 6. Session created but session.run not called -> KILLED
 * 7. Session.run mocked -> KILLED
 * 8. Hardcoded transcript -> KILLED
 * 9. Hardcoded OCR text -> KILLED
 * 10. Real model but wrong tokenizer -> KILLED
 * 11. Language registry mistaken for model support -> KILLED
 * 12. Monolingual pass mistaken for code-switch pass -> KILLED
 * 13. Fixture WER mistaken for real WER -> KILLED
 * 14. Network request during inference hidden -> KILLED
 * 15. Unsupported browser marked qualified -> KILLED
 */

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Bundle multimodal modules
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

let mutantsKilled = 0;
let mutantsSurvived = 0;
const TOTAL_MUTANTS = 15;

console.log("\n========================================================");
console.log("  SPE MM-Q3: 15-MUTANT EPISTEMIC FALSIFICATION SUITE");
console.log("========================================================\n");

// ---------------------------------------------------------------------
// MUTANT 1: Model file missing
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  // Provisioning with empty files object (missing required files)
  await reg.provisionPack("spe-whisper-tiny-int8", "EXPLICIT_DOWNLOAD", {});
  mutantsSurvived++;
  console.error("  ✗ MUTANT 1 SURVIVED: Missing required model files accepted!");
} catch (err) {
  if (/Missing required (model asset|file)/i.test(err.message)) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 1 KILLED: Missing required model file strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 1 SURVIVED with unexpected error:", err.message);
  }
}

// ---------------------------------------------------------------------
// MUTANT 2: Zero-byte model
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  // Provisioning with zero-byte model file
  await reg.provisionPack("spe-whisper-tiny-int8", "EXPLICIT_DOWNLOAD", {
    "encoder_model_quantized.onnx": new Uint8Array(0),
    "decoder_model_merged_quantized.onnx": new Uint8Array(100),
    "tokenizer.json": new Uint8Array(100),
  });
  mutantsSurvived++;
  console.error("  ✗ MUTANT 2 SURVIVED: Zero-byte model file accepted!");
} catch (err) {
  if (/Zero-byte model asset rejected/i.test(err.message)) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 2 KILLED: Zero-byte model asset strictly detected and rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 2 SURVIVED with unexpected error:", err.message);
  }
}

// ---------------------------------------------------------------------
// MUTANT 3: Wrong model hash
// ---------------------------------------------------------------------
try {
  const archive = mm.generateVettedOfflinePackage("spe-whisper-tiny-int8");
  const tampered = new Uint8Array(archive);
  tampered[tampered.length - 10] ^= 0xff; // Flip bits in model payload
  mm.unpackModelArchive(tampered);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 3 SURVIVED: Model bytes with wrong hash accepted!");
} catch (err) {
  if (/Digest mismatch for model asset/i.test(err.message)) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 3 KILLED: Tampered model bytes with invalid hash strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 3 SURVIVED with unexpected error:", err.message);
  }
}

// ---------------------------------------------------------------------
// MUTANT 4: SHA computed from string label
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  const labelDigest = mm.computeSha256("whisper-tiny-tokenizer-v1");
  assert.equal(mm.isStringLabelDerivedDigest(labelDigest), true);

  const manifestWithStringLabelHash = {
    modelId: "spe-string-label-model",
    version: "1.0.0",
    displayName: "String Label Derived Hash Model",
    task: "asr-speech-transcription",
    supportedTasks: ["asr-speech-transcription"],
    source: "local",
    license: "MIT",
    expectedSizeBytes: 1024,
    sha256: labelDigest,
    files: [
      {
        name: "model.onnx",
        sizeBytes: 1024,
        sha256: "7d1b3f94a28c460195e8bc4a54c30c8ef2829e0839e1a8bb23126f59b6c00d41",
        required: true,
      },
    ],
    supportedRuntimes: ["WASM"],
    supportedLanguages: ["en"],
    minimumMemoryMb: 64,
    quantization: "INT8",
    provenance: "string-label",
    qualificationState: "QUALIFIED",
  };

  const validation = reg.validateManifest(manifestWithStringLabelHash);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 4 SURVIVED: String-label derived digest accepted!");
  } else if (validation.errors.some((e) => /String-label derived.*digest rejected/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 4 KILLED: String-label derived digest identified and rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 4 SURVIVED with unexpected error:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 4 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 5: Synthetic fixture used as production model
// ---------------------------------------------------------------------
try {
  const reg = new mm.ModelPackRegistry();
  const synthArchive = mm.generateSyntheticModelFixturePackage("spe-whisper-tiny-int8");
  await reg.sideloadPack(synthArchive);

  // Attempting production qualification on synthetic pack MUST FAIL
  reg.assertProductionQualified("spe-whisper-tiny-int8");
  mutantsSurvived++;
  console.error("  ✗ MUTANT 5 SURVIVED: Synthetic model fixture accepted as production!");
} catch (err) {
  if (/TEST_FIXTURE|PRODUCTION_QUALIFICATION_REJECTED/i.test(err.message)) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 5 KILLED: Synthetic model fixture strictly blocked from production qualification.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 5 SURVIVED with unexpected error:", err.message);
  }
}

// ---------------------------------------------------------------------
// MUTANT 6: Session created but session.run not called
// ---------------------------------------------------------------------
try {
  const receiptWithNoRun = {
    sessionId: "asr-no-run-session",
    modelId: "spe-whisper-tiny-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 10,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    artifactClass: "PRODUCTION_RELEASE",
    productionQualificationAllowed: true,
    sessionCreateProven: true,
    sessionRunProven: false, // Session created, but run was never called!
  };

  assert.throws(
    () => mm.validateInferenceReceipt(receiptWithNoRun),
    /EXECUTION INTEGRITY VIOLATION.*session\.run was not proven/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 6 KILLED: Session create without session.run execution strictly blocked.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 6 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 7: Session.run mocked
// ---------------------------------------------------------------------
try {
  const receiptWithMockRun = {
    sessionId: "asr-mock-session",
    modelId: "spe-whisper-tiny-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 10,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    artifactClass: "PRODUCTION_RELEASE",
    productionQualificationAllowed: true,
    isMockSession: true, // Mocked session!
    sessionRunProven: true,
  };

  assert.throws(
    () => mm.validateInferenceReceipt(receiptWithMockRun),
    /EXECUTION INTEGRITY VIOLATION.*Mocked session/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 7 KILLED: Mocked inference session run strictly rejected.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 7 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 8: Hardcoded transcript
// ---------------------------------------------------------------------
try {
  const receiptWithHardcodedTranscript = {
    sessionId: "asr-hardcoded-text",
    modelId: "spe-whisper-tiny-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 10,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    artifactClass: "PRODUCTION_RELEASE",
    productionQualificationAllowed: true,
    hasHardcodedTranscript: true, // Hardcoded transcript!
  };

  assert.throws(
    () => mm.validateInferenceReceipt(receiptWithHardcodedTranscript),
    /EPISTEMIC VIOLATION.*Hardcoded transcript/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 8 KILLED: Hardcoded transcript claiming production inference strictly rejected.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 8 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 9: Hardcoded OCR text
// ---------------------------------------------------------------------
try {
  const receiptWithHardcodedOcr = {
    sessionId: "ocr-hardcoded-text",
    modelId: "spe-ocr-multilingual-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 10,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    artifactClass: "PRODUCTION_RELEASE",
    productionQualificationAllowed: true,
    hasHardcodedOcrText: true, // Hardcoded OCR text!
  };

  assert.throws(
    () => mm.validateInferenceReceipt(receiptWithHardcodedOcr),
    /EPISTEMIC VIOLATION.*Hardcoded OCR text/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 9 KILLED: Hardcoded OCR text claiming production inference strictly rejected.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 9 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 10: Real model but wrong tokenizer
// ---------------------------------------------------------------------
try {
  // Empty tokenizer or missing Whisper special tokens
  const invalidTokenizerJson = new TextEncoder().encode(
    JSON.stringify({ model: { vocab: { "hello": 1, "world": 2 } } })
  );

  assert.throws(
    () => mm.verifyTokenizerCompatibility("spe-whisper-tiny-int8", invalidTokenizerJson),
    /TOKENIZER MISMATCH.*Missing Whisper special tokens/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 10 KILLED: Mismatched tokenizer missing required model vocabulary strictly rejected.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 10 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 11: Language registry mistaken for model support
// ---------------------------------------------------------------------
try {
  const frStatus = mm.getLanguageQualificationStatus("fr");
  assert.equal(frStatus.uiLocaleAvailable, true);
  assert.equal(frStatus.asrBenchmarked, false, "French must NOT be falsely marked as ASR benchmarked!");
  assert.equal(frStatus.ocrBenchmarked, false, "French must NOT be falsely marked as OCR benchmarked!");
  assert.equal(frStatus.realBenchmarkExecuted, false);

  const asr = new mm.LocalAsrEngine();
  assert.equal(asr.supportsLanguage("klingon"), false);

  const unsuppResult = await asr.transcribe({
    audioBytes: new Uint8Array(100),
    language: "klingon",
  });
  assert.equal(unsuppResult.truthState, "LOCAL_ASR_UNAVAILABLE");

  mutantsKilled++;
  console.log("  ✓ MUTANT 11 KILLED: UI locale availability strictly separated from real neural benchmark qualification.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 11 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 12: Monolingual pass mistaken for code-switch pass
// ---------------------------------------------------------------------
try {
  // Epistemic Law: English PASS + Hindi PASS != Hinglish PASS
  const codeSwitchUnbenchmarked = mm.evaluateCodeSwitchStatus("en", "hi", true, true);
  assert.equal(
    codeSwitchUnbenchmarked,
    "NOT_TESTED",
    "Code-switch must remain NOT_TESTED without dedicated code-switch benchmark receipt"
  );

  // With verified benchmark receipt, it transitions to QUALIFIED_WITHIN_TESTED_SCOPE
  const codeSwitchQualified = mm.evaluateCodeSwitchStatus("en", "hi", true, true, {
    executed: true,
    status: "QUALIFIED_WITHIN_TESTED_SCOPE",
  });
  assert.equal(codeSwitchQualified, "QUALIFIED_WITHIN_TESTED_SCOPE");

  mutantsKilled++;
  console.log("  ✓ MUTANT 12 KILLED: Epistemic law enforced: Monolingual PASS != Code-switch PASS.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 12 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 13: Fixture WER mistaken for real WER
// ---------------------------------------------------------------------
try {
  const fakeRealReport = {
    fixturesEvaluated: 4,
    benchmarkClass: "REAL_MODEL_EVALUATION",
    realModelExecuted: false, // Discrepancy! Fixture evaluated but labeled REAL_MODEL_EVALUATION
  };

  assert.throws(
    () => mm.validateBenchmarkReport(fakeRealReport),
    /EPISTEMIC VIOLATION.*Cannot report REAL_MODEL_EVALUATION when realModelExecuted=false/i
  );

  // Vacuous report (0 fixtures) must also throw
  assert.throws(
    () => mm.validateBenchmarkReport({ fixturesEvaluated: 0 }),
    /VACUOUS BENCHMARK/i
  );

  mutantsKilled++;
  console.log("  ✓ MUTANT 13 KILLED: Synthetic fixture evaluation falsely labeled REAL_MODEL_EVALUATION blocked.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 13 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 14: Network request during inference hidden
// ---------------------------------------------------------------------
try {
  const leakingReceipt = {
    sessionId: "asr-leak-mmq3",
    modelId: "spe-whisper-tiny-int8",
    backend: "WASM",
    deviceCapability: { webGpuSupported: false, wasmSupported: true, threadsAvailable: 4, deviceClass: "DESKTOP" },
    inferenceTimeMs: 15,
    inputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    outputDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    rawUserDataEgress: 0,
    networkTrace: {
      modelDownloadNetworkBytes: 0,
      inferenceNetworkBytes: 1024, // Privacy violation!
      rawMediaEgressBytes: 0,
      derivedTextEgressBytes: 0,
      telemetryEgressBytes: 0,
    },
  };

  assert.throws(
    () => mm.validateInferenceReceipt(leakingReceipt),
    /PRIVACY VIOLATION.*inferenceNetworkBytes/i
  );

  mutantsKilled++;
  console.log("  ✓ MUTANT 14 KILLED: Hidden network request during local inference detected and blocked.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 14 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 15: Unsupported browser marked qualified
// ---------------------------------------------------------------------
try {
  const negotiator = mm.globalDeviceNegotiator;
  const unqualifiedEnv = negotiator.qualifyBrowserEnvironment({
    browser: "other",
    os: "other",
    hasWebGpu: false,
    hasWasmSimd: false,
  });

  assert.equal(
    unqualifiedEnv,
    "UNAVAILABLE",
    "Environment lacking both WebGPU and WASM SIMD must be UNAVAILABLE"
  );

  mutantsKilled++;
  console.log("  ✓ MUTANT 15 KILLED: Unsupported browser/runtime environment strictly marked UNAVAILABLE.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 15 SURVIVED:", err);
}

console.log("\n========================================================");
console.log(`  MUTANTS KILLED   : ${mutantsKilled} / ${TOTAL_MUTANTS}`);
console.log(`  MUTANTS SURVIVED : ${mutantsSurvived} / ${TOTAL_MUTANTS}`);
console.log("========================================================\n");

assert.equal(mutantsSurvived, 0, "All 15 falsification mutants MUST be killed!");
assert.equal(mutantsKilled, TOTAL_MUTANTS, "All 15 falsification mutants MUST be killed!");
console.log(">>> ALL 15 MM-Q3 FALSIFICATION MUTANTS KILLED — 0 SURVIVED <<<\n");
