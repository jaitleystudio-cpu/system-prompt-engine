"""K6 SpeArtifact — immutable .spe semantic artifact model.

Laws:
  ARTIFACT IDENTITY != PROMPT CONTENT IDENTITY (pad-)
  ARTIFACT IDENTITY != SNAPSHOT IDENTITY (snap-)
  ARTIFACT IDENTITY != PROOF RECEIPT IDENTITY (rcpt-)
  SERIALIZED BYTES != AUTHORITY
  FILE PRESENCE != TRUST
  HASH MATCH != QUALIFICATION
  LINEAGE != OWNERSHIP AUTHORITY
  PROMPT ARTIFACT != .spe ARTIFACT

Design (Ring-0 minimum):
  Embed canonical protected-intent payload for portable self-contained .spe.
  Bind snapshot / prompt / optional proof-ledger by typed digests (references).
  Direct parent lineage only — no DAG merge / ancestry store.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping


FORMAT_NAME = "spe"
FORMAT_VERSION = "1"
ARTIFACT_ID_PREFIX = "spe-"
SNAPSHOT_ID_PREFIX = "snap-"
PROMPT_DIGEST_PREFIX = "pad-"
PROOF_LEDGER_PREFIX = "led-"
PROTECTED_INTENT_PREFIX = "pid-"
REQUIREMENT_GRAPH_PREFIX = "rg-"

# Top-level identity-bearing semantic fields (excludes artifact_id itself).
IDENTITY_BEARING_FIELDS: frozenset[str] = frozenset(
    {
        "format",
        "format_version",
        "snapshot_id",
        "snapshot_version",
        "protected_intent_digest",
        "requirement_graph_digest",
        "prompt_content_digest",
        "proof_ledger_digest",
        "parent_artifact_id",
        "contract_validity",
        "protected_intent_payload",
    }
)

# Allowed top-level keys on serialized .spe documents (strict schema).
ALLOWED_TOP_LEVEL_FIELDS: frozenset[str] = IDENTITY_BEARING_FIELDS | frozenset(
    {"artifact_id"}
)

# Non-identity metadata is intentionally omitted from Ring-0 canonical artifact
# (no display filename, path, timestamps, UI labels).


def freeze_mapping(value: Any) -> Any:
    """Deep-freeze dict/list into MappingProxyType / tuple for nested immutability."""
    if isinstance(value, Mapping):
        return MappingProxyType({str(k): freeze_mapping(v) for k, v in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(freeze_mapping(v) for v in value)
    return value


def unfreeze_mapping(value: Any) -> Any:
    """Convert frozen nested structures back to plain dict/list for canonicalize."""
    if isinstance(value, Mapping):
        return {str(k): unfreeze_mapping(v) for k, v in value.items()}
    if isinstance(value, tuple):
        return [unfreeze_mapping(v) for v in value]
    return value


@dataclass(frozen=True, slots=True)
class SpeArtifact:
    """Immutable content-addressed K6 .spe semantic artifact.

    Identity preimage = all identity-bearing fields (NOT artifact_id).
    artifact_id = spe- + sha256(canonical_dumps(preimage))[:64]
    """

    format: str
    format_version: str
    artifact_id: str
    snapshot_id: str
    snapshot_version: int
    protected_intent_digest: str
    requirement_graph_digest: str
    prompt_content_digest: str | None
    proof_ledger_digest: str | None
    parent_artifact_id: str | None
    contract_validity: str
    protected_intent_payload: Mapping[str, Any]

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "protected_intent_payload", freeze_mapping(dict(self.protected_intent_payload))
        )
        if self.format != FORMAT_NAME:
            raise ValueError("SpeArtifact.format must be 'spe'")
        if self.format_version != FORMAT_VERSION:
            raise ValueError("SpeArtifact.format_version must be '1'")
        if not isinstance(self.snapshot_version, int) or isinstance(
            self.snapshot_version, bool
        ):
            raise TypeError("snapshot_version must be int")

    def to_identity_preimage(self) -> dict[str, Any]:
        """Canonical identity-bearing payload — excludes artifact_id (anti-recursion)."""
        return {
            "format": self.format,
            "format_version": self.format_version,
            "snapshot_id": self.snapshot_id,
            "snapshot_version": self.snapshot_version,
            "protected_intent_digest": self.protected_intent_digest,
            "requirement_graph_digest": self.requirement_graph_digest,
            "prompt_content_digest": self.prompt_content_digest,
            "proof_ledger_digest": self.proof_ledger_digest,
            "parent_artifact_id": self.parent_artifact_id,
            "contract_validity": self.contract_validity,
            "protected_intent_payload": unfreeze_mapping(self.protected_intent_payload),
        }

    def to_canonical_document(self) -> dict[str, Any]:
        """Full serialized document including artifact_id."""
        doc = self.to_identity_preimage()
        doc["artifact_id"] = self.artifact_id
        return doc


__all__ = [
    "FORMAT_NAME",
    "FORMAT_VERSION",
    "ARTIFACT_ID_PREFIX",
    "SNAPSHOT_ID_PREFIX",
    "PROMPT_DIGEST_PREFIX",
    "PROOF_LEDGER_PREFIX",
    "PROTECTED_INTENT_PREFIX",
    "REQUIREMENT_GRAPH_PREFIX",
    "IDENTITY_BEARING_FIELDS",
    "ALLOWED_TOP_LEVEL_FIELDS",
    "SpeArtifact",
    "freeze_mapping",
    "unfreeze_mapping",
]
