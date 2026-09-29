# Task57R mutation results

Full `pytest -q`: **992 passed, 0 failed**, exit 0, 184.91s. That run includes the existing Task57 mutant test, `test_all_twenty_three_mutants_killed`, and the effect-mutation module.

| Set | Result in this session |
| --- | --- |
| Task57 original outcome mutants | passed inside the 992 (test_mutants_killed) |
| Task57R guard outcomes | 12 checks in `test_task57r_guard_mutants_are_killed` |
| Core B / no-dead-end | `test-core-b-fallback.mjs` and `test-no-dead-end.mjs` passed |
| XCAT M1–M23 | the suite test that asserts all 23 mutants are killed is part of the 992 passed |
| Effect M1–M11 | the effect mutation module is part of the 992 passed |

These are outcome and guard checks against the real engine. They are not a separate source-rewriting mutation compiler.
