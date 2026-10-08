"""Canonical entity models for Instruction System of Record."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def _compute_hash(data: Any) -> str:
    canonical_json = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class InstructionIdentity:
    project_id: str
    instruction_id: str
    display_name: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def identity_hash(self) -> str:
        return _compute_hash({"project_id": self.project_id, "instruction_id": self.instruction_id})


@dataclass(frozen=True)
class ProtectedIntentSnapshot:
    goal: str
    non_negotiables: tuple[str, ...]
    authority_scope: str
    invariants: tuple[str, ...]
    intent_hash: str = field(init=False)

    def __post_init__(self) -> None:
        raw = {
            "goal": self.goal,
            "non_negotiables": list(self.non_negotiables),
            "authority_scope": self.authority_scope,
            "invariants": list(self.invariants),
        }
        object.__setattr__(self, "intent_hash", _compute_hash(raw))


@dataclass(frozen=True)
class RequirementIdentity:
    requirement_id: str
    category: str
    description: str
    is_hard_constraint: bool
    source_span: str | None = None


@dataclass(frozen=True)
class ConstraintIdentity:
    constraint_id: str
    rule_type: str
    predicate: str
    severity: str  # HARD, SOFT, ADVISORY


@dataclass(frozen=True)
class PromptArtifactIdentity:
    artifact_id: str
    compiled_prompt: str
    target_provider: str
    token_count_estimate: int
    prompt_hash: str = field(init=False)

    def __post_init__(self) -> None:
        raw = {
            "compiled_prompt": self.compiled_prompt,
            "target_provider": self.target_provider,
        }
        object.__setattr__(self, "prompt_hash", _compute_hash(raw))


@dataclass(frozen=True)
class ModelExecutionIdentity:
    execution_id: str
    model_id: str
    provider: str
    timestamp: str
    status: str
    latency_ms: float
    output_digest: str


@dataclass(frozen=True)
class EvidenceIdentity:
    evidence_id: str
    evidence_class: str  # OBSERVED_REMOTE, OBSERVED_LOCAL, SIMULATED, CALIBRATED_ESTIMATE, STATIC_ANALYSIS, UNKNOWN
    description: str
    metrics: dict[str, Any]
    content_hash: str


@dataclass(frozen=True)
class ApprovalIdentity:
    approval_id: str
    approver: str
    role: str
    approved_at: str
    policy_pack_id: str | None = None
    signature: str | None = None


@dataclass(frozen=True)
class DeploymentIdentity:
    deployment_id: str
    environment: str  # DEV, STAGING, SHADOW, PRODUCTION
    deployed_at: str
    deployed_by: str
    active: bool = True


@dataclass(frozen=True)
class InstructionVersion:
    version_id: str
    instruction_id: str
    version_number: int
    human_objective: str
    intent_snapshot: ProtectedIntentSnapshot
    requirements: tuple[RequirementIdentity, ...]
    constraints: tuple[ConstraintIdentity, ...]
    artifacts: tuple[PromptArtifactIdentity, ...]
    parent_version_id: str | None
    author: str
    created_at: str
    approval: ApprovalIdentity | None = None
    deployment: DeploymentIdentity | None = None
    version_digest: str = field(init=False)

    def __post_init__(self) -> None:
        payload = {
            "version_id": self.version_id,
            "instruction_id": self.instruction_id,
            "version_number": self.version_number,
            "human_objective": self.human_objective,
            "intent_hash": self.intent_snapshot.intent_hash,
            "requirements": [asdict(r) for r in self.requirements],
            "constraints": [asdict(c) for c in self.constraints],
            "artifacts": [{"id": a.artifact_id, "hash": a.prompt_hash} for a in self.artifacts],
            "parent_version_id": self.parent_version_id,
            "author": self.author,
            "created_at": self.created_at,
        }
        object.__setattr__(self, "version_digest", _compute_hash(payload))


@dataclass
class InstructionProject:
    project_id: str
    name: str
    description: str
    instructions: dict[str, InstructionIdentity] = field(default_factory=dict)
    versions: dict[str, list[InstructionVersion]] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def get_latest_version(self, instruction_id: str) -> InstructionVersion | None:
        v_list = self.versions.get(instruction_id, [])
        return v_list[-1] if v_list else None
