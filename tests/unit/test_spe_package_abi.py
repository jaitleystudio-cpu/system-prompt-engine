"""Tests for Open .spe Package Specification & Prompt ABI (M2)."""

from pathlib import Path
import pytest

from spe_runtime.spe_package.abi import (
    PromptABI,
    ToolDefinitionABI,
    lower_abi_to_provider,
)
from spe_runtime.spe_package.spec import (
    PackageVerificationError,
    SpePackage,
    inspect_package,
    migrate_package,
    pack_directory,
    unpack_package,
    verify_package_integrity,
)


def test_prompt_abi_lowering_to_all_providers():
    abi = PromptABI(
        system_identity="You are an enterprise code reviewer.",
        objectives=["Analyze pull requests for regressions", "Check test coverage"],
        invariants=["Maintain zero false positives on syntax errors"],
        negative_constraints=["Never approve unreviewed secrets in code"],
        output_schema={"type": "object", "properties": {"verdict": {"type": "string"}}},
        tools=[
            ToolDefinitionABI(
                name="run_linter",
                description="Runs project linter",
                parameters_schema={"type": "object", "properties": {"fix": {"type": "boolean"}}},
            )
        ],
        few_shot_examples=[{"input": "diff: +print('hello')", "output": "{\"verdict\": \"PASS\"}"}],
    )

    # 1. OpenAI
    openai_res = lower_abi_to_provider(abi, "openai")
    assert openai_res["target"] == "openai"
    assert "messages" in openai_res
    assert openai_res["messages"][0]["role"] == "system"
    assert "Never approve unreviewed secrets" in openai_res["messages"][0]["content"]
    assert len(openai_res["tools"]) == 1
    assert openai_res["response_format"]["json_schema"]["schema"] == abi.output_schema

    # 2. Anthropic
    anthropic_res = lower_abi_to_provider(abi, "anthropic")
    assert anthropic_res["target"] == "anthropic"
    assert "<system_instructions>" in anthropic_res["system"]
    assert "<prohibition>Never approve unreviewed secrets in code</prohibition>" in anthropic_res["system"]
    assert len(anthropic_res["tools"]) == 1

    # 3. Gemini
    gemini_res = lower_abi_to_provider(abi, "gemini")
    assert gemini_res["target"] == "gemini"
    assert "system_instruction" in gemini_res
    assert len(gemini_res["tools"][0]["function_declarations"]) == 1

    # 4. Local Open Weight
    local_res = lower_abi_to_provider(abi, "local")
    assert "<|im_start|>system" in local_res["chatml_prompt"]

    # 5. Cursor
    cursor_res = lower_abi_to_provider(abi, "cursor")
    assert "# You are an enterprise code reviewer." in cursor_res["cursorrules_content"]

    # 6. Windsurf
    windsurf_res = lower_abi_to_provider(abi, "windsurf")
    assert windsurf_res["target"] == "windsurf-rules"
    assert "## Invariant Enforcement" in windsurf_res["windsurfrules_content"]

    # 7. Generic Agent
    agent_res = lower_abi_to_provider(abi, "agent")
    assert agent_res["target"] == "generic-agent"
    assert "Behavioral Constraints:" in agent_res["system_prompt"]



def test_package_pack_unpack_verify(tmp_path: Path):
    pkg_src = tmp_path / "my_pkg"
    pkg = SpePackage.create_layout(pkg_src, package_id="spe.test.package", version="0.1.0")

    # Populate some content
    (pkg_src / "intent.json").write_text('{"goal": "secure routing"}', encoding="utf-8")
    (pkg_src / "requirements.json").write_text('{"reqs": ["REQ-1"]}', encoding="utf-8")

    archive = tmp_path / "package.spe.tar.gz"
    packed_path = pack_directory(pkg_src, archive)
    assert packed_path.exists()

    # Unpack to clean directory
    unpack_dest = tmp_path / "unpacked"
    unpacked_pkg = unpack_package(packed_path, unpack_dest)
    assert unpacked_pkg.manifest().package_id == "spe.test.package"

    # Verify integrity
    ver = verify_package_integrity(unpack_dest)
    assert ver["status"] == "PASS"

    # Inspect
    info = inspect_package(unpack_dest)
    assert info["has_intent"] is True
    assert info["has_requirements"] is True

    # Migration
    mig = migrate_package(unpack_dest, target_spec_version="0.2.0")
    assert mig["migrated"] is True
    assert unpacked_pkg.manifest().spec_version == "0.2.0"

    # Tamper test
    (unpack_dest / "intent.json").write_text('{"tampered": true}', encoding="utf-8")
    with pytest.raises(PackageVerificationError):
        verify_package_integrity(unpack_dest)
