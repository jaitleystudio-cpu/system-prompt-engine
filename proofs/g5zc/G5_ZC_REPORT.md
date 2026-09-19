# SPE Ω v2.4.1 — G5 ZERO-COST LOCAL FAULT / CHAOS REPORT

## FINAL VERDICT

G5_ZEROCOST_CHAOS_PASS

## SOURCE CUSTODY

G4-ZC base HEAD:
c3450c4add1329eeaba28eadcaf36c1cdf94d57b

G5 base HEAD:
c3450c4add1329eeaba28eadcaf36c1cdf94d57b

G5 HEAD:
7076f367c8fa6c7b623c22779e1bc2b298575f3d

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

input decode · ProtectedIntentContract · RequirementGraph · CognitivePlan · TechniqueSelection · PromptStrategy · PromptArtifact · deterministic validation · .spe build/serialization · file write/replace · load · process crash · concurrency · network kill · provider absence

See `proofs/g5zc/fault_surface_inventory.json` (F1–F20).

## MALFORMED INPUT

Result:
PASS — empty/whitespace typed reject; NUL/CRLF/RTL/emoji/hostile sentinels compile or reject without crash or authority mint

## UNICODE

Result:
PASS — NFC/NFD goal forms share `prompt_content_digest` where canonicalize applies

## OVERSIZED INPUT

Result:
PASS — ~100k-char safe fixture compiles; no provider fallback; no unbounded repair

## CONFLICTS

Result:
PASS — MUST vs MUST_NOT → CONFLICTED; `build_prompt_artifact` raises `K3_PROMPT_CONFLICTED_SOURCE`; no silent side deletion

## ARTIFACT INTEGRITY

Truncation:
PASS — first/middle/last-byte truncations rejected

Digest mismatch:
PASS — `K6_ARTIFACT_ID_MISMATCH`

Lineage:
PASS — self-parent → `K6_INVALID_LINEAGE`

Future version:
PASS — `K6_UNSUPPORTED_ARTIFACT_VERSION`

Failed load preserves current state:
PASS

## STORAGE FAULTS

Permission denied:
PASS — typed write failure

Partial write:
PASS — incomplete bytes never accepted as completed `.spe`

Existing target:
PASS — default overwrite refused; failed overwrite leaves prior bytes intact (temp+`os.replace`)

## PROCESS CRASH

Compile crash:
PASS — SIGKILL then fresh-process recompile deterministic

Artifact-write crash:
PASS — half-written file rejected on load

Kill mechanism:
SIGKILL (process-kill evidence only)

Physical power loss:
NOT TESTED

## CONCURRENCY

Same input:
PASS — identical digests/rendered prompts

Different inputs:
PASS — distinct digests; no token cross-leak

Concurrent export:
PASS — distinct paths; no cross-overwrite

Iterations:
20 Barrier-synchronized pairs (same-input)

Contamination:
NONE

## BOUNDED REPAIR

Maximum attempts:
technique budget `STANDARD_MAX_TECHNIQUES=3`; conflicts fail closed (no silent repair)

Unbounded loop:
NO

## RESOURCE LIMITS

Result:
PASS — technique budget truncation; oversized input remains bounded in tested fixtures

## NETWORK KILL

Core compile:
PASS under socket.connect kill

Result:
PASS — no mandatory network attempt from core path

## PROVIDER ABSENCE

Core affected?:
NO

Optional live gate:
`G4_LIVE_BLOCKED_NO_CREDENTIAL` — project/artifact intact

## MUTATIONS

Attempted:
12 (G5M1–G5M12)

Killed:
12

Survived:
0

## PERFORMANCE

Normal:
median 0.175 ms (n=21)

Stress (large input):
median 0.499 ms (n=11)

Concurrent:
Barrier multiprocess compile pairs — functional PASS (see concurrency_matrix.json)

Artifact save/load:
median 1.094 ms (n=11)

## MEMORY

Normal:
peak RSS 23204 KB (ru_maxrss)

Stress:
peak RSS 23204 KB (same process peak; descriptive only)

## G4-ZC REPLAY

Z1-Z10:
PASS (network kill + credentials absent)

## REGRESSION

pytest collected:
653 (`tests/unit`)

passed:
653

failed:
0

skipped:
0

Full-repo `python -m pytest`:
868 passed / 115 failed — all failures are portability/wasm (`wasm32-unknown-unknown` target missing); same exclusion discipline as G4-ZC

compileall:
PASS (exit 0)

G1:
PASS (contract hash match; unit suite)

G2:
PASS (model hash unchanged)

G3:
PASS (G3R/Ring-1 unit subset green)

G4:
PASS (G4-ZC unit + Z1–Z10 replay)

## FINDING / REPAIR

G5ZC-F01 (MEDIUM): non-atomic `Path.write_bytes` on overwrite path could destroy a complete `.spe` under injected write failure.
Minimal repair: temp sibling + `os.replace`; OSError → `SpeTypedError`; best-effort tmp cleanup.
First-run adversarial suite against untouched G4-ZC source: GREEN (35 passed) — preserved in `initial_adversarial_run.json`.

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
G5_IMPLEMENTATION_PASS + FAULT/CHAOS EVIDENCE PRESENT. This mission is the recorded qualification replay within tested scope — not all-filesystem / all-OS / power-loss proof.

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
