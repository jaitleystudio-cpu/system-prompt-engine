"""Data models for SPE Replay Capsule."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class TaintLevel(str, Enum):
    TRUSTED = "TRUSTED"
    UNTRUSTED_RETRIEVAL = "UNTRUSTED_RETRIEVAL"
    ADVERSARIAL_SUSPECT = "ADVERSARIAL_SUSPECT"


@dataclass(frozen=True)
class ExecutionEnvironment:
    provider: str
    model_id: str
    model_version: str | None = None
    temperature: float = 0.0
    top_p: float = 1.0
    seed: int | None = 42
    max_tokens: int | None = None
    tokenizer_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model_id": self.model_id,
            "model_version": self.model_version,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "seed": self.seed,
            "max_tokens": self.max_tokens,
            "tokenizer_name": self.tokenizer_name,
        }


@dataclass(frozen=True)
class ToolDefinitionSnapshot:
    name: str
    description: str
    parameters_schema: dict[str, Any]
    permission_tier: str = "DEFAULT"

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters_schema": self.parameters_schema,
            "permission_tier": self.permission_tier,
        }


@dataclass(frozen=True)
class RetrievalContextSnapshot:
    chunk_id: str
    source_uri: str
    content: str
    content_hash: str
    taint_level: TaintLevel = TaintLevel.TRUSTED

    def to_dict(self) -> dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "source_uri": self.source_uri,
            "content": self.content,
            "content_hash": self.content_hash,
            "taint_level": self.taint_level.value,
        }


@dataclass(frozen=True)
class ReplayCapsule:
    capsule_id: str
    instruction_version_id: str
    environment: ExecutionEnvironment
    prompt_input: str
    expected_output_digest: str
    observed_output: str
    tools: tuple[ToolDefinitionSnapshot, ...] = field(default_factory=tuple)
    retrieval_context: tuple[RetrievalContextSnapshot, ...] = field(default_factory=tuple)
    created_at: str = "2026-10-08T00:00:00Z"
    metadata: dict[str, Any] = field(default_factory=dict)
    capsule_digest: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "capsule_id": self.capsule_id,
            "instruction_version_id": self.instruction_version_id,
            "created_at": self.created_at,
            "environment": self.environment.to_dict(),
            "prompt_input": self.prompt_input,
            "expected_output_digest": self.expected_output_digest,
            "observed_output": self.observed_output,
            "tools": [t.to_dict() for t in self.tools],
            "retrieval_context": [r.to_dict() for r in self.retrieval_context],
            "metadata": self.metadata,
            "capsule_digest": self.capsule_digest,
        }


@dataclass(frozen=True)
class ReplayVerificationResult:
    capsule_id: str
    is_valid: bool = True
    input_digest_match: bool = True
    output_digest_match: bool = True
    replayed_output_match: bool = True
    violations: tuple[str, ...] = field(default_factory=tuple)
