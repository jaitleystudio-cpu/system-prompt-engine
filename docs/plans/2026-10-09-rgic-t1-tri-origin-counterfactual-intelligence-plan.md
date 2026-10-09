# Master Plan: SPE Ω — RGIC-T1 Tri-Origin Counterfactual Intelligence Harness
## Counterfactual Fault Discrimination, Cryptographic Precommitment & Retractable Knowledge Graphs

**Date:** October 9, 2026  
**Status:** Approved Research Architecture (Strict Quarantine)  
**Target Worktree:** `system-prompt-engine`  
**Governing Milestone:** Release Candidate Freeze October 26, 2026 (Quarantined Theoretical Frontier)  
**Research Quarantine:** `spe_runtime/research/rgic_t1/` & `tests/research/rgic_t1/`  
**Authors:** SPE Core Architecture & Autonomous Causal Learning Team  

---

## 1. Executive Summary & Problem Formulation

In modern AI agent systems, unexpected outcomes trigger superficial retry loops or automated prompt repairs. However, when an agent fails:
* **Goal Interpretation (G)**: The agent misunderstood the user's intent.
* **World Model (W)**: The agent's assumptions about the environment/API/runtime are false or drifted.
* **Verifier (V)**: The acceptance tests or measurement harnesses are defective, checking the wrong viewport, ignoring auth, or failing to detect regressions.
* **Joint Origins**: Two or more origins fail simultaneously (e.g., $G \land V$).
* **Unidentifiable**: Available observations cannot distinguish between competing explanations.

Repeatedly retrying code when the verifier is broken, or repairing a prompt when the runtime API has changed, is pure waste.

**RGIC-T1 (Tri-Origin Counterfactual Intelligence Harness)** introduces a formal counterfactual discrimination substrate that separates $G$, $W$, and $V$ through controlled, authorized experiments, enforces cryptographic prediction precommitment, and maintains a Directed Acyclic Epistemic Dependency Graph (DAEDG) so that knowledge can be safely retracted when underlying assumptions fail.

---

## 2. Theoretical Architecture & Mathematical Invariants

```
HUMAN OBJECTIVE & FROZEN INTENT (ProtectedIntent)
                      │
                      ▼
               OBSERVED DISCREPANCY
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
[COMPETING HYPOTHESES]     [IDENTIFIABILITY MATRIX]
H_G: Goal interpretation   Check Total Variation Distance:
H_W: World dynamics        TV(P(Y|H1), P(Y|H2)) ≥ ε
H_V: Verifier adequacy     If TV < ε: Formally UNIDENTIFIABLE
        │                           │
        └─────────────┬─────────────┘
                      ▼
       [EXPERIMENT UTILITY OPTIMIZER]
       Max Score(a) = ΔU_nanos(a) - CostNanoUSD(a) - RiskNanoUSD(a)
       Subject to a ∈ A_authorized
                      │
                      ▼
       [CRYPTOGRAPHIC PRECOMMITMENT LOCK]
       Digest = SHA256(Predictions || ProbeID || Timestamp || Nonce)
       Execution BLOCKED until commitment is sealed
                      │
                      ▼
            [ISOLATED PROBE RUN]
                      │
                      ▼
      [INDEPENDENT ADJUDICATION & SEPARATION]
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
[DISCRIMINATED OUTCOME]     [RETRACTION CASCADE (DAEDG)]
G, W, V, or Joint           Invalidated assumptions demote
                            transitive descendants to
                            REQUALIFICATION_REQUIRED
```

### 2.1 The Separability & Identifiability Criterion
Two candidate hypotheses $H_i, H_j \in \mathcal{H}$ are $\epsilon$-separable under authorized probe $a \in \mathcal{A}_{\text{authorized}}$ if and only if their predicted observation distributions satisfy:
$$\operatorname{TV}\big(P(Y(a) \mid H_i), P(Y(a) \mid H_j)\big) \ge \epsilon$$
If for all permitted actions $a \in \mathcal{A}_{\text{authorized}}$, $\operatorname{TV} < \epsilon$, then $H_i$ and $H_j$ belong to the same **Observational Equivalence Class**:
$$\mathcal{E}(H_i) = \{H_j \mid \forall a \in \mathcal{A}_{\text{authorized}}, \operatorname{TV} < \epsilon\}$$
Under this condition, RGIC-T1 **strictly refuses to manufacture a guess**. It records `FORMALLY_UNIDENTIFIABLE` along with the equivalence class.

### 2.2 The Cryptographic Prediction Precommitment Scheme
To eliminate post-hoc rationalization (HARKing) and prevent an agent from altering its predictions after observing test outcomes:
$$\text{Commitment} = \operatorname{HMAC-SHA256}(\text{Key}, \operatorname{CanonicalJSON}(\text{Predictions}) \parallel \text{ProbeID} \parallel \text{Timestamp})$$
The execution engine verifies the existence of this cryptographic seal before dispensing execution tokens. The predictions are opened and compared against real evidence strictly post-execution.

### 2.3 Exact Integer NanoUSD Value-of-Information (VOI) Optimization
$$\operatorname{Score}(a) = \Delta U_{\text{nanos}}(a) - \operatorname{CostNanoUSD}(a) - \operatorname{RiskNanoUSD}(a)$$
Where:
* $\Delta U_{\text{nanos}}(a) = \text{EntropyReduction}(a) \times \text{Criticality} \times 10^6 \text{ nanos}$
* $\operatorname{CostNanoUSD}(a)$ is exact integer execution cost ($10^9\text{ nanos} = \$1.00$)
* $\operatorname{RiskNanoUSD}(a) = \text{RiskPoints}(a) \times 10^7 \text{ nanos}$

### 2.4 The Directed Acyclic Epistemic Dependency Graph (DAEDG) & Retraction Cascade
Knowledge is structured as an explicit dependency DAG:
$$\mathcal{G} = (\mathcal{V}_{\text{epistemic}}, \mathcal{E}_{\text{derivation}})$$
Nodes include: Observations, Operational Mechanisms, Capabilities, and Qualifications.
$$\operatorname{Invalidated}(v) \implies \forall u \in \operatorname{TransitiveDescendants}(v), \operatorname{State}(u) \leftarrow \text{REQUALIFICATION\_REQUIRED}$$
The historical evidence log is never erased; rather, the entitlement to execute dependent capabilities in `VERIFIED` mode is revoked until independent requalification occurs.

---

## 3. Concrete Implementation Plan (`spe_runtime/research/rgic_t1/`)

1. **`types.py`**:
   - `OriginClass` (`G`, `W`, `V`, `OTHER_OR_UNMODELED`)
   - `FailureOrigin` (Enum & Bitmask)
   - `Hypothesis` (with precommitted predicted outcomes)
   - `PrecommitmentLock` (SHA-256 seal)
   - `DistinguishabilityRecord` (.spe research artifact)
   - `EpistemicNode` & `EpistemicGraph`
2. **`tri_origin_harness.py`**:
   - `TriOriginDiagnoser`: Hypothesis registry, Separability tester, Integer NanoUSD VOI probe planner, Precommitment validator, Adjudicator.
   - `EpistemicDependencyTracker`: Topological sort, Retraction cascade engine.
3. **`tests/research/rgic_t1/test_tri_origin_harness.py`**:
   - Factorial Three-Fault Worlds (G, W, V, G+W, G+V, W+V, G+W+V).
   - Observational equivalence & honest unidentifiability.
   - Precommitment enforcement (tampering / post-hoc predictions rejected).
   - Retraction cascade across multi-tier dependencies.
   - Integer NanoUSD arithmetic invariance.
