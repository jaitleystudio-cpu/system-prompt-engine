# SPE Ω v2.4.1 — G5 ENVIRONMENTAL REGRESSION CLOSURE REPORT

## PRIOR RED RUN

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

Preserved at:
`proofs/g5e/prior_red_run.json` / `prior_red_run.txt`

## ROOT CAUSE CLASSIFICATION

(of the preserved prior RED 115 — traceback/signature based, not filename alone)

Prior RED signatures:
missing wasm32 target: 115
real assertion failures: 0
other: 0
unknown: 0

Freeze nuance — complete environmental dependency chain (not sole permanent attribution to WASM target alone):

```
missing wasm32-unknown-unknown
        ↓  installed for ₹0
secondary missing /usr/bin/node exposed
        ↓  Node installed for ₹0
120/120 targeted WASM tests PASS
        ↓
986/986 repository-wide tests PASS
```

Classification of the 115: environment/toolchain-prerequisite failures.

## TOOLCHAIN BEFORE

rustc:
rustc 1.83.0 (90b35a623 2024-11-26)

cargo:
cargo 1.83.0 (5ffbef321 2024-10-29)

rustup:
rustup 1.29.0

installed targets:
x86_64-unknown-linux-gnu

wasm32-unknown-unknown:
ABSENT

## TOOLCHAIN ACTION

Action:
1. `rustup target add wasm32-unknown-unknown`
2. `apt-get install -y nodejs` (residual /usr/bin/node for WASM host)

Cost:
$0 / ₹0

SPE source semantic changes:
NONE

## TARGETED WASM RECHECK

(after both env unblocks)

command:
python -m pytest tests/portability/test_wasm_reference_conformance.py tests/portability/test_sprint5_merge_gate_differential.py tests/portability/test_sprint5_merge_gate_oracle.py

collected:
120

passed:
120

failed:
0

exit:
0

## REPOSITORY-WIDE RECHECK

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

## COMPILE / BUILD

compileall:
PASS (exit 0)

Rust/WASM:
PASS (exercised by portability conformance; wasm32 build + node host)

result:
PASS

## REPAIR CONTRACT CONFIRMATION

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

## SOURCE CUSTODY

G5 HEAD:
9c129e5f5cbaea55e10333ce7eeba3f1fa843942

Contract SHA:
68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3

G2 SHA:
15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562

PR #6:
OPEN @ 4e6c694 — UNTOUCHED / UNMERGED

Chaos campaign rerun:
NO (preserved)

## FINAL VERDICT

G5_ENVIRONMENTAL_CLOSURE_PASS

## CLAIM BOUNDARY

Only on PASS:

G5 =
ZERO_COST_LOCAL_FAULT_RESILIENCE_VERIFIED_WITHIN_TESTED_SCOPE

Production:
NOT QUALIFIED

Physical power loss:
NOT TESTED

Security red team:
NOT YET

World #1:
NOT PROVEN

## STOP

NO G6.
NO G4X PAID PROVIDER REQUIREMENT.
NO PR #6 MERGE.
NO spe_runtime/omega/.
