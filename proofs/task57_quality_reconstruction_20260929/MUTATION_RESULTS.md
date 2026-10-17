# Mutation results

## Task 57

Defined 18. Killed 18. Survived 0.

| Id | Attack | Killed by |
| --- | --- | --- |
| Q1 | fake global quality percentage | output has no score field |
| Q2 | longer prompt counted as improved | `NON_INFERIOR` / `LENGTH_NOT_QUALITY` |
| Q3 | lost hard constraint counted as improved | `REGRESSED` |
| Q4 | `UNKNOWN` rewritten as satisfied | `CONFLICT` / `UNKNOWN_LAUNDERED` |
| Q5 | authority expansion ignored | protected regression |
| Q6 | invented fact ignored | protected regression |
| Q7 | different protected intent compared as improvement | `PROTECTED_INTENT_MISMATCH` |
| R1 | unbounded reconstruction | `max_attempts` stays 1 |
| R2 | second attempt accepted | `REFUSED` |
| R3 | repair changes goal | forbidden repair, goal unchanged |
| R4 | repair changes K3 | forbidden repair, techniques unchanged |
| R5 | repair invents an example | forbidden repair |
| R6 | regressed candidate replaces original | original kept |
| V1 | `VALIDATE_ONLY` executes | `external_effect` false, `NOT_EXECUTED` |
| V2 | `VALIDATE_ONLY` uses the network | `network` false |
| V3 | `VALIDATE_ONLY` uses a credential | `credentials_used` false |
| V4 | enforcement unavailable returns `PASS` | `FAIL` / `ENFORCEMENT_UNAVAILABLE` |
| V5 | fabricated `EXECUTION_OBSERVED` | proof class is not `EXECUTION_OBSERVED` |

## Preserved suites

| Suite | Result |
| --- | --- |
| XCAT M1–M23 | 23/23 killed |
| Effect M1–M11 | 11/11 killed |
