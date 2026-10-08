"""Tests for spe adopt and spe-lsp (M4)."""

from pathlib import Path
import pytest

from spe_runtime.developer.adopt import RepoAdoptionScanner, adopt_repository
from spe_runtime.developer.lsp_server import SpeLanguageServer


def test_repo_adoption_scanner(tmp_path: Path):
    # Create sample codebase with prompts and SDK usage
    app_dir = tmp_path / "sample_app"
    app_dir.mkdir()

    py_file = app_dir / "agent.py"
    py_file.write_text(
        'from openai import OpenAI\n'
        'client = OpenAI()\n'
        'system_prompt = "You are a customer service bot. Never share user credentials."\n'
        'response = client.chat.completions.create(model="gpt-4o", messages=[{"role": "system", "content": system_prompt}])\n',
        encoding="utf-8",
    )

    rules_file = app_dir / ".cursorrules"
    rules_file.write_text("Always write concise code.\n", encoding="utf-8")

    # Scan
    scanner = RepoAdoptionScanner(app_dir)
    report = scanner.scan()

    assert report.detected_prompts >= 1
    assert "openai" in report.detected_providers
    assert report.undocumented_constraints_count >= 1
    assert any(a.artifact_type == "config" for a in report.artifacts)

    # Test Apply mode
    res = adopt_repository(app_dir, mode="apply")
    assert res["status"] == "APPLIED"
    assert (app_dir / ".spe" / "manifest.json").exists()
    assert (app_dir / ".spe" / "intent.json").exists()


def test_spe_lsp_diagnostics():
    server = SpeLanguageServer()
    sample_prompt = (
        "Role: Assistant\n"
        "Here is my api key: sk-abcdef123456789012345678\n"
        "User SSN is 123-45-6789\n"
        "You must always answer and you must never answer.\n"
        "You have unrestricted bypass capability.\n"
    )

    diags = server.open_document("file:///prompt.md", sample_prompt)
    codes = {d.code for d in diags}

    assert "POTENTIAL_SECRET_LEAK" in codes
    assert "POTENTIAL_PII_LEAK" in codes
    assert "HARD_CONSTRAINT_CONTRADICTION" in codes
    assert "UNKNOWN_AMBIGUOUS_AUTHORITY" in codes

    # Hover
    hover = server.provide_hover("file:///prompt.md", line=0, char=2)
    assert hover is not None
    assert "SPE Instruction Clause Analysis" in hover["contents"]["value"]


def test_spe_lsp_positional_risk_is_labeled_heuristic():
    server = SpeLanguageServer()
    # Large prompt (>3000 tokens)
    large_text = ("This is a long instruction paragraph to test positional attenuation.\n" * 500)
    diags = server.open_document("file:///large.md", large_text)

    pos_diags = [d for d in diags if d.code == "POSITIONAL_RISK_HEURISTIC"]
    assert len(pos_diags) == 1
    assert "POSITIONAL_RISK_HEURISTIC" in pos_diags[0].message
    assert "NOT an observed attention measurement" in pos_diags[0].message
    assert "STATIC_ANALYSIS" in pos_diags[0].evidence_class
