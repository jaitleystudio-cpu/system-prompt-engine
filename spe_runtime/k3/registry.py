"""Frozen G1R-7R technique registry. K3 owns this table; nothing else may extend it."""

from __future__ import annotations

SELECTOR_VERSION = "k3.g1r7r"
SCHEMA_VERSION = "technique_selection.v1"
PLAN_SCHEMA_VERSION = "cognitive_plan.v1"
STRATEGY_SCHEMA_VERSION = "prompt_strategy.v1"
STANDARD_MAX_TECHNIQUES = 3

TECHNIQUE_IDS: tuple[str, ...] = (
    "ZERO_SHOT",
    "FEW_SHOT",
    "ROLE_PERSONA",
    "CONTEXTUAL",
    "STEP_BACK",
    "DECOMPOSE_PLAN_SOLVE",
    "RETRIEVE_REASON",
    "CRITIQUE_REVISE",
    "STRUCTURED_OUTPUT",
)

TECHNIQUE_PRIORITY: dict[str, int] = {
    "RETRIEVE_REASON": 0,
    "STRUCTURED_OUTPUT": 1,
    "DECOMPOSE_PLAN_SOLVE": 2,
    "CRITIQUE_REVISE": 3,
    "FEW_SHOT": 4,
    "CONTEXTUAL": 5,
    "ROLE_PERSONA": 6,
    "STEP_BACK": 7,
    "ZERO_SHOT": 8,
}

INCOMPATIBLE: frozenset[frozenset[str]] = frozenset(
    {frozenset({"ZERO_SHOT", "FEW_SHOT"})}
)

STRENGTH_RANK: dict[str, int] = {
    "MUST": 0,
    "SHOULD": 1,
    "PREFERENCE": 2,
    "HINT": 3,
    "PLAN": 4,
}

KEY_HINTS: dict[str, tuple[str, ...]] = {
    "RETRIEVE_REASON": ("evidence", "research", "citation", "cite", "source", "retrieval"),
    "STRUCTURED_OUTPUT": ("json", "schema", "structured", "format", "fields"),
    "CRITIQUE_REVISE": ("revise", "revision", "critique", "review", "improve", "repair"),
    "DECOMPOSE_PLAN_SOLVE": ("decompose", "subproblem", "stages", "steps"),
    "FEW_SHOT": ("example", "examples", "few_shot"),
    "ROLE_PERSONA": ("role", "persona", "expertise"),
    "CONTEXTUAL": ("context",),
    "STEP_BACK": ("principles", "step_back"),
}

PLAN_STEPS: dict[str, tuple[str, ...]] = {
    "DIRECT": ("understand", "produce"),
    "DECOMPOSE": ("identify_subproblems", "solve_parts", "synthesize"),
    "RETRIEVE_THEN_REASON": (
        "identify_evidence_needs",
        "gather_allowed_evidence",
        "synthesize",
    ),
    "COMPARE": ("define_criteria", "compare_candidates", "report"),
    "CRITIQUE_REVISE": ("draft", "critique", "revise_once"),
    "PLAN_THEN_EXECUTE": ("plan_steps", "prepare_execution_notes", "produce"),
    "STRUCTURED_ANALYSIS": ("map_schema", "fill_fields", "validate_shape"),
}

INSTRUCTION_MODE: dict[str, str] = {
    "DIRECT": "direct_instruction",
    "DECOMPOSE": "decompose_then_solve",
    "RETRIEVE_THEN_REASON": "evidence_then_synthesize",
    "COMPARE": "compare_then_report",
    "CRITIQUE_REVISE": "draft_critique_revise_once",
    "PLAN_THEN_EXECUTE": "plan_then_produce",
    "STRUCTURED_ANALYSIS": "schema_constrained",
}

IMPLEMENTED_XCAT: frozenset[str] = frozenset(
    {"CAT:C01", "CAT:C02", "CAT:C03", "CAT:C06", "CAT:C07"}
)
UNIMPLEMENTED_XCAT: frozenset[str] = frozenset(
    {"CAT:C04", "CAT:C05", "CAT:C08", "CAT:C09", "CAT:C10", "CAT:C11", "CAT:C12"}
)

# Explicit product labels only. Not inferred from goal prose.
DISPLAY_LABEL_XCAT: dict[str, str] = {
    "Research": "CAT:C02",
    "Analysis": "CAT:C06",
}
DISPLAY_LABEL_PROTOCOL: dict[str, str] = {
    "AI Assistant": "general",
    "Writing": "writing_communication",
    "Coding": "coding",
    "Research": "research",
    "Business": "business_strategy",
    "Education": "education",
    "Analysis": "data_statistics",
    "Structured Data": "data_statistics",
    "Creative": "creative_media",
    "Multilingual": "translation_localization",
    "Website / 3D": "ux_ui_web_design",
    "Image": "image_generation",
    "Video": "video_generation",
}

LAWFUL_DISPOSITIONS: frozenset[str] = frozenset({"SELECTED", "SAFE_DEFAULT"})
FAIL_DISPOSITIONS: frozenset[str] = frozenset({"NO_SELECTION", "UNKNOWN"})
