# Project memory

## Map

- `spe_runtime/lab/contract.py` — created 2026-09-30 — Daily 3D Lab pipeline contract. Discovery, generate, and verify stay local. Publish stays NOT_AUTHORIZED.
- `spe_runtime/lab/__init__.py` — created 2026-09-30 — public exports for the pipeline contract.
- `schemas/daily_lab_pipeline.schema.json` — created 2026-09-30 — receipt schema. Authorization is fixed to NOT_AUTHORIZED. UNKNOWN cannot count as PASS.
- `tests/unit/test_daily_lab_pipeline.py` — created 2026-09-30 — refusals for network, hosting, deployment, automatic publish, live publish, and unknown verification.
- `apps/web/src/lab/` — existing finite Daily Lab queue of 14 specimens. This pipeline foundation does not change it.

## Log

### 2026-09-30 — Daily 3D Lab pipeline boundary
- Why: discovery → generate → verify → publish needs an explicit contract that cannot publish on its own
- Files: `spe_runtime/lab/contract.py` (created), `spe_runtime/lab/__init__.py` (created), `schemas/daily_lab_pipeline.schema.json` (created), `tests/unit/test_daily_lab_pipeline.py` (created), `SPE-CHANGELOG` (updated)
- Left: a later human gate, outside this foundation, would have to grant publish
