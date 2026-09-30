# Project memory

## Map

- `spe_runtime/lab/contract.py` — created 2026-09-30 — Daily 3D Lab pipeline contract. Discovery, generate, and verify stay local. Publish stays NOT_AUTHORIZED.
- `spe_runtime/lab/__init__.py` — created 2026-09-30 — public exports for the pipeline contract.
- `schemas/daily_lab_pipeline.schema.json` — created 2026-09-30 — receipt schema. Authorization is fixed to NOT_AUTHORIZED. UNKNOWN cannot count as PASS.
- `tests/unit/test_daily_lab_pipeline.py` — created 2026-09-30 — refusals for network, hosting, deployment, automatic publish, live publish, and unknown verification.
- `apps/web/src/lab/` — existing finite Daily Lab queue of 14 specimens. This pipeline foundation does not change it.
- `tests/unit/daily_lab_r1_oracle.py` — created 2026-09-30 — read-only Daily Lab R1 laws. An empty result means the donor still holds publish.
- `tests/unit/test_daily_lab_r1_qualification.py` — created 2026-09-30 — donor qualification and the DLR1-01 through DLR1-20 mutant kills.
- `tests/fixtures/daily_lab_r1/dlr1_mutants.json` — created 2026-09-30 — the twenty mutant ids and the law each one must trip.
- `proofs/daily_lab_r1_20260930/` — created 2026-09-30 — C4 qualification report, oracle result, and mutant ledger.

## Log

### 2026-09-30 — Daily Lab R1 qualification
- Why: prove the finite pipeline stays at PUBLISH_HELD and kill twenty publish, network, and queue mutants
- Files: `tests/unit/daily_lab_r1_oracle.py` (created), `tests/unit/test_daily_lab_r1_qualification.py` (created), `tests/fixtures/daily_lab_r1/dlr1_mutants.json` (created), `proofs/daily_lab_r1_20260930/` (created)
- Left: none

### 2026-09-30 — Daily 3D Lab pipeline boundary
- Why: discovery → generate → verify → publish needs an explicit contract that cannot publish on its own
- Files: `spe_runtime/lab/contract.py` (created), `spe_runtime/lab/__init__.py` (created), `schemas/daily_lab_pipeline.schema.json` (created), `tests/unit/test_daily_lab_pipeline.py` (created), `SPE-CHANGELOG` (updated)
- Left: a later human gate, outside this foundation, would have to grant publish
