# SPE Ω — REC-0: Reliability Envelope Compiler Architectural Specification

- **Document ID**: `SPE-SPEC-REC0-2026-10-11`
- **Milestone**: `REC-0 — RELIABILITY ENVELOPE SPECIFICATION AND ADVERSARIAL EXPERIMENT`
- **Status**: `RESEARCH_QUARANTINE_SPECIFICATION_AND_EXPERIMENT`
- **Target Worktree / Branch**: `/Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope` (`antigravity/rec0-reliability-envelope`, branched from `50889913df7b74cd07fe086e970b09be2f663f9e`)
- **Quarantine Scope**: `spe_runtime/research/rec/`, `tests/research/rec/`
- **Frozen Boundaries Respected**: `portable/spe-core-rs/`, `apps/web/public/spe_wasm.wasm`, `SPE-SPEC`, `PARALLEL_OWNERSHIP_MAP.json`, `apps/web/src/landing/SeoContent.tsx`

---

## 1. Executive Summary & Research Problem Formulation

### 1.1 The Repeatability & Reliability Gap
Evaluating AI systems via single-run average accuracy (`pass@1`) obscures operational fragility:
1. **Repeatability Collapse (`pass@1` vs `pass^k`)**: As highlighted by IBM Research (September 15, 2026 AppWorld evaluation), an agent completing `77.4%` of individual runs completed all five repeated runs (`pass^5`) on only `53.0%` of tasks. High leaderboard averages do not guarantee daily operational dependability.
2. **Agreement Is Not Proof of Correctness (Consistent Wrongness)**: Repeated execution with majority or unanimous voting (ArXiv `2602.11619`, Feb 2026) improves selection on some tasks (`87–88%` accuracy at `54–62%` coverage), but fails catastrophically under **common-mode failures** where models share systematic biases and unanimously agree on an incorrect outcome.
3. **Environmental & Perturbation Fragility**: Minor tool, schema, or prompt perturbations degrade both output consistency and execution-path stability (ArXiv `2605.10516`, May 2026).
4. **Scope-Bounded Statistical Risk**: Anytime-valid conformal and concentration risk bounds (ArXiv `2602.04364`, Feb 2026) control predictive error only within their calibration assumptions and supported populations; they become invalid under silent model-revision swaps, calibration contamination, or distribution drift.

### 1.2 Preregistered Research Question
> **Can SPE automatically select the cheapest permitted execution strategy that satisfies a measurable reliability contract, while detecting when earlier evidence no longer applies?**

The **Reliability Envelope Compiler (REC-0)** answers this question by turning reliability into an enforceable, cryptographically bound execution contract integrated into SPE's existing **ProtectedIntent**, **Reality-Bound Proof Dividend (RBPD)**, **WDIC-VCT**, **CSC**, **LVT**, and **HybridSwitchboard (WHS)** architecture—without introducing a second semantic brain or parallel authority registry.

---

## 2. Reused Canonical Owners & Anti-Sprawl Architecture

REC-0 introduces **zero duplicate semantic kernels, zero duplicate authority registries, zero uncontrolled cloud costs, and zero new production dependencies**:

