# Memory

## Map

- `schemas/gilden_operations.schema.json` — created 2026-09-30 — operations document schema; external actions stay closed and `live_agency` is false.
- `spe_runtime/gilden/contract.py` — created 2026-09-30 — kinds, NOT_AUTHORIZED register, evidence digest, closed effect flags.
- `spe_runtime/gilden/validate.py` — updated 2026-09-30 — JSON Schema check; a failure names the field and keyword and does not copy the rejected value.
- `spe_runtime/gilden/runner.py` — updated 2026-09-30 — local evaluation; `evaluate` rejects documents above 512 KiB before it writes records.
- `spe_runtime/gilden/__init__.py` — created 2026-09-30 — public contract and runner surface.
- `tools/gilden_ops_runner.py` — created 2026-09-30 — stdin or file in, receipt out; no external effects.
- `data/gilden/controls_register_v1.json` — created 2026-09-30 — frozen copy of the standing NOT_AUTHORIZED register for tests.
- `tests/unit/test_gilden_ops.py` — created 2026-09-30 — proves refusals, UNKNOWN reports, and no network imports.
- `docs/gilden/CONTEXT.md` — created 2026-09-30 — glossary for the Gilden operations context.
- `docs/adr/0001-gilden-operations-stay-local.md` — created 2026-09-30 — why this boundary is a local contract.
- `docs/implementation/gilden-operations-v1.md` — updated 2026-09-30 — operator contract; byte cap applies on `evaluate`, and schema receipts omit rejected values.
- `CONTEXT-MAP.md` — created 2026-09-30 — points at Gilden operations and leaves other SPE contexts alone.
- `SPE-CHANGELOG` — updated 2026-09-30 — records the local operations contract and the R1 credential and byte-budget repair.
- `tests/mutation/test_gilden_gor1.py` — created 2026-09-30 — GOR1-01 through GOR1-20 qualification mutants against the local runner.
- `tests/fixtures/gilden/gor1_aliases.json` — created 2026-09-30 — alias names that must stay NOT_AUTHORIZED.
- `proofs/gilden_ops_r1/GILDEN_OPS_R1_QUALIFICATION.md` — updated 2026-09-30 — C5 repair record. GOR1-01 through GOR1-20 are killed. Result is GILDEN_OPS_R1_REPAIR_PASS.
- `proofs/gilden_ops_r1/mutant_results.json` — updated 2026-09-30 — machine-readable kill table. 20 killed, 0 survived.

## Log

### 2026-09-30 — Gilden ops R1 repair pass
- Why: Schema receipts named rejected values, and `evaluate` accepted a schema-valid document above 512 KiB. Both refusals now hold, so GOR1-12 and GOR1-14 are killed.
- Files: `spe_runtime/gilden/validate.py` (updated), `spe_runtime/gilden/runner.py` (updated), `docs/implementation/gilden-operations-v1.md` (updated), `proofs/gilden_ops_r1/GILDEN_OPS_R1_QUALIFICATION.md` (updated), `proofs/gilden_ops_r1/mutant_results.json` (updated), `SPE-CHANGELOG` (updated), `MEMORY.md` (updated)
- Left: none

### 2026-09-30 — Gilden ops R1 qualification hold
- Why: Qualify the donor operations contract. Credential echoes and the in-memory size cap survive, so the lane holds.
- Files: `tests/mutation/test_gilden_gor1.py` (created), `tests/fixtures/gilden/gor1_aliases.json` (created), `proofs/gilden_ops_r1/GILDEN_OPS_R1_QUALIFICATION.md` (created), `proofs/gilden_ops_r1/mutant_results.json` (created), `MEMORY.md` (updated)
- Left: donor runtime unchanged

### 2026-09-30 — Gilden operations contract and local runner
- Why: Define maintenance, search review, research queue, social draft, growth notes, reporting, and controls without a live agency.
- Files: `schemas/gilden_operations.schema.json` (created), `spe_runtime/gilden/` (created), `tools/gilden_ops_runner.py` (created), `data/gilden/controls_register_v1.json` (created), `tests/unit/test_gilden_ops.py` (created), `docs/gilden/CONTEXT.md` (created), `docs/adr/0001-gilden-operations-stay-local.md` (created), `docs/implementation/gilden-operations-v1.md` (created), `CONTEXT-MAP.md` (created), `SPE-CHANGELOG` (updated), `MEMORY.md` (created)
- Left: none
