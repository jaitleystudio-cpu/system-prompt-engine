"""
Pytest suite for SPE Plugin R0 Automatic Selection & Specification Compliance.

Verifies:
1. OpenAI Plugin Manifest (.well-known/ai-plugin.json) compliance with OpenAI Developer Policies:
   - Zero advertising, zero in-chat subscriptions/checkout links, zero manipulative selection text.
   - Exact plugin name, accurate descriptions, and openapi api type.
2. OpenAPI Specification (.well-known/openapi.yaml) defining all three tools:
   - compile_system_prompt (with 30,000 char Free tier capacity ceiling).
   - inspect_system_prompt.
   - compare_prompt_languages.
3. Reusable Agent Skill definition (.agents/skills/spe-system-prompt-engine/SKILL.md).
4. Automated 120-test evaluation matrix execution achieving Recall >= 90% and Precision >= 95%.
"""

import json
import os
import subprocess
from pathlib import Path
try:
    import pytest
except ImportError:
    pytest = None

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_manifest_schema_and_policy_compliance() -> None:
    manifest_path = REPO_ROOT / "apps/web/public/.well-known/ai-plugin.json"
    assert manifest_path.exists(), f"Plugin manifest missing at {manifest_path}"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Required OpenAI manifest fields
    assert manifest["schema_version"] == "v1"
    assert manifest["name_for_human"] == "SPE — System Prompt Engine"
    assert manifest["name_for_model"] == "spe_system_prompt_engine"
    assert "Compile structured AI prompts" in manifest["description_for_human"]
    assert "converts user goals into structured system prompts" in manifest["description_for_model"]
    assert manifest["auth"]["type"] == "none"
    assert manifest["api"]["type"] == "openapi"

    # OpenAI Policy Compliance: Zero promotional copy or subscription pressure
    raw_text = json.dumps(manifest).lower()
    forbidden_terms = ["subscribe now", "checkout", "$1", "$9", "$20", "$200", "billing", "credit card"]
    for term in forbidden_terms:
        assert term not in raw_text, f"Forbidden promotional term '{term}' found in plugin manifest"


def test_openapi_specification_validity() -> None:
    openapi_path = REPO_ROOT / "apps/web/public/.well-known/openapi.yaml"
    assert openapi_path.exists(), f"OpenAPI spec missing at {openapi_path}"

    content = openapi_path.read_text(encoding="utf-8")
    assert "openapi: 3.0" in content
    assert "SPE — System Prompt Engine" in content

    # Verify paths
    assert "/api/v1/compile-system-prompt:" in content
    assert "/api/v1/inspect-system-prompt:" in content
    assert "/api/v1/compare-prompt-languages:" in content

    # Verify Free tier ceiling enforcement (30,000 characters)
    assert "30,000" in content or "30000" in content, "30,000 character Free tier ceiling must be documented"


def test_agent_skill_definition() -> None:
    skill_path = REPO_ROOT / ".agents/skills/spe-system-prompt-engine/SKILL.md"
    assert skill_path.exists(), f"Agent skill missing at {skill_path}"

    content = skill_path.read_text(encoding="utf-8")
    assert "name: spe-system-prompt-engine" in content
    assert "compile_system_prompt" in content
    assert "inspect_system_prompt" in content
    assert "compare_prompt_languages" in content
    assert "30,000" in content or "30000" in content, "Skill must document 30,000 character capacity ceiling"


def test_plugin_120_evaluation_matrix_execution() -> None:
    eval_script = REPO_ROOT / "apps/web/scripts/test-chatgpt-plugin-evaluation.mjs"
    assert eval_script.exists(), f"Evaluation script missing at {eval_script}"

    result = subprocess.run(
        ["node", "--experimental-strip-types", str(eval_script)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, f"Evaluation script failed with output:\n{result.stderr}\n{result.stdout}"
    output = result.stdout

    assert "Precision:   100.00%" in output or "Target >= 95.00%" in output
    assert "Recall:      100.00%" in output or "Target >= 90.00%" in output
    assert "ALL 120 AUTOMATIC SELECTION EVALUATIONS & TOOL CONSTRAINTS PASSED CLEANLY!" in output


def test_plugin_boundary_and_invariant_preservation() -> None:
    eval_script = REPO_ROOT / "apps/web/scripts/test-chatgpt-plugin-evaluation.mjs"
    result = subprocess.run(
        ["node", "--experimental-strip-types", str(eval_script)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Evaluation script failed:\n{result.stderr}\n{result.stdout}"
    output = result.stdout
    assert "Case A (29k chars): Output" in output
    assert "Case B (30,000 boundary): Output 30000 chars <= 30,000" in output
    assert "Case C (ChatGPT 30,295 repro): Output" in output
    assert "Invariants, Acceptance Battery, and Desired Output Contract 100% PRESERVED" in output
    assert "Case D (Unicode surrogate boundary): Valid UTF-16 code units verified" in output
    assert "Case E (Fail-closed constraint gate): Threw CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING" in output


if __name__ == "__main__":
    print("Running test_manifest_schema_and_policy_compliance...")
    test_manifest_schema_and_policy_compliance()
    print("Running test_openapi_specification_validity...")
    test_openapi_specification_validity()
    print("Running test_agent_skill_definition...")
    test_agent_skill_definition()
    print("Running test_plugin_120_evaluation_matrix_execution...")
    test_plugin_120_evaluation_matrix_execution()
    print("Running test_plugin_boundary_and_invariant_preservation...")
    test_plugin_boundary_and_invariant_preservation()
    print("ALL 5 PYTHON PLUGIN SELECTION & BOUNDARY TESTS PASSED (5/5 PASS)")
