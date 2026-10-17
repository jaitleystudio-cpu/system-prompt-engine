"""Tests for Instruction SBOM, Policy Compiler & Governance Evidence Pack (M14 & M15)."""

from spe_runtime.governance.evidence_pack import (
    ControlStatus,
    generate_governance_evidence_pack,
)
from spe_runtime.governance.policy_compiler import PolicyCompiler
from spe_runtime.governance.sbom import generate_instruction_sbom


def test_instruction_sbom_generation():
    sbom = generate_instruction_sbom(
        instruction_id="inst-finance",
        version_id="v1.0.0",
        prompt_text="Audit bank accounts.",
        author="alice@corp.com",
    )
    assert sbom.instruction_id == "inst-finance"
    assert sbom.trust_tier == "TIER_1_VERIFIED"
    assert len(sbom.content_hash) == 64
    assert "OWASP-GenAI-Top-10" in sbom.policies_enforced


def test_policy_compiler_requires_human_approval():
    compiler = PolicyCompiler()
    policy_text = (
        "Never process European customer data outside the EU.\n"
        "All database deletes must require two-factor approval.\n"
    )
    draft = compiler.compile_policy_text("POL-GDPR-01", policy_text)
    assert len(draft.candidate_requirements) == 2
    assert draft.human_approved is False
    assert draft.approved_by is None

    # Approve
    approved = compiler.approve_policy_draft(draft, approver="ciso@corp.com")
    assert approved.human_approved is True
    assert approved.approved_by == "ciso@corp.com"


def test_governance_evidence_pack_disclaimer_and_controls():
    pack = generate_governance_evidence_pack(
        instruction_id="inst-med",
        instruction_version="v2.1",
        has_zero_secrets=True,
        has_runtime_capability_firewall=True,
    )
    assert "EU_AI_ACT" in [c.framework for c in pack.framework_controls]
    assert "ISO_42001" in [c.framework for c in pack.framework_controls]
    assert "GDPR" in [c.framework for c in pack.framework_controls]
    assert "HIPAA" in [c.framework for c in pack.framework_controls]
    assert "OWASP_GENAI" in [c.framework for c in pack.framework_controls]

    # Legal disclaimer must be present
    assert "does NOT provide formal legal certification" in pack.legal_disclaimer

    md = pack.to_markdown()
    assert "# 📜 SPE AI Governance Evidence Pack" in md
    assert "Article 5 (Prohibited AI Practices)" in md