| Capability | Canonical SPE Owner Reused | Integration Role in REC-0 |
|---|---|---|
| Protected User Objective | `spe_runtime/prompt/meta_compiler.py` (`ProtectedIntent`, `NetworkPolicy`, `NanoUSD`) | Immutable `intent_digest`, forbidden-action invariants, budget cap, and air-gap/egress policy. |
| Requirement Identity | `spe_runtime/requirements/models.py` (`RequirementAtom`, `RequirementKind`) | Content-addressed `requirement_set_digest` bound into each `ReliabilityEnvelope`. |
| Evidence Asset & Slice Invalidation | `spe_runtime/research/rbpd/` (`RealityBoundEvidenceAsset`, `ProofContractValidator`, `SelectiveRequalificationEngine`, `DualChannelWitnessSelector`) | Supplies cryptographic evidence custody, causal invalidation cones, and Channel A/B anti-Goodhart witness selection. |
| Continuation & Specialization | `spe_runtime/research/wdic_vct/` (`WDICContinuationEngine`, `ProofDeficit`, `NextTaskContract`) | Tracks residual verification obligations when an envelope is `STALE` or partially covers a request. |
| Counterfactual Probes & Drift | `spe_runtime/research/csc/` (`ProbeOptimizer`, `AssumptionVerifier`, `OracleQualifier`) | Verifies environment assumptions and synthesizes high-EIG distinguishing probes on drift. |
| Trust Root, Model Identity & Tombstones | `spe_runtime/research/lvt/` (`LearningValidator`, `LearningTransferProtocol`, `StudyProtocol`, `_is_synthetic_model_digest`) | Enforces owner-root authority, verified model-revision identity, cross-model non-inheritance, and durable revocation tombstones. |
| Compute Placement Switchboard | `spe_runtime/hybrid/switchboard.py` (`HybridSwitchboard`, `PlacementTarget`, `TaskRequirement`) | Policy-constrained execution placement (`LOCAL_DETERMINISTIC`, `LOCAL_NEURAL`, `HYBRID_SPLIT`, `CLOUD_AUTHORIZED`, `BLOCKED`). |
| Scoped External Authority | `spe_runtime/authority/models.py` (`AuthorityGrant`) | Time-bounded, use-limited authority grants for execution, oracle verification, and human escalation. |
| Cross-Runtime Conformance | `tools/sprint5_conformance.py` (`run_python_reference_case`, `run_rust_case`, `run_wasm_case`) | Verifies bit-for-bit decision parity across Python, native Rust (`spe-core-eval`), and WebAssembly (`spe_wasm.wasm`). |

---

## 3. Reliability Envelope Contract Schema (`spe_runtime/research/rec/envelope.py`)

### 3.1 The 12 Mandatory Contract Fields (+ Cryptographic Custody Bindings)
Each `ReliabilityEnvelope` is a frozen, RFC 8785-canonicalizable dataclass signed by an owner-authorized `LearningValidator`:

| # | Field | Type | Semantic Meaning & Validation Invariant |
|---|---|---|---|
| 1 | `intent_digest` | `str` (64-hex SHA-256) | Digest of the immutable `ProtectedIntent` (`objective`, `invariants`, `forbidden_actions`, `domain`, `budget_nanos`, `network_policy`). |
| 2 | `requirement_set_digest` | `str` (64-hex SHA-256) | Canonical SHA-256 over sorted `RequirementAtom` IDs covered by this envelope. |
| 3 | `model_revision_binding` | `ModelRevisionBinding` | Authenticated `model_id`, 64-hex `model_or_runtime_digest`, and `model_digest_type` (`VERIFIED_MODEL_REVISION` vs `SYNTHETIC_NAME_DERIVED`). Synthetic digests claiming `VERIFIED_MODEL_REVISION` are rejected fail-closed via `_is_synthetic_model_digest`. |
| 4 | `environment_binding` | `EnvironmentBinding` | Operating environment contract: `runtime_id`, `tool_permissions: Tuple[str, ...]`, `network_policy: str`, `schema_version: str`, and `assumption_predicates: Dict[str, Any]`. |
| 5 | `evaluator_binding` | `EvaluatorBinding` | Independent authorized evaluator: `oracle_id`, `oracle_class` (`independent_static_oracle` or `independent_reality_witness`), `oracle_public_key`, and signed `oracle_attestation`. Self-certification (`oracle_id == model_id` or `generating_model_self`) is forbidden. |
| 6 | `dataset_commitment` | `DatasetCommitment` | Frozen evaluation-set identity: `dataset_id`, `dataset_sha256`, `independent_families_count` ($\ge 20$ for qualified status), `distinct_clusters_count`, `contamination_controlled: bool`, and `item_digests: Tuple[str, ...]`. |
| 7 | `observed_success` | `ObservedSuccessMetrics` | Empirically measured oracle outcomes (never model self-assessment): `n_tasks`, `k_runs_per_task`, `per_run_pass_rate` (`pass@1`), `all_runs_pass_rate` (`pass^k`), `execution_path_stability` ($\in [0, 1]$), `inter_run_correlation` ($\rho \in [0, 1]$), and `independent_oracle_verified: bool`. |
| 8 | `risk_bound` | `Optional[ float ]` | Statistically justified upper confidence bound on failure risk $\hat{R}_{\text{upper}}(\alpha) \in [0, 1]$ at confidence $1-\alpha$. **Must remain `None` (`UNKNOWN`) if calibration is missing, contaminated, unverified by an independent oracle, or based on verbal model confidence.** |
| 9 | `coverage_scope` | `CoverageScope` | Supported population and boundary conditions: `task_category`, `domain`, `max_complexity_score`, `supported_perturbation_radius`, and `eligible_input_predicates`. |
| 10 | `dependency_hashes` | `DependencyHashes` | Evidence required for reuse: `rbpd_asset_hashes: Tuple[str, ...]`, `causal_proof_slice_digest: str`, and `obligation_hypergraph_digest: str`. |
| 11 | `drift_triggers` | `Tuple[str, ...]` | Events that invalidate or suspend the envelope (`INTENT_MUTATED`, `REQUIREMENT_SET_CHANGED`, `MODEL_REVISION_CHANGED`, `ENVIRONMENT_PERTURBED`, `EXECUTION_PATH_UNSTABLE`, `CALIBRATION_CONTAMINATED`, `ORACLE_REVOKED`, `HORIZON_EXPIRED`, `TOMBSTONE_REVOKED`). |
| 12 | `revocation_reference` | `str` | Persistent revocation key (`tx:{envelope_id}`) checked against `LearningValidator` durable tombstones on disk and in memory. |

