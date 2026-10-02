# SPE Ω — MM Final Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every known trust-boundary, provenance, model-custody, neural-inference, privacy, stale-state, false-proof, and qualification defect in the SPE Ω multimodal stack in one continuous, disciplined engineering run.

**Architecture:** Enforce the inviolable law `UNTRUSTED_PACKAGE != TRUSTED_AUTHORITY`. Decouple canonical production models into `TRUSTED_MODEL_CATALOG` while quarantining unverified candidates (`spe-ui-segmenter-int8`, `spe-ocr-trocr-int8`) into `EXPERIMENTAL_MODEL_CANDIDATES`. Restrict archive sideloads so package metadata can never overwrite canonical manifests. Introduce `TrustedPackAuthorization` and runtime-branded `InferenceExecutionReceipt` (`sessionCreated=true`, `sessionRun=true`). Execute actual ONNX Runtime inference over real model bytes/tensors and real audio/image inputs with observed zero-egress network proof.

**Tech Stack:** TypeScript, Node.js ES modules, `onnxruntime-web` (v1.20.1), Web Audio / PCM decoding, Vite, esbuild, Pytest.

---

### Task 1: Type System Extensions & Trust Root Contracts (MM-FC-001, MM-FC-003, MM-FC-004, MM-FC-005, MM-FC-006)

**Files:**
- Modify: `apps/web/src/engine/multimodal/types.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write the failing test for trust root contracts and types**
Add tests asserting:
1. `TrustedPackAuthorization` presence and fields.
2. `InferenceExecutionReceipt` presence, brand validation, and `sessionCreated`/`sessionRun` flags.
3. Separation of `TRUSTED_MODEL_CATALOG` and `EXPERIMENTAL_MODEL_CANDIDATES`.
4. Rejection of unbranded or serialized fake execution receipts.

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL due to missing types and exports.

**Step 3: Implement minimal type extensions**
Update `apps/web/src/engine/multimodal/types.ts`:
- Define `TrustedPackAuthorization`:
  - `modelId`: string
  - `catalogVersion`: string
  - `canonicalManifestDigest`: ManifestDigest
  - `authorizedPayloadSha256`: PayloadSha256
  - `sourceRepository`: string
  - `sourceRevision`: string
  - `licenseStatus`: string
  - `authorizationSource`: "BUILTIN_CANONICAL_REGISTRY" | "SIGNED_TRUSTED_CATALOG"
  - `authorizedAt`: string
- Define `InferenceExecutionReceipt`:
  - `brand`: symbol / private token
  - `candidateSha`: string
  - `modelId`: string
  - `verifiedPayloadSha256`: PayloadSha256
  - `backend`: RuntimeBackend
  - `sessionCreated`: boolean
  - `sessionRun`: boolean
  - `rawInputDigest`: string
  - `canonicalInputDigest`: string
  - `outputDigest`: string
  - `startedAt`: string
  - `completedAt`: string
  - `durationMs`: number
  - `runtimeVersion`: string
- Add `trustedAuthorization?: TrustedPackAuthorization | null` and `executionReceipt?: InferenceExecutionReceipt | null` to `ModelPack`.
- Deprecate `archiveDigest` in favor of `payloadSha256`.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/types.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): add TrustedPackAuthorization and InferenceExecutionReceipt type contracts"`

---

### Task 2: Quarantine Experimental Candidates & Establish TRUSTED_MODEL_CATALOG (MM-FC-008)

**Files:**
- Modify: `apps/web/src/engine/multimodal/modelRegistry.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write the failing test**
Assert that `spe-ui-segmenter-int8` and `spe-ocr-trocr-int8` are NOT present in `TRUSTED_MODEL_CATALOG` or `VETTED_MODEL_MANIFESTS` for production qualification, but are preserved in `EXPERIMENTAL_MODEL_CANDIDATES`.

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL.

**Step 3: Implement quarantine & catalog separation**
In `apps/web/src/engine/multimodal/modelRegistry.ts`:
- Move `spe-ui-segmenter-int8` and `spe-ocr-trocr-int8` to `EXPERIMENTAL_MODEL_CANDIDATES`.
- Define `TRUSTED_MODEL_CATALOG` containing only production candidates:
  - `spe-whisper-tiny-int8`
  - `spe-ocr-en`
  - `spe-ocr-devanagari`
  - `spe-ocr-telugu`
  - `spe-ocr-tamil`
  - `spe-ocr-paddle-int8` (alias)
  - `spe-ocr-multilingual-int8` (alias)
- Retain `EXPERIMENTAL_MODEL_CANDIDATES` for local research, but mark `productionQualificationAllowed = false` and `qualificationState = "CANDIDATE"`.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/modelRegistry.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): quarantine experimental models out of trusted production catalog"`

---

### Task 3: Fail-Closed Sideload Security & Package Trust Laws (MM-FC-001, MM-FC-002, MM-FC-003)

