"""Category payload field specs (ProjectIR shapes from master architecture).

Only fields listed here are writable via apply_category_payload.
Do not invent extras beyond the architecture IR.
"""

from __future__ import annotations

# --- Domain specialty IRs (Task 56B engines) ---

C04_LANGUAGE_TRANSFER_FIELDS: frozenset[str] = frozenset(
    {
        "source_language",
        "target_language",
        "protected_terms",
        "localization_policy",
        "transliteration_policy",
        "alignment_map",
    }
)

C05_LEARNING_FIELDS: frozenset[str] = frozenset(
    {
        "learner_state",
        "concept_graph",
        "progression",
        "practice",
        "mastery_evidence",
    }
)

C08_BUSINESS_FIELDS: frozenset[str] = frozenset(
    {
        "customer",
        "market",
        "offer",
        "channels",
        "pricing",
        "unit_economics",
        "experiments",
        "metrics",
    }
)

C09_CODE_FIELDS: frozenset[str] = frozenset(
    {
        "repository",
        "architecture",
        "interfaces",
        "tests",
        "environment",
        "security_constraints",
        "performance_constraints",
        "rollback",
        "proof_artifacts",
    }
)

C10_MULTIMEDIA_FIELDS: frozenset[str] = frozenset(
    {
        "medium",
        "source_assets",
        "storyboard",
        "visual_audio_language",
        "timing",
        "rights_provenance",
        "visual_observations",
        "image_to_prompt_mode",
        "preserve_change_regions",
        "reference_image_roles",
        "target_adapter_requirements",
    }
)

C11_CAREER_FIELDS: frozenset[str] = frozenset(
    {
        "profile",
        "target_role",
        "evidence_of_skills",
        "gaps",
        "opportunities",
        "compensation_geography",
        "plan",
    }
)

C12_CREATIVE_FIELDS: frozenset[str] = frozenset(
    {
        "canon",
        "timeline",
        "characters",
        "knowledge_states",
        "relationships",
        "plot",
        "scenes",
        "roleplay_branching_franchise_state",
    }
)

# --- Existing category IRs (documented for payload validation when used) ---

C01_DECISION_FIELDS: frozenset[str] = frozenset(
    {
        "options",
        "criteria",
        "tradeoffs",
        "recommendation_rationale",
        "decision_record",
        "open_questions",
    }
)

C02_RESEARCH_FIELDS: frozenset[str] = frozenset(
    {
        "questions",
        "sources",
        "findings",
        "gaps",
        "confidence_notes",
        "citation_map",
    }
)

C03_WRITING_FIELDS: frozenset[str] = frozenset(
    {
        "audience",
        "purpose",
        "tone",
        "draft",
        "revision_goals",
        "style_constraints",
    }
)

C06_ANALYSIS_FIELDS: frozenset[str] = frozenset(
    {
        "subjects",
        "dimensions",
        "comparisons",
        "extractions",
        "limitations",
        "method_notes",
    }
)

C07_WORK_EXECUTION_FIELDS: frozenset[str] = frozenset(
    {
        "work_items",
        "preconditions",
        "execution_plan",
        "checkpoints",
        "rollback_notes",
        "outcome_observations",
    }
)

CATEGORY_PAYLOAD_FIELDS: dict[str, frozenset[str]] = {
    "CAT:C01": C01_DECISION_FIELDS,
    "CAT:C02": C02_RESEARCH_FIELDS,
    "CAT:C03": C03_WRITING_FIELDS,
    "CAT:C04": C04_LANGUAGE_TRANSFER_FIELDS,
    "CAT:C05": C05_LEARNING_FIELDS,
    "CAT:C06": C06_ANALYSIS_FIELDS,
    "CAT:C07": C07_WORK_EXECUTION_FIELDS,
    "CAT:C08": C08_BUSINESS_FIELDS,
    "CAT:C09": C09_CODE_FIELDS,
    "CAT:C10": C10_MULTIMEDIA_FIELDS,
    "CAT:C11": C11_CAREER_FIELDS,
    "CAT:C12": C12_CREATIVE_FIELDS,
}


def allowed_fields_for(category_id: str) -> frozenset[str]:
    fields = CATEGORY_PAYLOAD_FIELDS.get(category_id)
    if fields is None:
        raise ValueError(f"unknown category_id for payload spec: {category_id!r}")
    return fields