### 3.2 Validity-State Machine (`EnvelopeValidityState`)
An envelope lookup evaluates the envelope against the incoming request and current system reality, transitioning deterministically into one of four states:

```
                   ┌──────────────────────────────────────────────┐
                   │          RELIABILITY ENVELOPE LOOKUP         │
                   └──────────────────────┬───────────────────────┘
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             ▼                            ▼                            ▼
   [Signature/Owner/Oracle      [All 12 Contract Bindings     [No Envelope Exists OR
    Forged, Synthetic Model      Match + Independent Oracle    Missing Risk Bound OR
    Disguised, Contaminated      Attested + Risk Bound <= τ    Unverified Verbal/Agreement
    Calibration, or Tombstoned]  + Unexpired Horizon]          Confidence Only]
             │                            │                            │
             ▼                            ▼                            ▼
         ┌─────────┐                 ┌─────────┐                  ┌─────────┐
         │ INVALID │                 │  VALID  │                  │ UNKNOWN │
         └─────────┘                 └────┬────┘                  └─────────┘
         (Reject Reuse;                   │                       (Generate Full
          Permanent Block)                │ [Model Revision Swap,  Verification
                                          │  Env Perturbation,     Obligations or
                                          │  Requirement Edit,     Abstain/Escalate)
                                          │  Path Instability, or
                                          │  Horizon Expired]
                                          ▼
                                     ┌─────────┐
                                     │  STALE  │
                                     └─────────┘
                                (Suspend Direct Reuse;
                                 Generate Targeted RBPD/WDIC
                                 Re-Qualification Obligations)
```

### 3.3 Calibrated Risk Estimation (`CalibratedRiskEstimator`)
1. **Family-Clustered Upper Confidence Bound**:
   Given $N_{\text{fam}}$ independent task families (requiring $N_{\text{fam}} \ge 20$ distinct clusters with verified zero train/calibration overlap) and $F$ observed family-level failures (where a family counts as a success only if all $k$ repeated runs pass and execution-path stability $S_{\text{path}} \ge S_{\min}$), the exact one-sided Clopper-Pearson upper confidence bound at level $1 - \alpha$ is:
   $$\operatorname{UCB}_{\text{CP}}(F, N_{\text{fam}}; \alpha) = \inf \left\{ p \in [0, 1] : \sum_{j=0}^{F} \binom{N_{\text{fam}}}{j} p^j (1-p)^{N_{\text{fam}}-j} \le \alpha \right\}$$
