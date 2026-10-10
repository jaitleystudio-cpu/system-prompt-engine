"""
tests/unit/test_universal_specification_engine.py
Unit tests for the Universal Specification Engine in spe_runtime.prompt.
"""
from __future__ import annotations

import json
import pytest

from spe_runtime.prompt.universal_specification_engine import (
    AuditedTool,
    PluginAuditor,
    SpecificationVolume,
    TargetModel,
    ToolStatus,
    UniversalSpecificationEngine,
)


def test_universal_engine_compiles_all_target_models():
    """Verify that all 8 target models generate target-specific syntax."""
    request = "Build a privacy-preserving local offline encrypted vector database."
    
    # 1. Claude 3.7
    pkg_claude = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.CLAUDE_3_7,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_claude = pkg_claude.sections[1].content
    assert "<system_instructions>" in sec2_claude
    assert "<strict_invariants>" in sec2_claude
    assert "</system_instructions>" in sec2_claude

    # 2. ChatGPT o3
    pkg_chatgpt = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.CHATGPT_O3,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_gpt = pkg_chatgpt.sections[1].content
    assert "# SYSTEM POLICY (DEVELOPER ROLE)" in sec2_gpt
    assert "MANDATORY:" in sec2_gpt

    # 3. Grok 3
    pkg_grok = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.GROK_3,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_grok = pkg_grok.sections[1].content
    assert "# GROK 3 MATHEMATICAL REASONING KERNEL" in sec2_grok
    assert "CONSTITUTIONAL LAWS:" in sec2_grok

    # 4. Gemini 2.0 Flash
    pkg_gemini = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.GEMINI_2_FLASH,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_gemini = pkg_gemini.sections[1].content
    assert "[GEMINI SYSTEM INSTRUCTIONS - FLASH THINKING]" in sec2_gemini

    # 5. Cursor Rules
    pkg_cursor = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.CURSOR_RULES,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_cursor = pkg_cursor.sections[1].content
    # Must contain valid JSON block
    assert "```json" in sec2_cursor

    # 6. Antigravity Skills
    pkg_antigravity = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.ANTIGRAVITY_SKILLS,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_anti = pkg_antigravity.sections[1].content
    assert "# ANTIGRAVITY AGENT CONSTITUTION" in sec2_anti
    assert "<RULE>" in sec2_anti

    # 7. Kimi 128k
    pkg_kimi = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.KIMI_128K,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_kimi = pkg_kimi.sections[1].content
    assert "# KIMI 128K INSTRUCTION HIERARCHY" in sec2_kimi

    # 8. DeepSeek R1
    pkg_deepseek = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.DEEPSEEK_R1,
        volume=SpecificationVolume.DETAIL_5K,
    )
    sec2_ds = pkg_deepseek.sections[1].content
    assert "<|start_header_id|>system<|end_header_id|>" in sec2_ds


def test_volume_tiers_and_no_empty_skeletons():
    """Verify that specification volumes generate non-empty, substantive sections."""
    request = "Deploy high-throughput zero-copy event streaming engine."
    
    # Test Detail (3 sections)
    pkg_5k = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.CLAUDE_3_7,
        volume=SpecificationVolume.DETAIL_5K,
    )
    assert len(pkg_5k.sections) == 3
    for s in pkg_5k.sections:
        assert s.actual_words > 50, f"Section {s.volume_index} was an empty skeleton!"
        assert len(s.sha256) == 64

    # Test God Mode (10 sections)
    pkg_100k = UniversalSpecificationEngine.compile_specification(
        user_request=request,
        target_model=TargetModel.CLAUDE_3_7,
        volume=SpecificationVolume.GOD_MODE_100K,
    )
    assert len(pkg_100k.sections) == 10
    for s in pkg_100k.sections:
        assert s.actual_words > 50, f"Section {s.volume_index} was an empty skeleton in God Mode!"
        assert len(s.sha256) == 64


def test_plugin_auditor_prevents_hallucinated_tools():
    """Verify tool auditing accurately classifies tools and detects deprecated tools."""
    t_view = PluginAuditor.audit_tool("view_file")
    assert t_view.status == ToolStatus.AVAILABLE_AND_CONNECTED
    assert "AbsolutePath" in t_view.parameters_schema

    t_deprecated = PluginAuditor.audit_tool("untrusted_cloud_eval")
    assert t_deprecated.status == ToolStatus.DEPRECATED

    t_unknown = PluginAuditor.audit_tool("magical_ai_oracle_2030")
    assert t_unknown.status == ToolStatus.NOT_VERIFIED
    assert "REQUIRES_HUMAN_APPROVAL" in t_unknown.required_permissions


def test_research_citations_grounding():
    """Verify presence of verified academic research citations."""
    pkg = UniversalSpecificationEngine.compile_specification(
        user_request="Build robust long-context agent reasoning system.",
        target_model=TargetModel.CHATGPT_O3,
        volume=SpecificationVolume.DETAIL_5K,
    )
    assert len(pkg.research_citations) >= 4
    citation_titles = [c.title for c in pkg.research_citations]
    assert any("LIFBench" in t for t in citation_titles)
    assert any("RFC 8785" in t for t in citation_titles)


def test_rfc8785_canonical_digest_determinism():
    """Verify that re-compilation yields 100% deterministic RFC 8785 digest."""
    req = "Formal deterministic state machine."
    p1 = UniversalSpecificationEngine.compile_specification(
        user_request=req,
        target_model=TargetModel.GROK_3,
        volume=SpecificationVolume.DETAIL_5K,
    )
    p2 = UniversalSpecificationEngine.compile_specification(
        user_request=req,
        target_model=TargetModel.GROK_3,
        volume=SpecificationVolume.DETAIL_5K,
    )
    assert p1.rfc8785_digest == p2.rfc8785_digest
    assert len(p1.rfc8785_digest) == 64
