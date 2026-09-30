# Project memory

## Map

- `spe_runtime/webrecon/` — created 2026-09-30. WebRecon foundation: authorized URL boundary, untrusted-document isolation, and the observation models that feed the reconstruction contract. No network fetch and no K3 integration.
- `schemas/webrecon_reconstruction_contract.schema.json` — created 2026-09-30. Closed JSON Schema for `spe.webrecon.reconstruction-contract.v1`.
- `tests/unit/test_webrecon_foundation.py` — created 2026-09-30. Unit checks for refusals, quarantined payloads, and the contract shape.
- `proofs/webrecon_v1_20260930/SCOPE.md` — created 2026-09-30. Honest scope note for this lane. Not a score report.
- `tests/unit/test_webrecon_r1_qualification.py` — created 2026-09-30. R1 oracles for the supplied-capture contract. Failures are preserved donor evidence.
- `qualification/webrecon_r1/` — created 2026-09-30. R1 oracle list and WR1-01..WR1-20 mutation harness. Mutants run on a temporary copy.
- `proofs/webrecon_r1_20260930/` — created 2026-09-30. Pytest, junit, baseline oracles, mutation results, and the HOLD report.

## Log

### 2026-09-30 — WebRecon R1 qualification HOLD
- Why: Qualify supplied capture to Website X-Ray to ReconstructionContract. The donor fails active javascript residue, field text copy, path traversal, obfuscated loopback, and malformed complete X-Ray.
- Files: `tests/unit/test_webrecon_r1_qualification.py` (created), `qualification/webrecon_r1/` (created), `proofs/webrecon_r1_20260930/` (created)
- Left: HOLD. Donor runtime stays unchanged.

### 2026-09-30 — WebRecon capture-to-contract foundation
- Why: Lane I needed an owned path from an authorized capture to a Website X-Ray and reconstruction contract, without semantic authority or K3.
- Files: `spe_runtime/webrecon/` (created), `schemas/webrecon_reconstruction_contract.schema.json` (created), `tests/unit/test_webrecon_foundation.py` (created), `proofs/webrecon_v1_20260930/SCOPE.md` (created)
- Left: none in this lane. Live fetch, browser layout, and K3 handoff stay out of scope.
