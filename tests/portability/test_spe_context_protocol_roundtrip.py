"""Task 14 — .spe artifact lineage round-trip + ProtectedIntent immutability."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.portability.canonical import strict_equal
from spe_runtime.portability.spe_artifact import (
    CONTEXT_PROTOCOL_LINEAGE_KEY,
    SPE_FORMAT_V1,
    SPE_FORMAT_V2,
    build_context_protocol_lineage,
    build_spe_artifact,
    dumps_spe_artifact,
    loads_spe_artifact,
    protected_intent_of,
    refresh_stale_context,
    roundtrip_spe_artifact,
    verify_integrity,
)
from spe_runtime.protocols.quality_record import QualityRecord

REPO = Path(__file__).resolve().parents[2]
SCHEMA = REPO / "schemas" / "spe_artifact.schema.json"


def _legacy_v1_partial():
    return {
        "user_request": "Summarize the quarterly report",
        "category": "Writing",
        "target": "any",
        "envelope": {"envelope_id": "e-legacy-1"},
        "wasm": {
            "status": "OK",
            "disposition": None,
            "reason_code": None,
            "sha256": "abc",
            "imports": 0,
            "network_mode": "NONE",
            "used_ts_fallback": False,
        },
        "rendered_prompt": "Please summarize the quarterly report.",
        "intent": {
            "confirmed": [
                {"id": "i1", "label": "Goal", "text": "Summarize quarterly report"}
            ],
            "assumed": [],
            "unknowns": [],
            "conflicts": [],
        },
        "created_at_utc": "2026-01-01T00:00:00Z",
    }


def _quality_record(**overrides):
    base = QualityRecord(
        protocol_id="research.general",
        protocol_version="1",
        depth="STANDARD",
        required_nodes=("MISSION", "UNDERSTAND"),
        completed_nodes=("MISSION",),
        skipped_nodes=(),
        failed_nodes=(),
        unknown_nodes=(),
        context_capsule_ids=("cap-1",),
        evaluator_results=(),
        unverified_claims=(),
        known_limitations=("offline",),
        freshness_state="STALE",
        adapter_id="ANY_AI",
        prompt_digest="digest-old",
    )
    data = base.to_dict()
    data.update(overrides)
    return data


def test_old_artifact_roundtrips_unchanged():
    legacy = build_spe_artifact(_legacy_v1_partial(), spe_format=SPE_FORMAT_V1)
    assert legacy["spe_format"] == SPE_FORMAT_V1
    assert CONTEXT_PROTOCOL_LINEAGE_KEY not in legacy

    original = copy.deepcopy(legacy)
    rt = roundtrip_spe_artifact(legacy)

    assert strict_equal(rt, original)
    assert CONTEXT_PROTOCOL_LINEAGE_KEY not in rt
    assert protected_intent_of(rt) == protected_intent_of(original)
    # No silent migration to v2
    assert rt["spe_format"] == SPE_FORMAT_V1

    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    jsonschema.validate(rt, schema)


def test_new_artifact_preserves_protected_intent():
    qr = _quality_record(freshness_state="FRESH", prompt_digest="digest-new")
    lineage = build_context_protocol_lineage(
        context_snapshot_ids=["snap-a"],
        protocol_id="research.general",
        protocol_version="1",
        depth="DEEP",
        adapter_id="ANY_AI",
        freshness_state="FRESH",
        quality_record=qr,
        prompt_digest="digest-new",
        prompt_lineage=[
            {
                "node_id": "prompt:digest-new",
                "kind": "PROMPT",
                "prompt_digest": "digest-new",
                "created_at_utc": "2026-09-24T10:00:00Z",
            }
        ],
    )
    art = build_spe_artifact(
        _legacy_v1_partial(),
        spe_format=SPE_FORMAT_V2,
        context_protocol=lineage,
        created_at_utc="2026-09-24T10:00:00Z",
    )
    intent_before = copy.deepcopy(art["intent"])
    rt = roundtrip_spe_artifact(art)

    assert rt["spe_format"] == SPE_FORMAT_V2
    assert rt[CONTEXT_PROTOCOL_LINEAGE_KEY]["protocol_id"] == "research.general"
    assert rt[CONTEXT_PROTOCOL_LINEAGE_KEY]["prompt_digest"] == "digest-new"
    assert "receipt" not in json.dumps(rt)
    assert rt[CONTEXT_PROTOCOL_LINEAGE_KEY]["quality_record"]["adapter_id"] == "ANY_AI"
    assert strict_equal(rt["intent"], intent_before)
    assert protected_intent_of(rt) == protected_intent_of(art)

    verified = verify_integrity(rt)
    assert verified["integrity"]["state"] == "VERIFIED"

    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    jsonschema.validate(rt, schema)


def test_stale_context_refresh_new_snapshot_and_prompt_lineage_without_intent_mutation():
    qr = _quality_record()
    lineage = build_context_protocol_lineage(
        context_snapshot_ids=["cap-stale-1"],
        protocol_id="research.general",
        protocol_version="1",
        depth="STANDARD",
        adapter_id="ANY_AI",
        freshness_state="STALE",
        quality_record=qr,
        prompt_digest="digest-old",
        prompt_lineage=[
            {
                "node_id": "prompt:digest-old",
                "kind": "PROMPT",
                "prompt_digest": "digest-old",
                "created_at_utc": "2026-01-01T00:00:00Z",
                "from_snapshot_id": "cap-stale-1",
            }
        ],
    )
    # Start from a v1-shaped payload that already carries optional lineage,
    # then refresh into a new v2 snapshot without touching ProtectedIntent.
    stale = build_spe_artifact(
        _legacy_v1_partial(),
        spe_format=SPE_FORMAT_V1,
        context_protocol=lineage,
    )
    intent_before = copy.deepcopy(stale["intent"])
    source_copy = copy.deepcopy(stale)

    refreshed = refresh_stale_context(
        stale,
        new_context_snapshot_id="cap-stale-1:refresh:abc123",
        new_prompt_digest="digest-refreshed",
        freshness_state="FRESH",
        now_iso="2026-09-24T12:00:00Z",
    )

    assert refreshed["spe_format"] == SPE_FORMAT_V2
    cp = refreshed[CONTEXT_PROTOCOL_LINEAGE_KEY]
    assert "cap-stale-1" in cp["context_snapshot_ids"]
    assert "cap-stale-1:refresh:abc123" in cp["context_snapshot_ids"]
    assert cp["prompt_digest"] == "digest-refreshed"
    assert cp["freshness_state"] == "FRESH"
    assert any(
        n.get("prompt_digest") == "digest-refreshed" for n in cp["prompt_lineage"]
    )
    assert len(cp["prompt_lineage"]) == 2

    # ProtectedIntent immutable on result and on source.
    assert strict_equal(refreshed["intent"], intent_before)
    assert strict_equal(stale["intent"], intent_before)
    assert strict_equal(stale, source_copy)
    assert "receipt" not in dumps_spe_artifact(refreshed)

    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    jsonschema.validate(refreshed, schema)


def test_v2_requires_context_protocol():
    with pytest.raises(ValueError, match="requires context_protocol"):
        build_spe_artifact(_legacy_v1_partial(), spe_format=SPE_FORMAT_V2)


def test_loads_rejects_unknown_format():
    bad = build_spe_artifact(_legacy_v1_partial(), spe_format=SPE_FORMAT_V1)
    bad["spe_format"] = "spe.artifact.v999"
    with pytest.raises(ValueError, match="unsupported spe_format"):
        loads_spe_artifact(bad)


def test_quality_record_rejects_receipt_key():
    with pytest.raises(ValueError, match="receipt"):
        build_context_protocol_lineage(
            context_snapshot_ids=["c1"],
            protocol_id="p",
            protocol_version="1",
            depth="QUICK",
            adapter_id="ANY_AI",
            freshness_state="FRESH",
            quality_record={"receipt": {"no": True}, "protocol_id": "p"},
            prompt_digest="x",
        )
