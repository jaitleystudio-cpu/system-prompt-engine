# Master Plan: SPE Ω — RGIC-E1 Evidence Closure Planner
## Bidirectional Acceptance Compilation, Minimal Probe Selection & Uncertainty Conservation

**Date:** October 9, 2026  
**Status:** Approved Research Architecture (Strict Quarantine)  
**Target Worktree:** `system-prompt-engine`  
**Governing Milestone:** Release Candidate Freeze October 26, 2026, 10:10 PM IST (Non-Contaminating Research Track)  
**Research Quarantine:** `spe_runtime/research/rgic_e1/` & `tests/research/rgic_e1/`  
**Authors:** SPE Core Architecture & Autonomous Evidence Planning Team  

---

## 1. Executive Summary & Problem Formulation

In modern agentic AI systems, model outputs, tool invocations, and multi-step execution plans are frequently generated at near-zero cost. However, the critical vulnerability lies in **evidence closure**:
* An agent declares a task "complete" simply because it stopped generating text or executed a mock test.
* Competitor platforms (LangSmith, Promptfoo, OpenAI Agents SDK) evaluate or log what was produced, but do not work **backward** from the required outcome to determine what remains unproven before allowing completion.
* When information is missing, systems either loop indefinitely, hallucinate completion, or ask exhausting, low-value clarification questions.

**RGIC-E1 (Evidence Closure Planner)** introduces a bidirectional evidence compiler that formalizes the exact boundary between claimed outcomes and verified proof:
$$\boxed{\text{For every material claim, SPE must either connect it to authorized evidence, obtain an appropriate minimal observation, narrow the claim, or leave it explicitly UNKNOWN.}}$$

---

## 2. Theoretical Architecture & Conservation Invariant

### 2.1 The Bidirectional Compilation Cycle

```
HUMAN REQUEST (Intent)
      │
      ▼
ACCEPTANCE OBLIGATIONS O = {o_1, ..., o_n}
      │
      ▼
WHAT WOULD PROVE SUCCESS? (Predicate & Evidence Policy)
      │
      ├── Existing Evidence Satisfies ──► PASS
      │
      └── Evidence Gap Detected
            │
            ▼
      [CLASSIFY MISSING OBSERVATION]
            │
            ▼
      [SELECT MINIMAL UTILITY PROBE a*]
            │
            ▼
      [AUTHORIZATION & SAFETY CHECK] (a* ∈ A_authorized)
            │
            ▼
      [ACQUIRE OBSERVATION & INDEPENDENT ADJUDICATION]
            │
            ├── Valid Evidence Acquired ──► VERIFIED
            ├── Evidence Insufficient   ──► Retain UNKNOWN / UNRESOLVED
            └── Claim Narrowed          ──► LIMITED
```

### 2.2 The Mathematical Core

Let $\mathcal{O}$ denote the set of obligations derived from the user's protected intent:
$$S(o_i) \in \{\text{PASS}, \text{FAIL}, \text{UNKNOWN}, \text{NOT\_APPLICABLE}\}$$

For candidate verification action $a \in \mathcal{A}_{\text{authorized}}$, the expected utility is:
$$\operatorname{Utility}(a) = \operatorname{ExpectedDecisionImprovement}(a) - \operatorname{Cost}(a) - \operatorname{Risk}(a)$$
All costs and budgets are strictly computed in integer `NanoUSD` ($10^9\text{ nanos} = \$1.00$).

### 2.3 The Narrow Conservation Law
$$\boxed{\operatorname{Accept}(o_i) \implies \operatorname{ValidEvidence}(o_i, E)}$$
A conforming adjudicator **must not** accept an obligation without valid, independent evidence receipts.
If a task cannot be resolved by authorized observations, it **strictly retains `UNKNOWN`** rather than manufacturing false success.

---

## 3. Kernel Modules (`spe_runtime/research/rgic_e1/`)

1. **[`types.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic_e1/types.py)**:
   - Data structures: `Obligation`, `ObligationState`, `VerificationAction`, `EvidenceReceipt`, `ClaimScope` (`VERIFIED`, `LIMITED`, `UNRESOLVED`), and `EvidenceClosureContract`.
   - Invariants: Frozen dataclasses, integer `NanoUSD` costs.
2. **[`closure_planner.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic_e1/closure_planner.py)**:
   - Evaluates missing evidence per obligation.
   - Computes integer utility $\operatorname{Utility}(a)$ across authorized actions $\mathcal{A}_{\text{authorized}}$.
   - Selects the minimal probe that maximizes uncertainty reduction while minimizing cost and risk.
3. **[`adjudicator.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic_e1/adjudicator.py)**:
   - Enforces the conservation law.
   - Demotes ungrounded `PASS` states to `UNKNOWN` if no valid evidence receipt is present.
   - Sets contract claim scope to `UNRESOLVED` when obligations remain open.
4. **[`portable_contract.py`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/spe_runtime/research/rgic_e1/portable_contract.py)**:
   - Implements RFC 8785 JSON canonicalization and deterministic serialization of `spe_evidence_closure`.

---

## 4. Adversarial Verification Battery (`tests/research/rgic_e1/`)

The implementation verifies:
1. **Rejection of Ungrounded Claims**: Obligations marked `PASS` without matching receipts are immediately demoted to `UNKNOWN`.
2. **Rejection of Unauthorized Probes**: Actions with `is_authorized=False` are rejected by the planner.
3. **Retention of Uncertainty**: Unresolvable tasks preserve `UNKNOWN` and set claim scope to `UNRESOLVED`.
4. **Minimal Utility Selection**: Lower cost/risk probe is selected over high-cost alternatives.
5. **Portability**: Serialized `.spe` evidence closure contracts are deterministic and model-agnostic.
