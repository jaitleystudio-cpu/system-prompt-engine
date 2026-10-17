# Task57R-F3 mutation results

| Mutant | Result |
| --- | --- |
| F3-01 caller `proof_refs=["fake"]` | killed |
| F3-02 wrong taxonomy version | killed |
| F3-03 wrong active category with stale proof | killed |
| F3-04 wrong requirement-graph digest | killed |
| F3-05 changed K3 selection | killed |
| F3-06 changed effect plan | killed |
| F3-07 changed ProtectedIntent | killed |
| F3-08 proof text claims browsing | killed |
| F3-09 empty proof treated as satisfied | killed |
| F3-10 second repair attempt | killed; disposition `REFUSED`, `max_attempts` 1 |
| F3-11 browser visible prompt stays corrupted | killed by the browser qualifier |
| F3-12 repaired display/export mismatch | killed by the browser qualifier |

12 defined, 12 killed, 0 survived.

F2's 10 mutants, F1's 10, Task57, Task57R, XCAT 23/23, and effect 11/11 stayed inside the green pytest and browser qualifier runs.
