# SPE Ω v2.4.1 — G5 ZERO-COST LOCAL FAULT / CHAOS REPORT

## FINAL VERDICT

G5_ZEROCOST_CHAOS_PASS

## SOURCE CUSTODY

G4-ZC base HEAD:
c3450c4add1329eeaba28eadcaf36c1cdf94d57b

G5 base HEAD:
c3450c4add1329eeaba28eadcaf36c1cdf94d57b

G5 HEAD:
9c129e5f5cbaea55e10333ce7eeba3f1fa843942

Branch:
cursor/g5zc-local-chaos-0d6e

PR:
https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/26

PR #6:
OPEN @ 4e6c694b5d8b9379c5acfbaac416dcfa89b1768e — UNTOUCHED / UNMERGED

Working contract SHA:
68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3

G2 model SHA:
15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562

Model used for this mission:
Composer (Cursor Auto / cloud agent)

## PREVIOUS GATES

G1:
BOUND_AND_PASS

G2:
MODEL_CHECKED_WITHIN_DECLARED_FINITE_SCOPE

G3:
DURABLE_RING1_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE

G4:
ZERO_COST_CORE_ENGINE_VERIFIED_WITHIN_TESTED_SCOPE

## ZERO-COST CONTRACT

API keys required:
0

Paid providers:
0

Cloud calls:
0

Spend:
$0 / ₹0

## FAULT SURFACES

input decode · contract/graph · plan/techniques/strategy · PromptArtifact · validation · .spe build/serialize · write/replace · load · process kill · concurrency · network kill · provider absence (F1–F20)

See `proofs/g5zc/fault_surface_inventory.json`.

## MALFORMED INPUT

Result:
PASS

## UNICODE

Result:
PASS (NFC/NFD digest match)

## OVERSIZED INPUT

Result:
PASS (bounded; no provider fallback)

## CONFLICTS

Result:
PASS (CONFLICTED; no silent launder)

## ARTIFACT INTEGRITY

Truncation:
PASS

Digest mismatch:
PASS (`K6_ARTIFACT_ID_MISMATCH`)

Lineage:
PASS (`K6_INVALID_LINEAGE`)

Future version:
PASS (`K6_UNSUPPORTED_ARTIFACT_VERSION`)

Failed load preserves current state:
PASS

## STORAGE FAULTS

Permission denied:
PASS

Partial write:
PASS

Existing target:
PASS (atomic temp+`os.replace`; G5ZC-F01 fixed)

## PROCESS CRASH

Compile crash:
PASS

Artifact-write crash:
PASS

Kill mechanism:
SIGKILL

Physical power loss:
NOT TESTED

## CONCURRENCY

Same input:
PASS

Different inputs:
PASS

Concurrent export:
PASS

Iterations:
20

Contamination:
NONE

## BOUNDED REPAIR

Exact offline-core contract (confirmed; NOT technique budget):

initial validation attempts:
1

maximum repair attempts:
0

maximum total attempts:
1

third attempt possible:
NO

provider escalation:
NO

recursive repair:
NO

terminal on conflict:
`K3_PROMPT_CONFLICTED_SOURCE` (fail-closed single shot)

TechniqueSelection budget (`STANDARD_MAX_TECHNIQUES=3`):
separate selection-cardinality bound — not a repair-attempt bound

Evidence:
`proofs/g5zc/repair_bound_confirmation.json`
`tests/unit/test_g5zc_repair_bound.py`

Mission template assumed “initial + max one repair (≤2)”; implementation is stricter (zero repair attempts).

## RESOURCE LIMITS

Result:
PASS

## NETWORK KILL

Core compile:
PASS

Result:
PASS

## PROVIDER ABSENCE

Core affected?:
NO

## MUTATIONS

Attempted:
12

Killed:
12

Survived:
0

## PERFORMANCE

Normal:
median 0.175 ms

Stress:
median 0.499 ms

Concurrent:
PASS

## MEMORY

Normal:
23204 KB peak RSS

Stress:
23204 KB peak RSS

## G4-ZC REPLAY

Z1-Z10:
PASS

## REGRESSION

### Prior RED (preserved — not overwritten)

command:
python -m pytest

collected:
986

passed:
871

failed:
115

exit:
1

classification:
115/115 missing wasm32-unknown-unknown (see proofs/g5e/)

### G5-E environmental closure (green)

command:
python -m pytest

collected:
986

passed:
986

failed:
0

skipped:
0

exit:
0

compileall:
PASS (exit 0)

G1:
PASS

G2:
PASS (model hash unchanged)

G3:
PASS

G4:
PASS

G5-E report:
proofs/g5e/G5_E_REPORT.md

## FINDING / REPAIR

G5ZC-F01 (MEDIUM): non-atomic `Path.write_bytes` on overwrite path → temp + `os.replace`. FIXED.

Evidence-closing recheck (no chaos campaign rerun):
1. repair-attempt bound CONFIRMED
2. repository-wide pytest denominator CONFIRMED with wasm env accounting

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

G4X:
OPTIONAL / DEFERRED

Production:
NOT QUALIFIED

Physical power loss:
NOT TESTED

Security red team:
NOT YET

World #1:
NOT PROVEN

Promotion note:
G5-E closed the remaining full-regression blocker (wasm32 target + residual Node WASM host). Repository-wide pytest now exit 0. Chaos evidence reused (not rerun). Tested-scope freeze stands; not all-filesystem / all-OS / power-loss proof.

## EXACT EARNED CLAIM

The zero-cost SPE core preserved the tested semantic, artifact-integrity, bounded-repair, offline, and fail-closed properties under the recorded local input, storage, process-crash, concurrency, and resource-fault scenarios, without mandatory network access, provider credentials, or paid API calls.

## NEXT TASK

Only if G5-ZC PASS:

G6-ZC — REAL-USER / PRODUCT-VALUE QUALIFICATION

DO NOT EXECUTE.

## STOP

STOP AFTER G5-ZC.
NO G6 EXECUTION.
NO G4X PAID PROVIDER REQUIREMENT.
NO PR #6 MERGE.
NO spe_runtime/omega/.