2. **Correlation Penalty for Repeated Multi-Sampling ($\rho_{\text{corr}}$)**:
   When a strategy proposes $k$ repeated executions of a model with per-run failure bound $p_1$ and observed inter-run failure correlation $\rho_{\text{corr}} \in [0, 1]$, REC-0 **forbids** the naive independence formula $p_1^k$. Instead, the effective correlated failure upper bound is:
   $$\operatorname{Risk}_{\text{repeated}}(p_1, k, \rho_{\text{corr}}) = (1 - \rho_{\text{corr}}) p_1^k + \rho_{\text{corr}} p_1$$
   When $\rho_{\text{corr}} \to 1$ (common-mode failure / consistent wrongness), $\operatorname{Risk}_{\text{repeated}} \to p_1$: repeating the same model $k$ times provides **zero** risk reduction.
3. **Verbal Confidence & Unverified Agreement Prohibition**:
   If `independent_oracle_verified is False` or the caller supplies only `model_verbal_confidence` or `multi_agent_agreement_rate` without an attested independent evaluation dataset, `CalibratedRiskEstimator` returns `risk_bound = None` and `status = EnvelopeValidityState.UNKNOWN`.

---

## 4. Cost–Risk Execution Selector (`spe_runtime/research/rec/selector.py`)

### 4.1 Constrained Optimization Formulation
Given an incoming request with `ProtectedIntent`, required `RequirementAtom` set, environment context, and preregistered risk tolerance $\tau \in (0, 1)$, `CostRiskExecutionSelector` evaluates authorized strategies $a \in A_{\text{authorized}}$:

$$a^* = \arg\min_{a \in A_{\text{authorized}}} \operatorname{ExpectedCost}_{\text{NanoUSD}}(a) \quad \text{subject to:}$$
1. $\operatorname{EstimatedRiskUpperBound}(a) \le \tau$ (where `None` / `UNKNOWN` never satisfies $\le \tau$),
2. $\operatorname{ProtectedIntentPreserved}(a) = \text{True}$ (`intent_digest` match and zero `forbidden_actions`),
3. $\operatorname{PrivacyAndNetworkPolicySatisfied}(a) = \text{True}$ (e.g., `NetworkPolicy.AIR_GAPPED` blocks cloud egress),
4. $\operatorname{AuthorityGrantValid}(a) = \text{True}$ (`ACTIVE`, unexpired, within `use_limit`),
5. $\operatorname{EvidenceCustodyValid}(a) = \text{True}$ (non-tombstoned, authentic `RealityBoundEvidenceAsset` + `ReliabilityEnvelope`).

### 4.2 The Five Canonical Execution Actions (`ExecutionAction`)
1. `REUSE_DETERMINISTIC_PROCEDURE`: Selected when a `VALID` envelope covers the intent/requirements via a deterministic local procedure (`PlacementTarget.LOCAL_DETERMINISTIC`, $0$ cloud tokens, $\mathcal{O}(1)$ receipt verification cost). Prevents wasting tokens asking multiple models to debate a deterministically solved task.
2. `EXECUTE_SELECTED_MODEL`: Selected when a `VALID` envelope proves that a single authorized model execution satisfies $\hat{R}_{\text{upper}} \le \tau$ within the current `environment_binding` and `model_revision_binding`.
3. `EXECUTE_WITH_INDEPENDENT_VERIFICATION`: Selected when direct model execution alone has `UNKNOWN` or $> \tau$ risk (or when an envelope is `STALE` on a localized slice), and pairing execution with an authorized independent outcome verifier (plus selective RBPD reuse of unaffected slices) brings $\hat{R}_{\text{upper}} \le \tau$ within budget.
4. `ESCALATE_TO_HUMAN`: Selected when no automated strategy satisfies $\hat{R}_{\text{upper}} \le \tau$, and an active `AuthorityGrant` permits human decision escalation (`human_escalation_authorized=True`).
5. `ABSTAIN_INSUFFICIENT_QUALIFICATION`: Selected fail-closed when evidence is `INVALID` (revoked/forged), `ProtectedIntent` is violated, or no authorized strategy can achieve $\hat{R}_{\text{upper}} \le \tau$ within budget.

---

## 5. Adversarial Qualification Suite (`spe_runtime/research/rec/adversarial.py`)

REC-0 enforces 7 deterministic adversarial fixtures that attack every boundary of the reliability contract:

