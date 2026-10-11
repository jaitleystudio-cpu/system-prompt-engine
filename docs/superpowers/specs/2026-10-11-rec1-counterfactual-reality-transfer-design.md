# SPE Ω — REC-1: Counterfactual Reality Transfer Architectural Specification

- **Document ID**: `SPE-SPEC-REC1-2026-10-11`
- **Milestone**: `REC-1 — COUNTERFACTUAL REALITY TRANSFER AND EVIDENCE-ORIGIN FIREWALL`
- **Status**: `RESEARCH_SPECIFICATION_APPROVED_FOR_TDD`
- **Target Worktree / Branch**: `/Volumes/4TB-WD/spe-worktrees/spe-rec0-reliability-envelope` (`antigravity/rec1-counterfactual-reality-transfer`)
- **Quarantine Scope**: `spe_runtime/research/rec/`, `tests/research/rec/`
- **Frozen Boundaries Respected**: `portable/spe-core-rs/`, `apps/web/public/spe_wasm.wasm`, `SPE-SPEC`, `PARALLEL_OWNERSHIP_MAP.json`, `apps/web/src/landing/SeoContent.tsx`

---

## 1. Executive Summary & Epistemic Audit Resolutions

### 1.1 Root Problem: Statistical Soundness & The Pairwise Independence Fallacy
In REC-0, repeated execution risk was modeled as:
$$R(p, k, \rho) = (1 - \rho) p^k + \rho p$$
where $p$ is single-run failure probability, $k$ is number of attempts, and $\rho$ is pairwise correlation.

**The Counterexample (Pairwise Independence $\neq$ Mutual Independence)**:
Consider $k=3$ binary execution trials $(F_1, F_2, F_3) \in \{0, 1\}^3$ distributed uniformly over four ternary patterns:
$$\{ (1, 1, 1), (1, 0, 0), (0, 1, 0), (0, 0, 1) \} \quad \text{each with probability } \frac{1}{4}$$

1. **Marginal failure probability**:
   $$P(F_1 = 1) = P(1, 1, 1) + P(1, 0, 0) = \frac{1}{4} + \frac{1}{4} = \frac{1}{2} = 0.5$$
   Similarly, $P(F_2 = 1) = 0.5$ and $P(F_3 = 1) = 0.5$. Thus $p = 0.5$.
2. **Pairwise joint failure**:
   $$P(F_1 = 1, F_2 = 1) = P(1, 1, 1) = \frac{1}{4} = 0.25$$
   Since $P(F_1 = 1) \cdot P(F_2 = 1) = 0.5 \times 0.5 = 0.25$, the covariance is $\operatorname{Cov}(F_1, F_2) = 0$, so pairwise correlation $\rho = 0$.
3. **The REC-0 Formula Prediction**:
   $$R(0.5, 3, 0) = (1 - 0)(0.5)^3 + 0 = 0.125$$
4. **The Ground-Truth Joint Failure**:
   $$P(F_1 = 1 \cap F_2 = 1 \cap F_3 = 1) = P(1, 1, 1) = 0.25$$
5. **The Operational Defect**:
   The true probability that all 3 runs fail simultaneously is $0.25$—**exactly $2\times$ higher** than the formula's prediction of $0.125$. Under a risk tolerance $\tau = 0.15$, the old formula falsely certifies the envelope as safe ($0.125 \le 0.15$), exposing the user to catastrophic unbudgeted failure.

### 1.2 Evidence-Origin Integrity & The Simulation Conflation Barrier
In REC-0's synthetic simulation benchmark (`experiment.py`), 288 tasks across 24 families yielded a 35.34× cost reduction on synthetic fixtures. However:
- Synthetic fixtures and simulated competitor labels (e.g., `PROMPT_OPTIMIZED_GEPA`) must never be confused with real-world competitor evaluations.
- Generated dataset identifiers (`synth-rec0-iterative-24fam`) must never be granted `INDEPENDENTLY_VERIFIED` status.
- An **Evidence-Origin Firewall** must enforce strict segregation between `SYNTHETIC_FIXTURE` (benchmarking/unit-test only) and `INDEPENDENTLY_VERIFIED` (real-world attested).

---

## 2. Mathematical Formalization: Metric Separation & Fréchet-Hoeffding Copula Bounds

### 2.1 Formal Event Separation
We strictly distinguish three distinct random variables and risk quantities:

| Metric | Random Event | Independence Value | Fréchet-Hoeffding Bound (Distribution-Free) | Empirical Estimator |
|---|---|---|---|---|
| **Simultaneous Joint Failure ($P_{\text{joint}}$)** | $\bigcap_{i=1}^k \{F_i = 1\}$ | $\prod_{i=1}^k p_i = p^k$ | $\max(0, \sum p_i - (k-1)) \le P_{\text{joint}} \le \min_i(p_i)$ | Clopper-Pearson on observed family-level joint events $E_{\text{joint}} = \mathbb{I}(\forall i, F_i=1)$ |
| **All Attempts Succeed ($pass^k$)** | $\bigcap_{i=1}^k \{S_i = 1\}$ | $\prod_{i=1}^k (1 - p_i) = (1 - p)^k$ | $\max(0, \sum (1-p_i) - (k-1)) \le pass^k \le \min_i(1 - p_i)$ | Clopper-Pearson on family-level $E_{\text{all\_pass}} = \mathbb{I}(\forall i, S_i=1)$ |
| **At Least One Succeeds ($pass@k$)** | $\bigcup_{i=1}^k \{S_i = 1\} = 1 - P_{\text{joint}}$ | $1 - p^k$ | $1 - \min_i(p_i) \le pass@k \le 1 - \max(0, \sum p_i - (k-1))$ | $1 - \text{ClopperPearsonUpper}(E_{\text{joint}})$ |

