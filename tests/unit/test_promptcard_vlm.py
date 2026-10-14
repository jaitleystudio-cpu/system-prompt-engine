"""Unit tests for PromptCard VLM Reverse-Engineering Engine and Entitlement Integration."""

import json
import pytest
from spe_runtime.entitlement.manager import EntitlementManager
from spe_runtime.entitlement.models import PlanTier
from spe_runtime.promptcard.engine import (
    PromptCardVlmEngine,
    PROMPTCARD_VLM_SYSTEM_PROMPT,
)


def test_vlm_system_prompt_structure():
    """Verify that the VLM system prompt contains the 12-clause grammar and JSON schema."""
    assert "Strict 12-Clause Semicolon Grammar" in PROMPTCARD_VLM_SYSTEM_PROMPT
    assert "Clause 1 [Primary Setting & Ground Plane]" in PROMPTCARD_VLM_SYSTEM_PROMPT
    assert "Clause 12 [Intended Purpose, Genre & Aesthetic Reference]" in PROMPTCARD_VLM_SYSTEM_PROMPT
    assert "4 Style Tag Pills" in PROMPTCARD_VLM_SYSTEM_PROMPT
    assert "REQUIRED OUTPUT SCHEMA (STRICT JSON)" in PROMPTCARD_VLM_SYSTEM_PROMPT


def test_offline_deterministic_analysis_gta_benchmark():
    """Verify ground-truth GTA VI artwork reverse engineering matches benchmark specifications."""
    manager = EntitlementManager()
    manager.upgrade_plan("user_pro_01", PlanTier.PRO)
    engine = PromptCardVlmEngine(entitlement_manager=manager)

    result = engine.analyze_offline(
        context_hint="gta waterfront dock",
        aspect_ratio="16:9",
        customer_id="user_pro_01",
    )

    assert result.status == "completed"
    assert result.mode == "OFFLINE_DETERMINISTIC"
    assert result.inference_cost_usd == 0.0

    # 1. Check 12-clause semicolon grammar in English prompt
    en_clauses = [c.strip() for c in result.prompts.en.split(";")]
    assert len(en_clauses) >= 12, f"Expected at least 12 clauses, got {len(en_clauses)}"
    assert "tropical coast wooden dock" in en_clauses[0]
    assert any("woman on the left" in c for c in en_clauses)
    assert any("dominant colors:" in c for c in en_clauses)
    assert any("materials:" in c for c in en_clauses)
    assert any("16:9 aspect ratio" in c for c in en_clauses)
    assert any("intended as promotional game art for GTA VI" in c for c in en_clauses)

    # 2. Check 4 style tag pills
    assert len(result.tags) == 4
    assert "high illustration" in result.tags
    assert "comic line art" in result.tags
    assert "urban crime vibe" in result.tags
    assert "game promo art" in result.tags

    # 3. Check multilingual parity (EN, 中文, 日本語)
    assert len(result.prompts.zh) > 50
    assert "热带海岸木质码头" in result.prompts.zh
    assert "GTA VI" in result.prompts.zh
    assert len(result.prompts.ja) > 50
    assert "熱帯沿岸の木製桟橋" in result.prompts.ja

    # 4. Check structured JSON schema fields
    sj = result.structured_json
    assert sj.setting == "tropical coast wooden dock"
    assert len(sj.subjects) == 2
    assert "blue" in sj.color_palette
    assert "wood grain" in sj.materials_and_textures
    assert sj.aspect_ratio == "16:9"

    # 5. Serialization integrity
    data_dict = result.to_dict()
    assert json.dumps(data_dict) is not None
    assert data_dict["inferenceCostUsd"] == 0.0


def test_entitlement_gating_for_promptcard():
    """Verify that FREE users are blocked from advanced VLM while paid tiers (PRO, TEAM, ENTERPRISE) pass."""
    manager = EntitlementManager()

    # Free customer
    free_cust = manager.get_or_create_customer("free_user_01")
    assert manager.can_access_promptcard_vlm("free_user_01") is False

    engine = PromptCardVlmEngine(entitlement_manager=manager)
    with pytest.raises(PermissionError, match="requires an active PRO, TEAM, or ENTERPRISE subscription"):
        engine.analyze_offline(customer_id="free_user_01")

    # Pro customer upgrade
    manager.upgrade_plan("free_user_01", PlanTier.PRO)
    assert manager.can_access_promptcard_vlm("free_user_01") is True
    res_pro = engine.analyze_offline(customer_id="free_user_01")
    assert res_pro.status == "completed"

    # Team customer
    manager.upgrade_plan("team_user_01", PlanTier.TEAM)
    assert manager.can_access_promptcard_vlm("team_user_01") is True
    res_team = engine.analyze_offline(customer_id="team_user_01")
    assert res_team.status == "completed"

    # Enterprise customer
    manager.upgrade_plan("ent_user_01", PlanTier.ENTERPRISE)
    assert manager.can_access_promptcard_vlm("ent_user_01") is True
    res_ent = engine.analyze_offline(customer_id="ent_user_01")
    assert res_ent.status == "completed"


def test_fashion_editorial_mode_deconstruction():
    """Verify Section 20.A Fashion & Editorial Photography mode deconstruction."""
    engine = PromptCardVlmEngine()
    result = engine.analyze_offline(
        context_hint="runway fashion couture editorial",
        aspect_ratio="4:5",
    )

    assert result.status == "completed"
    assert result.mode == "OFFLINE_DETERMINISTIC"
    assert result.inference_cost_usd == 0.0

    # 12-clause semicolon structure
    clauses = [c.strip() for c in result.prompts.en.split(";")]
    assert len(clauses) >= 12
    assert "high-end minimalist studio" in clauses[0]
    assert any("sheer flowing organza" in c or "sheer organza" in c for c in clauses)
    assert any("85mm" in c for c in clauses)
    assert any("4:5 aspect ratio" in c for c in clauses)

    # 4 style tags
    assert result.tags == ["haute couture", "studio editorial", "rim lighting", "fashion lookbook"]

    # Multilingual parity
    assert "极简高端摄影棚" in result.prompts.zh
    assert "白ホリゾント" in result.prompts.ja

    # Structured JSON
    sj = result.structured_json
    assert sj.aspect_ratio == "4:5"
    assert "ivory white" in sj.color_palette
    assert "sheer organza" in sj.materials_and_textures


def test_generic_mode_deconstruction():
    """Verify generalized deterministic image deconstruction fallback."""
    engine = PromptCardVlmEngine()
    result = engine.analyze_offline(
        context_hint="cyberpunk neo tokyo street",
        aspect_ratio="16:9",
    )

    assert result.status == "completed"
    clauses = [c.strip() for c in result.prompts.en.split(";")]
    assert len(clauses) >= 12
    assert "architectural ground plane in cyberpunk neo tokyo street" in clauses[0]
    assert len(result.tags) == 4
    assert result.structured_json.aspect_ratio == "16:9"

