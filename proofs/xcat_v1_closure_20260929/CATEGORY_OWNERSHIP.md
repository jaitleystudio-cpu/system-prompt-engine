# Category ownership matrix (Task 56B draft stub)

**Date:** 2026-09-29  
**Taxonomy:** DOMAIN v2  
**Law:** CATEGORY ≠ KERNEL OWNER; `duplicate_writers=0`

| Field / concern | READ | PROPOSE | WRITE | MUST_NOT_WRITE |
|-----------------|------|---------|-------|----------------|
| `facts` | all CAT | C02 | C02 (append) | C01,C03–C12 |
| `provenance` | all CAT | C02 | C02 (append) | C01,C03–C12 |
| `uncertainties` | all CAT | C02,C06 | C02 (research), C06 (analysis notes) | C01,C03–C05,C07–C12 authority paths |
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
| `active_category` / `category_trace` | all CAT | router | apply / engines | reinterpret legacy taxonomy |

Per-category `category_payload` writers (DOMAIN):

| ID | Name | WRITE (`category_payload` fields only) |
|----|------|----------------------------------------|
| CAT:C01 | Advise / Plan / Decide | decision IR via decide engine (`recommendation` owned separately) |
| CAT:C02 | Research | research IR / facts+provenance append |
| CAT:C03 | Write / Rewrite / Communicate | writing IR / `rendering` |
| CAT:C04 | Translate / Localize / Language Transform | LanguageTransferIR |
| CAT:C05 | Learn | LearningIR |
| CAT:C06 | Analyze / Compare / Extract | analysis IR |
| CAT:C07 | Work / Execute | work execution IR under grant |
| CAT:C08 | Business | BusinessIR |
| CAT:C09 | Code | CodeIR (generation ≠ BUILD_PASS) |
| CAT:C10 | Multimedia | MultimediaIR (no rights oracle) |
| CAT:C11 | Career | CareerIR (USER_CLAIM ≠ VERIFIED_CREDENTIAL) |
| CAT:C12 | Creative / Story / Roleplay | CreativeIR (canon overwrite requires confirm) |

**duplicate_writers:** `0` — each envelope field has exactly one lawful writer class; category modules specialize `category_payload` only under `apply_category_payload`.

**Legacy taxonomy v1:** collision IDs C04/C05/C08–C12 require migration to v2 before any DOMAIN reinterpretation (`LEGACY_TAXONOMY_UNMIGRATED`).
