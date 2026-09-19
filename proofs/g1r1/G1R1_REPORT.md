# SPE Ω v2.4.1 — G1R-1 REPORT

Task: NORMATIVE SPEC BINDING + OWNERSHIP REPAIR

Status: **G1R-1_COMPLETE** — remaining G1 gaps are out of scope.

Binding status remains **BOUND_WITH_GAPS** (not G1_PASS, not G2).

## Scope (done)

1. Bind SPE Ω v2.4.1 working Ring-0 contract hash
2. Eliminate duplicate `failure_laundering_predicate` writer
3. Unify typed errors under one K5 owner

## Explicitly not done

- Ambient authority (A1 `replace_envelope`, A2 X09 any-object bypass) → G1R-2
- 22 missing Ring-0 requirements → G1R-3+
- G2 TLA+/TLC
- `spe_runtime/omega/`
- PR #6

## Spec binding (G1-B01)

The verified 181-file / 69-kernel tree is **UNAVAILABLE** (not in this GitHub
account, not in Gmail, README already recorded this at repo creation).

G1R-1 does **not invent** 181/69. It binds a working Ring-0 contract frozen from
the G1 reverse-mapped architecture:

- path: `specs/spe-omega-v2.4.1/RING0_WORKING_CONTRACT.json`
- version: `SPE Ω v2.4.1`
- custody: `WORKING_CONTRACT_BOUND`
- `verified_181_69_tree`: `UNAVAILABLE`
- sha256: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`

Mechanical test `test_g1r1_spec_bytes_match_binding_hash` fails if those bytes
change without updating `SPE_IMPLEMENTATION_BINDING_v2.json`.

G1-B01 status: **RESOLVED_AS_WORKING_CONTRACT** (not 181/69 provenance).

## Duplicate writers (G1-B02)

Before: 2. After: **0**.

| Fact | Before | After |
|---|---|---|
| `failure_laundering_predicate` | `xcat/invariants.py` AND `categories/_common.py` | `xcat/invariants.py` only. `_common.failures_not_laundered is invariants.failures_not_laundered` |
| `typed_error_code` | `xcat/reasons.py` AND `portability/reasons.py` | `spe_runtime/error_registry.py` only. `ReasonCode is PortabilityReason is ErrorCode` |

Wire strings unchanged (`X10_FAILURE_LAUNDERED`, `P_CAPABILITY_MISSING`, …).

G1-B02 status: **RESOLVED**.

## Tests

| Suite | Collected | Passed | Failed |
|---|---|---|---|
| Baseline (pre-G1 semantics) | 413 | 413 | 0 |
| G1 binding | 14 | 10 | 4 |
| G1R-1 ownership | 5 | 5 | 0 |
| **Final Python** | **432** | **428** | **4** |

The 4 remaining failures are honest unowned Ring-0 tests (proof, privacy,
artifact, prompt, snapshot, qualification, 22 MISSING requirements). Not
baseline regressions.

Rust/WASM: not re-run; no replica source change. Wire strings stable.

## Module inventory after G1R-1

57 Python modules under `spe_runtime/` (was 55; added `error_registry.py` +
`spec_binding.py`).

RETAIN 33 / WRAP 9 / MIGRATE 1 / REPLACE 0 / RETIRE 14

The remaining MIGRATE is `categories/_common.py` (`replace_envelope` ambient
authority) — G1R-2.

## Still blocking G1_PASS / G2

- G1-B03 unowned facts = 7, MISSING Ring-0 = 22
- G1-B04 ambient authority paths = 2
- G1-B05 platform registry honesty

## PR #6

OPEN, tip `4e6c694`, untouched. G1R-1 HEAD still `931128b` + local worktree edits.
No `tests/web` or `apps/web` imported.

## Next

**G1R-2 — authority hardening** (A1 + A2). Do not start G2.
