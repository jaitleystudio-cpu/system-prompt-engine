# SPE Ω — REC-0 Reliability Envelope Compiler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing SPE architecture (`ProtectedIntent`, `RBPD`, `WDIC`, `CSC`, `LVT`, `HybridSwitchboard`, `AuthorityGrant`) with a condition-bound **Reliability Envelope Compiler (REC-0)** in isolated research quarantine (`spe_runtime/research/rec/` and `tests/research/rec/`), complete with 7 adversarial qualification fixtures, a 5-stage preregistered baseline experiment across 5 baselines + negative control, cross-runtime conformance (`Python` / `Rust` / `WASM`), and a 7-view user experience interface.

**Architecture:** Reuses canonical SPE owners (`ProtectedIntent`, `RequirementAtom`, `RealityBoundEvidenceAsset`, `ProofContractValidator`, `SelectiveRequalificationEngine`, `DualChannelWitnessSelector`, `WDICContinuationEngine`, `ProbeOptimizer`, `AssumptionVerifier`, `LearningValidator`, `LearningTransferProtocol`, `HybridSwitchboard`, `AuthorityGrant`, and `tools/sprint5_conformance.py`). Zero duplicate semantic kernels, zero duplicate authority registries, zero uncontrolled cloud costs, zero modifications to frozen release-candidate files.

**Tech Stack:** Python 3.12 (`spe_runtime`), Ed25519 + RFC 8785 JCS (`spe_runtime.ci_gate.receipt`), Exact Clopper-Pearson & correlation-aware binomial risk bounds (`math.lgamma`), Native Rust (`spe-core-eval`), WebAssembly (`spe_wasm.wasm`), `pytest`, on-disk source mutation harness (`scripts/run_mutations.py`).

---

### Task 1: Reliability Envelope Schema, Validity-State Machine & Calibrated Risk Estimator (`spe_runtime/research/rec/envelope.py`)

**Files:**
- Create: `spe_runtime/research/rec/__init__.py`
- Create: `spe_runtime/research/rec/envelope.py`
- Test: `tests/research/rec/test_rec0_reliability_envelope.py`

**Step 1: Write the failing tests for Task 1**
- Test all 12 mandatory fields of `ReliabilityEnvelope` (`intent_digest`, `requirement_set_digest`, `model_revision_binding`, `environment_binding`, `evaluator_binding`, `dataset_commitment`, `observed_success`, `risk_bound`, `coverage_scope`, `dependency_hashes`, `drift_triggers`, `revocation_reference`) plus cryptographic custody bindings (`envelope_id`, `receipt_hash`, `signature`, `validator_public_key`, `authority_grant_id`).
- Test `EnvelopeValidityState` (`VALID`, `STALE`, `INVALID`, `UNKNOWN`) and `ReliabilityEnvelopeCompiler.evaluate_envelope(...)`.
- Test `CalibratedRiskEstimator`:
  - Exact one-sided Clopper-Pearson upper confidence bound on family-level failure rate,
  - Correlation-aware repeated-run risk bound $\operatorname{Risk}_{\text{repeated}}(p_1, k, \rho_{\text{corr}}) = (1 - \rho_{\text{corr}})p_1^k + \rho_{\text{corr}}p_1$,
  - Strict rule: missing calibration, unverified oracle, or verbal-only confidence returns `risk_bound = None` and `UNKNOWN` status.

**Step 2: Run test to verify it fails (RED)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task1" -v`
- Expected: `FAIL` (`ModuleNotFoundError: No module named 'spe_runtime.research.rec'`)

**Step 3: Write minimal implementation in `spe_runtime/research/rec/envelope.py`**
- Implement frozen dataclasses for the 12 contract bindings, `ReliabilityEnvelope`, `EnvelopeEvaluationResult`, `CalibratedRiskEstimator`, and `ReliabilityEnvelopeCompiler`.

**Step 4: Run test to verify it passes (GREEN)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task1" -v`
- Expected: `PASS`

---

### Task 2: Cost–Risk Execution Selector (`spe_runtime/research/rec/selector.py`)

**Files:**
- Create: `spe_runtime/research/rec/selector.py`
- Modify: `spe_runtime/research/rec/__init__.py`
- Test: `tests/research/rec/test_rec0_reliability_envelope.py`

**Step 1: Write the failing tests for Task 2**
- Test constrained optimization $a^* = \arg\min_{a \in A_{\text{authorized}}} \operatorname{ExpectedCost}(a)$ s.t. $\operatorname{EstimatedRiskUpperBound}(a) \le \tau$:
  - Deterministic task with `VALID` envelope selects `REUSE_DETERMINISTIC_PROCEDURE` ($0$ tokens, avoids multi-model debate waste).
  - Model task with `VALID` envelope and $\hat{R}_{\text{upper}} \le \tau$ selects `EXECUTE_SELECTED_MODEL`.
  - Uncertain or partially `STALE` task where independent verification brings risk $\le \tau$ selects `EXECUTE_WITH_INDEPENDENT_VERIFICATION` and generates targeted RBPD/WDIC verification obligations.
  - Task where no automated strategy satisfies $\hat{R}_{\text{upper}} \le \tau$ selects `ESCALATE_TO_HUMAN` when authorized, or `ABSTAIN_INSUFFICIENT_QUALIFICATION` when human escalation is not authorized or evidence is `INVALID`.
  - Verify `NetworkPolicy.AIR_GAPPED` and `AuthorityGrant` limits are strictly enforced.

