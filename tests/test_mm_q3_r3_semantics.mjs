#!/usr/bin/env node
/**
 * MM-Q3-R3: Semantic Model Truth & Digest Custody Closure Test Suite
 *
 * Epistemic Laws Enforced:
 * 1. SCRIPT_RECOGNIZER_BINDING: English recognizer cannot claim Indic/CJK/Arabic scripts.
 * 2. RECOGNIZER_CAPABILITY_TRUTH: Language claims must strictly derive from RecognizerCapability.
 * 3. DICTIONARY_RECOGNIZER_ALIGNMENT: Dictionary artifact must match recognizer script vocabulary.
 * 4. DETECTOR_RECOGNIZER_VERSION_PAIRING: PP-OCRv3 recognizer cannot be paired with PP-OCRv5 detector.
 * 5. DIGEST_TYPE_DISAMBIGUATION: FileSha256 != PayloadSha256 != ManifestDigest != ArchiveSha256.
 * 6. NO_HASH_OF_HASHES: Concatenated physical bytes must be hashed, not string-concatenated hashes.
 * 7. LEXICOGRAPHICAL_CANONICAL_PAYLOAD: Files payload concatenated in deterministic filename sort order.
 * 8. LICENSE_GATE_PRODUCTION: Models with artifactLicenseStatus HOLD/UNVERIFIED cannot be production qualified.
 *
 * 14 Mutants Tested & Killed:
 * Group 1: 7 Language False-Proof Mutants
 *   1. English recognizer claiming Telugu
 *   2. English recognizer claiming Hindi
 *   3. English dictionary with Tamil recognizer
 *   4. Telugu recognizer with Hindi dictionary
 *   5. v5 detector with v3 recognizer
 *   6. Generic alias overclaim (PaddleOCR/Multilingual alias claiming > ["en"])
 *   7. Manually expanded supportedLanguages without capability
 * Group 2: 6 Root Digest & Custody Mutants
 *   8. Hash of file-hashes mislabeled payload hash
 *   9. Manifest digest mislabeled artifact SHA
 *   10. Files reordering detection / canonical order enforcement
 *   11. Metadata + modified bytes rejected in provisionPack
 *   12. Corrupt archive rejected in unpackModelArchive
 *   13. verifiedDigest assigned without hashing provided bytes
 * Group 3: 1 Production Qualification License Hold Mutant
 *   14. Model with artifactLicenseStatus: HOLD rejected by assertProductionQualified
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
const TOTAL_MUTANTS = 14;

console.log("\n========================================================");
console.log("  SPE MM-Q3-R3: SEMANTIC MODEL TRUTH & DIGEST CUSTODY");
console.log("========================================================\n");

// ---------------------------------------------------------------------
// TEST 0: Baseline Production Semantic Validity & Script Separation Gate
// ---------------------------------------------------------------------
console.log("--- Baseline Production Gate Checks ---");

// Check stale model identities are zero
try {
  mm.assertNoStaleModelIdentities(mm.VETTED_MODEL_MANIFESTS);
  console.log("  ✓ PASS: Zero stale/fake repository strings in VETTED_MODEL_MANIFESTS");
} catch (err) {
  console.error("  ✗ FAIL: Stale identities found in VETTED_MODEL_MANIFESTS", err);
  process.exit(1);
}

// Check every vetted model manifest against provenance and semantic validity
const requiredModels = [
  "spe-whisper-tiny-int8",
  "spe-ocr-en",
  "spe-ocr-devanagari",
  "spe-ocr-telugu",
  "spe-ocr-tamil",
  "spe-ocr-paddle-int8",
  "spe-ocr-multilingual-int8",
  "spe-ui-segmenter-int8",
  "spe-ocr-trocr-int8",
];

for (const modelId of requiredModels) {
  const manifest = mm.VETTED_MODEL_MANIFESTS[modelId];
  const prov = mm.PRODUCTION_MODEL_PROVENANCE[modelId];

  assert.ok(manifest, `Missing vetted manifest for ${modelId}`);
  assert.ok(prov, `Missing provenance for ${modelId}`);

  mm.assertManifestProvenanceConsistency(manifest, prov);
  mm.assertSemanticModelValidity(manifest, prov);
  console.log(`  ✓ PASS: Semantics & Provenance verified for '${modelId}'`);
}

// Assert script separation: English recognizer is strictly Latin/English
assert.deepEqual(
  mm.VETTED_MODEL_MANIFESTS["spe-ocr-en"].supportedLanguages,
  ["en"],
  "spe-ocr-en must only claim ['en']",
);
assert.deepEqual(
  mm.VETTED_MODEL_MANIFESTS["spe-ocr-paddle-int8"].supportedLanguages,
  ["en"],
  "spe-ocr-paddle-int8 alias must be honestly scoped to ['en']",
);
assert.deepEqual(
  mm.VETTED_MODEL_MANIFESTS["spe-ocr-multilingual-int8"].supportedLanguages,
  ["en"],
  "spe-ocr-multilingual-int8 alias must be honestly scoped to ['en']",
);
assert.deepEqual(
  mm.VETTED_MODEL_MANIFESTS["spe-ocr-telugu"].supportedLanguages,
  ["te"],
  "spe-ocr-telugu must claim ['te']",
);
assert.deepEqual(
  mm.VETTED_MODEL_MANIFESTS["spe-ocr-tamil"].supportedLanguages,
  ["ta"],
  "spe-ocr-tamil must claim ['ta']",
);
assert.deepEqual(
  mm.VETTED_MODEL_MANIFESTS["spe-ocr-devanagari"].supportedLanguages,
  ["hi", "mr", "ne", "sa"],
  "spe-ocr-devanagari must claim Devanagari family",
);
console.log("  ✓ PASS: Script models separated and aliases honestly scoped to ['en']\n");

// ---------------------------------------------------------------------
// GROUP 1: 7 Language False-Proof Mutants
// ---------------------------------------------------------------------
console.log("--- Group 1: 7 Language False-Proof Mutants ---");

// MUTANT 1: English recognizer claiming Telugu
try {
  const mutantManifest = JSON.parse(
    JSON.stringify(mm.VETTED_MODEL_MANIFESTS["spe-ocr-en"]),
  );
  mutantManifest.supportedLanguages = ["en", "te"]; // Falsely claims Telugu on English rec
  mm.assertSemanticModelValidity(
    mutantManifest,
    mm.PRODUCTION_MODEL_PROVENANCE["spe-ocr-en"],
  );
  mutantsSurvived++;
  console.error("  ✗ MUTANT 1 SURVIVED: English recognizer claiming Telugu was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("claims language 'te' not supported")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 1 KILLED: English recognizer claiming Telugu strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 1 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 2: English recognizer claiming Hindi
try {
  const mutantManifest = JSON.parse(
    JSON.stringify(mm.VETTED_MODEL_MANIFESTS["spe-ocr-en"]),
  );
  mutantManifest.supportedLanguages = ["en", "hi"]; // Falsely claims Hindi on English rec
  mm.assertSemanticModelValidity(
    mutantManifest,
    mm.PRODUCTION_MODEL_PROVENANCE["spe-ocr-en"],
  );
  mutantsSurvived++;
  console.error("  ✗ MUTANT 2 SURVIVED: English recognizer claiming Hindi was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("claims language 'hi' not supported")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 2 KILLED: English recognizer claiming Hindi strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 2 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 3: English dictionary with Tamil recognizer
try {
  const mutantProv = JSON.parse(
    JSON.stringify(mm.PRODUCTION_MODEL_PROVENANCE["spe-ocr-tamil"]),
  );
  // Swap dictionary to English dict
  const dictFile = mutantProv.files.find((f) => f.name === "dict.txt");
  dictFile.upstreamUrl =
    "https://huggingface.co/monkt/paddleocr-onnx/resolve/7b02d0a30a07ba2b92ad1ff5a8941ae2c633de65/languages/english/dict.txt";

  mm.assertSemanticModelValidity(
    mm.VETTED_MODEL_MANIFESTS["spe-ocr-tamil"],
    mutantProv,
  );
  mutantsSurvived++;
  console.error("  ✗ MUTANT 3 SURVIVED: English dictionary with Tamil recognizer was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("Dictionary artifact in provenance")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 3 KILLED: English dictionary with Tamil recognizer strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 3 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 4: Telugu recognizer with Hindi dictionary
try {
  const mutantProv = JSON.parse(
    JSON.stringify(mm.PRODUCTION_MODEL_PROVENANCE["spe-ocr-telugu"]),
  );
  // Swap dictionary to Hindi dict
  const dictFile = mutantProv.files.find((f) => f.name === "dict.txt");
  dictFile.upstreamUrl =
    "https://huggingface.co/monkt/paddleocr-onnx/resolve/7b02d0a30a07ba2b92ad1ff5a8941ae2c633de65/languages/hindi/dict.txt";

  mm.assertSemanticModelValidity(
    mm.VETTED_MODEL_MANIFESTS["spe-ocr-telugu"],
    mutantProv,
  );
  mutantsSurvived++;
  console.error("  ✗ MUTANT 4 SURVIVED: Telugu recognizer with Hindi dictionary was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("Dictionary artifact in provenance")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 4 KILLED: Telugu recognizer with Hindi dictionary strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 4 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 5: v5 detector with v3 recognizer
try {
  const mutantProv = JSON.parse(
    JSON.stringify(mm.PRODUCTION_MODEL_PROVENANCE["spe-ocr-devanagari"]),
  );
  const detFile = mutantProv.files.find((f) => f.name === "det.onnx");
  detFile.upstreamUrl =
    "https://huggingface.co/monkt/paddleocr-onnx/resolve/7b02d0a30a07ba2b92ad1ff5a8941ae2c633de65/detection/v5/det.onnx";

  mm.assertSemanticModelValidity(
    mm.VETTED_MODEL_MANIFESTS["spe-ocr-devanagari"],
    mutantProv,
  );
  mutantsSurvived++;
  console.error("  ✗ MUTANT 5 SURVIVED: Incompatible v5 detector with v3 recognizer was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("Incompatible detector/recognizer version pairing")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 5 KILLED: Incompatible v5 detector with v3 recognizer strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 5 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 6: Generic alias overclaim
try {
  const mutantManifest = JSON.parse(
    JSON.stringify(mm.VETTED_MODEL_MANIFESTS["spe-ocr-multilingual-int8"]),
  );
  mutantManifest.supportedLanguages = ["en", "hi", "te", "ta", "zh"]; // Overclaiming
  mm.assertSemanticModelValidity(
    mutantManifest,
    mm.PRODUCTION_MODEL_PROVENANCE["spe-ocr-multilingual-int8"],
  );
  mutantsSurvived++;
  console.error("  ✗ MUTANT 6 SURVIVED: Generic alias language overclaim was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("claims language")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 6 KILLED: Generic alias language overclaim strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 6 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 7: Manually expanded supportedLanguages without capability
try {
  const mutantManifest = JSON.parse(
    JSON.stringify(mm.VETTED_MODEL_MANIFESTS["spe-ocr-en"]),
  );
  delete mutantManifest.recognizerCapabilityId;
  mutantManifest.supportedLanguages = ["en", "hi", "te"]; // No capability binding, claims non-Latin
  mm.assertSemanticModelValidity(mutantManifest);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 7 SURVIVED: Expanded supportedLanguages without capability was NOT caught.");
} catch (err) {
  if (err.message.includes("SEMANTIC_MODEL_INVALID") && err.message.includes("without a verified recognizerCapabilityId binding")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 7 KILLED: Expanded supportedLanguages without capability strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 7 UNEXPECTED ERROR:", err.message);
  }
}

// ---------------------------------------------------------------------
// GROUP 2: 6 Root Digest & Custody Mutants
// ---------------------------------------------------------------------
console.log("\n--- Group 2: 6 Root Digest & Custody Mutants ---");

const testFiles = {
  "encoder.onnx": new Uint8Array([1, 2, 3, 4, 5]),
  "decoder.onnx": new Uint8Array([6, 7, 8, 9, 10]),
};

// MUTANT 8: Hash of file-hashes mislabeled payload hash
try {
  const hashOfHashes = mm.computeSha256(
    Object.keys(testFiles)
      .sort()
      .map((k) => mm.computeSha256(testFiles[k]))
      .join(":"),
  );
  mm.verifyPayloadDigestSemantic(hashOfHashes, testFiles);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 8 SURVIVED: Hash of file-hashes mislabeled payload hash was NOT caught.");
} catch (err) {
  if (err.message.includes("DIGEST_SEMANTIC_VIOLATION") && err.message.includes("Hash of file-hash strings cannot be mislabeled")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 8 KILLED: Hash of file-hashes mislabeled payload hash strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 8 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 9: Manifest digest mislabeled artifact SHA
try {
  const manifest = mm.VETTED_MODEL_MANIFESTS["spe-ocr-en"];
  mm.verifyDigestSemanticDisambiguation(manifest, manifest.manifestDigest);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 9 SURVIVED: Manifest metadata digest mislabeled as artifact SHA was NOT caught.");
} catch (err) {
  if (err.message.includes("DIGEST_SEMANTIC_VIOLATION") && err.message.includes("Manifest metadata digest cannot be mislabeled")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 9 KILLED: Manifest metadata digest mislabeled as artifact SHA strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 9 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 10: Files reordering detection / canonical order enforcement
try {
  // Test canonical sorting invariance: insertion order in JS object must produce identical payload hash
  const filesA = {
    "zebra.bin": new Uint8Array([99]),
    "apple.bin": new Uint8Array([11]),
  };
  const filesB = {
    "apple.bin": new Uint8Array([11]),
    "zebra.bin": new Uint8Array([99]),
  };
  const shaA = mm.computePayloadSha256(filesA);
  const shaB = mm.computePayloadSha256(filesB);
  assert.equal(shaA, shaB, "computePayloadSha256 must be canonical and invariant to JS key order");

  // Non-canonical / tampered digest provided to assertVerifiedDigestComputedFromBytes must be rejected
  const tamperedDigest = "f".repeat(64);
  mm.assertVerifiedDigestComputedFromBytes(tamperedDigest, filesA);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 10 SURVIVED: Tampered or non-canonical digest was NOT caught.");
} catch (err) {
  if (err.message.includes("DIGEST_INTEGRITY_VIOLATION")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 10 KILLED: Canonical ordering enforced; non-canonical digest strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 10 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 11: Metadata + modified bytes rejected in provisionPack
try {
  const reg = new mm.ModelPackRegistry();
  const manifest = mm.VETTED_MODEL_MANIFESTS["spe-ocr-en"];
  const badFiles = {
    "det.onnx": new Uint8Array([0xde, 0xad, 0xbe, 0xef]), // Incorrect bytes
    "rec.onnx": new Uint8Array([0xca, 0xfe]),
    "dict.txt": new Uint8Array([0x01]),
  };
  await reg.provisionPack("spe-ocr-en", "OFFLINE_SIDELOAD", badFiles);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 11 SURVIVED: Modified bytes passed provisionPack.");
} catch (err) {
  if (err.message.includes("Digest mismatch on asset") || err.message.includes("size mismatch")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 11 KILLED: Modified bytes strictly rejected in provisionPack.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 11 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 12: Corrupt archive rejected in unpackModelArchive
try {
  const validArchive = mm.generateSyntheticModelFixturePackage("spe-ocr-en");
  // Corrupt payload bytes in archive
  const corruptedArchive = new Uint8Array(validArchive);
  corruptedArchive[corruptedArchive.length - 10] ^= 0xff;

  mm.unpackModelArchive(corruptedArchive);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 12 SURVIVED: Corrupted archive passed unpackModelArchive.");
} catch (err) {
  if (err.message.includes("Corrupted model") || err.message.includes("Digest mismatch") || err.message.includes("payload SHA mismatch")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 12 KILLED: Corrupted archive strictly rejected by unpackModelArchive.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 12 UNEXPECTED ERROR:", err.message);
  }
}

// MUTANT 13: verifiedDigest assigned without hashing provided bytes
try {
  const bogusDigest = "a".repeat(64);
  mm.assertVerifiedDigestComputedFromBytes(bogusDigest, testFiles);
  mutantsSurvived++;
  console.error("  ✗ MUTANT 13 SURVIVED: Bogus verifiedDigest was NOT caught.");
} catch (err) {
  if (err.message.includes("DIGEST_INTEGRITY_VIOLATION") && err.message.includes("does not match computed payload hash")) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 13 KILLED: verifiedDigest assigned without matching bytes strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 13 UNEXPECTED ERROR:", err.message);
  }
}

// ---------------------------------------------------------------------
// GROUP 3: 1 Production Qualification License Hold Mutant
// ---------------------------------------------------------------------
console.log("\n--- Group 3: 1 Production Qualification License Hold Mutant ---");

// MUTANT 14: Model with artifactLicenseStatus: HOLD rejected by assertProductionQualified
try {
  const reg = new mm.ModelPackRegistry();
  const pack = reg.getPack("spe-whisper-tiny-int8");
  assert.ok(pack, "Whisper pack must exist in registry");

  // Simulate pack being installed and marked READY with real binary qualification
  pack.state = "READY";
  pack.artifactClass = "PRODUCTION_RELEASE";
  pack.productionQualificationAllowed = true;
  pack.manifest.qualificationState = "QUALIFIED";
  pack.verifiedPayloadDigest = pack.manifest.expectedPayloadSha256 || pack.manifest.sha256;
  pack.verifiedDigest = pack.verifiedPayloadDigest;
  pack.artifactLicenseStatus = "HOLD"; // Conversion license is unverified HOLD

  reg.assertProductionQualified("spe-whisper-tiny-int8");
  mutantsSurvived++;
  console.error("  ✗ MUTANT 14 SURVIVED: Whisper with artifactLicenseStatus: HOLD passed assertProductionQualified.");
} catch (err) {
  if (
    err.message.includes("PRODUCTION_QUALIFICATION_REJECTED: ARTIFACT_LICENSE_UNRESOLVED") &&
    err.message.includes("Base-model license alone is insufficient")
  ) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 14 KILLED: Model with license HOLD strictly rejected from production qualification.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 14 UNEXPECTED ERROR:", err.message);
  }
}

console.log("\n========================================================");
console.log(`  SEMANTIC MUTANTS KILLED   : ${mutantsKilled} / ${TOTAL_MUTANTS}`);
console.log(`  SEMANTIC MUTANTS SURVIVED : ${mutantsSurvived} / ${TOTAL_MUTANTS}`);
console.log("========================================================\n");

if (mutantsSurvived > 0 || mutantsKilled !== TOTAL_MUTANTS) {
  console.error(`>>> ADVERSARIAL FAILURE: ${mutantsSurvived} mutants survived or ${TOTAL_MUTANTS - mutantsKilled} unkilled! <<<`);
  process.exit(1);
} else {
  console.log(`>>> ALL ${TOTAL_MUTANTS} MM-Q3-R3 FALSIFICATION MUTANTS KILLED — 0 SURVIVED <<<`);
}
