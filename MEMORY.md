# Project memory

## Map

- `spe_runtime/media/` — created 2026-09-30 — speech and video observation foundation: envelopes, speaker-neutral transcript custody, scenes, keyframes, alignment, temporal events, evidence graph, and MediaIntentContract
- `schemas/media_intent_contract.schema.json` — created 2026-09-30 — schema for the MediaIntentContract document, including privacy defaults
- `tests/unit/test_media_intelligence.py` — created 2026-09-30 — tests that retention, network authority, and speaker custody stay fail-closed
- `docs/implementation/media-intelligence-v1.md` — created 2026-09-30 — scope of the media foundation and what it does not wire
- `tests/unit/test_media_r1_qualification.py` — created 2026-09-30 — C2 oracle for retention, identity, network, time, scene, alignment, and authority
- `tests/qualification/media_r1_mutants.py` — created 2026-09-30 — in-memory MR1-01 through MR1-20 patches; donor files stay untouched
- `tests/qualification/qualify_media_r1.py` — created 2026-09-30 — runs the media tests and withholds a mutation score when the baseline is red
- `proof/media-r1/c2-media-r1-evidence.json` — created 2026-09-30 — evidence that non-boolean explicit-need turns raw video retention on

## Log

### 2026-09-30 — Media R1 qualification hold
- Why: C2 qualified the donor foundation and found raw video retention accepts non-boolean explicit-need
- Files: `tests/unit/test_media_r1_qualification.py` (created), `tests/qualification/media_r1_mutants.py` (created), `tests/qualification/qualify_media_r1.py` (created), `proof/media-r1/c2-media-r1-evidence.json` (created)
- Left: hold stands; donor runtime was not patched; mutation score stays withheld

### 2026-09-30 — Speech and video intelligence foundation
- Why: Lane J needed observation custody that emits a MediaIntentContract and keeps raw media and network authority off
- Files: `spe_runtime/media/` (created), `schemas/media_intent_contract.schema.json` (created), `tests/unit/test_media_intelligence.py` (created), `docs/implementation/media-intelligence-v1.md` (created), `SPE-CHANGELOG` (updated)
- Left: ProtectedIntent integration is later and was not wired
