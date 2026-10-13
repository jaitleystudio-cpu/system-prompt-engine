# SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1) Plan
**October 12, 2026 | Approved Research Specification & Prototype (Quarantine Track)**

---

## 1. Executive Summary & Core Objective

The mission of **SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1)** is to deliver an intelligence–efficiency breakthrough for System Prompt Engine Pro and the Universal Core. Rather than blindly applying indiscriminate prompt compression or fixed token limits, SPE Ω optimizes the complete problem-solving lifecycle:

> **The EGAC-1 Invariant**:
> Given an arbitrary user objective, preserve all mandatory semantic and security constraints; identify the minimum-cost execution strategy capable of satisfying them; adapt the model, context, reasoning budget, caching, compression, and verification to the task; and independently measure correctness, creativity, latency, token consumption, and cost.

Treat quality and reliability as hard constraints, not optional trade-offs. Never silently truncate legitimate long-form outputs, discard crucial context, reuse stale answers, or increase spending beyond authorized limits.

---

## 2. Core Architecture & Mechanisms

```
SPE PRO / UNIVERSAL — USER OBJECTIVE
  │
  ▼
PROTECTED INTENT
  │
  ▼
REQUIREMENT GRAPH
  │
  ▼
SEMANTIC DEPENDENCY MAP
  ┌───────────────────┼───────────────────┐
  ▼                   ▼                   ▼
HARD INVARIANTS    FLEXIBLE DATA       EVIDENCE
  │                   │                   │
  └───────────────────┼───────────────────┘
                      ▼
              EXECUTION PLANNER
  ┌───────────────────┼───────────────────┐
  ▼                   ▼                   ▼
CONTEXT STRATEGY   MODEL STRATEGY   COMPUTE STRATEGY
  │                   │                   │
  └───────────────────┼───────────────────┘
                      ▼
           OPTIMIZATION CANDIDATES
                      ▼
         PRESERVATION CHECKS (MECH A)
                      ▼
            QUALIFIED EXECUTION
                      ▼
         COUNTERFACTUAL EVAL (MECH C)
  ┌───────────────────┴───────────────────┐
  ▼                                       ▼
VALID RESULT                        FAILED / UNKNOWN
  │                                       │
  ▼                                       ▼
EVIDENCE RECORD & VSOD              REPAIR / ESCALATE
  │
  ▼
LVT TRANSFER GATE ──► VERIFIED REUSABLE METHOD
```

### Mechanism A — Semantic Conservation System (5 Information Classes)
Every piece of information in the prompt and context is partitioned into five distinct classes:

| Information Class | Treatment & Invariant Law |
|---|---|
| **1. Protected Requirements** | Cannot be silently removed or weakened; hard invariant. Zero loss tolerated. |
| **2. Exact-Byte Material** | Must retain byte-level representation when required (cryptographic hashes, exact schemas, code syntax, citations). |
| **3. Evidence-Bearing Material** | Can be transformed only with strict traceability and validated evidence coverage. |
| **4. Replaceable Context** | Eligible for summarization, restructuring, compression, or selective retrieval. |
| **5. Volatile Information** | Must carry freshness timestamps and strict invalidation conditions. |

### Mechanism B — Value-of-Information (VOI) Compute Allocation
Compute is allocated dynamically based on the predicted return on computation:

$$V(a) = \frac{\mathbb{E}[\Delta Q_{\mathrm{verified}} \mid a]}{\mathbb{E}[C_a] + \lambda \mathbb{E}[T_a]}$$

Where:
* $a$: Candidate computational action (e.g., retrieve paper, run simulation, escalate model, formal verification).
* $\Delta Q_{\mathrm{verified}}$: Expected contribution to independently verified answer quality $[0.0, 1.0]$.
* $C_a$: Expected computational or monetary cost in exact integer `NanoUSD` ($10^9 \text{ nanos} = \$1.00 \text{ USD}$).
* $T_a$: Expected additional latency in milliseconds.
* $\lambda$: Latency sensitivity coefficient ($\text{nanos}/\text{ms}$).

