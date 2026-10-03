# Lane R3-F — .spe binding path

START_SHA: `1a2a4faa14b2ee1c684fdacd651509cf96b878bf`
Branch: `grok/r3-f-spe-binding-20261003`
Worktree: `/Volumes/4TB-WD/spe-worktrees/spe-lane-r3-f-binding`
Parent PR not rewritten: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/102

`spe_contract` is `NOT_YET_BOUND`. The public path decision is exactly `HOLD`. `promoted` is false. `refused_promotion` is `VERIFIED`.

## Path

| Step | Result |
|---|---|
| CREATE | REAL `ProjectLibrary.create_project` |
| SAVE | REAL append-only JSONL via `create_artifact` |
| REVISION | REAL `revise` |
| DIFF | REAL `diff` |
| ROLLBACK | REAL `rollback` |
| EXPORT .spe | REAL `export_spe` through `spe_runtime.portability.spe_artifact` |
| VERIFY manifest hashes | REAL `revision_manifest` / `accept_revision_manifest` |
| IMPORT | REAL `import_bundle` |
| RECONSTRUCT | REAL `loads_spe_artifact` of the imported export, `strict_equal` |
| WORKFLOW EXPORT | REAL frozen G11 `spe_runtime.workflow_export.export_workflow` |
| TARGET MODEL COMPILE | HOLD. No owner compiles a saved .spe artifact for a named target model. `compile_execution_contract` is not called. |
| REOPEN | REAL new `ProjectLibrary` on the same file |
| stable semantic hash | REAL `verify_integrity` `content_sha256`, stable across reopen |

## Tests

`tests/unit/test_lane_r3f_spe_binding.py`, `tests/unit/test_lane_g6_spe_binding.py`, `tests/unit/test_project_library.py`, `tests/unit/test_workflow_export_v1.py`: 66 passed (62 previous + 4).

Covered here: stale manifest (`STALE_MANIFEST` after a later revision), changed payload (`HASH_MISMATCH`), missing provenance, duplicate ids (`CORRUPT_ENTRY` and `ID_COLLISION`), v1 and v2, future `spe.artifact.v9`, tampered library archive, rollback after import, workflow and .spe export mismatch.

WASM pin `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` was not edited. `apps/web/src/export/workflowExporters.ts` was not recreated.

MERGED=NO. DEPLOYED=NO. HOSTED=NO.
