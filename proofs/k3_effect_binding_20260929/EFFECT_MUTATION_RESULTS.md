# Effect mutation results

These ten mutants are local to the effect binder. They are not a repository-wide mutation score.

| Id | Mutant | Killed |
|---|---|---|
| M1 | ignore K3 and drop effect sections | yes |
| M2 | always emit DIRECT | yes |
| M3 | fabricate a FEW_SHOT example | yes |
| M4 | remove a hard constraint | yes |
| M5 | remove the budget | yes |
| M6 | RETRIEVE_REASON claims sources were fetched | yes |
| M7 | CRITIQUE_REVISE asks for an unbounded loop | yes |
| M8 | STRUCTURED_OUTPUT invents a schema | yes |
| M9 | UNKNOWN renders a success prompt | yes |
| M10 | a caller replaces the engine technique list | yes |
| M11 | K3 request fails and the renderer emits a fallback prompt | yes |

defined: 11
killed: 11
survived: 0

`effect_plan_is_lawful` accepts only the canonical `bind_prompt_effects` JSON for that selection. Each mutant changes that JSON. The renderer also rejects a technique list that does not match the plan, which is the M10 path at the TypeScript boundary.