1. **Fixture 1 — Consistent-But-Wrong Outcomes (`CONSISTENT_BUT_WRONG`)**:
   - *Attack*: 5 repeated runs produce 100% unanimous agreement (`5/5`) and `0.99` self-reported confidence on a subtly broken output; no independent oracle attestation is present or the independent oracle fails it.
   - *Expected Defense*: `CalibratedRiskEstimator` refuses to convert unanimous agreement or verbal confidence into a `risk_bound`; `IndependentOutcomeEvaluator` marks outcome `FAIL`; envelope cannot become `VALID`.
2. **Fixture 2 — Correlated Repeated Runs (`CORRELATED_REPEATED_RUNS`)**:
   - *Attack*: A model with per-run failure rate $p_1 = 0.25$ and high inter-run correlation $\rho_{\text{corr}} = 0.92$ (shared prompt flaw) claims a naive $k=5$ failure bound of $0.25^5 = 0.00098 \le \tau = 0.05$.
   - *Expected Defense*: Correlation-aware estimator computes $\operatorname{Risk}_{\text{repeated}} = (1 - 0.92)(0.25^5) + 0.92(0.25) = 0.2301 > \tau = 0.05$, rejecting the unverified multi-sampling strategy.
3. **Fixture 3 — Model-Revision Substitution (`MODEL_REVISION_SUBSTITUTION`)**:
   - *Attack*: (3a) Silent model checkpoint digest change (`model_or_runtime_digest` differs from envelope binding); (3b) Synthetic model name hash (`sha256("spe-model-v1:" + model_id)`) claiming `VERIFIED_MODEL_REVISION`.
   - *Expected Defense*: (3a) Transitions envelope to `STALE` and blocks silent cross-model inheritance until an `LVT` transfer receipt is provided; (3b) Transitions envelope to `INVALID` via `_is_synthetic_model_digest`.
4. **Fixture 4 — Contaminated Calibration Data (`CONTAMINATED_CALIBRATION`)**:
   - *Attack*: Calibration dataset shares `item_id`, `family_id`, or `content_sha256` with the held-out evaluation set, or has $< 20$ distinct clusters (`pseudoreplication`).
   - *Expected Defense*: Envelope validation fails closed (`INVALID` / `risk_bound = None`), blocking risk bound certification.
5. **Fixture 5 — Revoked Evidence Replay (`REVOKED_EVIDENCE_REPLAY`)**:
   - *Attack*: An envelope is revoked via `LearningValidator` durable tombstones, memory registries are cleared to simulate process restart, and the attacker replays the previously signed `ReliabilityEnvelope`.
   - *Expected Defense*: `LearningValidator.load_tombstones_from_disk()` restores the tombstone; envelope evaluates to `INVALID` and `CostRiskExecutionSelector` abstains.
6. **Fixture 6 — Environment Drift (`ENVIRONMENT_DRIFT`)**:
   - *Attack*: Tool permissions, network policy, or runtime environment assumptions drift (`environment_binding` mismatch or execution-path stability $S_{\text{path}}$ drops below threshold under perturbation).
   - *Expected Defense*: Transitions envelope from `VALID` to `STALE`, triggers `SelectiveRequalificationEngine` over affected obligations, and requires fresh independent verification.
7. **Fixture 7 — Incorrect Evidence Reuse (`INCORRECT_EVIDENCE_REUSE`)**:
   - *Attack*: Caller attempts to reuse a `VALID` envelope on a request whose `ProtectedIntent` (`intent_digest`) was mutated, whose `requirement_set_digest` added unverified requirements, or whose task parameters fall outside `coverage_scope`.
   - *Expected Defense*: Rejects reuse (`STALE` / `INVALID`), preventing cross-intent or out-of-scope contamination.

---

## 6. Preregistered Baseline Experiment Design (`spe_runtime/research/rec/experiment.py`)

