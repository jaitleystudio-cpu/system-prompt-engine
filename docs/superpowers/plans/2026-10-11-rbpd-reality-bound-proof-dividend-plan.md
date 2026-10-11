# SPE Ω — Reality-Bound Proof Dividend (RBPD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Round 3 LVT-2 trust-boundary gaps and build a falsifiable, TDD-verified prototype of the **Reality-Bound Proof Dividend (RBPD)** in isolated research quarantine (`spe_runtime/research/rbpd/` and `tests/research/rbpd/`).

**Architecture:** Reuses SPE canonical owners (`ProtectedIntent`/`RequirementAtom`, `CausalProofGraph`, `ObligationHypergraph`, `WDICSpecializer`/`WDICContinuationEngine`, `CSC` `ProbeOptimizer`/`AssumptionVerifier`, `LVT` `LearningValidator`/`LearningTransferProtocol`, `SpePackage`, `AuthorityGrant`, and `tools/sprint5_conformance.py`). Zero duplicate semantic brains, zero parallel authority registries, zero touches to frozen files (`portable/spe-core-rs/`, `apps/web/public/spe_wasm.wasm`, `SPE-SPEC`, `PARALLEL_OWNERSHIP_MAP.json`).

**Tech Stack:** Python 3.12 (`spe_runtime`), Ed25519 + RFC 8785 JCS (`spe_runtime.ci_gate.receipt`), Native Rust (`spe-core-eval`), WebAssembly (`spe_wasm.wasm`), `pytest`, on-disk source mutation harness (`scripts/run_mutations.py`).

---

## Task 1: Round 3 LVT-2 Trust-Boundary Closure (`spe_runtime/research/lvt/`)

**Files:**
- Modify: `spe_runtime/research/lvt/paired_gate_v2.py`
- Modify: `spe_runtime/research/lvt/learning_validator.py`
- Modify: `spe_runtime/research/lvt/transfer_protocol.py`
- Modify: `tests/research/lvt/test_lvt2_r5_adversarial_closure.py`

- [x] **Step 1: Write failing Round 3 adversarial tests in `tests/research/lvt/test_lvt2_r5_adversarial_closure.py`**
  - `test_round3_parent_transaction_revocation_persists_across_restart_and_backup_restore`
  - `test_round3_tombstone_io_failure_fails_closed_when_configured`
  - `test_round3_parent_and_variant_synthetic_model_digests_rejected`
  - `test_round3_cryptographic_owner_authority_and_validator_revocation_enforced`
- [x] **Step 2: Run pytest to verify RED failure**
  - Command: `pytest tests/research/lvt/test_lvt2_r5_adversarial_closure.py`
- [x] **Step 3: Implement minimal fail-closed fixes in `paired_gate_v2.py`, `learning_validator.py`, and `transfer_protocol.py`**
  - Reject synthetic model digests claiming `VERIFIED_MODEL_REVISION` in `StudyProtocol._validate` and `synthesize_spe_learning_artifact`.
  - Persist parent and child tombstones in `revoke_transaction` / `check_distribution_drift_and_revoke`, restore `tx:{tx_id}`, `{tx_id}:{target_model_id}`, and `validator_pk:{pk}` in `load_tombstones_from_disk`, and fail closed on tombstone I/O errors when explicitly configured.
  - Add `has_cryptographic_owner_authority`, `require_cryptographic_owner_authority`, `revoke_validator_key`, and strict timestamp validation.
- [x] **Step 4: Run pytest to verify GREEN pass**
  - Command: `pytest tests/research/lvt/test_lvt2_r5_adversarial_closure.py`

---

## Task 2: Phase A — Reality-Bound Evidence Asset Contract (`spe_runtime/research/rbpd/contract.py`)

**Files:**
- Create: `spe_runtime/research/rbpd/__init__.py`
- Create: `spe_runtime/research/rbpd/contract.py`
- Create: `tests/research/rbpd/test_rbpd_proof_dividend.py`

