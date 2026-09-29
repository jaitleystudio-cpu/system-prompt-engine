# Project memory

## Map

- `spe_runtime/media/` — created 2026-09-30 — speech and video observation foundation: envelopes, speaker-neutral transcript custody, scenes, keyframes, alignment, temporal events, evidence graph, and MediaIntentContract
- `schemas/media_intent_contract.schema.json` — created 2026-09-30 — schema for the MediaIntentContract document, including privacy defaults
- `tests/unit/test_media_intelligence.py` — created 2026-09-30 — tests that retention, network authority, and speaker custody stay fail-closed
- `docs/implementation/media-intelligence-v1.md` — created 2026-09-30 — scope of the media foundation and what it does not wire

## Log

### 2026-09-30 — Speech and video intelligence foundation
- Why: Lane J needed observation custody that emits a MediaIntentContract and keeps raw media and network authority off
- Files: `spe_runtime/media/` (created), `schemas/media_intent_contract.schema.json` (created), `tests/unit/test_media_intelligence.py` (created), `docs/implementation/media-intelligence-v1.md` (created), `SPE-CHANGELOG` (updated)
- Left: ProtectedIntent integration is later and was not wired
