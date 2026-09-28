# Graph mutation results

Scope: requirement-graph projection only. Not repository-wide mutation testing.

| Id | Defect | Killed |
|---|---|---|
| A | drop one hard constraint | yes |
| B | increase budget | yes |
| C | remove budget | yes |
| D | convert HARD to preference | yes |
| E | drop provenance | yes |
| F | invent requirement | yes |
| G | resolve UNKNOWN to known | yes |
| H | ignore contradiction | yes |
| I | nondeterministic node order | yes |
| J | let example override requirement | yes |

defined = 10
killed = 10
survived = 0

The canonical builder passes the same invariants. Each mutant fails at least one and its canonical JSON differs from the builder output.