- [ ] **Step 1: Write RED tests for Phase A in `tests/research/rbpd/test_rbpd_proof_dividend.py`**
  - Verify all 16 mandatory fields of `RealityBoundEvidenceAsset`.
  - Verify 4-state `EpistemicStatus` (`VALID`, `INVALID`, `STALE`, `UNKNOWN`).
  - Verify fail-closed rejection (`INVALID`) on:
    - Corrupted/forged Ed25519 signature or receipt hash mismatch.
    - Unattested/revoked validator when `require_cryptographic_owner_authority=True`.
    - Untrusted or self-certifying oracle (`oracle_identity == generator_id`).
    - Synthetic model digest claiming `VERIFIED_MODEL_REVISION`.
    - Revoked asset or durable tombstone present across simulated restart.
  - Verify `STALE` status on expired `validity_horizon`, mutated `subject_digest`, or violated `assumption_boundaries`.
  - Verify `UNKNOWN` status on missing asset or held external gates (`EXTERNAL_MODEL_QUALIFICATION`, `G6_H_BLINDED_HUMAN_EVALUATION`).
- [ ] **Step 2: Run pytest to confirm RED failure**
- [ ] **Step 3: Implement `spe_runtime/research/rbpd/contract.py` reusing `LearningValidator`, `AuthorityGrant`, and `SpePackage`**
- [ ] **Step 4: Run pytest to confirm Phase A tests pass (GREEN)**

---

## Task 3: Phase B — Sound Invalidation & Selective Re-Qualification (`spe_runtime/research/rbpd/invalidation.py`)

**Files:**
- Create: `spe_runtime/research/rbpd/invalidation.py`
- Modify: `tests/research/rbpd/test_rbpd_proof_dividend.py`

- [ ] **Step 1: Write RED tests for Phase B in `tests/research/rbpd/test_rbpd_proof_dividend.py`**
  - Test the 6-row invalidation matrix over `CausalProofGraph`, `ObligationHypergraph`, and `AssumptionVerifier`:
    1. Unrelated module edit -> 0 unaffected assets invalidated; 100% reuse of unaffected slices.
    2. Direct requirement edit -> invalidates only target slice and downstream dependents (`STALE`).
    3. Shared environment assumption mutation -> invalidates transitive dependent cone (`STALE`).
    4. Model revision digest change -> invalidates model-bound assets (`STALE`), blocking silent cross-model inheritance.
    5. Oracle key/version rotation -> invalidates assets attested by superseded oracle (`STALE`/`INVALID`).
    6. Durable revocation tombstone -> transitions asset to `INVALID` permanently.
- [ ] **Step 2: Run pytest to confirm RED failure**
- [ ] **Step 3: Implement `spe_runtime/research/rbpd/invalidation.py` reusing `CausalProofGraph`, `ObligationHypergraph`, `WDICContinuationEngine`, and `AssumptionVerifier`**
- [ ] **Step 4: Run pytest to confirm Phase B tests pass (GREEN)**

---

## Task 4: Phase C — Goodhart-Resistant Dual-Channel Witness Selector (`spe_runtime/research/rbpd/witness_selector.py`)

**Files:**
- Create: `spe_runtime/research/rbpd/witness_selector.py`
- Modify: `tests/research/rbpd/test_rbpd_proof_dividend.py`

- [ ] **Step 1: Write RED tests for Phase C in `tests/research/rbpd/test_rbpd_proof_dividend.py`**
  - Verify Channel A (`CSC` `ProbeOptimizer` counterfactual EIG probes) + Channel B (`SealedIndependentSampler` stratified random witnesses from sealed held-out families with `sealed_witness_fraction >= 0.25`).
  - Verify that a proxy-overfit ("Goodhart") candidate that games Channel A probes but regresses on sealed Channel B families is caught by `RBPD_DUAL_CHANNEL` (`GOODHART_DIVERGENCE_DETECTED`) while fooling `ACTIVE_ONLY`.
  - Verify deterministic HMAC-SHA256 sampling seed binding `(parent_receipt_hash, edit_commit_digest, epoch_nonce)` so the generator cannot pre-compute or cherry-pick Channel B witnesses.
