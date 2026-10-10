"""
Unit and Adversarial Tests for Master Prompt 4:
Frictionless Production Adoption & Sovereign Operations Governor (SOV-E10).
"""

import json
from pathlib import Path
import pytest

from spe_runtime.sov import (
    AdoptionExecutionResult,
    IDEDetectionResult,
    ProgressiveCard,
    RevertResult,
    SOVKernel,
)


def test_ide_workspace_auto_detection(tmp_path: Path):
    """Law 2: Auto-detects active AI coding assistant and IDE environments."""
    # 1. Empty workspace defaults to universal trio
    detected = SOVKernel.detect_workspace_ides(tmp_path)
    assert "Claude Code" in detected
    assert "Cursor" in detected
    assert "VS Code / GitHub Copilot" in detected

    # 2. Specifically configured workspace with Cursor and Windsurf
    (tmp_path / ".cursorrules").write_text("# cursor rules", encoding="utf-8")
    (tmp_path / ".windsurfrules").write_text("# windsurf rules", encoding="utf-8")
    detected_specific = SOVKernel.detect_workspace_ides(tmp_path)
    assert "Cursor" in detected_specific
    assert "Windsurf" in detected_specific


def test_adopt_repository_sub_3_second_guarantee(tmp_path: Path):
    """Law 1: Zero-config adopt completes in < 3 seconds with scaffolded targets."""
    # Pre-populate a git-like repo directory
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "index.ts").write_text("console.log('hello');", encoding="utf-8")

    res = SOVKernel.adopt_repository(root_dir=tmp_path, skill_name="test-assistant", dry_run=False)
    assert isinstance(res, AdoptionExecutionResult)
    assert res.status == "ADOPTED_SOVEREIGN"
    assert res.duration_seconds < 3.0
    assert res.guarantee_satisfied is True
    assert Path(res.rollback_marker_path).exists()

    # Check scaffolded targets exist on disk
    assert (tmp_path / ".claude/skills/test-assistant/SKILL.md").exists()
    assert (tmp_path / ".cursorrules").exists()
    assert (tmp_path / ".cursor/rules/test-assistant.mdc").exists()
    assert (tmp_path / ".github/copilot-instructions.md").exists()
    assert (tmp_path / ".spe/manifest.json").exists()


def test_adopt_dry_run_creates_no_files(tmp_path: Path):
    """Adoption in dry-run mode computes plan without touching disk."""
    res = SOVKernel.adopt_repository(root_dir=tmp_path, skill_name="dry-skill", dry_run=True)
    assert res.status == "ADOPTED_SOVEREIGN"
    assert len(res.scaffolded_targets) > 0

    # Ensure no files were actually written
    assert not (tmp_path / ".claude").exists()
    assert not (tmp_path / ".cursorrules").exists()
    assert not (tmp_path / ".spe").exists()


def test_zero_breakage_rollback_restoration(tmp_path: Path):
    """Law 3: spe revert cleanly restores pre-existing files and unlinks new files."""
    # 1. Create a pre-existing .cursorrules
    cursorrules = tmp_path / ".cursorrules"
    original_cursorrules = "# Original custom developer rules\nkeep_this: true\n"
    cursorrules.write_text(original_cursorrules, encoding="utf-8")

    # 2. Adopt
    adopt_res = SOVKernel.adopt_repository(root_dir=tmp_path, skill_name="my-skill", dry_run=False)
    assert cursorrules.read_text(encoding="utf-8") != original_cursorrules

    # 3. Revert
    revert_res = SOVKernel.revert_adoption(root_dir=tmp_path, dry_run=False)
    assert isinstance(revert_res, RevertResult)
    assert revert_res.status == "REVERTED_CLEAN"
    assert revert_res.clean_baseline is True

    # Pre-existing file content must be exactly restored bit-for-bit
    assert cursorrules.read_text(encoding="utf-8") == original_cursorrules
    assert ".cursorrules" in revert_res.files_restored

    # Newly created skill and marker files must be completely removed
    assert not (tmp_path / f".cursor/rules/my-skill.mdc").exists()
    assert not (tmp_path / ".spe/rollback_marker.json").exists()
    assert any(".cursor/rules/my-skill.mdc" in f for f in revert_res.files_deleted)


