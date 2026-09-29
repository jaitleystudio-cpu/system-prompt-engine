# CATEGORY OWNERSHIP — DOMAIN v2 (Task 56C)

**Date:** 2026-09-29  
**Taxonomy:** DOMAIN v2  
**Law:** CATEGORY ≠ KERNEL OWNER  
**Production path:** `spe_runtime.categories.domain.apply_domain_category` → `apply_category_payload`  
**Category direct canonical writers:** **0**  
**Duplicate semantic writers:** **0**

Task 56B's matrix incorrectly listed C01/C02/C03/C06 as canonical writers of recommendation, facts, analysis, and rendering. That text is **superseded**. Those functions remain only as `LEGACY_COMPATIBILITY` and are not the DOMAIN production path.

## DOMAIN matrix

| Field / concern | READ | PROPOSE | WRITE (canonical) | MUST_NOT_WRITE |
|-----------------|------|---------|-------------------|----------------|
| `category_payload` | owning category | owning category | owning category | every other category |
| category trace / routing | all categories | XCAT router | XCAT router / payload apply | kernel truth fields |
| `proof_obligation_proposals` | kernel owners | owning category | category proposal only | canonical verdict / state |
| facts / provenance / uncertainty | all categories | C02 (proposal only) | epistemic owner | all category modules |
| `hard_constraints` / `user_preferences` / `goal_identity` | all categories | — | intake / protected-intent owner | all category modules |
| `analysis` | all categories | C06 (inside payload) | analysis owner, if a separate canonical field is committed | all category modules on DOMAIN path |
| `recommendation` | all categories | C01 (inside payload) | decision owner, not the category module | all category modules on DOMAIN path |
| `rendering` | all categories | C03 (inside payload) | rendering owner, not the category module | all category modules on DOMAIN path |
| authority / privacy | all categories | C07 may name authority *inside payload* | K4 / authority-privacy owner | all category modules |
| proof verdict | all categories | category proposal | K2 | all category modules |
| strategy / effect | K3 consumers | — | K3 | all category modules |
| artifact lineage | — | — | K6 | all category modules |
| qualification / lifecycle | — | — | K7 | all category modules |
| `execution_grants` | C07 may read | C07 proposal | authority owner | all category modules |

`authority` and `receipt` may appear as **WorkExecutionProjectIR payload field names**. They are data inside `category_payload`. They do not write `authority_state` or an execution receipt.

## Per-category payload writers

All twelve DOMAIN categories write only `category_payload` (+ trace, active category, proposals):

| ID | Payload IR |
|----|------------|
| C01 | DecisionProjectIR |
| C02 | ResearchProjectIR |
| C03 | WritingProjectIR |
| C04 | LanguageTransferProjectIR |
| C05 | LearningProjectIR |
| C06 | AnalysisProjectIR |
| C07 | WorkExecutionProjectIR |
| C08 | BusinessProjectIR |
| C09 | CodeProjectIR |
| C10 | MultimediaProjectIR |
| C11 | CareerProjectIR |
| C12 | CreativeProjectIR |

## Legacy compatibility (not canonical writers)

| API | Still commits | Production reachable |
|-----|---------------|----------------------|
| `decide` | `recommendation` | no |
| `research` | facts / provenance / uncertainties | no |
| `communicate` | `rendering` | no |
| `analyze` | `analysis` | no |
| `form_execution_intent` / `retry_form_execution_intent` | category trace + returned ExecutionIntent proposal; does not mint authority | no |

`research_from_grounding` is DOMAIN: payload + epistemic proposal, then `EPISTEMIC_OWNER_UNAVAILABLE` if commit is requested.

## Counts

```
DOMAIN_CATEGORY_PAYLOAD_WRITERS = 12
CATEGORY_DIRECT_KERNEL_WRITERS = 0
PRODUCTION_LEGACY_WRITER_REACHABILITY = 0
DUPLICATE_SEMANTIC_WRITERS = 0
```
