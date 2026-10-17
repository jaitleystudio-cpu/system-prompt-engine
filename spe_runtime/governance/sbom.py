"""AI Instruction Software Bill of Materials (SBOM)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class ToolSBOMEntry:
    tool_name: str
    description: str
    mcp_server: str | None = None
    required_capabilities: list[str] = field(default_factory=list)


@dataclass
class InstructionSBOM:
    sbom_id: str
    spec_version: str
    generated_at: str
    instruction_id: str
    version_id: str
    content_hash: str
    author: str
    license: str
    trust_tier: str  # TIER_0_COMMUNITY, TIER_1_VERIFIED, TIER_2_ENTERPRISE
    dependencies: list[str]
    target_providers: list[str]
    tools: list[ToolSBOMEntry]
    few_shot_sources: list[str]
    policies_enforced: list[str]
    known_failures_referenced: list[str]
    last_qualification_timestamp: str

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)


def generate_instruction_sbom(
    instruction_id: str,
    version_id: str,
    prompt_text: str,
    author: str = "engineering-team",
    license: str = "Apache-2.0",
    trust_tier: str = "TIER_1_VERIFIED",
    target_providers: list[str] | None = None,
    tools: list[ToolSBOMEntry] | None = None,
    policies: list[str] | None = None,
) -> InstructionSBOM:
    now = datetime.now(timezone.utc).isoformat()
    content_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()

    return InstructionSBOM(
        sbom_id=f"urn:spe:sbom:{instruction_id}:{version_id}",
        spec_version="0.1.0",
        generated_at=now,
        instruction_id=instruction_id,
        version_id=version_id,
        content_hash=content_hash,
        author=author,
        license=license,
        trust_tier=trust_tier,
        dependencies=[],
        target_providers=target_providers or ["openai", "anthropic"],
        tools=tools or [],
        few_shot_sources=[],
        policies_enforced=policies or ["OWASP-GenAI-Top-10", "ISO-42001-A.8"],
        known_failures_referenced=[],
        last_qualification_timestamp=now,
    )
