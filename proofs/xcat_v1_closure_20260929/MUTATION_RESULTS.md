# Mutation results — XCAT M1–M23

**Date:** 2026-09-29  
**Suite:** `tests/unit/test_xcat_mutations_56b.py`  
**Result:** **23/23 killed** (0 survived)

M1–M16 remain killed. M16 no longer treats `decide()`'s recommendation write as acceptable.

| Id | Attack | How killed |
|----|--------|------------|
| M1 | Drop hard constraint | X01 `validate_constraint_monotonicity` returns False |
| M2 | Remove provenance | X02 `validate_provenance_monotonicity` returns False |
| M3 | Remove uncertainty | X03 `validate_uncertainty_preservation` returns False |
| M4 | Mutate preference statement | X04 `validate_preference_immutability` returns False |
| M5 | Fact without provenance | X05 `validate_facts_have_provenance` returns False |
| M6 | Analysis laundered as recommendation | X06 / legacy `analyze` rejects recommendation-shaped payload |
| M7 | Recommendation copied into execution_grants | X07 `validate_recommendation_not_execution` returns False |
| M8 | Communicate / rewrite goal_identity | X08 / legacy C03 refuses goal rewrite |
| M9 | Authority self-escalation without event | X09 `validate_authority_non_escalation` returns False |
| M10 | UNKNOWN→PASS failure laundering | X10 `validate_failure_preservation` returns False |
| M11 | C09 writes C04-only field | `apply_category_payload` raises unknown fields |
| M12 | Routing defaults unsupported → C01 | `route_mission_stage` → NEEDS_DISAMBIGUATION / null primary |
| M13 | Legacy Privacy treated as Code | `LEGACY_TAXONOMY_UNMIGRATED` on migration + apply |
| M14 | Category commits authority/EXECUTED | forbidden-key rejection on apply |
| M15 | Routing ignores stage evidence | Router ROUTED to CAT:C08 from stage.category_ref |
| M16 | Category redefines kernel truth | DOMAIN apply preserves facts/goal/provenance/constraints/authority; handoff REFUSE/BLOCKED on goal hijack |
| M17 | C01 directly commits recommendation | DOMAIN apply leaves `recommendation` unchanged; extra `recommendation` field rejected |
| M18 | C02 directly appends a canonical fact | DOMAIN apply leaves `facts` unchanged; `facts` field rejected |
| M19 | C02 directly appends provenance | DOMAIN apply leaves `provenance` unchanged; `provenance` field rejected |
| M20 | C02 directly changes uncertainty | DOMAIN apply leaves `uncertainties` unchanged; `uncertainties` field rejected |
| M21 | C03 directly commits rendering | DOMAIN apply leaves `rendering` unchanged; `rendering` field rejected |
| M22 | C06 directly commits analysis | DOMAIN apply leaves `analysis` unchanged; `analysis` field rejected |
| M23 | DOMAIN path reaches a legacy writer | production reachability 0; `via_legacy` rejected |

Illegal direct commits are not defined as acceptable DOMAIN behavior.
