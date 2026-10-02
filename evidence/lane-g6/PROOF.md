# Lane G6 — project library / .spe binding

START_SHA: `34098fc37e3ea0a74f6bc8bc30c2bf3c5b591d1f`
Branch: `grok/lane-g6-spe-binding-20261003`
Worktree: `/Volumes/4TB-WD/spe-worktrees/spe-lane-g6-spe-binding`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/102

Storage owner reused: `spe_runtime.storage.project_library.ProjectLibrary` (JSONL). Canonical `.spe` owner reused: `spe_runtime.portability.spe_artifact`. Workflow export owner brought from frozen G11 commit `4c916d77b211e2fee33ec1be69c389a8687128a7` (`grok/spe-workflow-export-v1-20260930`, PR #74): `spe_runtime/workflow_export` plus `tests/unit/test_workflow_export_v1.py` and `schemas/workflow_export.schema.json`.

`apps/web/src/export/workflowExporters.ts` was not copied. Frozen commits `b73f3cd` and `6218619` delete it as a second exporter, and the copy at `2560e2d` uses `Date.now()`. It is imported by `WorkflowExportModal.tsx`. No App.tsx, shell, nav, or routing files were edited.

## spe_contract

`NOT_YET_BOUND`. `promoted` is false. `refused_promotion` is `VERIFIED`. The workflow document has no `spe_contract` field.

## Real in this ancestry

| Check | Result |
|---|---|
| provenance_record | `spe.provenance-record.v1`, digest binding, missing and mismatch rejected |
| manifest_hashes | `spe.capability-manifest.v1`, `tools/build_manifest.py` recomputes and rejects corruption |
| workflow_export | frozen G11 `export_workflow`: offline, deterministic, `audit_export` rejects a corrupted fidelity list |

## HOLD

None for these three. Workflow export is no longer HOLD.

## Tests

- `tests/unit/test_lane_g6_spe_binding.py`, `tests/unit/test_project_library.py`, `tests/unit/test_workflow_export_v1.py`: 62 passed
- The G11 import test failed first (`No module named spe_runtime.workflow_export`)

MERGED=NO. DEPLOYED=NO. HOSTED=NO.
