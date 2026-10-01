#!/usr/bin/env node
/**
 * MM-Q3-R2: Single-Source Model Truth & Cross-Table Consistency Test Suite
 *
 * Epistemic Laws Enforced:
 * 1. SINGLE_SOURCE_OF_TRUTH: VETTED_MODEL_MANIFESTS == PRODUCTION_MODEL_PROVENANCE
 * 2. EXACT_METRIC_ALIGNMENT: repo, revision, filenames, sizes, SHA, license must agree byte-for-byte.
 * 3. LICENSE_INTEGRITY: BASE_MODEL_LICENSE != UNPROVEN_CONVERSION_LICENSE (Whisper MIT != Apache-2.0)
 * 4. CACHED_VS_LIVE_HONESTY: Cached metadata allowlist != Live network verification
 * 5. STALE_SOURCE_ZERO_TOLERANCE: 0 occurrences of fake/unverified repo names in production manifests
 * 6. REAL_NEURAL_INFERENCE: strictly HOLD until real bytes are downloaded and verified
 *
 * 8 Mutants Tested & Killed:
 * 1. new provenance + stale runtime manifest -> KILLED
 * 2. same model ID with different repo -> KILLED
 * 3. same model ID with different file size -> KILLED
 * 4. same model ID with different SHA -> KILLED
 * 5. MIT base model mislabeled Apache-2.0 -> KILLED
 * 6. unknown converted-repo license promoted to verified -> KILLED
 * 7. cached metadata mislabeled live verified -> KILLED
 * 8. old fake source surviving in VETTED_MODEL_MANIFESTS -> KILLED
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
const TOTAL_MUTANTS = 8;

console.log("\n========================================================");
console.log("  SPE MM-Q3-R2: SINGLE-SOURCE TRUTH & CONSISTENCY SUITE");
console.log("========================================================\n");

// ---------------------------------------------------------------------
// TEST 0: Baseline Production Manifest & Provenance Alignment Gate
// ---------------------------------------------------------------------
console.log("--- Baseline Production Gate Checks ---");

// Check stale model identities are zero
try {
  mm.assertNoStaleModelIdentities(mm.VETTED_MODEL_MANIFESTS);
  console.log("  ✓ PASS: Zero stale/fake repository strings in VETTED_MODEL_MANIFESTS");
} catch (err) {
  console.error("  ✗ FAIL: Stale model identities found in VETTED_MODEL_MANIFESTS:", err.message);
  process.exit(1);
}

// Check every model in VETTED_MODEL_MANIFESTS strictly matches PRODUCTION_MODEL_PROVENANCE
for (const [modelId, manifest] of Object.entries(mm.VETTED_MODEL_MANIFESTS)) {
  const prov = mm.PRODUCTION_MODEL_PROVENANCE[modelId];
  assert.ok(prov, `Missing provenance record for manifest '${modelId}'`);
  try {
    mm.assertManifestProvenanceConsistency(manifest, prov);
    console.log(`  ✓ PASS: Manifest & Provenance strictly aligned for '${modelId}'`);
  } catch (err) {
    console.error(`  ✗ FAIL: Manifest/Provenance discrepancy for '${modelId}':`, err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// MUTANT 1: New provenance with stale runtime manifest
// ---------------------------------------------------------------------
try {
  const mockProv = { ...mm.PRODUCTION_MODEL_PROVENANCE["spe-whisper-tiny-int8"] };
  const staleManifest = {
    ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"],
    expectedSizeBytes: 39_845_888, // Stale old size
  };

  assert.throws(
    () => mm.assertManifestProvenanceConsistency(staleManifest, mockProv),
    /MANIFEST_PROVENANCE_MISMATCH.*size/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 1 KILLED: Stale manifest size detected against canonical provenance.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 1 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 2: Same model ID with different repository
// ---------------------------------------------------------------------
try {
  const mockProv = {
    ...mm.PRODUCTION_MODEL_PROVENANCE["spe-whisper-tiny-int8"],
    upstreamRepository: "https://huggingface.co/onnx-community/whisper-tiny",
  };
  const alteredManifest = {
    ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"],
    source: "https://huggingface.co/unauthorized-fork/whisper-tiny",
  };

  assert.throws(
    () => mm.assertManifestProvenanceConsistency(alteredManifest, mockProv),
    /MANIFEST_PROVENANCE_MISMATCH.*source|repository/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 2 KILLED: Divergent repository source strictly rejected.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 2 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 3: Same model ID with different file size
// ---------------------------------------------------------------------
try {
  const mockProv = { ...mm.PRODUCTION_MODEL_PROVENANCE["spe-whisper-tiny-int8"] };
  const alteredManifest = {
    ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"],
    files: [
      {
        name: "encoder_model_quantized.onnx",
        sizeBytes: 15_820_112, // Old stale size instead of 10_124_990
        sha256: "2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19",
        required: true,
      },
      ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"].files.slice(1),
    ],
  };

  assert.throws(
    () => mm.assertManifestProvenanceConsistency(alteredManifest, mockProv),
    /MANIFEST_PROVENANCE_MISMATCH.*File size mismatch/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 3 KILLED: Per-file size mismatch strictly caught.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 3 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 4: Same model ID with different SHA
// ---------------------------------------------------------------------
try {
  const mockProv = { ...mm.PRODUCTION_MODEL_PROVENANCE["spe-whisper-tiny-int8"] };
  const alteredManifest = {
    ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"],
    files: [
      {
        name: "encoder_model_quantized.onnx",
        sizeBytes: 10_124_990,
        sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        required: true,
      },
      ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"].files.slice(1),
    ],
  };

  assert.throws(
    () => mm.assertManifestProvenanceConsistency(alteredManifest, mockProv),
    /MANIFEST_PROVENANCE_MISMATCH.*File SHA mismatch/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 4 KILLED: Per-file digest mismatch strictly caught.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 4 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 5: MIT base model mislabeled Apache-2.0
// ---------------------------------------------------------------------
try {
  const mislabeledProv = {
    ...mm.PRODUCTION_MODEL_PROVENANCE["spe-whisper-tiny-int8"],
    baseModel: "openai/whisper-tiny",
    baseModelLicense: "Apache-2.0", // Fraud: OpenAI Whisper is MIT
  };

  const validation = mm.validateLicenseProvenance(mislabeledProv);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 5 SURVIVED: MIT base model mislabeled Apache-2.0 was accepted!");
  } else if (validation.errors.some((e) => /mislabeled|base.*MIT/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 5 KILLED: Base model license fraud (Whisper MIT != Apache-2.0) detected.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 5 SURVIVED with unexpected errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 5 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 6: Unknown converted-repo license promoted to verified
// ---------------------------------------------------------------------
try {
  const unverifiedPromotionProv = {
    ...mm.PRODUCTION_MODEL_PROVENANCE["spe-whisper-tiny-int8"],
    conversionRepoLicense: "UNVERIFIED",
    artifactLicenseStatus: "VERIFIED_APACHE_2_0", // Unwarranted promotion
  };

  const validation = mm.validateLicenseProvenance(unverifiedPromotionProv);
  if (validation.valid) {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 6 SURVIVED: Unverified conversion license promoted to verified!");
  } else if (validation.errors.some((e) => /UNVERIFIED_LICENSE_PROMOTION|conversion.*unverified/i.test(e))) {
    mutantsKilled++;
    console.log("  ✓ MUTANT 6 KILLED: Promoting unverified conversion license to verified strictly blocked.");
  } else {
    mutantsSurvived++;
    console.error("  ✗ MUTANT 6 SURVIVED with unexpected errors:", validation.errors);
  }
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 6 ERROR:", err);
}

// ---------------------------------------------------------------------
// MUTANT 7: Cached metadata mislabeled live verified
// ---------------------------------------------------------------------
try {
  const falselyLiveClaim = {
    verificationTier: "CACHED_SOURCE_VERIFIED",
    isLiveVerified: false,
  };

  // Calling assertLiveSourceVerified on cached metadata must throw
  assert.throws(
    () => mm.assertLiveSourceVerified(falselyLiveClaim),
    /EPISTEMIC VIOLATION.*LIVE_SOURCE_VERIFIED/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 7 KILLED: Cached allowlist cannot be mislabeled as live authoritative verification.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 7 SURVIVED:", err);
}

// ---------------------------------------------------------------------
// MUTANT 8: Old fake source surviving in VETTED_MODEL_MANIFESTS
// ---------------------------------------------------------------------
try {
  const staleManifests = {
    "spe-whisper-tiny-int8": {
      ...mm.VETTED_MODEL_MANIFESTS["spe-whisper-tiny-int8"],
      source: "onnx-community/whisper-tiny-onnx-int8", // Old fake string
      provenance: "Old fake provenance",
    },
  };

  assert.throws(
    () => mm.assertNoStaleModelIdentities(staleManifests),
    /STALE_MODEL_IDENTITY.*whisper-tiny-onnx-int8/i
  );
  mutantsKilled++;
  console.log("  ✓ MUTANT 8 KILLED: Stale/fake source surviving in manifest strictly caught.");
} catch (err) {
  mutantsSurvived++;
  console.error("  ✗ MUTANT 8 SURVIVED:", err);
}

console.log("\n========================================================");
console.log(`  CONSISTENCY MUTANTS KILLED   : ${mutantsKilled} / ${TOTAL_MUTANTS}`);
console.log(`  CONSISTENCY MUTANTS SURVIVED : ${mutantsSurvived} / ${TOTAL_MUTANTS}`);
console.log("========================================================\n");

assert.equal(mutantsSurvived, 0, "All 8 consistency falsification mutants MUST be killed!");
assert.equal(mutantsKilled, TOTAL_MUTANTS, "All 8 consistency falsification mutants MUST be killed!");
console.log(">>> ALL 8 MM-Q3-R2 FALSIFICATION MUTANTS KILLED — 0 SURVIVED <<<\n");
