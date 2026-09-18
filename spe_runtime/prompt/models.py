"""K3 PromptArtifact — immutable models.

PromptArtifact is a model-facing semantic instruction artifact compiled from
authoritative K0/K1 inputs. It is NOT:
  AuthorityGrant, ProofReceipt, PrivacyProjection, ExecutionPlan,
  .spe package identity, or qualification evidence.

prompt_content_digest != spe_artifact_identity (K6).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class PromptSegmentKind(str, Enum):
    """Structural role of a prompt segment — instruction vs data boundary."""

    PROTECTED_CONSTRAINT = "PROTECTED_CONSTRAINT"
    SHOULD_GUIDANCE = "SHOULD_GUIDANCE"
    PREFERENCE = "PREFERENCE"
    CONTEXT_DATA = "CONTEXT_DATA"
    TARGET_PROFILE = "TARGET_PROFILE"


@dataclass(frozen=True, slots=True)
class PromptSourceBinding:
    """Deterministic binding to source ProtectedIntentContract semantics.

    Binds to content digests / requirement IDs — never Python object ids.
    slots=True blocks __dict__ mutation bypass of frozen=.
    """

    contract_content_digest: str
    contract_validity: str
    requirement_ids: tuple[str, ...]
    requirement_kinds: tuple[str, ...]
    requirement_values_digest: str
    provenance_markers: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PromptSegment:
    """One ordered, immutable prompt segment with categorical provenance."""

    kind: PromptSegmentKind
    requirement_kind: str | None  # MUST / MUST_NOT / SHOULD / PREFERENCE / None for context
    text: str
    requirement_ids: tuple[str, ...]
    provenance: str
    semantic_key: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "kind", PromptSegmentKind(self.kind))
        object.__setattr__(self, "requirement_ids", tuple(self.requirement_ids))
        if not isinstance(self.text, str):
            raise TypeError("PromptSegment.text must be str")


@dataclass(frozen=True, slots=True)
class PromptArtifact:
    """Immutable, content-addressed K3 PromptArtifact.

    Formal laws:
      PROMPT != AUTHORITY
      PROMPT_COMPILATION != VERIFICATION
      PROMPT_CREATED != PROMPT_QUALIFIED
      PROMPT_CONTENT != PRIVACY_AUTHORIZATION
      prompt_content_digest != spe_artifact_identity
    """

    schema_version: str
    source_binding: PromptSourceBinding
    segments: tuple[PromptSegment, ...]
    rendered_prompt: str
    prompt_content_digest: str
    target_profile: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "segments", tuple(self.segments))
        # Deep freeze: reject mutable nested containers leaked via construction
        if not isinstance(self.source_binding, PromptSourceBinding):
            raise TypeError("source_binding must be PromptSourceBinding")
        if not isinstance(self.segments, tuple):
            raise TypeError("segments must be tuple")
        for seg in self.segments:
            if not isinstance(seg, PromptSegment):
                raise TypeError("segments must contain PromptSegment")

    def to_canonical_payload(self) -> dict[str, Any]:
        """Canonical semantic payload for digest / portability (no K6 identity)."""
        return {
            "schema_version": self.schema_version,
            "source_binding": {
                "contract_content_digest": self.source_binding.contract_content_digest,
                "contract_validity": self.source_binding.contract_validity,
                "requirement_ids": list(self.source_binding.requirement_ids),
                "requirement_kinds": list(self.source_binding.requirement_kinds),
                "requirement_values_digest": self.source_binding.requirement_values_digest,
                "provenance_markers": list(self.source_binding.provenance_markers),
            },
            "segments": [
                {
                    "kind": s.kind.value,
                    "requirement_kind": s.requirement_kind,
                    "text": s.text,
                    "requirement_ids": list(s.requirement_ids),
                    "provenance": s.provenance,
                    "semantic_key": s.semantic_key,
                }
                for s in self.segments
            ],
            "rendered_prompt": self.rendered_prompt,
            "target_profile": self.target_profile,
            # Explicitly absent K6 / authority / proof / qualification / privacy fields
        }

    def has_k6_identity_fields(self) -> bool:
        """Always False — PromptArtifact never carries .spe / lineage identity."""
        payload = self.to_canonical_payload()
        forbidden = {
            "spe_artifact_id",
            "spe_package_id",
            "lineage_id",
            "export_identity",
            "import_identity",
            "artifact_lineage",
            "package_signature",
        }
        return bool(forbidden & set(payload.keys()))


__all__ = [
    "PromptSegmentKind",
    "PromptSourceBinding",
    "PromptSegment",
    "PromptArtifact",
]
