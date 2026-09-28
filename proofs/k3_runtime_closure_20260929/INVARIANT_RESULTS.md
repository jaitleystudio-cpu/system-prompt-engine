# Invariants

Checked by `tests/unit/test_k3_runtime.py` on every frozen vector and the focused classes.

| Law | Result |
|---|---|
| Same input, same object | pass |
| Whitespace around `CAT:C02` matches the stripped id (`N21` = `N04`) | pass |
| Caller protected object unchanged | pass |
| Goal, hard constraints, budget, desired output, facts, provenance echoed equal | pass |
| Authority grants unchanged; `execution_authorized`, network, credentials, sharing, external write stay false | pass |
| No technique id outside the registry on an accepted result | pass |
| `ZERO_SHOT` and `FEW_SHOT` never both selected | pass |
| Statement text is not scanned for technique tokens | pass |
| `claims_pass` is false, including `UNKNOWN` and `SAFE_DEFAULT` | pass |
| `selection_is_accepted` requires schema, selector version, lawful disposition, known ids, recomputed `selection_id`, and no authority flags | pass |
