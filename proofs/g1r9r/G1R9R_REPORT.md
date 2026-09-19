# SPE Ω v2.4.1 — G1R-9 INDEPENDENT K7 RECHECK REPORT

## FINAL VERDICT
G1R9_RECHECK_PASS

## SOURCE CUSTODY
Foundational base: 931128b384c3055ecef876124f787e5b8e67651b
G1R-8R reviewed HEAD: 5100c76d70971d1bf37c84747f66e964ff6086d3
G1R-9 implementation HEAD: 8766bfdc7a8907340b72d81e9c5d1bb82482ce51
G1R-9R review HEAD: c88703a879411198c8dff398eaf7d1657cc9ccd0
Branch: cursor/g1r9r-k7-qualification-recheck-0d6e
PR: #19
PR #6: OPEN @ 4e6c694 — untouched
Working contract SHA: 68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3

## SOURCE SCOPE
Expected: spe_runtime/qualification/*, tests, proofs/g1r9r
Unexpected: none (K7-only hardening)

## K7 CANONICAL OWNERS
QualificationEvidence: spe_runtime/qualification/evidence.py (1)
ClaimQualification: spe_runtime/qualification/evaluate.py (1)
ClaimPolicy: registered registry only (policy.py)
Duplicate writers: 0

## POLICY AUTHORITY
Can arbitrary caller policy weaken qualification?: **NO**
Known claim → canonical policy binding: CLAIM_POLICY_BINDINGS
Policy identity: policy_id@version

## GLOBAL STAGE FLOORS
Enforced via STAGE_FLOORS; validate_policy rejects weakenings.
default_ring0 max_stage: VERIFIED_WITHIN_SCOPE
subsystem_pass_external max_stage: QUALIFIED (requires distinct second review)

## QUALIFIED-STAGE REVIEW
Can one generic EXTERNAL_REVIEW earn QUALIFIED?: **NO**
(consume + unique_source; default_ring0 capped at VERIFIED)

## EVIDENCE REUSE
Same evidence discharge multiple distinct obligations?: **NO** (unless allow_reuse — not default)

## INDEPENDENCE TRUST BOUNDARY
INTERNAL: DECLARED OK for internal obligations
EXTERNAL/INDEPENDENT: require STRUCTURAL_BOUND (digest+ref)
Can caller self-declare INDEPENDENT and earn replication?: **NO**
How accepted: structural custody only — NOT crypto-authenticated

## SAME-SOURCE ATTACK
Same report wrapped twice: unique_source blocks
Copied files / branch / model name: do not create independence

## SCOPE REVIEW
Subject/revision binding: exact
Missing dimensions: UNBOUND ≠ ALL
Scope broadening: blocked

## PRODUCTION REVIEW
Remote CI / staging / preview / QA: **REJECTED**
Explicit production + custody refs required

## USER VALIDATION
Synthetic / developer self-test: **REJECTED**
Requires user_study:|user_validation:|human_user: + custody

## FORMAL VERIFICATION
TLA source only / no TLC: **NOT FORMALLY VERIFIED**

## CLAIM LADDER
No unsupported stage jumping (confirmed)

## CONTRADICTORY EVIDENCE
Matching FAIL blocks; UNKNOWN ≠ PASS; copies cannot outvote FAIL

## CURRENT PROJECT CLAIMS
G0: PASS
G1R-7/G1R-8: PASS_EXTERNAL (scoped)
G1R-9: **PASS_EXTERNAL**
Full Ring-0: IMPLEMENTED_WITHIN_G1_SCOPE / EXTERNAL_K7_RECHECK_COMPLETE
G1: **BOUND_WITH_GAPS**
Production / Formal / Independent replication / World #1: NOT EARNED/PROVEN

## G1R-8 SCOPE PRESERVATION
PORTABLE_SEMANTIC_BINDING_ARTIFACT preserved; SELF_CONTAINED_FULL_REPLAY unqualifiable

## SELF-QUALIFICATION ATTACK
Can G1R-9 local tests become PASS_EXTERNAL via evaluator?: **NO**
(Promotion is review decision, not K7 self-mint)

## DOMAIN SEPARATION
K7 → K0/K1/K2/K3/K4/K6/network/execution: **NO**

## IDENTITY / IMMUTABILITY / WRITERS
Deterministic qe-/qual-; frozen; writers 1/1; duplicates 0

## G1 REVERSE MAP
UNOWNED: 0
MISSING: 0

## G1 MECHANICAL GATES
qualification_owner_unique: PASS
no_unowned_required_ring0: PASS

## MUTATION RESULTS
10/10 focused K7 mutations killed

## TESTS
Full Python: 672 collected / 672 passed / 0 failed / 0 skipped / exit 0
compileall: ok
Delta: +40 from 632 baseline (G1R-9R adversarial + hardened G1R-9)

## REVIEW FINDINGS
G1R9R-F01 CRITICAL POLICY_DOWNGRADE — FIXED (reject ClaimPolicy objects + floors)
G1R9R-F02 CRITICAL SELF_DECLARED_INDEPENDENCE — FIXED (IndependenceBasis)
G1R9R-F03 HIGH EVIDENCE_REUSE — FIXED (consume + unique_source)
G1R9R-F04 HIGH NON_LOCAL_AS_PRODUCTION — FIXED (allowlist + custody)
G1R9R-F05 MEDIUM REVISION_WILDCARD — FIXED (UNBOUND≠ALL)
G1R9R-F06 HIGH SAME_SOURCE_WRAPPER — FIXED (source_key dedupe)

## PROMOTION DECISION
G1R-9: **PASS_EXTERNAL**
Full minimum Ring-0: PRESENT / REVIEWED WITHIN G1 SCOPE
G1: **BOUND_WITH_GAPS** (G1R-V pending)

## NEXT TASK
G1R-V FINAL COMPLETE G1 BINDING REPLAY — DO NOT EXECUTE

## STOP
NO G1R-V / G2 / G3 / G4–G9 / Sprint 7 / PR #6 merge / omega/
