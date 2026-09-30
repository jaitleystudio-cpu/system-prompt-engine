# Memory

## Map

- `schemas/gilden_operations.schema.json` — created 2026-09-30 — operations document schema; external actions stay closed and `live_agency` is false.
- `spe_runtime/gilden/contract.py` — created 2026-09-30 — kinds, NOT_AUTHORIZED register, evidence digest, closed effect flags.
- `spe_runtime/gilden/validate.py` — created 2026-09-30 — JSON Schema check for one operations document.
- `spe_runtime/gilden/runner.py` — created 2026-09-30 — local evaluation; reports without accepted evidence stay UNKNOWN.
- `spe_runtime/gilden/__init__.py` — created 2026-09-30 — public contract and runner surface.
- `tools/gilden_ops_runner.py` — created 2026-09-30 — stdin or file in, receipt out; no external effects.
- `data/gilden/controls_register_v1.json` — created 2026-09-30 — frozen copy of the standing NOT_AUTHORIZED register for tests.
- `tests/unit/test_gilden_ops.py` — created 2026-09-30 — proves refusals, UNKNOWN reports, and no network imports.
- `docs/gilden/CONTEXT.md` — created 2026-09-30 — glossary for the Gilden operations context.
- `docs/adr/0001-gilden-operations-stay-local.md` — created 2026-09-30 — why this boundary is a local contract.
- `docs/implementation/gilden-operations-v1.md` — created 2026-09-30 — operator contract for kinds, evidence, and the local runner.
- `CONTEXT-MAP.md` — created 2026-09-30 — points at Gilden operations and leaves other SPE contexts alone.
- `SPE-CHANGELOG` — updated 2026-09-30 — records the local operations contract.
- `tests/mutation/test_gilden_gor1.py` — created 2026-09-30 — GOR1-01 through GOR1-20 qualification mutants against the local runner.
- `tests/fixtures/gilden/gor1_aliases.json` — created 2026-09-30 — alias names that must stay NOT_AUTHORIZED.
- `proofs/gilden_ops_r1/GILDEN_OPS_R1_QUALIFICATION.md` — created 2026-09-30 — C5 qualification record. Two mutants survive, so the result is HOLD.
- `proofs/gilden_ops_r1/mutant_results.json` — created 2026-09-30 — machine-readable kill table for GOR1-01 through GOR1-20.

## Log

### 2026-09-30 — Gilden ops R1 qualification hold
- Why: Qualify the donor operations contract. Credential echoes and the in-memory size cap survive, so the lane holds.
- Files: `tests/mutation/test_gilden_gor1.py` (created), `tests/fixtures/gilden/gor1_aliases.json` (created), `proofs/gilden_ops_r1/GILDEN_OPS_R1_QUALIFICATION.md` (created), `proofs/gilden_ops_r1/mutant_results.json` (created), `MEMORY.md` (updated)
- Left: donor runtime unchanged

### 2026-09-30 — Gilden operations contract and local runner
- Why: Define maintenance, search review, research queue, social draft, growth notes, reporting, and controls without a live agency.
- Files: `schemas/gilden_operations.schema.json` (created), `spe_runtime/gilden/` (created), `tools/gilden_ops_runner.py` (created), `data/gilden/controls_register_v1.json` (created), `tests/unit/test_gilden_ops.py` (created), `docs/gilden/CONTEXT.md` (created), `docs/adr/0001-gilden-operations-stay-local.md` (created), `docs/implementation/gilden-operations-v1.md` (created), `CONTEXT-MAP.md` (created), `SPE-CHANGELOG` (updated), `MEMORY.md` (created)
- Left: none
