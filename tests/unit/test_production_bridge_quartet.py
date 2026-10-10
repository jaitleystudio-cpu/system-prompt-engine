"""
Unit and Integration Tests for Production Bridge Quartet Adapters:
- ZTESAdapter
- AEQHostileAdapter
- UTGMoatAdapter
- SOVOperationsAdapter
And the root spe export facade.
"""

from pathlib import Path
import pytest

import spe
from spe_runtime.production_bridge import (
    AEQHostileAdapter,
    SOVOperationsAdapter,
    UTGMoatAdapter,
    ZTESAdapter,
)


def test_spe_root_exports():
    """Verify that root `spe` module exports all 4 kernels and adapters."""
    assert hasattr(spe, "ZTESKernel")
    assert hasattr(spe, "AEQKernel")
    assert hasattr(spe, "UTGKernel")
    assert hasattr(spe, "SOVKernel")
    assert hasattr(spe, "ZTESAdapter")
    assert hasattr(spe, "AEQHostileAdapter")
    assert hasattr(spe, "UTGMoatAdapter")
    assert hasattr(spe, "SOVOperationsAdapter")
    assert hasattr(spe, "Kleene4Value")


def test_ztes_adapter_facade():
    """Verify ZTESAdapter methods via production bridge."""
    # 1. Unicode sanitization
    res_uni = ZTESAdapter.sanitize_unicode("Clean prompt without hidden chars")
    assert res_uni["is_clean"] is True
    assert res_uni["sanitized_text"] == "Clean prompt without hidden chars"

    # 2. Polyglot detection
    res_poly = ZTESAdapter.detect_polyglot(b"\x7fELF\x02\x01\x01\x00# header")
    assert res_poly["has_polyglot"] is True
    assert res_poly["error_code"] == "ERR-SEC-POLYGLOT"

    # 3. Ambient authority stripping
    env_clean = ZTESAdapter.enforce_zero_ambient_authority({"OPENAI_API_KEY": "sk-123", "SAFE_VAR": "ok"})
    assert "OPENAI_API_KEY" not in env_clean
    assert env_clean["SAFE_VAR"] == "ok"

    # 4. Full skill audit
    clean_code = "def add(a: int, b: int) -> int:\n    return a + b\n"
    res_audit = ZTESAdapter.audit_skill(clean_code, requested_permissions=["READ_LOCAL_STATE"])
    assert res_audit["qualified"] is True
    assert res_audit["ast_safe"] is True


def test_aeq_hostile_adapter_facade():
    """Verify AEQHostileAdapter methods via production bridge."""
    sample_code = """
def check_limit(val: int) -> bool:
    if val > 100:
        return False
    return True
"""
    # 1. Synthesize hostile battery
    battery = AEQHostileAdapter.synthesize_hostile_battery(sample_code)
    assert len(battery) >= 3
    assert any(m["order_k"] == 1 for m in battery)
    assert any(m["order_k"] == 3 for m in battery)

    # 2. Evaluate verifier adequacy
    def strict_verifier(code: str) -> bool:
        return code == sample_code

    eval_res = AEQHostileAdapter.evaluate_verifier(strict_verifier, sample_code)
    assert eval_res["verdict"] == "VERIFIER_QUALIFIED"
    assert eval_res["anti_lucky_pass_passed"] is True

    # 3. Tri-origin discrimination
    tri = AEQHostileAdapter.discriminate_tri_origin(baseline_pass=True, mutant_pass=True)
    assert tri["origin"] == "ORIGIN_V"

    # 4. Retraction DAG
    dag = {"A": [], "B": ["A"]}
    bisect = AEQHostileAdapter.causal_bisect_retraction(dag, invalidated_node="A")
    assert "B" in bisect["affected_nodes_topological"]


def test_utg_moat_adapter_facade():
    """Verify UTGMoatAdapter methods via production bridge."""
    # 1. Theorem binding
    thm = UTGMoatAdapter.bind_theorem("execution_state_ledger")
    assert "Chaudhary et al." in thm["authors"]
    assert len(thm["prompt_card"]) > 20

    # 2. Kleene-4 join
    join_res = UTGMoatAdapter.join_kleene4("UNKNOWN", "TRUE")
    assert join_res == "TRUE"
    join_conflict = UTGMoatAdapter.join_kleene4("TRUE", "FALSE")
    assert join_conflict == "CONTRADICTION"

    # 3. Wilson score calculation
    wilson_score = UTGMoatAdapter.compute_wilson(successes=95, trials=100)
    assert wilson_score > 0.85

    # 4. Canonical WASM freeze
    assert UTGMoatAdapter.verify_canonical_wasm() is True

    # 5. Copy purity
    purity = UTGMoatAdapter.verify_copy_purity("This tool delivers mathematical invariants.")
    assert purity["is_pure"] is True


def test_sov_operations_adapter_facade(tmp_path: Path):
    """Verify SOVOperationsAdapter methods via production bridge."""
    # 1. Adopt repository
    res_adopt = SOVOperationsAdapter.adopt_repository(root_dir=str(tmp_path), skill_name="bridge-skill")
    assert res_adopt["status"] == "ADOPTED_SOVEREIGN"
    assert res_adopt["guarantee_satisfied"] is True
    assert (tmp_path / ".claude/skills/bridge-skill/SKILL.md").exists()

    # 2. Revert repository
    res_revert = SOVOperationsAdapter.revert_adoption(root_dir=str(tmp_path))
    assert res_revert["status"] == "REVERTED_CLEAN"
    assert not (tmp_path / ".claude/skills/bridge-skill/SKILL.md").exists()

    # 3. Progressive disclosure
    simple_card = SOVOperationsAdapter.render_progressive_disclosure({"task": "audit"}, mode="simple")
    assert simple_card["mode"] == "simple"
    assert "Protected Invariant Card" in simple_card["rendered_payload"]

    pro_card = SOVOperationsAdapter.render_progressive_disclosure({"task": "audit"}, mode="pro")
    assert pro_card["mode"] == "pro"
    assert "Kleene-4" in pro_card["rendered_payload"]

    # 4. Privacy & SEO
    priv = SOVOperationsAdapter.evaluate_privacy_and_seo({"is_workspace": True, "has_ads": False})
    assert priv["sanctuary_honored"] is True
