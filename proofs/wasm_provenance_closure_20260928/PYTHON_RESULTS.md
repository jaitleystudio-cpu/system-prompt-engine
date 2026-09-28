# Python results

Interpreter: `/workspace/.venv-audit` (pytest 9.1.1). Not committed.

Command: `.venv-audit/bin/pytest -q --tb=line`

## After the test-contract edit

```
1 failed, 692 passed in 28.12s
EXIT:1
```

- collected = 693
- passed = 692
- failed = 1
- skipped = 0

The only failure is `tests/web/test_web_architecture_gates.py::test_shipped_release_wasm_matches_kernel_artifact_hash`.

It compared the tracked public digest `8d482a17…` with the gitignored rustc 1.83.0 release artifact `27c73e90…`. The assertion was not edited. The public WASM was not replaced.

PYTHON_NON_WASM_FAILURES = 0

## RED/GREEN of the two drift tests

Recorded in `TEST_DRIFT_FORENSICS.md`. Old assertions fail on frozen UI copy. Repaired assertions pass. No other test was modified to absorb a failure.