The complete planner enforces constrained optimization:
$$\min_{\pi} \mathbb{E}[C(\pi)] \quad \text{subject to} \quad \Pr(\text{success} \mid \pi) \ge q_{\min}, \; \Pr(\text{violation} \mid \pi) \le \epsilon, \; P_{95}(\text{latency} \mid \pi) \le L_{\max}$$

### Mechanism C — Counterfactual Optimization (CSC Integration)
Candidate optimizations that appear to conserve tokens are subjected to adversarial boundary probes before promotion:
1. **Security Invariant Probe**: Does shortened software specification still forbid unauthorized external network egress?
2. **Scientific Precision Probe**: Does compressed prompt preserve the crucial distinction between correlation and causation?
3. **Long-Horizon Context Probe**: Does context trimming preserve an indispensable decision made at step 0?
4. **Calibrated Difficulty Probe**: Does simple-query routing avoid routing short-but-deep mathematical or security questions to a weak model?
5. **Authorization & Freshness Probe**: Does exact answer cache reject stale answers when user permissions or underlying facts change?

---

## 3. The 8 Optimization Techniques & EGAC-E01

| Technique | Assessment & Policy |
|---|---|
| **1. JSON Minification** | Deterministic syntax preservation; qualified for structured workloads; tested via EGAC-E01. |
| **2. Output Token Budget (2048)** | Spending-control policy, NOT intelligence optimization; reject as universal default; protect 100k-word jobs. |
| **3. Whitespace Normalization** | Restricted opt-in; guard Python indentation, markdown tables, exact-byte strings. |
| **4. Context Window Trim** | Prune ancient turns only if protected requirements and causal dependencies remain intact. |
| **5. Duplicate Message Collapse** | Collapse accidental duplicates while preserving intentional tool traces and reinforcement nodes. |
| **6. Exact-Match Response Cache** | Valid only under identical model version, permissions, tool state, and freshness conditions. |
| **7. Concise Output Instruction** | Task-dependent; prohibited on scientific proofs, detailed manuscripts, and code generation. |
| **8. Simple-Query Model Routing** | Length-based difficulty estimation is rejected; replaced with evidence-calibrated difficulty routing. |

### Experiment EGAC-E01 — Controlled JSON Minification
* **Design**: Paired comparison on 120 representative JSON workloads (nested, unicode, large integers, duplicate keys, scientific data).
* **Conditions**: Control (Force Off) vs Treatment (Force On).
* **Canary Standard**: Zero tolerated critical failures ($\epsilon = 0$).

---

## 4. Breakthrough Research Metric: VSOD

$$\mathrm{VSOD} = \frac{N_{\mathrm{independently\ verified\ successes}}}{C_{\mathrm{total\ execution}}}$$

* Denominated in Verified Successes per Dollar.
* Total execution cost $C_{\mathrm{total}}$ includes inference, retrieval, verification, and retry overhead, tracked in integer `NanoUSD`.

---

## 5. Three Universal Experience Levels

1. **Immediate**: Smallest qualified computation ($0–$0.015), minimal latency (<300ms), complete direct result.
2. **Expert**: Multi-step decomposition, tool selection, constraint checking, automatic fallback to stronger models.
3. **Discovery**: Literature reconstruction, competing hypothesis generation, executable simulation, proof verification, output completeness protected.

---

## 6. Implementation Deliverables

1. Specification Document: `docs/plans/2026-10-12-spe-egac-evidence-gated-adaptive-compute-plan.md`.
2. Python Kernel (`spe_runtime/research/egac/`): `types.py`, `semantic_conservation.py`, `compute_allocation.py`, `counterfactual_optimizer.py`, `technique_evaluator.py`, `vsod_calculator.py`, `engine.py`, `__init__.py`.
3. Adversarial Test Battery (`tests/research/egac/`): Comprehensive pytest suite.
4. Universal Web Studio (`apps/web/src/engine/`): `speEgacTypes.ts`, `speEgacKernel.ts`, `spe-egac-studio.css`, `SpeEgacUniversalStudio.tsx`, wired into `FeaturesHub.tsx`.
5. Web Suite Automated Test (`apps/web/scripts/test-spe-egac-universal-suite.mjs`).
