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
- `tests/mutation/cvr1_harness.py` — created 2026-09-30 — R1 evidence oracle and CVR1-01 through CVR1-20 mutants
- `tests/mutation/test_codevision_cvr1_killed.py` — created 2026-09-30 — proves each CVR1 mutant is killed
- `tests/unit/test_codevision_r1_qualification.py` — created 2026-09-30 — locks the donor six-target IR without a fidelity claim
- `tests/proofs/codevision_r1q_proof.json` — created 2026-09-30 — C3 qualification proof: targets, evidence classes, unproven fidelity

## Log

### 2026-09-30 — CODEVISION structure foundation
- Why: screenshot observation needs a bounded structure compiler and an honest visual-fidelity proof format
- Files: `spe_runtime/codevision/` (created), `schemas/codevision_observation.schema.json` (created), `schemas/codevision_structure.schema.json` (created), `schemas/codevision_visual_fidelity_proof.schema.json` (created), `data/codevision/observation_two_cards.json` (created), `tests/unit/test_codevision_foundation.py` (created), `docs/architecture/codevision-v1.md` (created), `SPE-CHANGELOG` (updated)
- Left: visual fidelity is unproven; image decoding and code emission are out of scope

### 2026-09-30 — CODEVISION R1 qualification
- Why: qualify the six-target structural IR and kill uncertainty mutants without decoding images
- Files: `tests/mutation/cvr1_harness.py` (created), `tests/mutation/test_codevision_cvr1_killed.py` (created), `tests/unit/test_codevision_r1_qualification.py` (created), `tests/proofs/codevision_r1q_proof.json` (created)
- Left: visual fidelity remains UNPROVEN
