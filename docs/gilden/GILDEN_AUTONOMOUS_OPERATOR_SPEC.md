# GILDEN — Autonomous Moat Operator Specification

**Spec Version:** `1.0.0`  
**System Lineage:** `spe_runtime/gilden`  
**Status:** Integrated Operational Subsystem  
**Authority Rule:** AI agents may NEVER grant themselves authority or spend capital without explicit policy grants.

---

## 1. Overview & System Role
GILDEN is the autonomous operating, growth, and continuous-learning system for SPE Ω. It monitors external model releases, ingests failure patterns, tracks SEO search opportunities, monitors infrastructure reliability, and proposes validated compiler improvements.

GILDEN is strictly decoupled from the core prompt compiler semantics (`ProtectedIntent`). It operates through a formal `PolicyKernel` that restricts every action to authorized capability grants and budget limits.

---

## 2. Core Operational Loop

```
       ┌───────────────────────────────┐
       │   1. OBSERVE ENVIRONMENT      │
       │   (Models, Failures, SEO)     │
       └──────────────┬────────────────┘
                      ▼
       ┌───────────────────────────────┐
       │   2. REASON & SYNTHESIZE      │
       │   (Identify Market Gaps)      │
       └──────────────┬────────────────┘
                      ▼
       ┌───────────────────────────────┐
       │   3. GENERATE ACTION PLAN     │
       │   (Bounded Experiment Draft)  │
       └──────────────┬────────────────┘
                      ▼
       ┌───────────────────────────────┐
       │   4. POLICY & BUDGET CHECK    │ ◄── CapabilityGrant + BudgetGuard
       │   (Check Granted Authority)   │
       └──────────────┬────────────────┘
                      ▼
       ┌───────────────────────────────┐
       │   5. EXECUTE & VERIFY         │
       │   (Run Local Benchmark/Job)   │
       └──────────────┬────────────────┘
                      ▼
       ┌───────────────────────────────┐
       │   6. REPORT & ACCUMULATE      │ ──► Append to Immutable Gilden Store
       │   (Feed Evidence to SPE)      │
       └───────────────────────────────┘
```

---

## 3. Subsystem Architecture

### 3.1 PolicyKernel & CapabilityGrant
Every autonomous task submitted to GILDEN must reference a valid `CapabilityGrant`:
- `capability`: Type of authorized action (`MODEL_PROBE`, `BENCHMARK_RUN`, `FAILURE_INGEST`, `SEO_ANALYZE`, `REPORT_GENERATE`).
- `resource_scope`: Allowlisted targets (e.g., local model IDs, specific directories).
- `budget_usd`: Maximum allowed financial expenditure ($0 for local operations).
- `expiration`: ISO timestamp beyond which the grant becomes void.

### 3.2 GildenStore (Append-Only Audit Log)
All actions, inputs, outputs, verification checks, and costs are written to an append-only transaction ledger (`gilden_history.jsonl`). Raw API keys or confidential customer prompt contents are strictly prohibited from log storage.

### 3.3 Core Operating Modules
1. **Gilden Model Watch:** Scans for frontier model updates, generates Model Passports, and flags behavioral drift.
2. **Gilden Failure Clustering:** Deduplicates reported failures, runs counterexample minimization, and produces candidates for the Failure Genome.
3. **Gilden SEO Loop:** Analyzes search rankings and Core Web Vitals to identify technical content needs.
4. **Gilden Reliability Observer:** Tracks runtime SLOs, aggregates incident traces, and coordinates regression bisects.
