# K3 mutation scope

This is not repository-wide mutation testing. `tools/run_mutations.py` was not expanded.

Defined mutants live in `tests/unit/test_k3_runtime.py::test_defined_mutants_are_killed`. Each disagrees with `select_prompt_techniques` or fails `selection_is_accepted`.

| Mutant | Fault | Killed |
|---|---|---|
| A | always `ZERO_SHOT` | yes — CAT:C02 selects `RETRIEVE_REASON` first |
| B | ignore category context | yes — result differs from the C02 selection |
| C | rewrite a hard constraint | yes — binding differs; canonical binding does not |
| D | rewrite budget | yes — binding differs; canonical budget does not |
| E | set `execution_authorized` and an authority effect | yes — `selection_is_accepted` is false |
| F | treat `UNKNOWN` as success / `claims_pass` | yes — canonical `claims_pass` stays false and acceptance stays false |
| G | emit `NOT_A_TECHNIQUE` | yes — acceptance is false |

Mutants defined: 7. Killed: 7. Survivors: 0.
