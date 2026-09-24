"""`.spe` portable artifact serializer (Python portability surface).

Discovery (Task 14): the historical browser serializer lives at
``packages/web-runtime/src/speArtifact.ts`` (``spe.artifact.v1``). No prior
Python serializer existed under ``spe_runtime/portability/``; this module is
the chosen portability equivalent. Schema: ``schemas/spe_artifact.schema.json``
(no prior ``.spe`` artifact schema under ``schemas/`` — ``spe_universal_abi``
is the ABI envelope only).

ProtectedIntent is the artifact ``intent`` object and must never be rewritten
by refresh / migration. ``quality_record`` is never renamed to ``receipt``.
"""

from __future__ import annotations

import copy
import hashlib
from typing import Any, Mapping, MutableMapping, Sequence

from spe_runtime.portability.canonical import canonical_dumps, canonicalize, strict_equal
from spe_runtime.protocols.quality_record import QualityRecord

SPE_FORMAT_V1 = "spe.artifact.v1"
SPE_FORMAT_V2 = "spe.artifact.v2"

# Versioned context-protocol lineage block (optional on v1; required on v2).
CONTEXT_PROTOCOL_LINEAGE_KEY = "context_protocol"

_REQUIRED_V1 = (
    "spe_format",
    "created_at_utc",
    "user_request",
    "category",
    "target",
    "envelope",
    "wasm",
    "rendered_prompt",
    "intent",
    "lineage",
    "integrity",
)

_REQUIRED_LINEAGE_FIELDS = (
    "context_snapshot_ids",
    "protocol_id",
    "protocol_version",
    "depth",
    "adapter_id",
    "freshness_state",
    "quality_record",
    "prompt_digest",
)


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _as_str_list(value: Sequence[str] | None) -> list[str]:
    if value is None:
        return []
    return [str(item) for item in value]


def _intent_fingerprint(intent: Mapping[str, Any]) -> Any:
    """Canonical ProtectedIntent snapshot for immutability checks."""
    return canonicalize(dict(intent))


