# SPE Ω Master Engineering Plan: CWC, Proactive Research Blueprints & Autonomous Skill Auto-Installer
**Date**: October 10, 2026  
**Status**: APPROVED & IN EXECUTION  
**Branch**: `candidate/2026-10-26`  
**Target Milestone**: SPE Ω Sovereign Evidence-Verified Continuation Engine

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Problem: The Paid Chat Subscription Trap & Cognitive Overload
In conventional agentic development:
1. Developers spend **$480+/year on ChatGPT Plus and Claude Pro** just to paste 40,000-token terminal logs into web chats and ask: *"Review this task output and tell me what prompt to run next."*
2. Summarizing execution logs across chat loops loses up to **41% of epistemic constraints** (*Facts Without Rules 2026*), falsely promoting `UNKNOWN` to `PASS`.
3. Models tasked with multifaceted requirements (security, UI design, database optimization, testing) suffer severe attention head dispersion and hallucination.
4. Naive test passes frequently mask untested defects ("Lucky Passes", *AgentLens 2026*).

### 1.2 The Solution: Three Interlocking Capabilities
SPE Ω introduces three unified mechanisms inside `spe_runtime/research/wdic_vct/`:
1. **Counterfactual Witness Continuation (CWC)**:
   - Evaluates whether an incorrect implementation could produce the exact same test report.
   - Selects the lowest-cost deterministic distinguishing witness ($W_{\text{dist}}$) at integer `NanoUSD` cost.
   - Enforces an incremental proof reuse matrix ($I_{\text{dep}}$) across 300+ tasks without redundant re-testing.
2. **Proactive Open-Science Research Blueprints (S-Capsules)**:
   - Queries free, zero-auth preprint APIs (arXiv, PubMed, OpenAlex) to ground task implementations in empirical SOTA literature rather than LLM guesswork.
   - Distills 15-page papers into compact ~200-token `EvidenceCapsule` blueprints.
3. **Autonomous Skill & Plugin Auto-Installer**:
   - Detects required specialized domain capabilities from the task AST.
   - Matches against the verified installed environment catalog (`@skill:frontend-design`, `@skill:tdd-workflow`, `@skill:security-auditor`, etc.).
   - If missing, validates safety against malicious code injection patterns and dynamically installs/injects the skill, cutting model cognitive load by >50%.

---

## 2. Mathematical & Algorithmic Invariants

### 2.1 The Distinguishing Witness Invariant
Let $C$ be a task completion claim, $S_{\text{obs}}$ be the observed test pass, and $\Omega_{\text{bad}}$ be the set of violation states that could produce $S_{\text{obs}}$.
$$W_{\text{dist}} = \arg\min_{p \in \mathcal{P}_{\text{admissible}}} \operatorname{Cost}(p) \quad \text{s.t.} \quad p(\text{Compliant}) \neq p(\Omega_{\text{bad}})$$
If no such probe exists or passes, disposition remains `HOLD` (Kleene-4: `UNKNOWN ≠ PASS`).

### 2.2 Proof Reuse & Invalidation Closure
Let $\mathcal{O}_{\text{verified}}$ be previously verified obligations, and $\Delta F$ be the set of files modified in Task $k$.
$$\mathcal{O}_{\text{invalidated}} = \{ o \in \mathcal{O}_{\text{verified}} \mid \operatorname{Dependencies}(o) \cap \Delta F \neq \emptyset \}$$
$$\mathcal{O}_{\text{reusable}} = \mathcal{O}_{\text{verified}} \setminus \mathcal{O}_{\text{invalidated}}$$
Only $\mathcal{O}_{\text{invalidated}} \cup \mathcal{O}_{\text{unmet}}$ require evaluation.

### 2.3 Deterministic Continuation Compilation ($0 Inference)
The Next Task Contract $T_{k+1}$ is derived from:
$$\mathcal{O}_{\text{deficit}} = \mathcal{O}_{\text{mission}} \setminus \mathcal{O}_{\text{reusable}}$$
with auto-bound skills $\mathbb{S}_{\text{bound}}$ and S-Capsule literature blueprint $\mathcal{B}_{\text{science}}$.

---

## 3. Implementation Architecture

### 3.1 New & Extended Modules in `spe_runtime/research/wdic_vct/`
1. `evidence_capsules.py`:
   - `EvidenceCapsule` dataclass.
   - `EvidenceCapsuleRetriever`: Curated local empirical bank + zero-auth public REST adapters (`build_arxiv_url`, `build_openalex_url`, `build_pubmed_search_url`).
2. `skill_autoinstaller.py`:
   - `SkillRequirement`, `SkillInstallationProposal`.
   - `SkillAutoInstaller`: Domain AST matcher, safety scanner (rejects dangerous network exfiltration/bash execution), dynamic injector.
3. `cwc_witness.py`:
   - `CounterfactualWitness`, `DistinguishingWitnessEngine`.
   - Dependency graph tracker & proof invalidation matrix.
   - Dual-product emitter: Product A (Audited Task Receipt) and Product B (Continuation Task Contract).
4. `continuation_engine.py`:
   - Integrated with CWC, S-Capsules, and Skill Auto-Installer.

---

## 4. Test Strategy & Verification Criteria

1. **Unit & Adversarial Tests**:
   - `tests/research/wdic_vct/test_cwc_witness.py`: Tests distinguishing probe generation, lucky-pass rejection, and dependency invalidation.
   - `tests/research/wdic_vct/test_evidence_capsules.py`: Tests zero-auth paper fetching, S-Capsule extraction, and context-size safety.
   - `tests/research/wdic_vct/test_skill_autoinstaller.py`: Tests capability gap detection, malicious skill rejection, and auto-injection.
2. **Regression Verification**:
   - Full repository test battery: Ensure 1,540+ tests pass with zero regressions.
