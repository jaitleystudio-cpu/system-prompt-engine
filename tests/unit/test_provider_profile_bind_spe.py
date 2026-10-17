"""Batch E Turn 4 — provider profile bind into execution_record + .spe round-trip."""

from __future__ import annotations

import copy

import pytest

from spe_runtime.portability.spe_artifact import (
    build_spe_artifact,
    loads_spe_artifact,
    roundtrip_spe_artifact,
    verify_integrity,
)
from spe_runtime.providers.adapter import select_profile
from spe_runtime.providers.profiles import (
    get_provider_profile,
    provider_profile_digest,
)


def _minimal_intent() -> dict:
    return {
        "confirmed": [{"id": "desired-output", "label": "Desired", "text": "ok"}],
        "assumed": [],
        "unknowns": [],
        "conflicts": [],
    }


def _execution_record_with_profile(profile_id: str = "DETERMINISTIC") -> dict:
    profile = get_provider_profile(profile_id)
    selection = select_profile(policy={"allow_external": False})
    assert selection.profile_id == profile_id
    assert selection.authority_granted is False
    return {
        "record_format": "spe.local-execution-record.v1",
        "recorded_at_utc": "2026-09-26T00:00:00.000Z",
        "build_sha": "tip-test",
        "mode": "LOCAL_DRY_RUN",
        "side_effects": "NONE",
        "executed": False,
        "outcome": "NOT_EXECUTED",
        "contract": {
            "protocol_id": "protocol.test",
            "depth": "STANDARD",
            "goal": "test",
            "hard_constraints": [],
            "acceptance_criteria": [],
            "authority": {
                "status": "NONE",
                "level": 0,
                "grants": [],
                "execution_grants": [],
            },
            "example": {
                "present": False,
                "classification": "EXAMPLE / USER_SUPPLIED",
                "non_authoritative": True,
            },
            "provider_profile_id": profile.profile_id,
            "profile_version": profile.profile_version,
            "provider_profile_digest": provider_profile_digest(profile),
            "profile_selection_status": selection.status,
            "profile_selection_reason": selection.reason,
            "profile_display_source": "python_adapter",
            "profile_semantic_owner": "spe_runtime.providers.profiles+adapter",
            "profile_authority_granted": False,
        },
        "quality_record": {"protocol_id": "protocol.test"},
        "checks": [
            {
                "id": "profile-not-authority",
                "label": "Provider profile does not escalate authority",
                "status": "PASS",
                "detail": "observational",
            },
            {
                "id": "protocol-outcome",
                "label": "Protocol execution outcome",
                "status": "UNKNOWN",
                "detail": "open",
            },
        ],
        "conformance": {
            "overall": "UNKNOWN",
            "pass": 1,
            "fail": 0,
            "unknown": 1,
        },
        "digests": {
            "input_artifact_sha256": "a" * 64,
            "goal_sha256": "b" * 64,
            "hard_constraints_sha256": "c" * 64,
            "contract_sha256": "d" * 64,
            "quality_record_sha256": "e" * 64,
            "prompt_sha256": "f" * 64,
            "record_sha256": "1" * 64,
        },
    }


def test_spe_roundtrip_preserves_provider_profile_lineage():
    record = _execution_record_with_profile("DETERMINISTIC")
    art = build_spe_artifact(
        {
            "user_request": "bind profile",
            "category": "Writing",
            "target": "any",
            "envelope": {},
            "rendered_prompt": "prompt",
            "intent": _minimal_intent(),
            "execution_record": record,
        },
        created_at_utc="2026-09-26T00:00:00.000Z",
    )
    assert "execution_record" in art
    assert art["execution_record"]["contract"]["provider_profile_id"] == "DETERMINISTIC"
    assert art["execution_record"]["contract"]["profile_version"] == "1.0.0"
    assert art["execution_record"]["conformance"]["overall"] == "UNKNOWN"

    rt = roundtrip_spe_artifact(art)
    assert (
        rt["execution_record"]["contract"]["provider_profile_id"]
        == "DETERMINISTIC"
    )
    assert rt["execution_record"]["contract"]["profile_version"] == "1.0.0"
    assert (
        rt["execution_record"]["contract"]["provider_profile_digest"]
        == record["contract"]["provider_profile_digest"]
    )
    assert rt["execution_record"]["contract"]["profile_authority_granted"] is False
    # UNKNOWN must not launder to PASS across round-trip
    assert rt["execution_record"]["conformance"]["overall"] == "UNKNOWN"
    verified = verify_integrity(rt)
    assert verified["integrity"]["state"] == "VERIFIED"


def test_spe_without_execution_record_still_builds():
    """Backward compatible — older artifacts omit execution_record."""
    art = build_spe_artifact(
        {
            "user_request": "legacy",
            "category": "Writing",
            "target": "any",
            "envelope": {},
            "rendered_prompt": "prompt",
            "intent": _minimal_intent(),
        },
        created_at_utc="2026-09-26T00:00:00.000Z",
    )
    assert "execution_record" not in art
    loaded = loads_spe_artifact(art)
    assert "execution_record" not in loaded


def test_execution_record_rejects_receipt_key():
    record = _execution_record_with_profile()
    bad = copy.deepcopy(record)
    bad["receipt"] = {"forged": True}
    with pytest.raises(ValueError, match="receipt"):
        build_spe_artifact(
            {
                "user_request": "bad",
                "category": "Writing",
                "target": "any",
                "envelope": {},
                "rendered_prompt": "prompt",
                "intent": _minimal_intent(),
                "execution_record": bad,
            },
            created_at_utc="2026-09-26T00:00:00.000Z",
        )


def test_profile_selection_does_not_escalate_authority():
    sel = select_profile(policy={"allow_external": True})
    assert sel.authority_granted is False
    assert sel.network_enabled is False
    assert sel.credentials_released is False
    d = sel.to_dict()
    assert d["authority_granted"] is False
