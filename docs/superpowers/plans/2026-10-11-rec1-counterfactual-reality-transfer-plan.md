# SPE Ω — REC-1: Counterfactual Reality Transfer Implementation Plan

- **Document ID**: `SPE-PLAN-REC1-2026-10-11`
- **Milestone**: `REC-1 — COUNTERFACTUAL REALITY TRANSFER AND EVIDENCE-ORIGIN FIREWALL`
- **Status**: `READY_FOR_EXECUTION`
- **Target Worktree / Branch**: `/Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope` (`antigravity/rec1-counterfactual-reality-transfer`)
- **Parent Specification**: `docs/superpowers/specs/2026-10-11-rec1-counterfactual-reality-transfer-design.md`

---

## Task Breakdown & Verification Strategy

### Task 1: TDD RED Phase — Failing Regression Tests
- **Target File**: `tests/research/rec/test_rec1_counterfactual_transfer.py`
- **Tests to write**:
  1. `test_pairwise_independent_ternary_counterexample_fails_mixture_formula_and_requires_sound_bounds`: Demonstrates $k=3, p=0.5, \rho=0$, where true joint failure is $0.25$, but naive mixture formula predicts $0.125$. Asserts that the new estimator returns bound $\ge 0.25$.
  2. `test_evidence_origin_firewall_blocks_synthetic_fixtures_from_production_valid_state`: Verifies that envelopes with synthetic datasets evaluate to `SYNTHETIC_CALIBRATION_ONLY`, not `VALID`.
  3. `test_selector_rejects_synthetic_fixture_reuse_in_production_mode`: Proves `CostRiskExecutionSelector` rejects deterministic procedure reuse for synthetic fixtures in production mode.
  4. `test_reality_transfer_counterfactual_witness_detects_drift_and_invalidates_envelope`: Tests that target reality perturbation is detected by counterfactual witnesses and transitions envelope to `STALE`.
  5. `test_distribution_free_frechet_bounds_for_higher_order_joint_failure`: Verifies that without empirical joint data or an exchangeable proof, Fréchet upper copula bound $\min(p_1, \dots, p_k)$ governs repeated risk.
- **Verification**: Run pytest and watch tests FAIL with expected assertions.

### Task 2: Core Estimator & Contract Refactor (GREEN Phase)
- **Target File**: `spe_runtime/research/rec/envelope.py`
- **Changes**:
  - Define `EvidenceOrigin` enum (`SYNTHETIC_FIXTURE`, `OBSERVED_UNVERIFIED`, `INDEPENDENTLY_VERIFIED`, `STALE`, `REVOKED`).
  - Add `EvidenceOrigin` and `is_synthetic` to `DatasetCommitment`.
  - Add `EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY`.
  - Implement sound Fréchet-Hoeffding and empirical joint Clopper-Pearson estimators in `CalibratedRiskEstimator`.
  - Add `joint_risk_estimator_type` tracking (`EMPIRICAL_JOINT_CLOPPER_PEARSON`, `FRECHET_WORST_CASE_BOUND`, `EXCHANGEABLE_MIXTURE_APPROXIMATION`).

### Task 3: Selector & Experiment Evidence Firewall
- **Target Files**: `spe_runtime/research/rec/selector.py`, `spe_runtime/research/rec/experiment.py`
- **Changes**:
  - In `selector.py`, enforce `EvidenceOrigin` firewall: synthetic envelopes can never be reused in production mode.
  - In `experiment.py`, mark synthetic datasets as `SYNTHETIC_FIXTURE`, and output `SYNTHETIC_SIMULATION_BENCHMARK` metadata.

### Task 4: Counterfactual Reality Transfer Engine
- **Target File**: `spe_runtime/research/rec/reality_transfer.py`
- **Changes**:
  - Implement `CounterfactualWitnessSearch` and `RealityTransferEngine`.
  - Connect with RBPD `ProofContractValidator` and `SelectiveRequalificationEngine`.

### Task 5: Verification, Mutation Testing & Final Reporting
- **Verification**:
  - Run all tests in `tests/research/rec/` and `tests/research/rbpd/`.
  - Add REC-1 mutations to `scripts/run_mutations.py` and run mutation suite.
  - Write final verification report artifact.
