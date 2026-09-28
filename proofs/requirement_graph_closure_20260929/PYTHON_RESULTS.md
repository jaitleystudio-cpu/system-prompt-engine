# Python results

Oracle: `spe_runtime.requirements.project.build_requirement_graph`

| Suite | Result |
|---|---|
| `tests/unit/test_requirement_graph.py` + `tests/unit/test_requirement_graph_mutation.py` | 86 passed |
| `tests/unit/test_k3_runtime.py` | passed inside the full suite |
| Full `python3 -m pytest` with `PYTHONPATH=/workspace` | 865 passed, 0 failed |

The two benchmark-subprocess tests fail if `PYTHONPATH` does not include the repo, because that child process does not see `spe_runtime`. With the repo on `PYTHONPATH` they pass. That failure is an invocation detail, not a graph mismatch.
