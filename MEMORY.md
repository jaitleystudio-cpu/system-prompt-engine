# Project memory

## Map

- `spe_runtime/codevision/` — updated 2026-09-30 — screenshot observation to six structure targets; visual fidelity stays unproven
- `schemas/codevision_observation.schema.json` — created 2026-09-30 — closed input contract for a supplied screenshot observation
- `schemas/codevision_structure.schema.json` — created 2026-09-30 — six-target structure document
- `schemas/codevision_visual_fidelity_proof.schema.json` — created 2026-09-30 — proof format that only validates `UNPROVEN`
- `data/codevision/observation_two_cards.json` — created 2026-09-30 — fixture observation used by the contract tests
- `tests/unit/test_codevision_foundation.py` — created 2026-09-30 — locks the six targets, refusals, and unproven proof
- `docs/architecture/codevision-v1.md` — created 2026-09-30 — names the six targets and the unproven boundary
- `SPE-CHANGELOG` — updated 2026-09-30 — records the CODEVISION foundation

## Log

### 2026-09-30 — CODEVISION structure foundation
- Why: screenshot observation needs a bounded structure compiler and an honest visual-fidelity proof format
- Files: `spe_runtime/codevision/` (created), `schemas/codevision_observation.schema.json` (created), `schemas/codevision_structure.schema.json` (created), `schemas/codevision_visual_fidelity_proof.schema.json` (created), `data/codevision/observation_two_cards.json` (created), `tests/unit/test_codevision_foundation.py` (created), `docs/architecture/codevision-v1.md` (created), `SPE-CHANGELOG` (updated)
- Left: visual fidelity is unproven; image decoding and code emission are out of scope
