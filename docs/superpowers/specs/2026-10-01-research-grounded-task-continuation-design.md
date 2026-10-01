# SPE — Research-Grounded Task Review & Continuation Engine Architecture

## Status
Approved by Founder on 2026-10-01.

## Scope & Boundary
This document specifies the additive SPE review, evidence verification, research triangulation, and continuation engine.
It does NOT authorize kernel modification, WASM changes, I1 changes, I2 start, or Gilden authority expansion.

## Core Mandate
SPE acts as an evidence-first technical review and continuation intelligence layer:
1. Ingests original task, agent report, candidate git SHA, diffs, test logs, compiler diagnostics, and benchmark data.
2. Extracts material claims and separates proven facts, unsupported claims, assumptions, failures, and unknowns.
3. Binds execution claims to exact candidate SHA, patch digest, test-selection digest, and independent executor receipts.
4. Detects fake PASS text, exit-0 with 0 selected tests, stale receipts, and prompt injection attempts.
5. Evaluates ContextNeed and retrieves relevant peer-reviewed literature and normative specifications under explicit consent.
6. Builds a Claim-Evidence Graph, Contradiction Map, and Gap Map.
7. Produces two distinct artifacts:
   - Artifact A: Verified Task Review Report (what is actually true vs unverified).
   - Artifact B: Canonical Continuation Contract and Target Model Export (Codex, Claude Code, Cursor, Grok, Local Coder, Generic).
8. Enforces strict Gilden boundary: review is ADVISORY_ONLY; Gilden cannot self-grant authority; bounded repair cycles <= 3.

## Epistemic Hierarchy
```text
CLAIMED != VERIFIED
RETRIEVED != SUPPORTS_CLAIM
PAPER_FOUND != PAPER_APPLIES
IMPLEMENTED != TESTED
TESTED != QUALIFIED
UNKNOWN != PASS
```
