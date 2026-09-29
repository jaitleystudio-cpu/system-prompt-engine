# Massive Intent v1 — Large Paste intake

Lineage: NEW_IMPLEMENTATION. Lane B only.

Stop line: `MassiveSourceIR` + `SourceMap` + extracted explicit evidence.
Semantic classification, K3, quality, and `PromptEffectPlan` are not part of this lane.
`READY_FOR_F3E` means the accepted source is in custody. It is not a semantic pass.
`is_semantic_pass()` is always false. `semantic_engine` stays `NOT_INTEGRATED`.
`semantic_judgment` stays `NOT_A_PASS`. `waits_for` stays `F3E_FREEZE`.

## Status vocabulary

`READY_FOR_F3E`, `REFUSED`, `INCOMPLETE`, `RESUMABLE`, `REFUSED_IN_PROGRESS`,
`CUSTODY_MISMATCH`, `MEMORY_PRESSURE_HALTED`.

`PASS` is not a status. `UNKNOWN` is not a pass. `ABSENT` evidence is not a pass.

## Custody

- Word cap is 1,000,000. Exactly 1,000,000 words may seal `READY_FOR_F3E`.
- 1,000,001 words refuses the entire body. The prefix is not kept as the source.
- Refusal journals `REFUSE` before blobs are deleted, then `BLOBS_CLEARED`.
- `loss_kind` is `REFUSED_OVER_BUDGET_BODY_DISCARDED`. `silent_truncation` is false.
- If blobs remain, seal stays `REFUSED_IN_PROGRESS` with cleanup incomplete.
- Chunk target is 32,768 code points, hard cap 65,536, max resident 65,536.
- Cuts are slices of the original string. A word longer than the hard cap splits on a character boundary and is marked `split_inside_word`.
- Chain hash is `spe.massive.chain.v1`: sha256(previous raw digest || chunk raw digest).
- The journal is the source of truth. A torn final line is ignored. Orphan blobs that never got a journal line are ignored.
- Missing or corrupt blobs resume as `CUSTODY_MISMATCH`, not `READY_FOR_F3E`.
- Memory pressure halts, discloses `rejected_char_count`, and keeps the durable prefix recoverable. Further appends are rejected and not stored.
- After a refused session is resumed, a later append cannot rebuild the content hash, so `attempted_sha256_status` becomes `UNKNOWN`.

## Explicit evidence

Lexical only: `EXPLICIT_MUST_NOT`, `LABELED_CONSTRAINT`, `QUOTED_DIRECTIVE`, `EXPLICIT_MUST`.
These are not XCAT categories. Lines longer than 8,192 code points are skipped and disclosed.
If every candidate line was skipped and nothing was emitted, evidence status is `NOT_SCANNED`.
`ABSENT` is only used when the scan completed and found nothing.

## Where it runs

- Python oracle: `spe_runtime/massive/`. Filesystem custody under a caller-chosen root.
- Browser intake: `apps/web/src/massive/`. OPFS directory `spe-massive`, IndexedDB `spe_massive_v1` for metadata only, streaming worker `ingest.worker.mjs` speaking `spe.massive-ingest.v1`.
- Shared vectors: `data/massive/vectors.json`.
- Schema: `schemas/massive_source_ir.schema.json`.

IndexedDB stores session metadata, chunk coordinates, and evidence items. Chunk bodies stay in OPFS.
If the IndexedDB mirror fails, the journal still holds the source and the ack reports `index_persisted: false`.

## Not mounted

Home quick-start remains capped at 20,000 characters in `apps/web/src/input/boundedText.ts`.
Create is not wired to `MassiveSession`. F3E freeze owns that product surface and any semantic integration.

Local-first. No hosting, deploy, or network fetch in this lane.

## Tests

- `.venv/bin/pytest tests/unit/test_massive_ingest.py`
- `node apps/web/scripts/test-massive-ingest.mjs` (`npm run test:massive` from `apps/web`)
