# SPE Ω — Reliability Envelope Compiler (REC-0): Specification, Implementation & 5-Stage Experiment Report

> [!WARNING] **Skepticism Disclaimer**
> All 15 REC-0 unit/adversarial/experiment tests, 30/30 on-disk source mutation kills (`M01`–`M30`), and Python/Rust/WASM cross-runtime conformance vectors pass deterministically in the quarantined worktree `/Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope`, **but all empirical metrics (`35.3374x` cost reduction, 95% CI `[31.1399x, 42.6126x]`, `pass^5 = 0.9167`, `0.0` false acceptance rate) are produced by an in-repository deterministic simulator (`REC0ExperimentRunner`) rather than live external frontier model APIs, and `G6-H` (real human cohort study) plus production qualification remain explicitly held (`BLOCKED_HOLD` / `HOLD`).**

---

## 1. Executive Summary & Architectural Positioning

The **Reliability Envelope Compiler (REC-0)** extends the System Prompt Engine (SPE $\Omega$) so that user requests compile not merely into prompts, workflows, or verification gates, but into **cryptographically signed, scope-bounded Reliability Envelopes** paired with a **Policy-Constrained Cost–Risk Execution Selector**.

- **Quarantined Worktree**: `/Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope` (branch `antigravity/rec0-reliability-envelope`).
- **Release-Candidate Isolation**: Zero modifications to `/Volumes/4TB-WD/spe-worktrees/spe-lvt2-r2-trust-root-repair` (PR #147) and zero modifications to locked release-candidate landing copy (`apps/web/src/landing/SeoContent.tsx`).
- **Literature Grounding**:
  - *Consistent-but-Wrong / Repeated Sampling Limits* (Pass@k vs. Pass^k; ArXiv 2603.12238): Repeated model agreement without an independent outcome oracle cannot establish reliability when common-mode correlation $\rho \to 1$.
  - *Execution-Path Instability under Environmental Perturbation* (ArXiv 2605.10516): When execution-path stability drops below the calibrated floor (`0.85`), envelope state transitions from `VALID` to `STALE`.
  - *Reflective Prompt Evolution vs. Runtime Qualification* (GEPA, ArXiv 2507.19457): Prompt optimization improves single-run accuracy on stationary distributions but does not provide runtime drift invalidation, cryptographic provenance, or selective proof reuse.

---

## 2. Deliverable 1: Specification & Implementation (`spe_runtime/research/rec/`)

### 2.1 12-Field `ReliabilityEnvelope` Schema ([envelope.py](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py))
Every compiled [`ReliabilityEnvelope`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L430-L490) binds all 12 required contract fields under an RFC 8785 canonical JSON SHA-256 `receipt_hash` and Ed25519 signature from an owner-attested [`LearningValidator`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/lvt/learning_validator.py) (`_is_validator_key_authorized` verifies the signing public key against `_OWNER_AUTHORIZED_VALIDATORS` and `_REVOKED_VALIDATORS`):
1. `intent_digest`: Canonical SHA-256 digest of [`ProtectedIntent`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/prompt/meta_compiler.py).
2. `requirement_set_digest`: Canonical SHA-256 digest of sorted [`RequirementAtom`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/requirements/models.py) obligations.
3. `model_revision_binding`: [`ModelRevisionBinding`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L68-L80) (`model_id`, `model_or_runtime_digest`, `model_digest_type`; rejects synthetic model-name hashes claiming `VERIFIED_MODEL_REVISION`).
4. `environment_binding`: [`EnvironmentBinding`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L84-L100) (`runtime_id`, `tool_permissions`, `network_policy`, `schema_version`, `assumption_predicates`).
5. `evaluator_binding`: [`EvaluatorBinding`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L104-L118) (`oracle_id`, `oracle_class`, `oracle_public_key`, signed `oracle_attestation`; prohibits self-certification).
6. `dataset_commitment`: [`DatasetCommitment`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L122-L177) ($\ge 20$ distinct contamination-controlled task family clusters, zero train/holdout overlap).
7. `observed_success`: [`ObservedSuccessMetrics`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L181-L234) (`per_run_pass_rate`, `all_runs_pass_rate` / `pass^k`, `execution_path_stability`, `inter_run_correlation`, `independent_oracle_verified`; enforces `all_runs_pass_rate <= per_run_pass_rate` and exact consistency with `n_all_runs_passed_tasks / n_tasks`).
8. `risk_bound`: Exact one-sided Clopper–Pearson family-clustered upper confidence bound on failure probability (`0.091483 <= tau = 0.10` for 24/24 families at $\alpha = 0.10$), verified on both compilation and evaluation against recomputation. Remains `None` (`UNKNOWN`) if `independent_oracle_verified=False`.
9. `coverage_scope`: [`CoverageScope`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L238-L254) (`task_category`, `domain`, `max_complexity_score`, `supported_perturbation_radius`, `eligible_input_predicates`).
10. `dependency_hashes`: [`DependencyHashes`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L258-L280) (`rbpd_asset_hashes`, `causal_proof_slice_digest`, `obligation_hypergraph_digest`, `requirement_slice_hashes` for selective per-obligation reuse, and `parent_envelope_hashes` for multi-hop compositional invalidation).
11. `drift_triggers`: Tuple of all 11 canonical [`DriftTrigger`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L51-L65) identifiers.
12. `revocation_reference`: Durable tombstone pointer (`tx:<envelope_id>`).

### 2.2 Four-State Validity Machine & Correlation-Aware Risk Estimator
- [`EnvelopeValidityState`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L42-L48):
  - `VALID`: All 12 bindings (and any upstream parent envelopes) match and `risk_bound <= tau`; qualified reuse permitted.
  - `STALE`: Previously valid evidence suspended due to requirement edit, model revision change, environment perturbation, path instability (`< 0.85`), dependency slice edit, expired horizon, or stale upstream envelope. Direct reuse blocked; generates targeted requalification obligations while preserving unaffected `reused_obligations`.
  - `INVALID`: Forged signature, unattested/revoked validator or oracle or tombstone, tampered `risk_bound`, synthetic model digest spoofing, contaminated calibration dataset, invalid upstream parent envelope, or cross-intent/out-of-scope reuse attempt. Fails closed immediately.
  - `UNKNOWN`: Missing envelope or unverified verbal confidence / multi-agent agreement without an independent oracle. Never converted to `PASS`.
- [`CalibratedRiskEstimator.correlated_repeated_risk_bound`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/envelope.py#L345-L370):
  $$\operatorname{Risk}_{\text{repeated}}(p_1, k, \rho) = (1 - \rho) p_1^k + \rho p_1$$
  Prevents correlated repeated runs ($\rho \to 1$) from claiming naive $p_1^k$ risk reduction.

### 2.3 Policy-Constrained Cost–Risk Execution Selector ([selector.py](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/selector.py))
[`CostRiskExecutionSelector.select_execution_strategy`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/selector.py#L145-L341) solves:
$$a^* = \arg\min_{a \in A_{\text{authorized}}} \operatorname{ExpectedCost}(a) \quad \text{s.t.} \quad \operatorname{EstimatedRiskUpperBound}(a) \le \tau$$
across the 5 canonical [`ExecutionAction`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/selector.py#L35-L42) types (`REUSE_DETERMINISTIC_PROCEDURE`, `EXECUTE_SELECTED_MODEL`, `EXECUTE_WITH_INDEPENDENT_VERIFICATION`, `ESCALATE_TO_HUMAN`, `ABSTAIN_INSUFFICIENT_QUALIFICATION`) while enforcing `ProtectedIntent.budget_nanos`, `NetworkPolicy.AIR_GAPPED`, `AuthorityGrant` active limits, and bounding unverified strategy risk from below by `envelope_eval.effective_risk_bound`.

---

## 3. Deliverable 2: Adversarial Qualification Suite ([adversarial.py](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/adversarial.py))

All 7 mandatory adversarial fixtures execute in [`AdversarialQualificationSuite`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/adversarial.py#L64-L492) with `attack_blocked=True` and `unauthorized_effect_occurred=False`:

| Fixture ID | Adversarial Attack Vector | Observed State | Blocked? |
| :--- | :--- | :--- | :---: |
| `ADV-REC0-01-CONSISTENT-BUT-WRONG` | 5/5 unanimous self-agreement + `0.999` verbal confidence without independent oracle | `UNKNOWN:ABSTAIN_INSUFFICIENT_QUALIFICATION` | **PASS** |
| `ADV-REC0-02-CORRELATED-REPEATED-RUNS` | 5 correlated runs ($p_1=0.25, \rho=0.92$) claiming naive $p_1^5 = 0.00098 \le \tau=0.05$ | `corr_risk=0.2301:ABSTAIN_INSUFFICIENT_QUALIFICATION` | **PASS** |
| `ADV-REC0-03-MODEL-REVISION-SUBSTITUTION` | Silent checkpoint digest swap + synthetic model digest claiming `VERIFIED_MODEL_REVISION` | `swap=STALE,synth=INVALID` | **PASS** |
| `ADV-REC0-04-CONTAMINATED-CALIBRATION` | Calibration dataset with train/holdout overlap and `< 20` distinct clusters | `INVALID` | **PASS** |
| `ADV-REC0-05-REVOKED-EVIDENCE-REPLAY` | Replay of signed `ReliabilityEnvelope` after durable tombstone revocation & simulated restart | `INVALID` (`TOMBSTONE_REVOKED`) | **PASS** |
| `ADV-REC0-06-ENVIRONMENT-DRIFT` | Tool permission / DOM assumption drift + execution-path stability drop (`0.62 < 0.85`) | `STALE` (`ENVIRONMENT_PERTURBED`, `EXECUTION_PATH_UNSTABLE`) | **PASS** |
| `ADV-REC0-07-INCORRECT-EVIDENCE-REUSE` | Cross-intent reuse (`ProtectedIntent` mutated) and out-of-scope task category reuse | `intent=INVALID,scope=INVALID` | **PASS** |

---

## 4. Deliverable 3: 5-Stage Preregistered Experiment & 5-Baseline Comparison ([experiment.py](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/experiment.py))

Executed under [`PreregisteredExperimentProtocol`](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/experiment.py#L46-L78) (`PREREG-SPE-REC0-2026-10-11`, 24 task families $\times$ 12 iterative steps = 288 submitted tasks per system, $k=5$, $\tau=0.10$, explicit abstention inclusion in the denominator):

| System / Baseline | Submitted Tasks | Verified Passed (`pass^5`) | Verified `pass^5` Rate | False Acceptances | False Acceptance Rate | Abstained Tasks | Lifecycle Cost (NanoUSD) | Cost / Verified Outcome (NanoUSD) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `DIRECT_EXECUTION` | 288 | 168 | `0.5833` | 120 | `0.4167` | 0 | 14,400,000 | `85,714.29` |
| `PROMPT_OPTIMIZED_GEPA` | 288 | 192 | `0.6667` | 96 | `0.3333` | 0 | 18,720,000 | `97,500.00` |
| `REPEATED_MAJORITY_UNANIMOUS` | 288 | 192 | `0.6667` | 96 | `0.3333` | 0 | 72,000,000 | `375,000.00` |
| `INDEPENDENT_VERIFIER_NO_REUSE` | 288 | 204 | `0.7083` | 0 | `0.0000` | 84 | 43,200,000 | `211,764.71` |
| `FULL_REEXECUTION_NO_REUSE` | 288 | 264 | `0.9167` | 0 | `0.0000` | 24 | 100,800,000 | `381,818.18` |
| **`SPE_REC0_ENVELOPE_COMPILER`** | **288** | **264** | **`0.9167`** | **0** | **`0.0000`** | **24 (`0.0833`)** | **2,852,500** | **`10,804.92`** |

- **Lifecycle Cost Reduction vs. `FULL_REEXECUTION_NO_REUSE`**: **`35.3374x`** (95% paired family-cluster bootstrap CI **`[31.1399x, 42.6126x]`** $\ge 10.0\times$ target), accounting for initial envelope compilation (`8,000` NanoUSD), per-step invalidation checks (`500`–`800` NanoUSD across families), deterministic procedure reuse (`1,500` NanoUSD), and selective slice reverification (`15,000`–`18,000` NanoUSD) on localized animation edits.
- **Evidence Commitment Hash**: `63f247dfc4687b4cbabb0c0d1edbd4756348777a4dc4608cd289d8f23c2e04d7`
- **Mandatory Negative Control (`GLOBAL_MODEL_AND_ENVIRONMENT_SHIFT_EVERY_STEP`)**: When every step undergoes a global model revision shift and environment perturbation, `reused_envelopes_count = 0`, `rec0_cost_nanos = 8,420,000 > full_reexecution_cost_nanos = 8,400,000`, `net_cost_advantage_claimed = False`, and `claim_status = "NO_10X_CLAIMED_OUTSIDE_ELIGIBLE_ENVELOPE"`.
- **Stage 5 Independent Reproduction & Cross-Runtime Conformance**: `reproduce_rec0_experiment` verified exact bit-for-bit reproduction (`reproduced_exact = True`, `evidence_commitment_match = True`), and `PortabilityVerifier` verified 100% conformance across `python-reference`, `rust-spe-core-eval`, and `wasm-spe_wasm`.

---

## 5. Deliverable 4: 7-View Differentiating User Experience ([explain.py](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/explain.py), [cli.py](file:///Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope/spe_runtime/research/rec/cli.py))

For the canonical prompt *"Build a 3D scrolling website from this reference URL, make it work on mobile, keep keyboard navigation, and make it load fast"* followed by a localized scroll-animation edit, `python3 -m spe_runtime.research.rec.cli` (and `--json`) renders all 7 required views (`Intent`, `Execution`, `Validation`, `Reliability`, `Unresolved`, `Recovery`, `Cost`) and a strict `PASS` / `FAIL` / `UNKNOWN` epistemic ledger where `G6_H_REAL_HUMAN_STUDY = BLOCKED_HOLD` and `PRODUCTION_QUALIFICATION = HOLD`.
