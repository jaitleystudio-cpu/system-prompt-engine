# Master Plan: SPE Ω — Reality-Grounded Intelligence Compilation (RGIC)
## RGIC-O1: Concept Discovery, Operational Measurement & Cross-Model Causal Transfer

**Date:** October 9, 2026  
**Status:** Approved Research Architecture (Strict Quarantine)  
**Target Worktree:** `system-prompt-engine`  
**Governing Milestone:** Release Candidate Freeze October 26, 2026, 10:10 PM IST (Non-Contaminating Research Track)  
**Research Quarantine:** `spe_runtime/research/rgic/` & `tests/research/rgic/`  
**Authors:** SPE Core Architecture & Autonomous Causal Inference Team  

---

## 1. Executive Summary & Problem Statement

In modern AI evaluation, benchmark performance on static or even interactive environments (such as ARC-AGI-3 or synthetic RL suites) can be deceptive. A foundation model can achieve near-perfect task scores via memorized heuristics, prompt adaptation, or over-parameterized search without acquiring a genuine causal explanation of the underlying environmental mechanics.

When the environment dynamics change, simple behavioral skills and ungrounded prompt heuristics fail catastrophically:
1. **The Representation Blindspot:** The AI's existing ontology or feature space may lack the hidden variables necessary to explain observed variance.
2. **The Predictive vs. Causal Fallacy:** Correlation is routinely mistaken for causation. Merely observing $P(Y \mid X)$ does not establish the interventional effect $P(Y \mid do(X))$.
3. **Observation Timing & Target Leakage:** Candidate concepts often cheat by implicitly conditioning on future target outcomes rather than prior interaction history.
4. **Unidentifiability & Epistemic Overconfidence:** When multiple competing causal structures are observationally indistinguishable, naive models invent arbitrary explanations rather than honestly retaining uncertainty (`UNKNOWN`).
5. **Cross-Model Transport Fragility:** Causal explanations learned on Model A cannot be naively assumed to hold on Model B or across differing domain topologies.

**Reality-Grounded Intelligence Compilation (RGIC)** introduces a vendor-neutral, model-independent protocol for:
$$\boxed{\text{Discovering, operationally measuring, and independently qualifying portable causal theories and new conceptual distinctions across heterogeneous AI models.}}$$

---

## 2. The RGIC-O1 Five-Stage Lifecycle

Every candidate concept $z$ must survive five rigorous validation stages:

```
UNKNOWN PROBLEM
      │
      ▼
[1. DISCOVERY] ───────── Identify unexplained variance & formulate candidate concept
      │
      ▼
[2. MEASUREMENT] ─────── Define operational procedure: z_t = g(h_t) (Zero Target Leakage)
      │
      ▼
[3. CHALLENGE] ───────── Execute discriminating interventions & negative controls
      │
      ▼
[4. QUALIFICATION] ───── Independent verifier evaluates Δ_pred & identifiability
      │
      ├── If Observationally Indistinguishable ──► Retain UNKNOWN / Ambiguity
      │
      ▼
[5. TRANSFER] ────────── Cross-model transport φ: S → T (Revoked upon environment drift)
```

1. **Discovery:** The system identifies that current explanatory variables cannot account for prediction failures and proposes a candidate concept with a declared role (`PREDICTIVE`, `CAUSAL`, or `STRUCTURAL`).
2. **Operational Measurement:** The concept must provide an explicit, reproducible measurement procedure $z_t = g(h_t)$ based solely on history prior to prediction time $t$. Any dependence on future target $y_t$ constitutes target leakage and triggers immediate rejection.
3. **Challenge:** Synchronized experiments challenge the candidate against counterexamples, negative controls, and randomized feedback baselines.
4. **Qualification:** An independent verifier qualifies the concept within a bounded scope, strictly preventing self-certification and distinguishing predictive correlations from interventional causal claims. If competing theories are observationally indistinguishable, the verifier enforces Kleene `UNKNOWN`.
5. **Transfer:** The concept is packaged into a portable `.spe` theory artifact and tested on an independent target model family under mapping $\phi: S \to T$. If the target environment drifts, the qualification is dynamically revoked (`REVOKED`).

---

## 3. Kernel Modules (`spe_runtime/research/rgic/`)

| Module | Architectural Purpose | Invariants Enforced |
| :--- | :--- | :--- |
| [`types.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic/types.py) | Immutable dataclasses for `ConceptCandidate`, `OperationalMeasurement`, `ClaimedRole`, and `ConceptQualification`. | Frozen dataclasses, exact `NanoUSD` integer accounting. |
| [`operational_measurement.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic/operational_measurement.py) | Validates operational measurement procedure $z_t = g(h_t)$. | Rejects missing procedures, enforces dependency constraints, blocks target leakage. |
| [`qualification_validator.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic/qualification_validator.py) | Independent qualification gate evaluating held-out predictive gain $\Delta_{\text{pred}}$. | Enforces anti-self-certification, correlation-vs-causation barrier, and retention of `UNKNOWN`. |
| [`transfer_adapter.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic/transfer_adapter.py) | Cross-model concept transport $\phi: S \to T$. | Validates target model execution, dynamic revocation upon environment shift. |
| [`hidden_state_challenge.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic/hidden_state_challenge.py) | Procedural benchmark evaluating Environments A, B, and C. | Environment A (parity discovery), Environment B (unidentifiable state), Environment C (mechanism drift). |

---

## 4. The Hidden-State Challenge Benchmark

The benchmark simulates three progressively difficult operational environments:

* **Environment A (Discoverable State):** The internal operating state toggles with each `TOGGLE` action. The agent discovers the operational state parity:
  $$z_t = (\text{number of toggles since reset}) \bmod 2$$
  Yields predictable output $P(Y \mid X, z_t)$ and passes qualification.
* **Environment B (Unidentifiable State):** The hidden state transition is non-deterministic or uncoupled from observable actions. Competing theories remain observationally indistinguishable. The validator **must retain uncertainty (`UNKNOWN`)** rather than hallucinating an unverified concept.
* **Environment C (Changed Mechanism):** A previously verified state-transition rule stops applying due to external distribution drift. The system immediately detects prediction failure and **revokes the stale qualification**.

---

## 5. Adversarial Test Battery (`tests/research/rgic/`)

The implementation must pass 100% of the following adversarial tests:
1. `test_rgic_contract_immutability_and_types`: Immutability and exact integer cost invariants.
2. `test_operational_measurement_leakage`: Rejects candidates without measurement procedures or with future target leakage.
3. `test_concept_qualification_and_unidentifiability`: Blocks predictive claims masquerading as causal claims; enforces `UNKNOWN` on Environment B.
4. `test_cross_model_concept_transfer`: Validates cross-model transport, rejects target validation failures, and revokes qualification on distribution shift.
5. `test_hidden_state_environments`: Full verification across Environments A, B, and C.

---

## 6. Verification Status

* **Pytest Suite:** 11/11 tests passing in [`tests/research/rgic/`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/tests/research/rgic/).
* **Full Regression:** 159/159 tests passing across all research, hybrid, and unit suites in 12.19s.
* **Governance:** 0 copy-check violations, \$0 token spend, 100% air-gapped offline operation.
