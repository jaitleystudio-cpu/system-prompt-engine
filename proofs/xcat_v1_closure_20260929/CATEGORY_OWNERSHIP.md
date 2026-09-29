# CATEGORY OWNERSHIP — DOMAIN v2 (Task 56B)

**Date:** 2026-09-29  
**Taxonomy:** DOMAIN v2  
**Law:** CATEGORY ≠ KERNEL OWNER; **`duplicate_writers=0`**

## Envelope field ownership

| Field / concern | READ | PROPOSE | WRITE | MUST_NOT_WRITE |
|-----------------|------|---------|-------|----------------|
| `facts` | all CAT | C02 | C02 (append) | C01, C03–C12 |
| `provenance` | all CAT | C02 | C02 (append) | C01, C03–C12 |
| `uncertainties` | all CAT | C02, C06 | C02 (research), C06 (analysis notes) | C01, C03–C05, C07–C12 authority paths |
| `hard_constraints` | all CAT | — | kernel / intake only | all CAT |
| `user_preferences` | all CAT | — | kernel / intake only | all CAT |
| `goal_identity` | all CAT | — | kernel / intake only | all CAT |
| `analysis` | all CAT | C06 | C06 | all others |
| `recommendation` | all CAT | C01 | C01 | all others |
| `rendering` | all CAT | C03 | C03 | all others |
| `authority_state` | all CAT | — | external authority event only | all CAT |
| `execution_grants` | all CAT | — | kernel / authority event | all CAT |
| `failures` | all CAT | — | kernel / observe | all CAT (no FAIL/UNKNOWN→PASS) |
| `category_payload` | owning CAT | owning CAT | owning CAT (`apply_category_payload`) | other CAT ids |
| `proof_obligation_proposals` | all CAT | owning CAT | owning CAT (proposals only) | cannot commit kernel truth |
| `active_category` / `category_trace` | all CAT | router | apply / engines | reinterpret legacy taxonomy |

## Per-category `category_payload` writers (DOMAIN)

| ID | Name | WRITE (`category_payload` only) | Kernel non-owner reminder |
|----|------|----------------------------------|---------------------------|
| CAT:C01 | Advise / Plan / Decide | DecisionIR; `recommendation` owned separately | ≠ K3 CognitivePlan sole writer |
| CAT:C02 | Research | ResearchIR / facts+provenance append | — |
| CAT:C03 | Write / Rewrite / Communicate | WritingIR / `rendering` | — |
| CAT:C04 | Translate / Localize / Language Transform | LanguageTransferIR | ≠ legacy Plan; ≠ K3 plan |
| CAT:C05 | Learn | LearningIR | ≠ K2 Verify |
| CAT:C06 | Analyze / Compare / Extract | AnalysisIR | — |
| CAT:C07 | Work / Execute | WorkExecutionIR under grant | ≠ mint authority |
| CAT:C08 | Business | BusinessIR | ≠ K7 Recover |
| CAT:C09 | Code | CodeIR (generation ≠ BUILD_PASS) | ≠ K4 Privacy |
| CAT:C10 | Multimedia | MultimediaIR (no rights oracle) | ≠ K4 Authority |
| CAT:C11 | Career | CareerIR (USER_CLAIM ≠ VERIFIED_CREDENTIAL) | ≠ provenance oracle |
| CAT:C12 | Creative / Story / Roleplay | CreativeIR (canon overwrite requires confirm) | ≠ Capability registry |

## Single-writer check

- **`duplicate_writers=0`** for each envelope field’s lawful writer class.
- Category modules specialize `category_payload` only under `apply_category_payload`.
- Legacy taxonomy v1 collision IDs require migration to v2 before DOMAIN reinterpretation (`LEGACY_TAXONOMY_UNMIGRATED`).

## Evidence

Domain engines under `spe_runtime/categories/c0{1-9}_*` / `c1{0-2}_*`, ownership matrix tests in `test_xcat_domain_56b.py`, mutations M11/M14/M16.
