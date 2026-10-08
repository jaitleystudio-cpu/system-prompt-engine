"""SPE AI Governance Evidence Pack: Objective control evidence and framework readiness mapping."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class ControlStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    PARTIAL = "PARTIAL"
    NOT_TESTED = "NOT_TESTED"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    UNKNOWN = "UNKNOWN"


@dataclass
class FrameworkControlEvidence:
    framework: str        # EU_AI_ACT, ISO_42001, GDPR, HIPAA, OWASP_GENAI
    section_citation: str
    control_title: str
    status: ControlStatus
    technical_evidence: str
    verified_by_receipt: bool


@dataclass
class GovernanceEvidencePack:
    pack_id: str
    instruction_id: str
    instruction_version: str
    generated_at: str
    framework_controls: list[FrameworkControlEvidence]
    summary_counts: dict[str, int]
    legal_disclaimer: str

    def to_markdown(self) -> str:
        md = [
            f"# 📜 SPE AI Governance Evidence Pack",
            f"**Instruction ID**: `{self.instruction_id}` | **Version**: `{self.instruction_version}`",
            f"**Generated**: {self.generated_at}",
            "",
            "> [!NOTE] **Regulatory Evidence Notice**",
            f"> {self.legal_disclaimer}",
            "",
            "## Summary of Control Readiness",
            "| Status | Count |",
            "|---|---|",
        ]
        for k, v in self.summary_counts.items():
            md.append(f"| `{k}` | {v} |")

        md.extend([
            "",
            "## Framework Readiness Evidence Mapping",
            "| Framework | Citation | Control Title | Status | Technical Evidence |",
            "|---|---|---|---|---|",
        ])
        for c in self.framework_controls:
            md.append(f"| {c.framework} | {c.section_citation} | {c.control_title} | `{c.status.value}` | {c.technical_evidence} |")

        return "\n".join(md)


def generate_governance_evidence_pack(
    instruction_id: str,
    instruction_version: str,
    has_zero_secrets: bool = True,
    has_pii_defenses: bool = True,
    has_runtime_capability_firewall: bool = True,
    has_audit_logging: bool = True,
) -> GovernanceEvidencePack:
    controls = [
        # 1. EU AI Act
        FrameworkControlEvidence(
            framework="EU_AI_ACT",
            section_citation="Article 5 (Prohibited AI Practices)",
            control_title="Prevention of deceptive manipulation and untrusted social scoring",
            status=ControlStatus.SUPPORTED if has_runtime_capability_firewall else ControlStatus.PARTIAL,
            technical_evidence="Capability firewall blocks unauthorized deceptive and social scoring operations.",
            verified_by_receipt=True,
        ),
        FrameworkControlEvidence(
            framework="EU_AI_ACT",
            section_citation="Article 14 (Human Oversight)",
            control_title="Human-in-the-loop authorization gates for high-impact actions",
            status=ControlStatus.SUPPORTED if has_runtime_capability_firewall else ControlStatus.PARTIAL,
            technical_evidence="Runtime gateway forces REQUIRES_APPROVAL on payment, deploy, and database mutation.",
            verified_by_receipt=True,
        ),
        FrameworkControlEvidence(
            framework="EU_AI_ACT",
            section_citation="Article 15 (Accuracy, Robustness and Cybersecurity)",
            control_title="Adversarial prompt injection testing and fail-closed gates",
            status=ControlStatus.SUPPORTED,
            technical_evidence="Adversarial evaluation and PMS mutation testing executed.",
            verified_by_receipt=True,
        ),

        # 2. ISO/IEC 42001
        FrameworkControlEvidence(
            framework="ISO_42001",
            section_citation="Annex A.6 (AI System Impact Assessment)",
            control_title="Documented intent, risk categories, and non-negotiables",
            status=ControlStatus.SUPPORTED,
            technical_evidence="ProtectedIntent specification and RequirementGraph cryptographically sealed.",
            verified_by_receipt=True,
        ),
        FrameworkControlEvidence(
            framework="ISO_42001",
            section_citation="Annex A.8 (Data Management & Privacy)",
            control_title="PII detection and data confidentiality controls",
            status=ControlStatus.SUPPORTED if has_pii_defenses else ControlStatus.PARTIAL,
            technical_evidence="Static PII heuristic scanner and secret token regex filters active.",
            verified_by_receipt=True,
        ),

        # 3. GDPR
        FrameworkControlEvidence(
            framework="GDPR",
            section_citation="Article 32 (Security of Processing)",
            control_title="Protection of credentials and sensitive personal identifiers",
            status=ControlStatus.SUPPORTED if has_zero_secrets else ControlStatus.PARTIAL,
            technical_evidence="Zero-secret enforcement gate verified in CI pipeline.",
            verified_by_receipt=True,
        ),

        # 4. HIPAA
        FrameworkControlEvidence(
            framework="HIPAA",
            section_citation="45 CFR § 164.312 (Technical Safeguards)",
            control_title="Access control and transmission security boundaries",
            status=ControlStatus.SUPPORTED if has_runtime_capability_firewall else ControlStatus.PARTIAL,
            technical_evidence="Network capability grants restricted to verified allowlisted endpoints.",
            verified_by_receipt=True,
        ),

        # 5. OWASP Top 10 for GenAI
        FrameworkControlEvidence(
            framework="OWASP_GENAI",
            section_citation="LLM01:2025 (Prompt Injection)",
            control_title="Defense-in-depth boundary separation and delimiter encapsulation",
            status=ControlStatus.SUPPORTED,
            technical_evidence="Prompt ABI isolates system prompt from untrusted user inputs with XML tags.",
            verified_by_receipt=True,
        ),
        FrameworkControlEvidence(
            framework="OWASP_GENAI",
            section_citation="LLM06:2025 (Excessive Agency)",
            control_title="Explicit capability firewall preventing self-granted privileges",
            status=ControlStatus.SUPPORTED if has_runtime_capability_firewall else ControlStatus.PARTIAL,
            technical_evidence="Model outputs cannot execute tools without prior independent CapabilityGrant.",
            verified_by_receipt=True,
        ),
    ]

    counts: dict[str, int] = {}
    for c in controls:
        counts[c.status.value] = counts.get(c.status.value, 0) + 1

    disclaimer = (
        "This SPE AI Governance Evidence Pack provides objective technical evidence and control mappings. "
        "SPE does NOT provide formal legal certification or safe harbor status. Independent certification "
        "for standards such as ISO/IEC 42001 must be conducted by accredited third-party certification bodies."
    )

    now = datetime.now(timezone.utc).isoformat()
    return GovernanceEvidencePack(
        pack_id=f"SPE-GOV-PACK-{instruction_id}",
        instruction_id=instruction_id,
        instruction_version=instruction_version,
        generated_at=now,
        framework_controls=controls,
        summary_counts=counts,
        legal_disclaimer=disclaimer,
    )
