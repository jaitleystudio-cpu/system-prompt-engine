# SPE Ω — Reality-Bound Proof Dividend (RBPD) Implementation Plan

See canonical Superpowers specification at [`docs/superpowers/specs/2026-10-11-rbpd-reality-bound-proof-dividend-design.md`](../superpowers/specs/2026-10-11-rbpd-reality-bound-proof-dividend-design.md) and full task-by-task implementation plan at [`docs/superpowers/plans/2026-10-11-rbpd-reality-bound-proof-dividend-plan.md`](../superpowers/plans/2026-10-11-rbpd-reality-bound-proof-dividend-plan.md).

## Summary of Phases & Deliverables

1. **Task 1 — Round 3 Trust-Boundary Closure (`spe_runtime/research/lvt/`)**:
   - Durable parent & child transaction revocation tombstones across restarts (`revoke_transaction`, `check_distribution_drift_and_revoke`, `load_tombstones_from_disk`), fail-closed tombstone I/O error handling when explicitly configured.
   - Parent and child synthetic model digest rejection (`_is_synthetic_model_digest`) in `StudyProtocol._validate`, `verify_model_transfer_receipt`, and `synthesize_spe_learning_artifact`.
   - Cryptographic owner authority property/enforcement (`has_cryptographic_owner_authority`, `require_cryptographic_owner_authority`), validator key revocation (`revoke_validator_key`), and strict attestation timestamp validation.
2. **Task 2 — Phase A: Reality-Bound Evidence Asset Contract (`spe_runtime/research/rbpd/contract.py`)**:
   - 16-field `RealityBoundEvidenceAsset` schema + `ProofContractValidator` returning `VALID`, `INVALID`, `STALE`, `UNKNOWN` backed by `LearningValidator`, `AuthorityGrant`, and `SpePackage`.
3. **Task 3 — Phase B: Sound Invalidation & Selective Re-Qualification (`spe_runtime/research/rbpd/invalidation.py`)**:
   - `SelectiveRequalificationEngine` over `CausalProofGraph`, `ObligationHypergraph`, `WDICContinuationEngine`, and `AssumptionVerifier` enforcing the 6-class invalidation matrix.
4. **Task 4 — Phase C: Goodhart-Resistant Reality Witness Selection (`spe_runtime/research/rbpd/witness_selector.py`)**:
   - `DualChannelWitnessSelector` combining Channel A (`CSC` `ProbeOptimizer` counterfactual EIG probes) and Channel B (`SealedIndependentSampler` stratified random witnesses from sealed held-out families, `>= 25%` floor).
5. **Task 5 — Phase D & E: Lifecycle Proof-Dividend Benchmark & Cross-Runtime/Cross-Model Portability (`spe_runtime/research/rbpd/dividend_benchmark.py`)**:
   - Full `LifecycleCostLedger`, Verified Outcome Efficiency (VOE), $\ge 90\%$ incremental reverification cost reduction on localized edits, mandatory negative control when overhead exceeds full rerun, and cross-runtime Python/Rust/WASM conformance (`tools/sprint5_conformance.py`) + cross-model non-inheritance (`LearningTransferProtocol`).
6. **Task 6 — Product Human Interface & Mutation Testing (`spe_runtime/research/rbpd/explain.py`, `cli.py`, `scripts/run_mutations.py`)**:
   - Human-readable and JSON audit output (`ESTABLISHED`, `REUSED`, `REVERIFIED`, `UNKNOWN_OR_HELD`, `WHY`) and on-disk source mutation suite (`M01`–`M30`).
