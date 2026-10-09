# Master Plan: SPE Ω — Adversarial Evidence Qualification (AEQ)
## Extending RGIC-E1: Verifier Adequacy, Semantic Mutation Operators & Independent Release Audits

**Date:** October 9, 2026  
**Status:** Approved Research & Commercial Qualification Plan (Strict Quarantine)  
**Target Worktree:** `system-prompt-engine`  
**Governing Milestone:** Release Candidate Freeze October 26, 2026 (Non-Contaminating Research Track)  
**Research Quarantine:** `spe_runtime/research/rgic_e1/` & `tests/research/rgic_e1/`  
**Authors:** SPE Core Architecture, Adversarial Testing & Autonomous Qualification Team  

---

## 1. Executive Summary & Problem Formulation

Modern agent evaluation frameworks (LangSmith, Promptfoo, New Relic AI Evaluation, Kore.ai Autoloop) evaluate agent outputs against static benchmarks or prompt assertions. However, this creates a catastrophic structural vulnerability:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        THE GLOBAL AI EVALUATION BLINDSPOT                              │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ WHAT THE INDUSTRY ASKS:                  │ WHAT SPE Ω ASKS:                            │
│ "Does the agent's output pass the test?" │ "Would this test detect a realistic defect?"│
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

Empirical research in 2026 proves this gap:
1. **The False Sense of Security (Harness 2026 State of Agent DLC)**: 74% of engineering teams are confident in their evals, but only 19% have automated gates blocking bad releases, and 60% blow through AI budgets.
2. **The "Lucky Pass" Defect (AgentLens 2026, `arXiv:2605.12925`)**: 10.7% of successful software-agent submissions pass test suites through unreliable, incidental shortcuts.
3. **Task Completion $\ne$ Environment Understanding (Task2Quiz 2026, `arXiv:2601.09503`)**: Agents frequently satisfy superficial completion predicates while remaining blind to underlying environment state.
4. **Impossibility of Latent Elicitation (`arXiv:2606.12268`)**: You cannot reliably prove internal model thoughts; you must test falsifiable, observable artifacts under controlled stress.
5. **Prior Art Boundary (`arXiv:2610.01348`, Oct 1, 2026)**: Basic *claim $\to$ evidence $\to$ verdict* is already published research. SPE's defensible moat is **"Who verifies the verifier?"** (Adversarial Evidence Qualification).

---

## 2. Theoretical Architecture: Adversarial Evidence Qualification (AEQ)

```
USER OBJECTIVE & FROZEN SPECIFICATION R (ProtectedIntent)
                      │
                      ▼
            CANDIDATE VERIFIER V
                      │
       ┌──────────────┴──────────────┐
       ▼                             ▼
[LEGITIMATE ARTIFACTS X]     [SEMANTIC MUTATION ENGINE M(R)]
       │                             │
       ▼                             ▼
Does V accept valid x?       Inject Controlled Defects F_R
(False Rejection Rate)       (SMO-Auth, SMO-Binding, SMO-A11y...)
       │                             │
       │                             ▼
       │                     Does V catch defects?
       │                     Defect Detection Rate D(V, R, F_R)
       │                             │
       │                     ┌───────┴───────┐
       │                     │               │
       │                 V misses defect  V catches all
       │                     │               │
       │                     ▼               ▼
       │             VERIFIER INADEQUATE   VERIFIER QUALIFIED
       │                     │               │
       └──────────────┬──────┴───────────────┘
                      ▼
     [NON-WEAKENING REPAIR CHECKER]
     Requires: V'(x) = PASS ∧ V'(f) = FAIL
     Specification R remains strictly immutable (Hash(R))
                      │
                      ▼
         INDEPENDENT RELEASE AUDIT
    (PASS, FAIL, or Kleene UNRESOLVED)
```

### 2.1 Formal Defect-Detection Rate with Wilson Confidence Bounds
For a frozen requirement $R$, candidate verifier $V$, and injected fault set $F_R$:
$$D(V, R, F_R) = \frac{\sum_{f \in F_R} \mathbf{1}[V(f) = \text{FAIL}]}{|F_R|}$$