### 2.2 Sound Joint Risk Calculation in REC-1
When estimating the failure upper bound for $k \ge 2$ multi-attempt execution:
1. **Empirical Joint Observations Available**: If the dataset commitment contains $N_{\text{fam}} \ge 20$ independent families where each family has observed outcomes across all $k$ runs, the estimator computes the exact one-sided Clopper-Pearson upper bound on the joint failure indicator $E_{\text{joint}} = \mathbb{I}(\text{all } k \text{ runs failed})$.
2. **Empirical Joint Observations Unavailable**: When only per-run marginal failure rate $\hat{p}_1$ and pairwise correlation $\rho$ are known, REC-1 **forbids** assuming $(1-\rho)p^k + \rho p$ as a universal upper bound. Instead:
   - For simultaneous failure risk $P(\bigcap F_i)$, the distribution-free upper bound is $\hat{p}_1$ (Fréchet upper copula).
   - If an exchangeable mixture model is explicitly declared and verified, the estimator labels the bound `EXCHANGEABLE_MIXTURE_APPROXIMATION` and enforces an inflation factor or flags `UNKNOWN` if $\tau < \hat{p}_1$.

---

## 3. Evidence-Origin Firewall Architecture

### 3.1 `EvidenceOrigin` Specification
```python
class EvidenceOrigin(str, Enum):
    SYNTHETIC_FIXTURE = "SYNTHETIC_FIXTURE"          # strictly for local tests/calibration; prohibited from production qualification
    OBSERVED_UNVERIFIED = "OBSERVED_UNVERIFIED"      # observed in execution, but lacks independent oracle attestation
    INDEPENDENTLY_VERIFIED = "INDEPENDENTLY_VERIFIED"# attested by verified third-party independent oracle with non-synthetic dataset
    STALE = "STALE"                                  # once verified, but invalidated by causal slice drift or environment perturbation
    REVOKED = "REVOKED"                              # tombstoned
```

### 3.2 Firewall Enforcement Rules
1. **Rule EOF-1 (Synthetic Non-Promotion)**:
   Any `ReliabilityEnvelope` whose `dataset_commitment.dataset_id` has prefix `synth-`, whose `dataset_commitment.is_synthetic is True`, or whose evidence origin is `SYNTHETIC_FIXTURE`, evaluates to `EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY`.
2. **Rule EOF-2 (Selector Gate)**:
   `CostRiskExecutionSelector` will NEVER select `REUSE_DETERMINISTIC_PROCEDURE` or `EXECUTE_SELECTED_MODEL` when the supporting envelope has `evidence_origin == SYNTHETIC_FIXTURE` unless the request execution policy explicitly authorizes `allow_synthetic_calibration_execution=True` (test-mode only).
3. **Rule EOF-3 (Report Truth)**:
   In `REC1ExperimentRunner` and all reporting CLI tools, the synthetic benchmark is labeled `SYNTHETIC_SIMULATION_BENCHMARK`. The report must output:
   - `competitor_qualification: NOT_PROVEN (requires live external API evaluation)`
   - `external_model_qualification: BLOCKED_HOLD`
   - `g6_h_blinded_human_evaluation: BLOCKED_HOLD`
   - `production_release_authorization: HOLD`

---

## 4. Counterfactual Reality Transfer (`RealityTransferEngine`)

### 4.1 Cross-Reality Invalidation Cones
When an agent or procedure qualified under Reality $\mathcal{R}_{\text{src}} = (\text{Model}_A, \text{Env}_A, \text{ToolSchema}_A)$ is targeted for Reality $\mathcal{R}_{\text{tgt}} = (\text{Model}_B, \text{Env}_B, \text{ToolSchema}_B)$:
1. **Exact Transfer Receipt Enforced**: Transfer is valid iff an authenticated `LearningValidator.verify_model_transfer_receipt` attestation exists.
2. **Counterfactual Witness Search**: Synthesizes discriminating test vectors $\mathbf{x}^* \in \mathcal{X}$ where $\mathcal{R}_{\text{src}}$ and $\mathcal{R}_{\text{tgt}}$ are predicted to diverge.
3. **Reality Drift Detection**: If counterfactual witnesses detect divergence $\ge \epsilon_{\text{drift}}$, the envelope transitions immediately to `STALE` and generates minimal requalification proof obligations via `SelectiveRequalificationEngine`.

---

## 5. Verification & Acceptance Criteria

1. **Defect REC-F01 Repaired**: The 3-attempt ternary counterexample ($p=0.5, \rho=0$, joint failure $0.25$) is reproduced as a failing test, and the repaired estimator correctly returns a risk bound $\ge 0.25$ (Fréchet / empirical joint bound).
2. **Defect REC-F02 Repaired**: Envelopes with synthetic datasets cannot acquire `VALID` production state or bypass the selector gate.
3. **All 38 Previous Mutants + New REC-1 Mutants Killed**: Mutation score $\ge 100\%$.
4. **Clean Conformance**: Python unit/integration tests pass hermetically without tombstone pollution.
