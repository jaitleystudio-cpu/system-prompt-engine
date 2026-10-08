"""Tests for Instruction System of Record (M1)."""

import pytest
from pathlib import Path

from spe_runtime.instruction_record.models import (
    ApprovalIdentity,
    ConstraintIdentity,
    DeploymentIdentity,
    InstructionIdentity,
    InstructionProject,
    InstructionVersion,
    PromptArtifactIdentity,
    ProtectedIntentSnapshot,
    RequirementIdentity,
)
from spe_runtime.instruction_record.store import InstructionStore, TamperError, VersionNotFoundError


def test_instruction_identity_stability():
    id1 = InstructionIdentity(project_id="proj-alpha", instruction_id="inst-001", display_name="Data Agent")
    id2 = InstructionIdentity(project_id="proj-alpha", instruction_id="inst-001", display_name="Data Agent v2")
    assert id1.identity_hash == id2.identity_hash
    assert len(id1.identity_hash) == 64


def test_version_lineage_and_tamper_detection(tmp_path: Path):
    store = InstructionStore(tmp_path / "instructions")
    proj = store.create_project("proj-finance", "Financial Engine", "Risk analysis instructions")

    intent = ProtectedIntentSnapshot(
        goal="Audit banking transactions for AML patterns",
        non_negotiables=("Never export unredacted SSN", "Enforce 2FA audit threshold"),
        authority_scope="READ_ONLY_FINANCIAL_RECORDS",
        invariants=("Latency must stay under 200ms",),
    )
    req1 = RequirementIdentity("REQ-01", "AML", "Scan SAR rules", True, "source-span-1")
    con1 = ConstraintIdentity("CON-01", "PREDICATE", "transaction.amount < 10000 or has_flag(sar)", "HARD")
    art1 = PromptArtifactIdentity("ART-01", "You are an AML audit assistant.", "openai-gpt4o", 12)

    v1 = InstructionVersion(
        version_id="inst-aml-v1",
        instruction_id="inst-aml",
        version_number=1,
        human_objective="Implement initial AML audit instruction",
        intent_snapshot=intent,
        requirements=(req1,),
        constraints=(con1,),
        artifacts=(art1,),
        parent_version_id=None,
        author="alice@example.com",
        created_at="2026-10-08T00:00:00Z",
    )
    store.record_version("proj-finance", v1)

    # Add v2
    art2 = PromptArtifactIdentity("ART-02", "You are an AML audit assistant v2.", "anthropic-claude-3-5", 14)
    v2 = InstructionVersion(
        version_id="inst-aml-v2",
        instruction_id="inst-aml",
        version_number=2,
        human_objective="Optimize for Claude 3.5 Sonnet",
        intent_snapshot=intent,
        requirements=(req1,),
        constraints=(con1,),
        artifacts=(art2,),
        parent_version_id="inst-aml-v1",
        author="bob@example.com",
        created_at="2026-10-08T01:00:00Z",
    )
    store.record_version("proj-finance", v2)

    versions = store.load_versions_for_project("proj-finance")["inst-aml"]
    assert len(versions) == 2
    assert versions[0].version_id == "inst-aml-v1"
    assert versions[1].parent_version_id == "inst-aml-v1"

    # Test Rollback
    rolled = store.rollback("proj-finance", "inst-aml", "inst-aml-v1", author="alice@example.com")
    assert rolled.version_number == 3
    assert rolled.parent_version_id == "inst-aml-v2"
    assert rolled.artifacts[0].artifact_id == "ART-01"

    # Test Tamper Detection
    # Manually corrupt the history file
    history_file = tmp_path / "instructions" / "history.jsonl"
    lines = history_file.read_text(encoding="utf-8").splitlines()
    corrupt_line = lines[0].replace("Alice", "Eve").replace("alice@example.com", "eve@attacker.com")
    lines[0] = corrupt_line
    history_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    with pytest.raises(TamperError):
        store.load_versions_for_project("proj-finance")


def test_unicode_and_boundary_handling(tmp_path: Path):
    store = InstructionStore(tmp_path / "instructions")
    intent = ProtectedIntentSnapshot(
        goal="తెలుగు మరియు हिंदी లో విశ్లేషణ: 🚀 Привет мир! 💖",
        non_negotiables=("ఇన్పుట్ మార్చకూడదు", "डेटा सुरक्षित رکھیں"),
        authority_scope="MULTILINGUAL_SANDBOX",
        invariants=("UTF-8 preservation",),
    )
    v = InstructionVersion(
        version_id="v-unicode",
        instruction_id="inst-uni",
        version_number=1,
        human_objective="Multilingual non-ASCII verification",
        intent_snapshot=intent,
        requirements=(),
        constraints=(),
        artifacts=(),
        parent_version_id=None,
        author="dev@india.org",
        created_at="2026-10-08T02:00:00Z",
    )
    store.record_version("proj-uni", v)
    loaded = store.get_version("proj-uni", "inst-uni", "v-unicode")
    assert "తెలుగు" in loaded.intent_snapshot.goal
    assert "डेटा" in loaded.intent_snapshot.non_negotiables[1]
