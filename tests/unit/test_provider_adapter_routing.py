"""Batch E Turn 3 — thin Capability ABI adapter + local-first routing."""

from __future__ import annotations

import pytest

from spe_runtime.protocols.capability_routing import (
    build_auto_route_node_for_provider,
    capability_profile_for_provider,
)
from spe_runtime.providers.adapter import (
    STATUS_BLOCKED,
    STATUS_SELECTED,
    STATUS_UNAVAILABLE,
    CapabilityNeed,
    ProfileSelection,
    RoutingPolicy,
    select_profile,
)
from spe_runtime.providers.profiles import get_provider_profile


def test_local_first_prefers_deterministic_or_local_wasm_over_external():
    # Empty need → first local-first profile (DETERMINISTIC).
    sel = select_profile(need=None, policy={"allow_external": True})
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "DETERMINISTIC"
    assert sel.reason
    assert "local-first" in sel.reason or "DETERMINISTIC" in sel.reason

    # Capability covered by both local + external → must stay local.
    sel2 = select_profile(
        need={"capabilities": ["offline"]},
        policy={"allow_external": True},
    )
    assert sel2.status == STATUS_SELECTED
    assert sel2.profile_id in {"DETERMINISTIC", "LOCAL_WASM"}
    assert sel2.profile_id != "EXTERNAL_OPTIONAL"

    # WASM-only capability → LOCAL_WASM, not external.
    sel3 = select_profile(
        need=["wasm_runtime", "local_inference"],
        policy=RoutingPolicy(allow_external=True, allow_network=True),
    )
    assert sel3.status == STATUS_SELECTED
    assert sel3.profile_id == "LOCAL_WASM"


def test_prefer_deterministic_flag():
    sel = select_profile(
        need={"capabilities": ["offline"], "prefer_deterministic": True},
        policy={},
    )
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "DETERMINISTIC"
    assert "prefer_deterministic" in sel.reason or sel.profile_id == "DETERMINISTIC"


def test_external_disabled_no_external_optional():
    # Need only external can cover.
    sel = select_profile(
        need={"capabilities": ["external_optional", "network_optional"]},
        policy={"allow_external": False},
    )
    assert sel.status == STATUS_BLOCKED
    assert sel.profile_id is None
    assert "EXTERNAL_OPTIONAL" in sel.reason or "allow_external" in sel.reason
    assert "EXTERNAL_OPTIONAL" != sel.profile_id


def test_external_allowed_when_explicit():
    sel = select_profile(
        need={"capabilities": ["external_optional", "compat_adapter"]},
        policy={"allow_external": True},
    )
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "EXTERNAL_OPTIONAL"
    assert "allow_external" in sel.reason
    assert sel.network_enabled is False  # never auto-enabled by selection
    assert sel.credentials_released is False


def test_network_required_rejection_when_not_allowed():
    sel = select_profile(
        need={"capabilities": ["offline"], "network_required": True},
        policy={"allow_external": False, "allow_network": False},
    )
    assert sel.status == STATUS_BLOCKED
    assert sel.profile_id is None
    assert "network-required" in sel.reason.lower() or "network" in sel.reason.lower()


def test_unknown_profile_rejected():
    sel = select_profile(
        need={"profile_id": "NOT_A_REAL_PROVIDER_PROFILE"},
        policy={},
    )
    assert sel.status == STATUS_UNAVAILABLE
    assert sel.profile_id is None
    assert "unknown" in sel.reason.lower()

    with pytest.raises(KeyError, match="unknown provider profile"):
        capability_profile_for_provider("NOT_A_REAL_PROVIDER_PROFILE")


def test_authority_non_escalation_selection_is_not_grant():
    sel = select_profile(need=["deterministic_fixture"], policy={})
    assert sel.status == STATUS_SELECTED
    assert sel.authority_granted is False
    assert sel.network_enabled is False
    assert sel.credentials_released is False
    # Even if caller tries to construct a grant, dataclass coerces to False.
    forced = ProfileSelection(
        profile_id="DETERMINISTIC",
        status=STATUS_SELECTED,
        reason="probe",
        authority_granted=True,
        network_enabled=True,
        credentials_released=True,
    )
    assert forced.authority_granted is False
    assert forced.network_enabled is False
    assert forced.credentials_released is False
    d = sel.to_dict()
    assert d["authority_granted"] is False
    assert d["network_enabled"] is False
    assert d["credentials_released"] is False


def test_reason_string_present_on_all_outcomes():
    cases = [
        select_profile(need=None, policy={}),
        select_profile(
            need={"capabilities": ["external_optional"]},
            policy={"allow_external": False},
        ),
        select_profile(need={"profile_id": "NOPE"}, policy={}),
        select_profile(
            need={"capabilities": ["no_such_capability_zzzz"]},
            policy={"allow_external": True},
        ),
    ]
    for sel in cases:
        assert isinstance(sel.reason, str)
        assert sel.reason.strip()
        assert sel.status in {STATUS_SELECTED, STATUS_BLOCKED, STATUS_UNAVAILABLE}


def test_pinned_external_blocked_without_allow():
    sel = select_profile(
        need={"profile_id": "EXTERNAL_OPTIONAL"},
        policy={"allow_external": False},
    )
    assert sel.status == STATUS_BLOCKED
    assert sel.profile_id is None


def test_pinned_local_ok():
    sel = select_profile(
        need={"profile_id": "LOCAL_WASM"},
        policy={},
    )
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "LOCAL_WASM"
    assert get_provider_profile("LOCAL_WASM").profile_id == sel.profile_id


def test_capability_routing_wrap_is_data_only():
    caps = capability_profile_for_provider("DETERMINISTIC")
    assert "deterministic_fixture" in caps.available
    node = build_auto_route_node_for_provider(
        "DETERMINISTIC", task_benefits_from_tools=True
    )
    assert node is not None
    assert "DATA only" in node.instruction or "not an authority grant" in node.instruction.lower()
    assert build_auto_route_node_for_provider(
        "DETERMINISTIC", task_benefits_from_tools=False
    ) is None


def test_no_silent_local_to_remote_fallback():
    # Local covers → never EXTERNAL even with allow_external.
    sel = select_profile(
        need={"capabilities": ["replay", "test_double"]},
        policy={"allow_external": True, "allow_network": True, "credentials_available": True},
    )
    assert sel.profile_id == "DETERMINISTIC"
    assert sel.profile_id != "EXTERNAL_OPTIONAL"
