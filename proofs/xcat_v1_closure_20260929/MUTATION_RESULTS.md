# Mutation results — XCAT M1–M16

**Date:** 2026-09-29  
**Suite:** `tests/unit/test_xcat_mutations_56b.py`  
**Result:** **16/16 killed** (0 survived)

| Id | Attack | How killed |
|----|--------|------------|
| M1 | Drop hard constraint | X01 `validate_constraint_monotonicity` returns False |
| M2 | Remove provenance | X02 `validate_provenance_monotonicity` returns False |
| M3 | Remove uncertainty | X03 `validate_uncertainty_preservation` returns False |
| M4 | Mutate preference statement | X04 `validate_preference_immutability` returns False |
| M5 | Fact without provenance | X05 `validate_facts_have_provenance` returns False |
| M6 | Analysis laundered as recommendation | X06 / `analyze` rejects recommendation-shaped payload |
| M7 | Recommendation copied into execution_grants | X07 `validate_recommendation_not_execution` returns False |
| M8 | Communicate / rewrite goal_identity | X08 / C03 ownership refuses goal rewrite |
| M9 | Authority self-escalation without event | X09 `validate_authority_non_escalation` returns False |
| M10 | UNKNOWN→PASS failure laundering | X10 `validate_failure_preservation` returns False |
| M11 | C09 writes C04-only field | `apply_category_payload` raises unknown fields |
| M12 | Routing defaults unsupported → C01 | `route_mission_stage` → NEEDS_DISAMBIGUATION / null primary |
| M13 | Legacy Privacy treated as Code | `LEGACY_TAXONOMY_UNMIGRATED` on migration + apply |
| M14 | Category commits authority/EXECUTED | forbidden-key rejection on apply |
| M15 | Routing ignores stage evidence | Router ROUTED to CAT:C08 from stage.category_ref |
| M16 | Category redefines kernel truth | apply preserves facts/goal/provenance/constraints/authority; handoff REFUSE/BLOCKED on goal hijack |

Observed: parametrized `test_mutant_killed` + `test_all_sixteen_mutants_killed` → **17** tests passed in this run.
