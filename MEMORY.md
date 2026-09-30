# Project memory

## Map

- `spe_runtime/webrecon/` — updated 2026-09-30. WebRecon capture firewall: authorized URL boundary, untrusted-document isolation, and the observation models that feed the reconstruction contract. No network fetch and no K3 integration.
- `schemas/webrecon_reconstruction_contract.schema.json` — created 2026-09-30. Closed JSON Schema for `spe.webrecon.reconstruction-contract.v1`.
- `tests/unit/test_webrecon_foundation.py` — created 2026-09-30. Unit checks for refusals, quarantined payloads, and the contract shape.
- `proofs/webrecon_v1_20260930/SCOPE.md` — created 2026-09-30. Honest scope note for this lane. Not a score report.
- `tests/unit/test_webrecon_r1_qualification.py` — created 2026-09-30. R1 oracles for the supplied-capture contract. Assertions stay as written.
- `qualification/webrecon_r1/` — updated 2026-09-30. R1 oracle list and WR1-01..WR1-20 mutation harness. The harness scores a descendant of the donor. Mutants run on a temporary copy.
- `spe_runtime/webrecon/acquisition.py` — updated 2026-09-30. Collapses encoded dot-segments and refuses inet_aton loopback forms.
- `spe_runtime/webrecon/assets.py` — updated 2026-09-30. Resolved references use the same path collapse.
- `spe_runtime/webrecon/isolation.py` — updated 2026-09-30. Quarantines javascript and vbscript CSS `url()` and `@import` as digests.
- `spe_runtime/webrecon/html_css.py` — updated 2026-09-30. Withholds textarea and option text, neutralizes javascript meta refresh, and rejects malformed markup.
- `spe_runtime/webrecon/contract.py` — updated 2026-09-30. Malformed captures return `WR_MALFORMED_DOCUMENT`.
- `spe_runtime/webrecon/reasons.py` — updated 2026-09-30. Adds `WR_MALFORMED_DOCUMENT`.
- `proofs/webrecon_r1_20260930/` — updated 2026-09-30. Pytest, junit, baseline oracles, mutation results, and the R1 repair report.

## Log

### 2026-09-30 — WebRecon R1 capture firewall repair
- Why: The C1 oracles failed because CSS javascript URLs, meta refresh, field text, encoded traversal, obscured loopback, and malformed markup could still enter a complete contract.
- Files: `spe_runtime/webrecon/` (updated), `qualification/webrecon_r1/run_wr1_mutations.py` (updated), `proofs/webrecon_r1_20260930/` (updated)
- Left: none in this lane. No live fetch, no K3, no merge.

### 2026-09-30 — WebRecon R1 qualification HOLD
- Why: Qualify supplied capture to Website X-Ray to ReconstructionContract. The donor fails active javascript residue, field text copy, path traversal, obfuscated loopback, and malformed complete X-Ray.
- Files: `tests/unit/test_webrecon_r1_qualification.py` (created), `qualification/webrecon_r1/` (created), `proofs/webrecon_r1_20260930/` (created)
- Left: HOLD. Donor runtime stays unchanged.

### 2026-09-30 — WebRecon capture-to-contract foundation
- Why: Lane I needed an owned path from an authorized capture to a Website X-Ray and reconstruction contract, without semantic authority or K3.
- Files: `spe_runtime/webrecon/` (created), `schemas/webrecon_reconstruction_contract.schema.json` (created), `tests/unit/test_webrecon_foundation.py` (created), `proofs/webrecon_v1_20260930/SCOPE.md` (created)
- Left: none in this lane. Live fetch, browser layout, and K3 handoff stay out of scope.
