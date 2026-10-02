# Lane G6 — project library / .spe binding

START_SHA: `34098fc37e3ea0a74f6bc8bc30c2bf3c5b591d1f`
Branch: `grok/lane-g6-spe-binding-20261003`
Worktree: `/Volumes/4TB-WD/spe-worktrees/spe-lane-g6-spe-binding`
Ancestry: PR #81 head. Local A7 `e9cd877` and A7-R `ed4f271` are siblings, not descendants, so they do not supersede #81. A8 workflow-export UI is a different branch and is not merged here.

Storage owner reused: `spe_runtime.storage.project_library.ProjectLibrary` (JSONL). Canonical `.spe` owner reused: `spe_runtime.portability.spe_artifact`. No second storage engine.

## spe_contract

`NOT_YET_BOUND`. Not promoted. `spe_binding_report` is read-only and sets `refused_promotion` to `VERIFIED`.

Artifact `integrity.state` may be `VERIFIED` only when `verify_integrity` recomputes the SHA-256 digest. That state is reported on the head and is not copied onto `spe_contract`. Import of a bundle whose `spe_contract` is `VERIFIED` is `UNKNOWN_SCHEMA`.

## Executable proof (owned)

| Check | Result |
|---|---|
| create project | private, noindex, no account field |
| revisions | create + revise, ids stable |
| diff | `spe.project-library.diff.v1` replace |
| rollback | `HEAD_MOVE` reason `ROLLBACK`, prior body kept |
| provenance hooks in this owner | `provenance_refs` round-trip |
| bundle import/export | schema-valid, `spe_contract` stays `NOT_YET_BOUND` |
| .spe artifact generation | `build_spe_artifact` v1 and v2, then `export_spe` |
| integrity hash | `content_sha256` matches `verify_integrity`; `body_sha256` is the library digest |
| corruption rejection | tampered body `INTEGRITY_MISMATCH`; journal byte swap `CORRUPT_ENTRY` |
| backwards compatibility | v1 artifact has no context-protocol block; legacy bundle still imports |
| offline/private | socket patched to fail; library source has no network client |

## HOLD (no owner — contract not closed)

| Check | Why |
|---|---|
| provenance_record | `schemas/provenance_record.schema.json` is a stub |
| manifest_hashes | `schemas/capability_manifest.schema.json` and `tools/build_manifest.py` are stubs |
| workflow_export | `apps/web/src/export/workflowExporters.ts` is not in this ancestry (G11 / A8). Not copied. |

## Tests

- `tests/unit/test_lane_g6_spe_binding.py` plus `tests/unit/test_project_library.py`: 36 passed
- `node apps/web/scripts/test-project-library-ui.mjs` with the repo venv `python3`: PASS
- First run of the new tests failed on missing `spe_binding_report` (3 failed, 1 passed) before the report existed

MERGED=NO. DEPLOYED=NO. HOSTED=NO.