To eliminate stochastic LLM-as-a-judge noise, $D$ is reported with a $95\%$ Wilson score confidence interval:
$$w^\pm = \frac{\hat{p} + \frac{z^2}{2n} \pm z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$
If $w^- < \tau_{\text{threshold}}$ or verifier variance across $k$ runs exceeds $\epsilon$, the verifier is flagged as `INADEQUATE` or `FLAKY_STOCHASTIC`.

### 2.2 Semantic Mutation Operators (SMOs)
To avoid the "Goodhart Mutation Trap" (where trivial syntax errors inflate $D$), AEQ introduces structured semantic mutations:
1. **`SMO-Auth` (Authority Bypass)**: Strips authentication headers, identity tokens, or tenant scoping while maintaining syntactically valid payloads.
2. **`SMO-Binding` (Stale / Replay Mutation)**: Injects an expired receipt, an invalid timestamp, or a mismatched commit SHA to verify state-binding enforcement.
3. **`SMO-Inversion` (Semantic Predicate Inversion)**: Inverts the business invariant (e.g. negative withdrawal, unauthorized address mutation) while keeping formatting 100% conformant.
4. **`SMO-A11y` (Silent Degradation)**: Strips accessibility semantics (ARIA attributes, keyboard navigation) while preserving identical DOM layout.
5. **`SMO-Escrow` (Financial Leakage)**: Mutates transactional balance by $10^{-9}$ USD to verify exact integer `NanoUSD` conservation.

### 2.3 The Non-Weakening Invariant Theorem ($\Delta R = \emptyset$)
When AEQ identifies verifier inadequacy and proposes a repair $V'$, it enforces:
$$\boxed{\forall x \in \text{Valid}(R), V'(x) = \text{PASS} \quad \land \quad \forall f \in F_R, V'(f) = \text{FAIL}}$$
The specification $R$ is cryptographically signed and immutable ($\text{Ed25519}(R)$). The repair modifies only the *measurement probe or test harness*, never the *authorized specification*.

---

## 3. Commercial Productization: The $1,500 Independent Release Audit

SPE delivers immediate revenue without human consulting overhead or cloud data centers via:
```bash
spe audit-release --contract <contract.spe> --harness <test_dir/> --out report.html
```

### Deliverable: The Self-Contained Interactive Audit Bundle
1. **Requirement Inventory**: Frozen extraction of all functional, security, and financial invariants.
2. **Coverage vs Defect-Detection Matrix**: Distinguishing between executed lines and genuine fault-detection capability.
3. **Interactive Fault Playback**: Direct replay scripts for each injected mutant that slipped past the customer's verifiers.
4. **Estimated Cost-to-Close**: Exact integer `NanoUSD` / token projection to repair the evaluation harness.
5. **Cryptographic Readiness Receipt**: Ed25519-signed verdict (`RELEASE_QUALIFIED`, `EVALUATION_INADEQUATE`, or `UNRESOLVED`).

---

## 4. The 4-Arm Falsification Experiment

| Arm | Description | Target Hypothesis |
| :--- | :--- | :--- |
| **Arm A** | Baseline agent with native completion checks | Catches $<25\%$ of injected semantic mutants. |
| **Arm B** | Agent evaluated with standard framework (Promptfoo / LangSmith) | Catches $45\text{--}60\%$ of mutants; susceptible to Lucky Passes. |
| **Arm C** | SPE RGIC-E1 without verifier challenges | Enforces honest `UNKNOWN`, but accepts inadequate test passes. |
| **Arm D** | **SPE RGIC-E1 + AEQ (Adversarial Evidence Qualification)** | Catches $\ge 95\%$ of semantic mutants; identifies test harness blindspots with 0% requirement drift. |

---

## 5. Implementation Roadmap (Strict Quarantine)

1. `spe_runtime/research/rgic_e1/verifier_adequacy.py`: Core AEQ engine, Semantic Mutation Operators, Wilson score interval, Non-Weakening Invariant Guard.
2. `tests/research/rgic_e1/test_verifier_adequacy.py`: Test suite validating mutant detection, rejection of inadequate verifiers, and non-weakening enforcement.
3. Verification in battery: Integration into the automated pytest runner.
