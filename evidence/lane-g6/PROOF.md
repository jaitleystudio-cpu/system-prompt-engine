# Lane G6 — project library / .spe binding

START_SHA: `34098fc37e3ea0a74f6bc8bc30c2bf3c5b591d1f`
Branch: `grok/lane-g6-spe-binding-20261003`
Worktree: `/Volumes/4TB-WD/spe-worktrees/spe-lane-g6-spe-binding`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/102

Storage owner reused: `spe_runtime.storage.project_library.ProjectLibrary` (JSONL). Canonical `.spe` owner reused: `spe_runtime.portability.spe_artifact`. Manifest hashes recompute in `tools/build_manifest.py`. No second storage engine. G11 workflow exporters were not copied.

## spe_contract

`NOT_YET_BOUND`. `promoted` is false. `refused_promotion` is `VERIFIED`.

## Real in this ancestry

| Check | Result |
|---|---|
| provenance_record | schema `spe.provenance-record.v1`. `artifact_sha256` is the recomputed revision body digest. Canonical `.spe` bodies also bind `content_sha256`. Missing source or hash is `MISSING_PROVENANCE`. A mismatched digest is `PROVENANCE_MISMATCH`. The record is not a second journal. |
| manifest_hashes | schema `spe.capability-manifest.v1`. `tools/build_manifest.py` recomputes SHA-256 from current bytes and exits non-zero on corruption. `ProjectLibrary.revision_manifest` uses that checker. A tampered entry is `HASH_MISMATCH`. |

## HOLD

| Check | Why |
|---|---|
| workflow_export | Missing owner `apps/web/src/export/workflowExporters.ts`. G11 workflow export is not in this ancestry and was not copied. |

## Tests

- `tests/unit/test_lane_g6_spe_binding.py` and `tests/unit/test_project_library.py`: 38 passed
- The new provenance and manifest assertions failed before the implementation (holds still stubbed; `ManifestError` missing)

MERGED=NO. DEPLOYED=NO. HOSTED=NO.
