"""K6 .spe serialization — canonical UTF-8 bytes, deterministic parse/load.

Policy:
  - dumps_spe always emits canonical JSON bytes (sorted keys, compact, NFC via canonicalize).
  - loads_spe may accept semantically valid noncanonical whitespace/key order,
    then recomputes identity from canonical semantic payload.
  - Duplicate JSON keys are rejected (no last-key-wins).
  - Unknown semantic fields rejected.
  - Import validates structure + recomputed identity; does NOT grant trust/authority.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.storage.models import SpeArtifact
from spe_runtime.storage.validate import (
    compute_artifact_id,
    validate_document_dict,
    validate_spe_artifact,
)


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in pairs:
        if k in out:
            raise SpeTypedError(
                ErrorCode.K6_INVALID_ARTIFACT,
                f"duplicate JSON key: {k!r}",
            )
        out[k] = v
    return out


def dumps_spe(artifact: SpeArtifact) -> bytes:
    """Serialize SpeArtifact to canonical UTF-8 .spe bytes."""
    artifact = validate_spe_artifact(artifact)
    text = canonical_dumps(artifact.to_canonical_document())
    return text.encode("utf-8")


def loads_spe(data: bytes | str) -> SpeArtifact:
    """Parse + validate .spe bytes/text. Recomputes artifact_id; mismatch rejects.

    Noncanonical whitespace/key order may parse, but identity uses canonical
    semantic preimage. Reserialization via dumps_spe always emits canonical bytes.
    """
    if isinstance(data, bytes):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise SpeTypedError(
                ErrorCode.K6_INVALID_ARTIFACT,
                "invalid UTF-8 in .spe bytes",
            ) from exc
    elif isinstance(data, str):
        text = data
    else:
        raise SpeTypedError(ErrorCode.K6_INVALID_ARTIFACT, ".spe input must be bytes or str")

    if not text.strip():
        raise SpeTypedError(ErrorCode.K6_INVALID_ARTIFACT, "empty .spe document")

    try:
        raw = json.loads(text, object_pairs_hook=_reject_duplicate_keys)
    except SpeTypedError:
        raise
    except json.JSONDecodeError as exc:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"truncated JSON: {exc.msg}",
        ) from exc

    doc = validate_document_dict(raw)
    claimed_id = doc["artifact_id"]
    preimage = {k: v for k, v in doc.items() if k != "artifact_id"}
    expected_id = compute_artifact_id(preimage)
    if claimed_id != expected_id:
        raise SpeTypedError(
            ErrorCode.K6_ARTIFACT_ID_MISMATCH,
            "artifact_id does not match recomputed content digest",
        )

    artifact = SpeArtifact(
        format=doc["format"],
        format_version=doc["format_version"],
        artifact_id=claimed_id,
        snapshot_id=doc["snapshot_id"],
        snapshot_version=doc["snapshot_version"],
        protected_intent_digest=doc["protected_intent_digest"],
        requirement_graph_digest=doc["requirement_graph_digest"],
        prompt_content_digest=doc["prompt_content_digest"],
        proof_ledger_digest=doc["proof_ledger_digest"],
        parent_artifact_id=doc["parent_artifact_id"],
        contract_validity=doc["contract_validity"],
        protected_intent_payload=doc["protected_intent_payload"],
    )
    return validate_spe_artifact(artifact)


def save_spe(
    artifact: SpeArtifact,
    path: str | Path,
    *,
    overwrite: bool = False,
) -> Path:
    """Write canonical .spe bytes to caller-specified path. Path does not affect identity."""
    target = Path(path)
    if target.exists() and not overwrite:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"refusing to overwrite existing file: {target}",
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    data = dumps_spe(artifact)
    target.write_bytes(data)
    return target


def load_spe(path: str | Path) -> SpeArtifact:
    """Load .spe from filesystem path. Path/filename never influence identity."""
    target = Path(path)
    try:
        data = target.read_bytes()
    except OSError as exc:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            f"cannot read .spe path: {target}",
        ) from exc
    return loads_spe(data)


__all__ = ["dumps_spe", "loads_spe", "save_spe", "load_spe"]
