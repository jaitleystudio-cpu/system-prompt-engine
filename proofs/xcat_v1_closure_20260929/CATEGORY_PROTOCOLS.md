# Category protocols — payload IR + proof obligations

**Date:** 2026-09-29  
**Task:** 56B  
**Field specs:** `spe_runtime/categories/payloads.py`  
**Apply gate:** `spe_runtime/categories/apply.py`  
**Global invariants:** X01–X10 in `spe_runtime/xcat/invariants.py`

## Shared laws (all CAT:C01–C12)

- Specialize **`category_payload`** (+ `active_category`, `proof_obligation_proposals`, `category_trace`) only on the DOMAIN production path.
- MUST NOT write: facts, provenance, uncertainties, hard_constraints, user_preferences, goal_identity, analysis, recommendation, rendering, authority_state, execution_grants.
- Legacy `decide` / `research` / `communicate` / `analyze` still exist as `LEGACY_COMPATIBILITY` and are not DOMAIN writers (`LEGACY_CATEGORY_CALLSITE_AUDIT.md`).
- Forbidden payload keys (`EXECUTED`, `VERIFIED_SUCCESS`, `PROMOTE`, …) are rejected. Ratified C07 field names `authority` and `receipt` are payload data only and do not write kernel authority or receipts.
- Unknown IR fields: reject.
- CATEGORY ≠ KERNEL OWNER; category direct canonical writers = 0.

## Payload IR list (writable fields)

| ID | IR name | Allowed `category_payload` fields |
|----|---------|-----------------------------------|
| CAT:C01 | DecisionProjectIR | options, criteria, constraints, evidence, uncertainty, sensitivity, reversibility, decision_authority |
| CAT:C02 | ResearchProjectIR | question, search_strategy, source_classes, freshness, contradiction_map, gaps, synthesis |
| CAT:C03 | WritingProjectIR | communicative_goal, audience, facts_claims, voice, format, prohibited_claims |
| CAT:C04 | LanguageTransferIR | source_language, target_language, protected_terms, localization_policy, transliteration_policy, alignment_map |
| CAT:C05 | LearningIR | learner_state, concept_graph, progression, practice, mastery_evidence |
| CAT:C06 | AnalysisProjectIR | source_objects, dimensions, extraction, normalization, calculations, anomalies, conclusions |
| CAT:C07 | WorkExecutionProjectIR | desired_action, authority, credentials_reference, reversibility, approvals, postconditions, receipt |
| CAT:C08 | BusinessIR | customer, market, offer, channels, pricing, unit_economics, experiments, metrics |
| CAT:C09 | CodeIR | repository, architecture, interfaces, tests, environment, security_constraints, performance_constraints, rollback, proof_artifacts |
| CAT:C10 | MultimediaIR | medium, source_assets, storyboard, visual_audio_language, timing, rights_provenance, visual_observations, image_to_prompt_mode, preserve_change_regions, reference_image_roles, target_adapter_requirements |
| CAT:C11 | CareerIR | profile, target_role, evidence_of_skills, gaps, opportunities, compensation_geography, plan |
| CAT:C12 | CreativeIR | canon, timeline, characters, knowledge_states, relationships, plot, scenes, roleplay_branching_franchise_state |

## Category-local anti-laundering (beyond X01–X10)

| ID | Rule |
|----|------|
| C04 | HUMAN_CERTIFIED localization requires `alignment_map` evidence |
| C05 | MUST NOT claim MASTERED without `mastery_evidence` |
| C08 | MUST NOT elevate hypothesis / experiment plan → completed/fact |
| C09 | Generation ≠ `BUILD_PASS` / `TEST_PASS` / `VERIFIED` |
| C10 | `PUBLICLY_VIEWABLE ≠ LICENSED`; no rights-oracle claims |
| C11 | `USER_CLAIM ≠ VERIFIED_CREDENTIAL` without verification artifact |
| C12 | Silent canon overwrite forbidden; requires explicit confirm |

## Proof obligations (master-arch scoped)

Categories may **propose** `proof_obligation_proposals` to kernel owners. They never commit kernel truth themselves.

| Scope | Obligation |
|-------|------------|
| All categories | Preserve X01–X10 on handoff; no UNKNOWN→PASS; no authority self-escalation |
| C01–C07 specialty | Domain IR validation + ownership as above; C07 still consumes external grants only |
| **C08 / C10 / C11** | **Global invariants only** for kernel proof planes — Business / Multimedia / Career payloads do not invent new verification, licensing, or credential oracles; proposals only |
| C09 | Code generation may propose proof artifacts; never asserts BUILD_PASS |
| C12 | Canon changes require confirm; no silent franchise overwrite |

No hosting. No network. No merge of PR #56 under this document alone.
