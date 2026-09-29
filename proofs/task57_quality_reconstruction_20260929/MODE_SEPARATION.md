# Mode separation

| Mode | What this task allows | Verdicts | Execution |
| --- | --- | --- | --- |
| `DRY_RUN` | Local preview of an already supplied artifact | `PREVIEW` or `REFUSED` | not authorized |
| `VALIDATE_ONLY` | Deterministic obligation validation | `PASS`, `FAIL`, `UNKNOWN` | not authorized |
| `EXECUTE` | Refusal only | `FAIL` | not authorized and not observed |

`DRY_RUN` is not `VALIDATE_ONLY`. `VALIDATE_ONLY` is not `EXECUTE`. `LOCAL_DRY_RUN` remains the existing local execution-record label and is not accepted as one of these three modes (`UNSUPPORTED_MODE`).

`RECOMMEND`, `AUTHORIZE`, and `EXECUTE` stay distinct. A validation `PASS` does not grant execution. An authority grant that contains `EXECUTE` still receives `FAIL` / `EXECUTION_NOT_AUTHORIZED` from this module, because Task 57 does not perform execution.