- [ ] **Step 2: Run pytest to confirm RED failure**
- [ ] **Step 3: Implement `spe_runtime/research/rbpd/witness_selector.py`**
- [ ] **Step 4: Run pytest to confirm Phase C tests pass (GREEN)**

---

## Task 5: Phase D & E — Lifecycle Proof-Dividend Benchmark & Cross-Runtime/Cross-Model Portability (`spe_runtime/research/rbpd/dividend_benchmark.py`)

**Files:**
- Create: `spe_runtime/research/rbpd/dividend_benchmark.py`
- Modify: `tests/research/rbpd/test_rbpd_proof_dividend.py`

- [ ] **Step 1: Write RED tests for Phases D & E in `tests/research/rbpd/test_rbpd_proof_dividend.py`**
  - Verify full `LifecycleCostLedger` accounting (`initial_proof_construction_cost`, `invalidation_analysis_cost`, `witness_selection_cost`, `incremental_reverification_cost`, `artifact_verification_cost`).
  - Verify positive incremental proof dividend ($\ge 90\%$ reverification cost reduction after amortization) and superior Verified Outcome Efficiency (VOE) vs `FULL_RERUN`, `RANDOM_ONLY`, and `ACTIVE_ONLY`, with `0.0` escaped-defect rate and `0.0` false-reuse rate.
  - Verify mandatory **negative control**: when a global root assumption changes or in unamortized single-shot execution where RBPD overhead $\ge$ full rerun, RBPD reports `net_dividend_positive=False` and `claim_status="NO_DIVIDEND_CLAIMED"`.
  - Verify Phase E cross-runtime conformance across Python, native Rust (`spe-core-eval`), and WebAssembly (`spe_wasm.wasm`) via `tools/sprint5_conformance.py`, plus cross-model non-inheritance via `LearningTransferProtocol`.
- [ ] **Step 2: Run pytest to confirm RED failure**
- [ ] **Step 3: Implement `spe_runtime/research/rbpd/dividend_benchmark.py`**
- [ ] **Step 4: Run pytest to confirm Phases D & E tests pass (GREEN)**

---

## Task 6: Product Human Interface & CLI (`spe_runtime/research/rbpd/explain.py` & `cli.py`) + Mutation Testing (`scripts/run_mutations.py`)

**Files:**
- Create: `spe_runtime/research/rbpd/explain.py`
- Create: `spe_runtime/research/rbpd/cli.py`
- Modify: `scripts/run_mutations.py`
- Modify: `tests/research/rbpd/test_rbpd_proof_dividend.py`

- [ ] **Step 1: Write RED tests for `explain_proof_dividend` and `cli.py` in `tests/research/rbpd/test_rbpd_proof_dividend.py`**
  - Verify structured human and JSON report sections: `ESTABLISHED`, `REUSED`, `REVERIFIED`, `UNKNOWN_OR_HELD`, and `WHY`.
  - Verify explicit `BLOCKED`/`HOLD` reporting for `EXTERNAL_MODEL_QUALIFICATION` and `G6_H_BLINDED_HUMAN_EVALUATION`.
- [ ] **Step 2: Implement `spe_runtime/research/rbpd/explain.py` and `spe_runtime/research/rbpd/cli.py`**
- [ ] **Step 3: Add Round 3 LVT-2 (`M23`–`M25`) and RBPD (`M26`–`M30`) on-disk source mutants to `scripts/run_mutations.py`**
- [ ] **Step 4: Run full pytest suite, mutation harness (`30/30` killed), and CLI end-to-end verification**