def build_context_protocol_lineage(
    *,
    context_snapshot_ids: Sequence[str],
    protocol_id: str,
    protocol_version: str,
    depth: str,
    adapter_id: str,
    freshness_state: str,
    quality_record: Mapping[str, Any] | QualityRecord,
    prompt_digest: str,
    prompt_lineage: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the versioned context-protocol lineage block for a new artifact."""
    if isinstance(quality_record, QualityRecord):
        qr = quality_record.to_dict()
    else:
        qr = dict(quality_record)
    if "receipt" in qr:
        raise ValueError("quality_record must never use key 'receipt'")
    block: dict[str, Any] = {
        "context_snapshot_ids": _as_str_list(context_snapshot_ids),
        "protocol_id": str(protocol_id),
        "protocol_version": str(protocol_version),
        "depth": str(depth),
        "adapter_id": str(adapter_id),
        "freshness_state": str(freshness_state),
        "quality_record": qr,
        "prompt_digest": str(prompt_digest),
        "prompt_lineage": [dict(node) for node in (prompt_lineage or ())],
    }
    return canonicalize(block)


def _integrity_body(artifact: Mapping[str, Any]) -> dict[str, Any]:
    body = {k: v for k, v in artifact.items() if k != "integrity"}
    return canonicalize(body)


def compute_integrity(artifact: Mapping[str, Any]) -> dict[str, Any]:
    digest = _sha256_hex(canonical_dumps(_integrity_body(artifact)))
    return {
        "algorithm": "SHA-256",
        "content_sha256": digest,
        "state": "COMPUTED",
    }


def verify_integrity(artifact: Mapping[str, Any]) -> dict[str, Any]:
    art = dict(artifact)
    integrity = dict(art.get("integrity") or {})
    expected = integrity.get("content_sha256")
    digest = _sha256_hex(canonical_dumps(_integrity_body(art)))
    state = "VERIFIED" if expected == digest else "MISMATCH"
    return {
        **art,
        "integrity": {
            "algorithm": "SHA-256",
            "content_sha256": str(expected or digest),
            "state": state,
        },
    }


def build_spe_artifact(
    partial: Mapping[str, Any],
    *,
    spe_format: str = SPE_FORMAT_V1,
    context_protocol: Mapping[str, Any] | None = None,
    created_at_utc: str | None = None,
) -> dict[str, Any]:
    """Build a portable ``.spe`` artifact dict with integrity digest.

    Legacy ``spe.artifact.v1`` omits context-protocol lineage unless provided
    (fields remain optional). ``spe.artifact.v2`` requires a full lineage block.
    """
    fmt = str(spe_format)
    if fmt not in {SPE_FORMAT_V1, SPE_FORMAT_V2}:
        raise ValueError(f"unsupported spe_format: {fmt}")

    base: dict[str, Any] = {
        "spe_format": fmt,
        "created_at_utc": created_at_utc
        if created_at_utc is not None
        else str(partial.get("created_at_utc") or ""),
        "user_request": str(partial["user_request"]),
        "category": str(partial.get("category", "")),
        "target": str(partial.get("target", "")),
        "envelope": canonicalize(partial.get("envelope", {})),
        "wasm": canonicalize(
            partial.get(
                "wasm",
                {
                    "status": None,
                    "disposition": None,
                    "reason_code": None,
                    "sha256": None,
                    "imports": None,
                    "network_mode": "NONE",
                    "used_ts_fallback": False,
                },
            )
        ),
        "rendered_prompt": str(partial.get("rendered_prompt", "")),
        "intent": canonicalize(partial["intent"]),
        "lineage": canonicalize(
            partial.get(
                "lineage",
                {
                    "engine": "spe_wasm.wasm → spe-core-rs",
                    "abi": "spe.universal-abi.v1",
                    "ui": "SPE-WEB-01",
                    "not_a_release": True,
                },
            )
        ),
    }

    cp = context_protocol
    if cp is None and CONTEXT_PROTOCOL_LINEAGE_KEY in partial:
        cp = partial[CONTEXT_PROTOCOL_LINEAGE_KEY]  # type: ignore[assignment]

    if fmt == SPE_FORMAT_V2:
        if cp is None:
            raise ValueError("spe.artifact.v2 requires context_protocol lineage")
        lineage_block = _normalize_lineage_block(cp)
        base[CONTEXT_PROTOCOL_LINEAGE_KEY] = lineage_block
    elif cp is not None:
        # Optional on v1 — persist when caller supplies it, no silent injection.
        base[CONTEXT_PROTOCOL_LINEAGE_KEY] = _normalize_lineage_block(cp)

    base["integrity"] = compute_integrity(base)
    return base


def _normalize_lineage_block(raw: Mapping[str, Any]) -> dict[str, Any]:
    missing = [k for k in _REQUIRED_LINEAGE_FIELDS if k not in raw]
    if missing:
        raise ValueError(f"context_protocol missing required fields: {missing}")
    qr = raw["quality_record"]
    if isinstance(qr, QualityRecord):
        qr_dict = qr.to_dict()
    else:
        qr_dict = dict(qr)  # type: ignore[arg-type]
    if "receipt" in qr_dict:
        raise ValueError("quality_record must never use key 'receipt'")
    return canonicalize(
        {
            "context_snapshot_ids": _as_str_list(raw.get("context_snapshot_ids")),  # type: ignore[arg-type]
            "protocol_id": str(raw["protocol_id"]),
            "protocol_version": str(raw["protocol_version"]),
            "depth": str(raw["depth"]),
            "adapter_id": str(raw["adapter_id"]),
            "freshness_state": str(raw["freshness_state"]),
            "quality_record": qr_dict,
            "prompt_digest": str(raw["prompt_digest"]),
            "prompt_lineage": [
                canonicalize(dict(node))
                for node in (raw.get("prompt_lineage") or ())
            ],
        }
    )


def loads_spe_artifact(raw: Mapping[str, Any] | str) -> dict[str, Any]:
    """Deserialize a ``.spe`` artifact without migrating / rewriting intent."""
    if isinstance(raw, str):
        import json

        data = json.loads(raw)
    else:
        data = dict(raw)
    if not isinstance(data, MutableMapping):
        raise TypeError("spe artifact must be a mapping")
    fmt = data.get("spe_format")
    if fmt not in {SPE_FORMAT_V1, SPE_FORMAT_V2}:
        raise ValueError(f"unsupported spe_format: {fmt!r}")
    for key in _REQUIRED_V1:
        if key not in data:
            raise ValueError(f"missing required artifact field: {key}")
    if fmt == SPE_FORMAT_V2:
        if CONTEXT_PROTOCOL_LINEAGE_KEY not in data:
            raise ValueError("spe.artifact.v2 requires context_protocol")
        _normalize_lineage_block(data[CONTEXT_PROTOCOL_LINEAGE_KEY])
    # Deep-copy to avoid caller mutation; never rewrite intent.
    return copy.deepcopy(dict(data))


def dumps_spe_artifact(artifact: Mapping[str, Any]) -> str:
    """Serialize artifact to deterministic canonical JSON text."""
    return canonical_dumps(loads_spe_artifact(artifact))


def roundtrip_spe_artifact(artifact: Mapping[str, Any]) -> dict[str, Any]:
    """Load then dump-parse round-trip; preserves ProtectedIntent bytes-equal."""
    loaded = loads_spe_artifact(artifact)
    text = dumps_spe_artifact(loaded)
    return loads_spe_artifact(text)


def protected_intent_of(artifact: Mapping[str, Any]) -> Any:
    """Return the immutable ProtectedIntent surface (``intent``)."""
    return _intent_fingerprint(artifact["intent"])  # type: ignore[arg-type]


def refresh_stale_context(
    artifact: Mapping[str, Any],
    *,
    new_context_snapshot_id: str,
    new_prompt_digest: str,
    freshness_state: str = "FRESH",
    now_iso: str,
    quality_record: Mapping[str, Any] | QualityRecord | None = None,
) -> dict[str, Any]:
    """Create a new context snapshot + prompt lineage node without mutating intent.

    Returns a **new** ``spe.artifact.v2`` artifact. The input's ProtectedIntent
    (``intent``) is copied unchanged. No in-place mutation of ``artifact``.
    """
    src = loads_spe_artifact(artifact)
    intent_before = protected_intent_of(src)

    prior_cp = src.get(CONTEXT_PROTOCOL_LINEAGE_KEY) or {}
    if not isinstance(prior_cp, Mapping):
        prior_cp = {}

    snapshot_ids = list(prior_cp.get("context_snapshot_ids") or [])
    if new_context_snapshot_id not in snapshot_ids:
        snapshot_ids.append(str(new_context_snapshot_id))

    prompt_lineage = [dict(n) for n in (prior_cp.get("prompt_lineage") or [])]
    prompt_lineage.append(
        {
            "node_id": f"prompt:{new_prompt_digest}",
            "kind": "PROMPT",
            "prompt_digest": str(new_prompt_digest),
            "created_at_utc": str(now_iso),
            "from_snapshot_id": str(new_context_snapshot_id),
        }
    )

    if quality_record is None:
        qr_raw = prior_cp.get("quality_record") or {
            "protocol_id": str(prior_cp.get("protocol_id") or "unknown"),
            "protocol_version": str(prior_cp.get("protocol_version") or "1"),
            "depth": str(prior_cp.get("depth") or "STANDARD"),
            "required_nodes": [],
            "completed_nodes": [],
            "skipped_nodes": [],
            "failed_nodes": [],
            "unknown_nodes": [],
            "context_capsule_ids": snapshot_ids,
            "evaluator_results": [],
            "unverified_claims": [],
            "known_limitations": [],
            "freshness_state": str(freshness_state),
            "adapter_id": str(prior_cp.get("adapter_id") or ""),
            "prompt_digest": str(new_prompt_digest),
        }
        if isinstance(qr_raw, QualityRecord):
            qr = qr_raw.to_dict()
        else:
            qr = dict(qr_raw)
        qr["freshness_state"] = str(freshness_state)
        qr["prompt_digest"] = str(new_prompt_digest)
        qr["context_capsule_ids"] = list(snapshot_ids)
    elif isinstance(quality_record, QualityRecord):
        qr = quality_record.to_dict()
    else:
        qr = dict(quality_record)

    if "receipt" in qr:
        raise ValueError("quality_record must never use key 'receipt'")

    lineage_block = build_context_protocol_lineage(
        context_snapshot_ids=snapshot_ids,
        protocol_id=str(prior_cp.get("protocol_id") or "unknown"),
        protocol_version=str(prior_cp.get("protocol_version") or "1"),
        depth=str(prior_cp.get("depth") or "STANDARD"),
        adapter_id=str(prior_cp.get("adapter_id") or ""),
        freshness_state=str(freshness_state),
        quality_record=qr,
        prompt_digest=str(new_prompt_digest),
        prompt_lineage=prompt_lineage,
    )

    rebuilt = build_spe_artifact(
        {
            "user_request": src["user_request"],
            "category": src["category"],
            "target": src["target"],
            "envelope": src["envelope"],
            "wasm": src["wasm"],
            "rendered_prompt": src["rendered_prompt"],
            "intent": src["intent"],  # ProtectedIntent — copied, never rewritten
            "lineage": src["lineage"],
        },
        spe_format=SPE_FORMAT_V2,
        context_protocol=lineage_block,
        created_at_utc=str(now_iso),
    )

    intent_after = protected_intent_of(rebuilt)
    if not strict_equal(intent_before, intent_after):
        raise RuntimeError("ProtectedIntent mutated during stale context refresh")
    # Ensure source object was not mutated.
    if not strict_equal(protected_intent_of(artifact), intent_before):
        raise RuntimeError("ProtectedIntent mutated on source artifact")
    return rebuilt


__all__ = [
    "SPE_FORMAT_V1",
    "SPE_FORMAT_V2",
    "CONTEXT_PROTOCOL_LINEAGE_KEY",
    "build_context_protocol_lineage",
    "build_spe_artifact",
    "compute_integrity",
    "dumps_spe_artifact",
    "loads_spe_artifact",
    "protected_intent_of",
    "refresh_stale_context",
    "roundtrip_spe_artifact",
    "verify_integrity",
]