def test_revert_with_no_rollback_marker(tmp_path: Path):
    """Law 3: Attempting revert without rollback marker returns NO_ROLLBACK_MARKER."""
    revert_res = SOVKernel.revert_adoption(root_dir=tmp_path, dry_run=False)
    assert revert_res.status == "NO_ROLLBACK_MARKER"
    assert revert_res.clean_baseline is False
    assert len(revert_res.files_restored) == 0
    assert len(revert_res.files_deleted) == 0


def test_revert_with_corrupt_rollback_marker(tmp_path: Path):
    """Law 3: Corrupt marker file is safely reported without crashing."""
    spe_dir = tmp_path / ".spe"
    spe_dir.mkdir(parents=True, exist_ok=True)
    marker = spe_dir / "rollback_marker.json"
    marker.write_text("CORRUPTED NOT JSON{{{", encoding="utf-8")

    revert_res = SOVKernel.revert_adoption(root_dir=tmp_path, dry_run=False)
    assert revert_res.status == "CORRUPT_ROLLBACK_MARKER"
    assert revert_res.clean_baseline is False


def test_two_speed_progressive_disclosure():
    """Law 4: Simple mode renders 4-part clean cards; Pro mode provides deep epistemic manifold."""
    # 1. Simple mode
    card_simple = SOVKernel.render_progressive_disclosure({"task": "build_api"}, mode="simple")
    assert isinstance(card_simple, ProgressiveCard)
    assert card_simple.mode == "simple"
    assert card_simple.protected_invariants_count == 3
    assert "Protected Invariant Card" in card_simple.rendered_payload
    assert card_simple.local_token_savings_pct == 100
    assert card_simple.pro_details is None

    # 2. Pro mode
    card_pro = SOVKernel.render_progressive_disclosure({"task": "build_api"}, mode="pro")
    assert card_pro.mode == "pro"
    assert "Pro Omega Epistemic Manifold" in card_pro.rendered_payload
    assert "Kleene-4" in card_pro.rendered_payload
    assert "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d" in card_pro.rendered_payload
    assert card_pro.pro_details is not None
    assert card_pro.pro_details["lattice"] == "Kleene-4"


def test_privacy_and_seo_governor():
    """Law 5: Self-balancing SEO & Privacy integrity."""
    # 1. Private workspace run with zero trackers
    clean_workspace = {
        "is_workspace": True,
        "is_cli": False,
        "has_ads": False,
        "has_trackers": False,
    }
    gov_res = SOVKernel.evaluate_privacy_and_seo_governor(clean_workspace)
    assert gov_res["sanctuary_honored"] is True
    assert gov_res["air_gap_enforced"] is True
    assert gov_res["crawler_indexable"] is False
    assert gov_res["robots_directive"] == "noindex, nofollow"
    assert gov_res["ad_sanctuary_status"] == "SANCTUARY_PROTECTED"

    # 2. Workspace with intrusive ad/tracker violation
    dirty_workspace = {
        "is_workspace": True,
        "is_cli": True,
        "has_ads": True,
        "has_trackers": False,
    }
    gov_res_dirty = SOVKernel.evaluate_privacy_and_seo_governor(dirty_workspace)
    assert gov_res_dirty["sanctuary_honored"] is False
    assert gov_res_dirty["ad_sanctuary_status"] == "VIOLATION_DETECTED"

    # 3. Public web landing page is indexable
    public_landing = {
        "is_workspace": False,
        "is_cli": False,
        "has_ads": False,
        "has_trackers": False,
    }
    gov_pub = SOVKernel.evaluate_privacy_and_seo_governor(public_landing)
    assert gov_pub["crawler_indexable"] is True
    assert gov_pub["robots_directive"] == "index, follow"
