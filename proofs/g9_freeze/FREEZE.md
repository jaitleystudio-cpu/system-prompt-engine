# SPE Ω v2.4.1 — G9 FREEZE + G6-H HANDOFF

**Pack:** G9-FREEZE-G6H-HANDOFF  
**Freeze HEAD:** `480ee2bdc95fa7cf768aa94737660e43f6072af3`  
**Proposed tag:** `spe-v2.4.1-g9-frozen-g6h-pending`  
**Verify:** `python tools/verify_g9_freeze.py`

---

## Canonical freeze table (founder)

| Gate | Earned scoped status | Evidence |
|------|----------------------|----------|
| G1–G5 | Previously frozen | preserved |
| G6 | HUMAN VALUE EVIDENCE PENDING | no fabricated ratings |
| G7 | SECURITY_PRIVACY_RED_TEAM_VERIFIED_WITHIN_TESTED_SCOPE | 1023 tests |
| G8 | ZERO_COST_HERMETIC_CORE_REPLAY_VERIFIED_WITHIN_TESTED_SCOPE | 1033 tests |
| G9 | ZERO_COST_STACK_CUSTODY_PACKAGED_WITHIN_TESTED_SCOPE | 1041 tests |
| Independent replication | NOT_PROVEN | requires real second party |
| World #1 | NOT_PROVEN | requires external comparative evidence |

## Enforced corrections

- **G9 PASS ↛ World #1**
- **1041/1041 tests ↛ World #1** (internal conformance ≠ market superiority)
- **Hermetic replay by same agent/team ≠ independent replication**
- **G7–G9 do not satisfy G6** (different claims)

## What the coding agent CAN / CANNOT

| CAN | CANNOT mint |
|-----|-------------|
| Package evidence | REAL HUMAN PREFERENCE |
| Verify hashes | INDEPENDENTLY_REPLICATED |
| Execute deterministic tests | WORLD #1 |
| Red-team itself under frozen tests | |

That refusal is a feature of the proof architecture, not unfinished engineering.

## STOP

- NO more self-certifying “make SPE better” Cursor engineering missions until G6-H returns.
- NO fabrication of blinded human ratings.
- NO PR #6 merge.
- NO `spe_runtime/omega/`.

## NEXT (external)

**G6-H — blinded human evaluation** using already-frozen G6 corpus/rubric/pairs.

See `proofs/g9_freeze/G6H_PROTOCOL.md`.
