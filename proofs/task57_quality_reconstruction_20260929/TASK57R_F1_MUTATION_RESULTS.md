# Task57R-F1 mutation results

| Mutant | Killed by |
| --- | --- |
| F1 `from_k3` skips `reconstruct` | repaired missing-constraint case still returns `kept=repaired` |
| F2 `from_k3` reconstructs twice | call count is 1 and `max_attempts` stays 1 |
| F3 receipt validates the original after a repaired keep | receipt digest equals the kept subject and differs from the original |
| F4 web accepts repaired when plan is not `ACCEPTED` | terminal stays `CANONICAL_PROMPT` |
| F5 web accepts repaired when delta is not `IMPROVED` | terminal stays `CANONICAL_PROMPT` |
| F6 artifact stays original after repaired display | artifact prompt equals the kernel repaired prompt |
| F7 history saves the original after repaired display | history artifact and preview bind the same prompt |
| F8 `.spe` exports the original while the UI shows the repair | export prompt equals display |
| F9 TypeScript synthesizes a repaired prompt | display is exactly `kept_subject.compiled_prompt` |
| F10 repaired prompt bypasses the protected-regression check | kernel keeps the original; the web also keeps the canonical prompt when regressions are non-empty |

10 defined, 10 killed, 0 survived.

Task57 `test_mutants_killed`, Task57R guard checks, XCAT M1–M23, and effect M1–M11 remained inside the green pytest run (999 passed, 0 failed).
