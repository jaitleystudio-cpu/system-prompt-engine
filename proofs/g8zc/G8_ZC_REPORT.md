# SPE Ω v2.4.1 — G8 ZERO-COST HERMETIC FULL-SYSTEM REPLAY REPORT

## FINAL VERDICT

ZERO_COST_HERMETIC_CORE_REPLAY_VERIFIED_WITHIN_TESTED_SCOPE

## SOURCE CUSTODY

G5 HEAD:
99173c2f700508c6c958b5d79e8bc17418f9bfd6

G7 HEAD (base):
6849a9dc2633ec60fe1891b944ab652d3bf856f8

G8 HEAD:
(see source_identity.json after tip pin)

Branch:
cursor/g8zc-full-replication-0d6e

PR:
https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/30

PR #6:
OPEN @ 4e6c694 — UNTOUCHED / UNMERGED

Contract SHA:
68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3

G2 SHA:
15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562

Corpus SHA:
64b2fa80b1145776f64f62fc8c1d8ad792974ede4319aa9754202fc35c71a8c5

## ZERO-COST

Provider calls:
0

Required keys:
0

Spend:
₹0

## GOLDEN CORPUS

Tasks:
34

Success:
28

Fail-closed:
6 (4 conflict + 2 invalid)

Replay runner:
tools/g8zc_replay.py

Replay:
34/34 match (compile → persist → reload → second compile)

## MUTATIONS

G8M1–G8M5 (+ G8M1b):
6 killed · 0 survived

Highlights:
- Self-asserted INDEPENDENT_REPLICATION rejected
- Local TEST_RESULT ladder cannot earn INDEPENDENTLY_REPLICATED
- SELF_CONTAINED_FULL_REPLAY remains UNQUALIFIABLE_UNDER_POLICY
- WORLD_1 remains unqualifiable
- Path does not affect .spe identity

## REGRESSION

Repository-wide pytest:
1033 passed · 0 failed · 0 skipped · exit 0

Denominator:
G7 baseline 1023 + 10 G8 tests = 1033

compileall spe_runtime:
exit 0

## CLAIM BOUNDARY

G1–G7:
carried forward (see previous_gate_status.json)

G8:
ZERO_COST_HERMETIC_CORE_REPLAY_VERIFIED_WITHIN_TESTED_SCOPE

NOT EARNED:
INDEPENDENTLY_REPLICATED
SELF_CONTAINED_FULL_REPLAY (K7-qualified)
WORLD_1_PROVEN
PRODUCTION_OBSERVED

## EXACT EARNED CLAIM

Within the frozen 34-task golden corpus, the SPE core reproduced identical prompt digests and .spe artifact identities across in-process and subprocess hermetic replays, including fail-closed conflict/invalid paths, without paid providers or network — and without K7 allowing local evidence to mint independent-replication or World #1 claims.

## FOUNDER DIRECTIVE

Stop gates removed. Continue roadmap.

## NEXT

G9-ZC — RELEASE CUSTODY / WORLD-#1 HONEST FREEZE PACKAGING

(Does not self-award World #1; packages the zero-cost qualified stack for external custody.)

## CONSTRAINTS CARRIED FORWARD

NO PR #6 MERGE.
NO spe_runtime/omega/.
NO paid providers required for zero-cost core path.
NO fabrication of G6 human product-value ratings.
NO self-mint of INDEPENDENTLY_REPLICATED / WORLD_1.
