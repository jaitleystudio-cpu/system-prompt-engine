# Task 57 contract recovery

Base: `01dd665a1903264da311de06f1a903d77f000e90` on `cursor/spe-xcat-v1-closure-20260929`.

## Recovered definitions

| Name in the repository | Owner | Status for Task 57 |
| --- | --- | --- |
| `QualityRecord` (`spe_runtime/protocols/quality_record.py`) | Protocol inspect record | Kept. It is not a quality delta and must not be renamed to `receipt`. |
| `EvaluatorStatus` | Protocol criterion status: `PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE` | Kept for protocol evaluators. It has no `SATISFIED` or `CONFLICT` and is not the obligation verdict. |
| `RecoveryPlan` (`spe_runtime/recovery/plan.py`) | Journal replay after crash | Kept. It is not bounded prompt reconstruction. |
| `OutcomeState` | Execution outcome machine | Kept. Task 57 receipts stay `NOT_EXECUTED`. |
| `LOCAL_DRY_RUN` | Local execution record mode in `packages/web-runtime` | Kept. It is not aliased to `DRY_RUN`. |
| `PromptEffectPlan` | `spe_runtime/k3/effect.py` | Frozen. Plan B may render from a bound plan and may not bypass it. |
| Protected intent fields | Goal, hard constraints, budget, desired output, facts, provenance, authority | Frozen. Accepted reconstruction requires the same protected intent. |
| Proof classes `DECLARED_POLICY`, `ENFORCEMENT_AVAILABLE`, `ENFORCEMENT_VERIFIED`, `EXECUTION_OBSERVED` | Not present as a frozen enum | Introduced only on the validation receipt. `EXECUTION_OBSERVED` is rejected for this task. |

## Not found

Searches of `spe_runtime/`, `portable/`, `schemas/`, `docs/`, and `proofs/` found no frozen type named Quality Delta, Plan B, or `VALIDATE_ONLY`. Prior proof packs name them as out of scope.

## Task 57 types

Because those names were absent, this task adds:

- obligation status: `SATISFIED`, `UNSATISFIED`, `CONFLICT`, `UNKNOWN`, `NOT_APPLICABLE`
- `spe.quality_delta.v1`
- `spe.reconstruction_plan.v1` with `max_attempts = 1`
- target modes `DRY_RUN`, `VALIDATE_ONLY`, `EXECUTE`
- `spe.validation_receipt.v1`

## Conflicts

- Protocol `PASS` is not obligation `SATISFIED`.
- `LOCAL_DRY_RUN` is not `DRY_RUN`.
- `QualityRecord` is not `QualityDelta`.
- Journal `RecoveryPlan` is not Plan B.

## Unresolved

No historical schema defines a global quality score, human preference, or target-model success. Those are not implemented.