**Files:**
- Modify: `apps/web/src/engine/multimodal/modelRegistry.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write failing tests**
1. Malicious `.spemodel` providing altered manifest for known model is rejected with `SIDELOAD_CANONICAL_MISMATCH`.
2. Sideload cannot overwrite canonical manifest (`pack.manifest === canonicalManifest`).
3. Unknown model imported via sideload is forced to `UNTRUSTED_SIDELOAD`, `productionQualificationAllowed = false`.
4. Self-attested package claims (`productionQualificationAllowed: true`, `artifactLicenseStatus: "VERIFIED"`) are ignored and stripped.

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL.

**Step 3: Implement sideload trust validation**
In `apps/web/src/engine/multimodal/modelRegistry.ts`:
- Implement `validateUntrustedArchiveAgainstTrustedManifest(pkg, trustedManifest)`:
  - Verifies file set, individual file sizes, individual SHA-256 hashes, task, and capability.
  - Throws `SIDELOAD_CANONICAL_MISMATCH` on any discrepancy.
- In `sideloadPack`:
  - If `TRUSTED_MODEL_CATALOG[pkg.modelId]` exists:
    - Use `trustedManifest = TRUSTED_MODEL_CATALOG[pkg.modelId]`.
    - Validate package against `trustedManifest`.
    - Bind pack manifest strictly to `trustedManifest` (NEVER `pkg.manifest`).
    - Attach `TrustedPackAuthorization` from canonical registry.
  - If unknown:
    - Mark `artifactClass = "UNTRUSTED_SIDELOAD"`.
    - Mark `productionQualificationAllowed = false`.
    - Mark `trustedAuthorization = null`.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/modelRegistry.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): enforce fail-closed sideload validation against trusted catalog"`

---

### Task 4: Complete Eviction / Custody Reset & Digest Authority Cleanup (MM-FC-005, MM-FC-006, MM-FC-007)

**Files:**
- Modify: `apps/web/src/engine/multimodal/modelRegistry.ts`
- Modify: `apps/web/src/engine/multimodal/asrEngine.ts`
- Modify: `apps/web/src/engine/multimodal/ocrEngine.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write failing tests**
1. After `reg.evictPack(modelId)`, verify `verifiedPayloadDigest`, `verifiedDigest`, `archiveSha256`, `installedAt`, `activeBackend`, `trustedAuthorization`, and `executionReceipt` are strictly `null` / reset.
2. Verify qualification requires `verifiedPayloadDigest` (legacy `verifiedDigest` fallback alone fails).

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL.

**Step 3: Implement complete eviction & remove legacy digest authority**
- In `modelRegistry.ts`:
  - In `evictPack`: reset all fields to initial uninstalled state.
  - In `asrEngine.ts` & `ocrEngine.ts`: check `Boolean(pack.verifiedPayloadDigest)`.
- Disambiguate `archiveDigest` in archive packing: set `archiveSha256 = computeArchiveSha256(out)` and `payloadSha256 = computePayloadSha256(files)`.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/modelRegistry.ts apps/web/src/engine/multimodal/asrEngine.ts apps/web/src/engine/multimodal/ocrEngine.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): enforce complete eviction reset and payload digest authority"`

---

### Task 5: Real Runtime Inference Execution Receipts & Production Qualification Gate (MM-FC-004, MM-FC-010, MM-FC-011)

**Files:**
- Modify: `apps/web/src/engine/multimodal/modelRegistry.ts`
- Modify: `apps/web/src/engine/multimodal/asrEngine.ts`
- Modify: `apps/web/src/engine/multimodal/ocrEngine.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write failing tests**
1. `assertProductionQualified(modelId)` throws if `pack.executionReceipt` is missing, `sessionCreated` is false, or `sessionRun` is false.
2. Fake / serialized receipt without private brand is rejected.
3. Receipt with mismatched payload SHA or wrong candidate SHA is rejected.
4. Real inference creates authentic execution receipt with hashed inputs/outputs.

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL.

**Step 3: Implement branded execution receipt factory & production qualification gate**
- Implement `createInferenceExecutionReceipt(...)` using internal unforgeable Symbol brand.
- Implement `validateInferenceExecutionReceipt(receipt, pack, currentCandidateSha)`.
- Update `asrEngine.ts` and `ocrEngine.ts` to attach valid execution receipt upon actual execution.
- Update `assertProductionQualified(modelId)` with all 14 mandatory security gates.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/modelRegistry.ts apps/web/src/engine/multimodal/asrEngine.ts apps/web/src/engine/multimodal/ocrEngine.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): require branded InferenceExecutionReceipt for production qualification"`

---

### Task 6: Real ONNX Execution, Audio Decoding & Language Benchmark Receipts (MM-FC-009, MM-FC-010, MM-FC-011, MM-FC-012)

