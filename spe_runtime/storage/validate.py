"""K6 SpeArtifact validation — single shared semantic validator."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.storage.models import (
    ALLOWED_TOP_LEVEL_FIELDS,
    ARTIFACT_ID_PREFIX,
    FORMAT_NAME,
    FORMAT_VERSION,
    PROMPT_DIGEST_PREFIX,
    PROOF_LEDGER_PREFIX,
    PROTECTED_INTENT_PREFIX,
    REQUIREMENT_GRAPH_PREFIX,
    SNAPSHOT_ID_PREFIX,
    SpeArtifact,
    unfreeze_mapping,
)


def _require_str(value: Any, field: str) -> str:
    if not isinstance(value, str) or isinstance(value, bool):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"{field} must be str",
        )
    return value


def _require_optional_str(value: Any, field: str) -> str | None:
    if value is None:
        return None
    return _require_str(value, field)


def _require_int(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"{field} must be int",
        )
    return value


def _require_prefix(value: str | None, prefix: str, field: str) -> None:
    if value is None:
        return
    if not value.startswith(prefix):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"{field} must start with {prefix}",
        )
    rest = value[len(prefix) :]
    if not rest or any(c not in "0123456789abcdef" for c in rest):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"{field} digest body must be lowercase hex",
        )


def compute_artifact_id(preimage: Mapping[str, Any]) -> str:
    """Sole identity derivation: spe- + sha256(canonical identity preimage)."""
    return content_digest(dict(preimage), prefix=ARTIFACT_ID_PREFIX, length=64)


def validate_spe_artifact(artifact: SpeArtifact, *, recompute_id: bool = True) -> SpeArtifact:
    """Canonical SpeArtifact validator (builder + parser share this path)."""
    if not isinstance(artifact, SpeArtifact):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "artifact must be SpeArtifact",
        )
    if artifact.format != FORMAT_NAME:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"format must be {FORMAT_NAME!r}",
        )
    if artifact.format_version != FORMAT_VERSION:
        raise SpeTypedError(
            ErrorCode.K6_UNSUPPORTED_ARTIFACT_VERSION,
            f"unsupported format_version {artifact.format_version!r}",
        )

    _require_prefix(artifact.snapshot_id, SNAPSHOT_ID_PREFIX, "snapshot_id")
    _require_prefix(
        artifact.protected_intent_digest, PROTECTED_INTENT_PREFIX, "protected_intent_digest"
    )
    _require_prefix(
        artifact.requirement_graph_digest,
        REQUIREMENT_GRAPH_PREFIX,
        "requirement_graph_digest",
    )
    _require_prefix(
        artifact.prompt_content_digest, PROMPT_DIGEST_PREFIX, "prompt_content_digest"
    )
    _require_prefix(
        artifact.proof_ledger_digest, PROOF_LEDGER_PREFIX, "proof_ledger_digest"
    )
    _require_prefix(artifact.artifact_id, ARTIFACT_ID_PREFIX, "artifact_id")

    parent = artifact.parent_artifact_id
    if parent is not None:
        _require_prefix(parent, ARTIFACT_ID_PREFIX, "parent_artifact_id")
        if parent == artifact.artifact_id:
            raise SpeTypedError(
                ErrorCode.K6_INVALID_LINEAGE,
                "direct self-parent lineage is forbidden",
            )

    if artifact.contract_validity not in ("VALID", "CONFLICTED", "INCOMPLETE"):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "contract_validity must be VALID|CONFLICTED|INCOMPLETE",
        )

    payload = unfreeze_mapping(artifact.protected_intent_payload)
    if not isinstance(payload, dict):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload must be object",
        )
    if payload.get("validity") != artifact.contract_validity:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "contract_validity does not match embedded protected_intent_payload.validity",
        )

    if recompute_id:
        expected = compute_artifact_id(artifact.to_identity_preimage())
        if artifact.artifact_id != expected:
            raise SpeTypedError(
                ErrorCode.K6_ARTIFACT_ID_MISMATCH,
                "artifact_id does not match recomputed content digest",
            )

    return artifact


def validate_document_dict(doc: Mapping[str, Any]) -> dict[str, Any]:
    """Structural + domain checks on a parsed .spe document dict."""
    if not isinstance(doc, Mapping):
        raise SpeTypedError(ErrorCode.K6_INVALID_ARTIFACT, "document must be object")
    keys = set(doc.keys())
    unknown = keys - ALLOWED_TOP_LEVEL_FIELDS
    if unknown:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"unknown semantic fields: {sorted(unknown)}",
        )
    missing = ALLOWED_TOP_LEVEL_FIELDS - keys
    # All allowed fields are required keys (nullable values allowed for optional digests)
    if missing:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"missing required fields: {sorted(missing)}",
        )

    fmt = _require_str(doc["format"], "format")
    ver = _require_str(doc["format_version"], "format_version")
    if fmt != FORMAT_NAME:
        raise SpeTypedError(ErrorCode.K6_INVALID_ARTIFACT, "format must be 'spe'")
    if ver != FORMAT_VERSION:
        raise SpeTypedError(
            ErrorCode.K6_UNSUPPORTED_ARTIFACT_VERSION,
            f"unsupported format_version {ver!r}",
        )

    snapshot_id = _require_str(doc["snapshot_id"], "snapshot_id")
    snapshot_version = _require_int(doc["snapshot_version"], "snapshot_version")
    pid = _require_str(doc["protected_intent_digest"], "protected_intent_digest")
    rg = _require_str(doc["requirement_graph_digest"], "requirement_graph_digest")
    pad = _require_optional_str(doc["prompt_content_digest"], "prompt_content_digest")
    led = _require_optional_str(doc["proof_ledger_digest"], "proof_ledger_digest")
    parent = _require_optional_str(doc["parent_artifact_id"], "parent_artifact_id")
    validity = _require_str(doc["contract_validity"], "contract_validity")
    artifact_id = _require_str(doc["artifact_id"], "artifact_id")
    payload = doc["protected_intent_payload"]
    if not isinstance(payload, dict):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload must be object",
        )

    return {
        "format": fmt,
        "format_version": ver,
        "artifact_id": artifact_id,
        "snapshot_id": snapshot_id,
        "snapshot_version": snapshot_version,
        "protected_intent_digest": pid,
        "requirement_graph_digest": rg,
        "prompt_content_digest": pad,
        "proof_ledger_digest": led,
        "parent_artifact_id": parent,
        "contract_validity": validity,
        "protected_intent_payload": payload,
    }


__all__ = [
    "compute_artifact_id",
    "validate_spe_artifact",
    "validate_document_dict",
]
