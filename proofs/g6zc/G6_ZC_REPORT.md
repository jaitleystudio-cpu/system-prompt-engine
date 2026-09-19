# SPE Ω v2.4.1 — G6 ZERO-COST PRODUCT-VALUE REPORT

## FINAL VERDICT

G6_HARNESS_IMPLEMENTATION_PASS / PRODUCT_VALUE_REVIEW_PENDING

## SOURCE CUSTODY

G5 HEAD:
99173c2f700508c6c958b5d79e8bc17418f9bfd6

G6 base:
99173c2f700508c6c958b5d79e8bc17418f9bfd6

G6 HEAD:
(see tip after docs pin)

Branch:
cursor/g6zc-product-value-0d6e

PR:
(see PR after open)

PR #6:
OPEN @ 4e6c694 — UNTOUCHED / UNMERGED

Contract SHA:
68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3

G2 SHA:
15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562

## ZERO-COST

Provider calls:
0

Required keys:
0

Spend:
₹0

## BENCHMARK

Total:
120

Dev:
96

Holdout:
24

Categories:
C01–C10 (12 each)

Languages:
en, te, hi, ta, es, fr, en+te

Corpus SHA:
0e80007e9efdd06f6aea4f14e98504876772020cf7757ab58112d7dce2cbea34

Rubric SHA:
6456af82732fd6169a7eb1336deeaa2c48b2383d25b586093fe802e4928e3c6b

Thresholds SHA (frozen before ratings):
8e7074a6e5f25a3961b83be0ad2a94357b7948170a353f7bf403b2b81ed5eff4

## AUTOMATED SEMANTIC RESULTS

Intent fidelity:
N/A as human V1 — machine lane uses compile success + drift heuristics

MUST preservation:
SPE substring recall of declared MUST atoms recorded in `constraint_preservation.json` (non-conflict tasks)

MUST_NOT preservation:
Recorded in `constraint_preservation.json`

UNKNOWN preservation:
Heuristic no-invent flags — see `ambiguity_results.json` (rate on tasks with expected_unknowns)

Conflict preservation:
100% fail-closed on conflict-tagged tasks (7/7 typed `K3_PROMPT_CONFLICTED_SOURCE`)

Compile outcomes:
113 success / 7 typed conflict fails / 0 crashes

Determinism:
PASS (digest rematch on successful compiles)

## COMPLEXITY

Raw median length:
(see `prompt_bloat.json` per-task)

SPE median length:
(see `prompt_bloat.json`)

Expansion:
median expansion ≈ 13.1× on successful compiles (includes structured SPE sections)

Trivial-task behavior:
anti-gaming / trivial tagged tasks compiled; technique budget remains `STANDARD_MAX_TECHNIQUES=3`

## TECHNIQUE SELECTION

Mean techniques:
budget-capped selection path; max constant = 3

Max:
3 (`STANDARD_MAX_TECHNIQUES`)

Unnecessary-selection findings:
none filed as G6-Fxx from automated lane; human V9 pending

## HUMAN EVALUATION

Evaluators:
0

Paired evaluations:
0

SPE preferred:
PENDING

RAW preferred:
PENDING

Ties:
PENDING

Harness ready:
`evaluations/g6zc/blind_evaluator.html` + `blind_pairs.json` (no SPE/RAW labels)

Limitation:
SINGLE_EVALUATOR_LIMITATION / PRODUCT_VALUE_REVIEW_PENDING — ratings not fabricated

## CATEGORY RESULTS

C01–C10:
automated compile counts in `category_results.json`; blinded preference pending human evidence

## HOLDOUT

Result:
isolated 24 tasks; not used for repair (no G6-Fxx repairs applied)

## LOCAL MODEL

Available:
NO

Required:
NO

Outcome evidence:
NOT_AVAILABLE

## PRODUCT FINDINGS

G6-Fxx:
none

## MUTATIONS

Attempted:
12 (G6M1–G6M12)

Killed:
12

Survived:
0

## REGRESSION

pytest:
998 passed / 0 failed / exit 0 (986 baseline + 12 G6 mutation tests)

compileall:
PASS

WASM:
PASS via full repository pytest

G1-G5:
preserved (contract/G2 hashes unchanged; suite green)

## CLAIM BOUNDARY

G1:
BOUND_AND_PASS

G2:
MODEL_CHECKED_WITHIN_DECLARED_FINITE_SCOPE

G3:
DURABLE_RING1_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE

G4:
ZERO_COST_CORE_ENGINE_VERIFIED_WITHIN_TESTED_SCOPE

G5:
ZERO_COST_LOCAL_FAULT_RESILIENCE_VERIFIED_WITHIN_TESTED_SCOPE

G6:
G6_HARNESS_IMPLEMENTATION_PASS / PRODUCT_VALUE_REVIEW_PENDING

(NOT earned: REAL_USER_PRODUCT_VALUE_VERIFIED_WITHIN_TESTED_SCOPE — requires blinded human ratings)

G4X:
OPTIONAL / DEFERRED

Production:
NOT YET

Security red team:
NOT YET

World #1:
NOT PROVEN

## NEXT

If G6 human evidence later earns PASS:

G7-ZC — SECURITY / PRIVACY RED TEAM

DO NOT EXECUTE G7 IN THIS MISSION.

## STOP

STOP AFTER G6.
NO G7.
NO PR #6 MERGE.
NO spe_runtime/omega/.
NO paid providers required.
