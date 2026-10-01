#!/usr/bin/env node
/**
 * MM-Q3-R: Provenance Custody Repair Test Suite
 *
 * Epistemic Laws Enforced:
 * 1. REAL_REPOSITORY_URL != INVENTED_STRING
 * 2. IMMUTABLE_REVISION != PATTERNED_HEX
 * 3. REAL_PAYLOAD_BYTES != LFS_POINTER_TEXT
 * 4. MEASURED_FILE_SIZE != ESTIMATED_GUESS
 * 5. SCRIPT_SPECIFIC_RECOGNIZER != GENERIC_MULTILINGUAL_CLAIM
 * 6. NO CUSTODY STATE SKIPPING: DECLARED -> SOURCE_VERIFIED -> DOWNLOADED -> HASH_VERIFIED -> RUNTIME_LOADED -> SESSION_CREATED -> SESSION_RUN -> BENCHMARKED -> FIELD_QUALIFIED
 *
 * 11 Mutants Tested & Killed:
 * 1. Fake 40-char patterned revision -> KILLED
 * 2. Nonexistent repository -> KILLED
 * 3. Real repo with nonexistent revision -> KILLED
 * 4. Real revision with wrong file -> KILLED
 * 5. Correct filename with wrong bytes -> KILLED
 * 6. Correct bytes with wrong SHA -> KILLED
 * 7. LFS pointer hashed instead of model payload -> KILLED
 * 8. Estimated file size treated as measured -> KILLED
 * 9. License copied from base model without repository verification -> KILLED
 * 10. Unsupported script promoted to supported -> KILLED
 * 11. SOURCE_VERIFIED promoted directly to SESSION_RUN -> KILLED
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
const TOTAL_MUTANTS = 11;

console.log("\n========================================================");
console.log("  SPE MM-Q3-R: PROVENANCE CUSTODY REPAIR FALSIFICATION SUITE");
console.log("========================================================\n");

// ---------------------------------------------------------------------
// MUTANT 1: Fake 40-char patterned revision
// ---------------------------------------------------------------------
try {
  const patternedRevision = "a6b8c9d0e1f23456789abcdef0123456789abcde";
  assert.equal(mm.isPatternedRevision(patternedRevision), true);

  const fakeProv = {
    modelId: "spe-fake-whisper",
    baseModel: "openai/whisper-tiny",
    upstreamRepository: "https://huggingface.co/onnx-community/whisper-tiny",
    revision: patternedRevision,
    license: "Apache-2.0",
    files: [],
    totalSizeBytes: 1000,
    custodyState: "DECLARED",
    custodyStatus: "CUSTODY_PENDING",
  };

  const validation = mm.validateUpstreamProvenance(fakeProv);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 1 SURVIVED: Patterned revision accepted as valid upstream provenance!");
  } else if (validation.errors.some((e) => /patterned|fake|synthetic revision/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 1 KILLED: Patterned/synthetic revision strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 1 SURVIVED with unexpected validation errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 1 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 2: Nonexistent repository
// ---------------------------------------------------------------------
try {
  const fakeProv = {
    modelId: "spe-fake-whisper",
    baseModel: "openai/whisper-tiny",
    upstreamRepository: "https://huggingface.co/onnx-community/nonexistent-fabricated-repo-xyz123",
    revision: "6d4fb5abc94227ee92e43fc5091278851eadf8a0",
    license: "Apache-2.0",
    files: [],
    totalSizeBytes: 1000,
    custodyState: "DECLARED",
    custodyStatus: "CUSTODY_PENDING",
  };

  const validation = mm.validateUpstreamProvenance(fakeProv);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 2 SURVIVED: Invented repository name accepted!");
  } else if (validation.errors.some((e) => /unverified|nonexistent|invented repository/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 2 KILLED: Invented repository name strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 2 SURVIVED with unexpected validation errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 2 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 3: Real repo with nonexistent revision
// ---------------------------------------------------------------------
try {
  const fakeProv = {
    modelId: "spe-whisper-tiny-int8",
    baseModel: "openai/whisper-tiny",
    upstreamRepository: "https://huggingface.co/onnx-community/whisper-tiny",
    revision: "0000000000000000000000000000000000000000", // Nonexistent commit
    license: "Apache-2.0",
    files: [],
    totalSizeBytes: 1000,
    custodyState: "DECLARED",
    custodyStatus: "CUSTODY_PENDING",
  };

  const validation = mm.validateUpstreamProvenance(fakeProv);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 3 SURVIVED: Nonexistent commit revision accepted!");
  } else if (validation.errors.some((e) => /nonexistent revision|invalid revision|unverified revision/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 3 KILLED: Nonexistent commit revision strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 3 SURVIVED with unexpected validation errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 3 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 4: Real revision with wrong file
// ---------------------------------------------------------------------
try {
  const fakeProv = {
    modelId: "spe-whisper-tiny-int8",
    baseModel: "openai/whisper-tiny",
    upstreamRepository: "https://huggingface.co/onnx-community/whisper-tiny",
    revision: "6d4fb5abc94227ee92e43fc5091278851eadf8a0",
    license: "Apache-2.0",
    files: [
      {
        name: "nonexistent_model_file.onnx",
        upstreamUrl: "https://huggingface.co/onnx-community/whisper-tiny/resolve/6d4fb5abc94227ee92e43fc5091278851eadf8a0/nonexistent_model_file.onnx",
        expectedSizeBytes: 1000,
        expectedSha256: "7d1b3f94a28c460195e8bc4a54c30c8ef2829e0839e1a8bb23126f59b6c00d41",
        isRealBinaryVerified: false,
      },
    ],
    totalSizeBytes: 1000,
    custodyState: "DECLARED",
    custodyStatus: "CUSTODY_PENDING",
  };

  const validation = mm.validateUpstreamProvenance(fakeProv);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 4 SURVIVED: Missing/invented file name in revision accepted!");
  } else if (validation.errors.some((e) => /unverified file|missing.*upstream|unknown file/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 4 KILLED: Invented file name not in verified revision rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 4 SURVIVED with unexpected validation errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 4 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 5: Correct filename with wrong bytes
// ---------------------------------------------------------------------
try {
  const dummyWrongBytes = new Uint8Array(10_124_990).fill(1); // 10MB of 1s
  assert.throws(
    () => mm.verifyArtifactBytes(
      dummyWrongBytes,
      "2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19",
      10_124_990
    ),
    /DIGEST_MISMATCH|SHA-256 mismatch/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 5 KILLED: Correct filename with wrong bytes rejected by SHA-256 check.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 5 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 6: Correct bytes with wrong SHA
// ---------------------------------------------------------------------
try {
  const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
  const wrongSha = "0000000000000000000000000000000000000000000000000000000000000000";

  assert.throws(
    () => mm.verifyArtifactBytes(testBytes, wrongSha, 5),
    /DIGEST_MISMATCH|SHA-256 mismatch/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 6 KILLED: Correct bytes paired with wrong expected SHA rejected.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 6 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 7: LFS pointer hashed instead of model payload
// ---------------------------------------------------------------------
try {
  // Typical Git LFS pointer text file (133 bytes)
  const lfsPointerText = "version https://git-lfs.github.com/spec/v1\noid sha256:2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19\nsize 10124990\n";
  const lfsPointerBytes = new TextEncoder().encode(lfsPointerText);

  assert.equal(mm.isGitLfsPointer(lfsPointerBytes), true);

  assert.throws(
    () => mm.verifyArtifactBytes(
      lfsPointerBytes,
      "2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19",
      10_124_990
    ),
    /LFS_POINTER_REJECTED/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 7 KILLED: Git LFS pointer text file strictly detected and rejected from model binary custody.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 7 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 8: Estimated file size treated as measured
// ---------------------------------------------------------------------
try {
  // If isRealBinaryVerified is false, calling assertMeasuredSize must throw
  const unverifiedFile = {
    name: "model.onnx",
    upstreamUrl: "https://example.com/model.onnx",
    expectedSizeBytes: 10_000_000,
    expectedSha256: "2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19",
    isRealBinaryVerified: false,
  };

  assert.throws(
    () => mm.assertMeasuredSize(unverifiedFile),
    /ESTIMATED_SIZE_NOT_MEASURED|CUSTODY_UNVERIFIED/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 8 KILLED: Unverified estimated size strictly forbidden from being treated as measured.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 8 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 9: License copied from base model without repository verification
// ---------------------------------------------------------------------
try {
  const provWithUnverifiedLicense = {
    modelId: "spe-whisper-tiny-int8",
    baseModel: "openai/whisper-tiny",
    upstreamRepository: "https://huggingface.co/onnx-community/whisper-tiny",
    revision: "6d4fb5abc94227ee92e43fc5091278851eadf8a0",
    license: "UNKNOWN_OR_INFERRED",
    files: [],
    totalSizeBytes: 1000,
    custodyState: "DECLARED",
    custodyStatus: "CUSTODY_PENDING",
  };

  const validation = mm.validateUpstreamProvenance(provWithUnverifiedLicense);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 9 SURVIVED: Inferred or unverified license accepted!");
  } else if (validation.errors.some((e) => /license/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 9 KILLED: Unverified or inferred license strictly rejected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 9 SURVIVED with unexpected errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 9 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 10: Unsupported script promoted to supported
// ---------------------------------------------------------------------
try {
  // English recognizer cannot be claimed to recognize Telugu or Tamil
  const englishRecognizer = {
    modelId: "paddle-rec-english",
    supportedScripts: ["Latin", "Code"],
  };

  assert.equal(mm.isScriptSupportedByRecognizer(englishRecognizer, "Telugu"), false);
  assert.equal(mm.isScriptSupportedByRecognizer(englishRecognizer, "Tamil"), false);
  assert.equal(mm.isScriptSupportedByRecognizer(englishRecognizer, "Latin"), true);

  assert.throws(
    () => mm.assertScriptSupportedByRecognizer(englishRecognizer, "Telugu"),
    /UNSUPPORTED_SCRIPT_FOR_RECOGNIZER/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 10 KILLED: Recognizer script scope strictly enforced (English != Telugu/Tamil).");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 10 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 11: SOURCE_VERIFIED promoted directly to SESSION_RUN
// ---------------------------------------------------------------------
try {
  // Custody law: DECLARED -> SOURCE_VERIFIED -> DOWNLOADED -> HASH_VERIFIED -> RUNTIME_LOADED -> SESSION_CREATED -> SESSION_RUN
  assert.throws(
    () => mm.assertValidCustodyTransition("SOURCE_VERIFIED", "SESSION_RUN"),
    /CUSTODY VIOLATION.*skipping intermediary custody states/i
  );

  // Valid single-step transition must succeed
  mm.assertValidCustodyTransition("SOURCE_VERIFIED", "DOWNLOADED");
  mm.assertValidCustodyTransition("DOWNLOADED", "HASH_VERIFIED");

  mutantsKilled++;
  console.log("  ✓ MUTANT 11 KILLED: Unskippable custody state machine enforced (SOURCE_VERIFIED cannot jump to SESSION_RUN).");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 11 SURVIVED:", err);
}

console.log("\n========================================================");
console.log(`  PROVENANCE MUTANTS KILLED   : ${mutantsKilled} / ${TOTAL_MUTANTS}`);
console.log(`  PROVENANCE MUTANTS SURVIVED : ${mutantsSurvived} / ${TOTAL_MUTANTS}`);
console.log("========================================================\n");

assert.equal(mutantsSurvived, 0, "All 11 provenance falsification mutants MUST be killed!");
assert.equal(mutantsKilled, TOTAL_MUTANTS, "All 11 provenance falsification mutants MUST be killed!");
console.log(">>> ALL 11 MM-Q3-R FALSIFICATION MUTANTS KILLED — 0 SURVIVED <<<\n");
