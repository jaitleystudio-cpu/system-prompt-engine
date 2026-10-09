# Master Plan: SPE Ω — WDIC-VCT (Verified Continuation Transactions)
## Zero-Subscription Automated Task-Report Review & Evidence-Priced Continuation

**Date:** October 10, 2026  
**Status:** Approved Research & Production Architecture (Strict Quarantine)  
**Target Worktree:** `system-prompt-engine`  
**Governing Milestone:** Release Candidate Freeze October 26, 2026  
**Research Quarantine:** `spe_runtime/research/wdic_vct/` & `tests/research/wdic_vct/`  
**Authors:** SPE Core Architecture & Autonomous Task Continuity Team  

---

## 1. Executive Summary & Problem Formulation

In modern agent workflows (SWE-bench, OpenHands, Cursor, Claude Code, Gilden), developers are trapped in an expensive subscription loop:
1. An agent executes a task and dumps a report (*"126 tests passed, session recovery implemented"*).
2. The developer copies the report into ChatGPT / Claude Pro ($20/mo) and asks: *"Did the agent do the right thing? What went wrong? What should I do next?"*.
3. The LLM consumes 5,000 to 20,000 tokens analyzing the report, frequently hallucinates progress, and suggests ungrounded next steps.
4. Recent empirical research (**LongHorizon-Harness, August 2026**) proves that simply adding an AI reviewer inflates token costs by **2.3× to 3.6×**!

**WDIC-VCT (Witness-Directed Intelligence Compilation — Verified Continuation Transactions)** eliminates this subscription dependency:
* A task report is treated as an **untrusted proposal**, not ground truth.
* SPE evaluates reports locally through a **4-tier cost hierarchy** (T0 Deterministic $\to$ T1 Reusable $\to$ T2 Local SLM $\to$ T3 Cloud).
* The next task is compiled directly from the **Proof Deficit** ($O_{\text{unfulfilled}}$), completely eliminating expensive conversational prompting.

---

## 2. Multi-Agent Brainstorming Decision Log

### Phase 1: Understanding Lock
* **Core Objective**: Provide an automated, local-first replacement for ChatGPT report reviews that preserves mission intent, verifies receipts claim-by-claim, identifies remaining work, and emits the next task contract at $0 inference cost.
* **Non-Negotiable**: No duplicate task schedulers or replacing Gilden. SPE remains the *Epistemic Adjudicator and Next-Task Compiler*; Gilden / coding tools remain the *Executors*.

### Phase 2: Reviewer Critiques & Hard Invariants
1. **Skeptic / Challenger**:
   * *Objection*: Reviewer agents inflate token consumption by 230%–360% (LongHorizon-Harness finding).
   * *Accepted Resolution*: Enforce **Tier 0 Deterministic First**: File existence, exit codes, commit SHAs, and requirement coverage are validated by $0 AST/regex parsers before any language model is invoked. $\ge 80\%$ of tasks exit at Tier 0 ($0 spend).
   * *Objection*: Agents report false success by omitting negative tests ("Lucky Passes", `arXiv:2605.12925`).
   * *Accepted Resolution*: Anti-Omission Verification. Any requirement $r \in R$ lacking an explicit test execution receipt in the report trace remains `UNVERIFIED`.
2. **Constraint Guardian**:
   * *Objection*: Cost and savings must be strictly denominated in integer `NanoUSD` ($10^9\text{ nanos} = \$1.00$).
   * *Accepted Resolution*: Exact integer tracking in all continuation receipts.
   * *Objection*: Privacy & air-gap preservation.
   * *Accepted Resolution*: Zero network calls in T0, T1, and T2.
3. **User Advocate**:
   * *Objection*: Developers want a single copy-paste prompt or 1-click CLI command, not an academic lecture on proof theory.
   * *Accepted Resolution*: 4-part clean output: (1) Verification Verdict, (2) Root Cause Deficit, (3) Next Executable Task Contract, (4) Exact Dollar Savings.

### Phase 3: Disposition
* **Final Disposition**: **APPROVED** for implementation in research quarantine.

---

## 3. Four-Tier Execution Architecture

```
TASK REPORT INGESTED (from Gilden, Claude Code, Cursor, or Developer)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 0: DETERMINISTIC LOCAL ENGINE ($0, 0 TOKENS, <10ms)        │
│ • Commit SHA & file path verification                           │
│ • Test exit code & receipt digest validation                    │
│ • RequirementGraph coverage cross-check                         │
│ • Anti-omission check (detects unverified obligations)          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         All Obligations Verified       Evidence Deficit Detected
                    │                         │
                    ▼                         ▼
            RELEASE_QUALIFIED   ┌─────────────────────────────────┐
                                │ TIER 1: REUSABLE PROOF CACHE    │
                                │ • Reuses valid prior proofs     │
                                │ • Invalidation closure via DAG │
                                └────────────────┬────────────────┘
                                                 │
                                                 ▼
                                ┌─────────────────────────────────┐
                                │ TIER 2: LOCAL SLM (Ollama/Metal)│
                                │ • Semantic defect classification│
                                │ • $0 tokens, zero cloud egress  │
                                └────────────────┬────────────────┘
                                                 │ (Only if complex)
                                                 ▼
                                ┌─────────────────────────────────┐
                                │ TIER 3: OPTIONAL CLOUD GATEWAY  │
                                │ • Explicit user approval only   │
                                │ • 2PC NanoUSD escrow protected  │
                                └────────────────┬────────────────┘
                                                 │
                                                 ▼
                                    COMPILED NEXT TASK CONTRACT
                                    (Baseline, Objective, Scope,
                                     Execution, Acceptance, Stop)
```

---

## 4. Formal Contract Specification: Next Task Contract

Every continuation task emitted by WDIC-VCT strictly conforms to the 6-clause schema:
1. **BASELINE**: Exact commit SHA, file tree digest, and verified assumption snapshot.
2. **OBJECTIVE**: The single unfulfilled proof obligation driving this step.
3. **SCOPE**: Whitelist of allowed files/modules; blacklist of protected areas.
4. **EXECUTION**: Step-by-step minimal intervention plan.
5. **ACCEPTANCE**: Deterministic falsifiable criterion (test command, schema match, or witness receipt).
6. **STOP**: Hard boundaries preventing runaway modifications or premature release declarations.

---

## 5. Implementation Roadmap (`spe_runtime/research/wdic_vct/`)

1. `types.py`:
   - `TaskReport`: Raw agent output, declared claims, test stats, modified files.
   - `ClaimVerificationResult`: Kleene-4 status (`PASS`, `FAIL`, `UNVERIFIED`, `CONTRADICTED`).
   - `ProofDeficit`: Set of open obligations requiring evidence.
   - `NextTaskContract`: 6-clause executable specification.
2. `continuation_engine.py`:
   - Ingestion and regex/AST parsing of task reports.
   - Deterministic Tier 0 verification engine.
   - Invalidation closure and proof reuse engine.
   - Next-task contract compiler.
3. `test_continuation_engine.py`:
   - Report ingestion & claim-by-claim verification.
   - Detection of omitted requirements (preventing false passes).
   - Derivation of exact next task from missing evidence.
   - Zero-token execution verification ($0 cloud spend).
