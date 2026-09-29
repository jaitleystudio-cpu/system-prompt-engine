# Category protocols — payload IR + proof obligations

**Date:** 2026-09-29  
**Task:** 56B  
**Field specs:** `spe_runtime/categories/payloads.py`  
**Apply gate:** `spe_runtime/categories/apply.py`  
**Global invariants:** X01–X10 in `spe_runtime/xcat/invariants.py`

## Shared laws (all CAT:C01–C12)

- Specialize **`category_payload`** (+ `active_category`, `proof_obligation_proposals`, `category_trace`) only.
- MUST NOT write: facts, provenance, uncertainties (except historical C02 research append paths), hard_constraints, user_preferences, goal_identity, authority_state, execution_grants.
- Forbidden payload keys (authority/EXECUTED/VERIFIED_SUCCESS/PROMOTE/…): reject.
- Unknown IR fields: reject.
- CATEGORY ≠ KERNEL OWNER; `duplicate_writers=0`.

## Payload IR list (writable fields)

| ID | IR name | Allowed `category_payload` fields |
|----|---------|-----------------------------------|
| CAT:C01 | DecisionIR | options, criteria, tradeoffs, recommendation_rationale, decision_record, open_questions |
| CAT:C02 | ResearchIR | questions, sources, findings, gaps, confidence_notes, citation_map |
| CAT:C03 | WritingIR | audience, purpose, tone, draft, revision_goals, style_constraints |
| CAT:C04 | LanguageTransferIR | source_language, target_language, protected_terms, localization_policy, transliteration_policy, alignment_map |
| CAT:C05 | LearningIR | learner_state, concept_graph, progression, practice, mastery_evidence |
| CAT:C06 | AnalysisIR | subjects, dimensions, comparisons, extracted, limitations, method_notes |
| CAT:C07 | WorkExecutionIR | work_items, preconditions, execution_plan, checkpoints, rollback_notes, outcome_observations |
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
