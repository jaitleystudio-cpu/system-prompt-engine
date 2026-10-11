# SPE Ω — REC-0: Reliability Envelope Compiler Implementation Plan

See canonical Superpowers architectural specification at [`docs/superpowers/specs/2026-10-11-rec0-reliability-envelope-compiler-design.md`](../superpowers/specs/2026-10-11-rec0-reliability-envelope-compiler-design.md) and full task-by-task implementation plan at [`docs/superpowers/plans/2026-10-11-rec0-reliability-envelope-compiler-plan.md`](../superpowers/plans/2026-10-11-rec0-reliability-envelope-compiler-plan.md).

## Summary of REC-0 Tasks & Deliverables

1. **Task 1 — Reliability Envelope Contract, Validity-State Machine & Calibrated Risk Estimator (`spe_runtime/research/rec/envelope.py`)**:
   - 12 mandatory contract fields (`intent_digest`, `requirement_set_digest`, `model_revision_binding`, `environment_binding`, `evaluator_binding`, `dataset_commitment`, `observed_success`, `risk_bound`, `coverage_scope`, `dependency_hashes`, `drift_triggers`, `revocation_reference`) + Ed25519 RFC 8785 custody bindings.
   - 4-state `EnvelopeValidityState` (`VALID`, `STALE`, `INVALID`, `UNKNOWN`) + `CalibratedRiskEstimator` (Clopper-Pearson family-clustered upper confidence bound, correlation-aware repeated-run failure bound $\operatorname{Risk}_{\text{repeated}}(p_1, k, \rho_{\text{corr}})$, and strict prohibition on verbal confidence or unverified multi-agent agreement).
2. **Task 2 — Cost–Risk Execution Selector (`spe_runtime/research/rec/selector.py`)**:
   - Policy-constrained selector integrated with `HybridSwitchboard` (`WHS`), `WDICContinuationEngine`, `SelectiveRequalificationEngine` (`RBPD`), `ProtectedIntent`, and `AuthorityGrant`.
   - Selects among `REUSE_DETERMINISTIC_PROCEDURE`, `EXECUTE_SELECTED_MODEL`, `EXECUTE_WITH_INDEPENDENT_VERIFICATION`, `ESCALATE_TO_HUMAN`, and `ABSTAIN_INSUFFICIENT_QUALIFICATION` via $a^* = \arg\min_{a \in A_{\text{authorized}}} \operatorname{ExpectedCost}(a)$ subject to $\operatorname{EstimatedRiskUpperBound}(a) \le \tau$.
3. **Task 3 — 7 Adversarial Qualification Fixtures (`spe_runtime/research/rec/adversarial.py`)**:
   - Falsifiable fixtures for: (1) Consistent-but-wrong outcomes, (2) Correlated repeated runs, (3) Model-revision substitution & synthetic digests, (4) Contaminated calibration data, (5) Revoked evidence replay across restart, (6) Environment drift & execution-path instability, and (7) Incorrect evidence reuse across mutated intent or out-of-scope populations.
4. **Task 4 — 5-Stage Baseline Experiment, Negative Control & Cross-Runtime Reproduction (`spe_runtime/research/rec/experiment.py`)**:
   - Frozen preregistered protocol comparing `SPE_REC0_ENVELOPE_COMPILER` against all 5 required baselines (`DIRECT_EXECUTION`, `PROMPT_OPTIMIZED_GEPA`, `REPEATED_MAJORITY_UNANIMOUS`, `INDEPENDENT_VERIFIER_NO_REUSE`, `FULL_REEXECUTION_NO_REUSE`), mandatory global-shift negative control, Stage 5 deterministic reproduction, and Python/Rust/WASM conformance.
5. **Task 5 — 7-View User Experience Interface, CLI & Mutation Testing (`spe_runtime/research/rec/explain.py`, `cli.py`, `scripts/run_mutations.py`)**:
   - Exposes `Intent`, `Execution`, `Validation`, `Reliability`, `Unresolved`, `Recovery`, and `Cost` views (demonstrated on the 3D scrolling website + animation change lifecycle), explicit `PASS`/`FAIL`/`UNKNOWN` separation, and on-disk source mutation kills (`M31`–`M36`).