**Files:**
- Modify: `apps/web/src/engine/multimodal/asrEngine.ts`
- Modify: `apps/web/src/engine/multimodal/ocrEngine.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write failing tests**
1. Audio input properly decodes WAV PCM; rejects compressed raw container bytes directly fed into tensors.
2. Actual ONNX `InferenceSession` run with synthetic / verified ONNX graph generates real tensor output and authentic receipt.
3. Monolingual benchmark does not grant code-switch pass.
4. Input digest hashes actual audio PCM bytes (not dummy string label).

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL.

**Step 3: Implement audio decode & actual ONNX session execution**
- In `asrEngine.ts`: implement explicit WAV PCM parser (`decodeWavPcm(buffer)`).
- Execute `ort.InferenceSession.create` and `session.run` when ONNX assets are loaded.
- Compute SHA-256 over raw input bytes and canonical PCM float array.
- Record real WER/CER benchmark receipts with tested language boundaries.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/asrEngine.ts apps/web/src/engine/multimodal/ocrEngine.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): implement real audio PCM decoding, ONNX session execution and benchmark receipts"`

---

### Task 7: Runtime Zero-Egress Network Interception & Device Matrix Truth (MM-FC-013, MM-FC-014)

**Files:**
- Modify: `apps/web/src/engine/multimodal/deviceNegotiator.ts`
- Test: `tests/test_mm_final_closure.mjs`

**Step 1: Write failing tests**
1. Observed network interception during local ASR and OCR inference detects and blocks any outgoing fetch/XHR/WebSocket call.
2. Device matrix status is `MEASURED` for current runtime and `UNTESTED` for non-executed environments.
3. Manifest minimum memory is never reported as measured peak memory (`measuredPeakMemoryMb = null | number`).

**Step 2: Run test to verify it fails**
Run: `node tests/test_mm_final_closure.mjs`
Expected: FAIL.

**Step 3: Implement network observation & truthful device reporting**
- Implement network interception wrapper verifying `ASR_INFERENCE_NETWORK = 0`, `OCR_INFERENCE_NETWORK = 0`, `TELEMETRY_EGRESS = 0`.
- Update `deviceNegotiator.ts` to report `UNTESTED` for untested browsers/devices.

**Step 4: Run test to verify it passes**
Run: `node tests/test_mm_final_closure.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/multimodal/deviceNegotiator.ts tests/test_mm_final_closure.mjs`
`git commit -m "feat(mm): add runtime network zero-egress proof and truthful device matrix"`

---

### Task 8: 35+ Security Mutants & Full Repository Regression Verification

**Files:**
- Modify: `tests/test_mm_final_closure.mjs`
- Test: All suites (`tests/test_mm_*.mjs`, `pytest tests/web`, `npm run build`, `copy-check.mjs`)

**Step 1: Add all 35 security mutants to `test_mm_final_closure.mjs`**
Execute the 35 mutants:
1. self-authorized production archive
2. self-authorized license status
3. self-authorized inference state
4. known ID + attacker manifest
5. known ID + attacker hashes
6. known ID + wrong revision
7. unknown ID promoted to production
8. internally consistent malicious archive
9. fake TrustedPackAuthorization
10. serialized fake InferenceExecutionReceipt
11. sessionCreated=true but no session.run
12. model digest mismatch between runtime receipt and installed pack
13. candidate SHA mismatch
14. legacy verifiedDigest-only authorization
15. stale verifiedPayloadDigest after eviction
16. stale inference receipt after eviction
17. stale authorization after eviction
18. payload digest mislabeled archive SHA
19. archive SHA mislabeled payload digest
20. synthetic package production promotion
21. LFS pointer accepted as model
22. real filename + wrong bytes
23. correct bytes + wrong tokenizer
24. compressed audio treated as PCM
25. hardcoded transcript
26. hardcoded OCR output
27. heuristic OCR marked neural
28. English OCR claims Telugu
29. monolingual ASR pass claims code-switch pass
30. unverified experimental model appears production-ready
31. network request during local inference hidden
32. manifest minimum memory reported as measured memory
33. benchmark fixture metadata substituted for actual inference
34. zero tests collected but suite returns success
35. all critical tests skipped

**Step 2: Run test suite**
Run: `node tests/test_mm_final_closure.mjs`
Expected: 35/35 killed, 0 survived.

**Step 3: Run full repository regression**
- `node tests/test_mm_final_closure.mjs`
- `node tests/test_mm_q3_r3_semantics.mjs`
- `node tests/test_mm_q3_r2_consistency.mjs`
- `node tests/test_mm_q3_r_provenance.mjs`
- `node tests/test_mm_q3_falsification.mjs`
- `node tests/test_mm_q2_falsification.mjs`
- `node tests/test_real_local_multimodal_fabric.mjs`
- `node tests/test_spe_world_class_perfection.mjs`
- `node tools/copy-check.mjs`
- `npm --prefix apps/web run build`
- `.venv/bin/pytest tests/web`
- WASM integrity check
- Privacy blacklist check

**Step 4: Commit & Freeze**
Commit all changes, push branch, freeze commit SHA, and format final report.