**Step 2: Run test to verify it fails (RED)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task2" -v`

**Step 3: Write minimal implementation in `spe_runtime/research/rec/selector.py`**
- Implement `ExecutionAction`, `AuthorizedStrategyCandidate`, `ExecutionSelectionDecision`, and `CostRiskExecutionSelector`.

**Step 4: Run test to verify it passes (GREEN)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task2" -v`

---

### Task 3: The 7 Mandatory Adversarial Qualification Fixtures (`spe_runtime/research/rec/adversarial.py`)

**Files:**
- Create: `spe_runtime/research/rec/adversarial.py`
- Modify: `spe_runtime/research/rec/__init__.py`
- Test: `tests/research/rec/test_rec0_reliability_envelope.py`

**Step 1: Write the failing tests for Task 3**
- Test all 7 adversarial fixtures:
  1. `test_task3_fixture1_consistent_but_wrong_outcomes_rejected`
  2. `test_task3_fixture2_correlated_repeated_runs_naive_independence_rejected`
  3. `test_task3_fixture3_model_revision_substitution_and_synthetic_digest_rejected`
  4. `test_task3_fixture4_contaminated_calibration_data_rejected`
  5. `test_task3_fixture5_revoked_evidence_replay_across_restart_rejected`
  6. `test_task3_fixture6_environment_drift_and_path_instability_triggers_stale`
  7. `test_task3_fixture7_incorrect_evidence_reuse_across_intent_or_scope_rejected`

**Step 2: Run test to verify it fails (RED)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task3" -v`

**Step 3: Write minimal implementation in `spe_runtime/research/rec/adversarial.py`**
- Implement `AdversarialFixtureResult`, `AdversarialQualificationSuite`, and all 7 fixture runners.

**Step 4: Run test to verify it passes (GREEN)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task3" -v`

---

### Task 4: Preregistered 5-Stage Experiment, 5 Baselines, Negative Control & Cross-Runtime Reproduction (`spe_runtime/research/rec/experiment.py`)

**Files:**
- Create: `spe_runtime/research/rec/experiment.py`
- Modify: `spe_runtime/research/rec/__init__.py`
- Test: `tests/research/rec/test_rec0_reliability_envelope.py`

**Step 1: Write the failing tests for Task 4**
- Test frozen `PreregisteredExperimentProtocol` (hypotheses, datasets, metrics, budgets, stopping conditions sealed before execution).
- Test Stage 2 strict separation between `CostRiskExecutionSelector` and `IndependentOutcomeEvaluator`.
- Test all 5 required baselines (`DIRECT_EXECUTION`, `PROMPT_OPTIMIZED_GEPA`, `REPEATED_MAJORITY_UNANIMOUS`, `INDEPENDENT_VERIFIER_NO_REUSE`, `FULL_REEXECUTION_NO_REUSE`) vs `SPE_REC0_ENVELOPE_COMPILER` across the 8 qualification gates (`Quality`, `Cost`, `Repeatability`, `Coverage`, `Security`, `Requalification`, `Portability`, `Independence`).
- Test mandatory negative control (`run_global_shift_negative_control`) proving honest refusal when 100% of envelopes are invalidated.
- Test Stage 5 independent reproduction (`reproduce_rec0_experiment`) and cross-runtime parity (`Python` / `Rust` / `WASM`).

**Step 2: Run test to verify it fails (RED)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task4" -v`

**Step 3: Write minimal implementation in `spe_runtime/research/rec/experiment.py`**
- Implement `PreregisteredExperimentProtocol`, `IndependentOutcomeEvaluator`, `BaselineComparisonMetrics`, `REC0ExperimentReport`, `REC0ExperimentRunner`, and `reproduce_rec0_experiment`.

**Step 4: Run test to verify it passes (GREEN)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task4" -v`

---

### Task 5: 7-View User Experience Interface, CLI & On-Disk Mutation Suite (`spe_runtime/research/rec/explain.py`, `cli.py`, `scripts/run_mutations.py`)

**Files:**
- Create: `spe_runtime/research/rec/explain.py`
- Create: `spe_runtime/research/rec/cli.py`
- Modify: `scripts/run_mutations.py`
- Test: `tests/research/rec/test_rec0_reliability_envelope.py`

**Step 1: Write the failing tests for Task 5**
- Test the 7 user-facing SPE views (`Intent`, `Execution`, `Validation`, `Reliability`, `Unresolved`, `Recovery`, `Cost`) on the 3D scrolling website + animation-change scenario from Section 5 of the specification.
- Test separate reporting of source custody, exact test evidence, unresolved assumptions, and `PASS` / `FAIL` / `UNKNOWN` gates.
- Test `python -m spe_runtime.research.rec.cli` in both human-readable and `--json` modes.

**Step 2: Run test to verify it fails (RED)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/test_rec0_reliability_envelope.py -k "task5" -v`

**Step 3: Implement `explain.py`, `cli.py`, and add REC-0 source mutants `M31`–`M36` to `scripts/run_mutations.py`**

**Step 4: Run full pytest suite, mutation harness, and CLI verification (GREEN)**
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest tests/research/rec/ tests/research/rbpd/ tests/research/lvt/`
- Run: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/python scripts/run_mutations.py`