### 6.1 Preregistered Hypotheses (Frozen Before Execution)
- **$H_1$ (Verified Repeatability & Zero False Acceptance)**: Across a multi-family workload with $k=5$ repeated seeds per task, `SPE_REC0_ENVELOPE_COMPILER` achieves `false_acceptance_rate == 0.0` (blocking all consistent-but-wrong and stale-evidence traps that fool `DIRECT_EXECUTION`, `PROMPT_OPTIMIZED_GEPA`, and `REPEATED_MAJORITY_UNANIMOUS`) while maintaining non-inferior verified `all_runs_pass_rate` (`pass^5`) relative to `FULL_REEXECUTION_NO_REUSE`.
- **$H_2$ ($\ge 10\times$ Verified-Outcome Cost Reduction on Eligible Qualified-Reuse Workloads)**: On the preregistered eligible iterative workload (24 task families across 8 lifecycle rounds where localized perturbations affect 10–15% of the obligation graph per round), `SPE_REC0_ENVELOPE_COMPILER` achieves a $\ge 10\times$ reduction in total cost per verified outcome (including lower 95% confidence bound $\ge 10.0\times$) compared to `FULL_REEXECUTION_NO_REUSE` and `REPEATED_MAJORITY_UNANIMOUS`.
- **$H_3$ (Mandatory Negative Control — Honest Refusal When Assumptions Shift Globally)**: Under a global environment/model-revision shift that invalidates 100% of prior envelopes, `SPE_REC0_ENVELOPE_COMPILER` rejects all stale reuse (`reused_envelopes == 0`), incurs full re-qualification cost, and honestly reports `net_cost_advantage_claimed = False` (`NO_10X_CLAIMED_OUTSIDE_ELIGIBLE_ENVELOPE`).

### 6.2 Strict Separation of Selector and Evaluator (Stage 2)
- `CostRiskExecutionSelector` receives only the public task request, `ProtectedIntent`, and candidate `ReliabilityEnvelope` registry.
- `IndependentOutcomeEvaluator` holds the sealed ground-truth oracle and Channel B stratified witnesses in a private closure inaccessible to the selector.

### 6.3 Required Baselines Compared on Matched Tasks & Budgets
1. `DIRECT_EXECUTION`: Single model call, no prompt optimizer, no envelope check, no independent verifier.
2. `PROMPT_OPTIMIZED_GEPA`: Prompt-optimized baseline (higher single-run accuracy, no condition-bound envelope invalidation or independent outcome oracle).
3. `REPEATED_MAJORITY_UNANIMOUS`: $k=5$ repeated model calls with unanimous agreement filter (`5/5` agreement accepted without independent outcome oracle; abstains on disagreement).
4. `INDEPENDENT_VERIFIER_NO_REUSE`: Model execution + independent outcome verifier on every run, without deterministic procedure offload or RBPD/envelope evidence reuse.
5. `FULL_REEXECUTION_NO_REUSE`: $k=5$ full model executions + full independent oracle verification on every obligation across every lifecycle round (`FULL_RERUN`).
6. `SPE_REC0_ENVELOPE_COMPILER`: Condition-bound `ReliabilityEnvelope` lookup + `CostRiskExecutionSelector` + `RBPD` selective slice reuse + independent oracle verification + explicit abstention/escalation.

---

## 7. Differentiating User Experience & 7-View Audit Interface (`spe_runtime/research/rec/explain.py`)

For every request (such as building a 3D scrolling website with mobile, keyboard accessibility, performance, and authorized design constraints, followed by an incremental animation edit), `explain_reliability_envelope(...)` and `python -m spe_runtime.research.rec.cli` expose:

1. **Intent**: Protected objective (`intent_digest`), required design, interactions, accessibility, and performance atoms.
2. **Execution**: Selected strategy (`ExecutionAction`), authorized model revision, placement target, and `AuthorityGrant`.
3. **Validation**: Independent oracle checks and Channel A/B witnesses actually executed (`PASS` / `FAIL` / `UNKNOWN`).
4. **Reliability**: Measured `all_runs_pass_rate` (`pass^5`), `per_run_pass_rate` (`pass@1`), `execution_path_stability`, calibrated `risk_bound` (at $1-\alpha = 95\%$) or `UNKNOWN`, and `coverage_scope`.
5. **Unresolved**: Out-of-scope or untested conditions (e.g., untested mobile browser/WebGL device tiers, `EXTERNAL_MODEL_QUALIFICATION: BLOCKED_HOLD`, `G6_H_BLINDED_HUMAN_EVALUATION: BLOCKED_HOLD`).
6. **Recovery**: Smallest relevant repair and retest plan when an animation edit or perturbation invalidates a localized dependency slice.
7. **Cost**: Exact integer `NanoUSD` and USD breakdown across generation, verification, reuse savings, and recovery.
