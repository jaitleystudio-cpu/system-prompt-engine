"""Batch E Turn 5 — adversarial suite for provider-profile / adapter / .spe bind.

Proves (within declared Batch E scope):
1. provider/profile cannot grant itself authority
2. external profile cannot silently activate network; allow_external defaults false
3. profile change cannot mutate ProtectedIntent
4. unknown profile cannot become PASS / SELECTED
5. .spe import cannot escalate capabilities (registry + selection remain closed)
6. local failure does not silently switch to cloud / EXTERNAL_OPTIONAL

HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN. No live spend / network / credentials release.
"""

from __future__ import annotations

import copy

import pytest

from spe_runtime.portability.canonical import strict_equal
from spe_runtime.portability.capability import detect_capability_escalation
from spe_runtime.portability.spe_artifact import (
    build_spe_artifact,
    loads_spe_artifact,
    protected_intent_of,
    refresh_stale_context,
    roundtrip_spe_artifact,
    verify_integrity,
)
from spe_runtime.providers.adapter import (
    STATUS_BLOCKED,
    STATUS_SELECTED,
    STATUS_UNAVAILABLE,
    ProfileSelection,
    RoutingPolicy,
    select_profile,
)
from spe_runtime.providers.profiles import (
    FORBIDDEN_AUTHORITY_FLAGS,
    get_provider_profile,
    list_provider_profiles,
    provider_profile_digest,
    validate_provider_profile,
)


def _intent() -> dict:
    return {
        "confirmed": [
            {
                "id": "desired-output",
                "label": "Desired Output",
                "text": "Ship a local-only dry-run",
            },
            {
                "id": "hard-constraint-privacy",
                "label": "Privacy",
                "text": "No network without explicit opt-in",
            },
        ],
        "assumed": [
            {
                "id": "desired-example",
                "label": "Example",
                "text": "EXAMPLE / USER_SUPPLIED / NON-AUTHORITATIVE",
            }
        ],
        "unknowns": [{"id": "u1", "label": "Open", "text": "cloud spend unknown"}],
        "conflicts": [],
    }


def _execution_record(
    *,
    profile_id: str | None,
    status: str,
    reason: str,
    overall: str = "UNKNOWN",
    authority_granted: bool = False,
    forged_capabilities: list[str] | None = None,
) -> dict:
    contract: dict = {
        "protocol_id": "protocol.adversarial",
        "depth": "STANDARD",
        "goal": "adversarial",
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
        "provider_profile_id": profile_id,
        "profile_version": None,
        "provider_profile_digest": None,
        "profile_selection_status": status,
        "profile_selection_reason": reason,
        "profile_display_source": "python_adapter",
        "profile_semantic_owner": "spe_runtime.providers.profiles+adapter",
        "profile_authority_granted": bool(authority_granted),
    }
    if profile_id is not None:
        try:
            profile = get_provider_profile(profile_id)
            contract["profile_version"] = profile.profile_version
            contract["provider_profile_digest"] = provider_profile_digest(profile)
            if forged_capabilities is not None:
                contract["forged_capabilities_probe"] = list(forged_capabilities)
        except KeyError:
            contract["profile_version"] = "0.0.0-forged"
            contract["provider_profile_digest"] = "0" * 64
    return {
        "record_format": "spe.local-execution-record.v1",
        "recorded_at_utc": "2026-09-26T00:00:00.000Z",
        "build_sha": "adversarial-tip",
        "mode": "LOCAL_DRY_RUN",
        "side_effects": "NONE",
        "executed": False,
        "outcome": "NOT_EXECUTED" if overall != "FAIL" else "BLOCKED",
        "contract": contract,
        "quality_record": {"protocol_id": "protocol.adversarial"},
        "checks": [
            {
                "id": "profile-not-authority",
                "label": "Provider profile does not escalate authority",
                "status": "PASS" if not authority_granted else "FAIL",
                "detail": "adversarial",
            },
            {
                "id": "protocol-outcome",
                "label": "Protocol execution outcome",
                "status": "UNKNOWN",
                "detail": "open",
            },
        ],
        "conformance": {
            "overall": overall,
            "pass": 1 if not authority_granted else 0,
            "fail": 0 if not authority_granted else 1,
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


def _build_artifact(execution_record: dict | None = None) -> dict:
    partial: dict = {
        "user_request": "adversarial batch-e",
        "category": "Writing",
        "target": "any",
        "envelope": {},
        "rendered_prompt": "prompt",
        "intent": _intent(),
    }
    if execution_record is not None:
        partial["execution_record"] = execution_record
    return build_spe_artifact(partial, created_at_utc="2026-09-26T00:00:00.000Z")


# ---------------------------------------------------------------------------
# 1. Provider / profile cannot grant itself authority
# ---------------------------------------------------------------------------


def test_adv_profile_cannot_self_grant_authority_via_registry():
    for profile in list_provider_profiles():
        flags = {f.lower() for f in profile.authority_capabilities}
        assert flags.isdisjoint(FORBIDDEN_AUTHORITY_FLAGS)
        for flag in flags:
            assert flag.startswith("read_") or flag in {"inspect", "describe"}

    escalating = get_provider_profile("DETERMINISTIC").to_dict()
    for bad in ("execute", "self_escalate", "mint_authority", "grant", "admin"):
        probe = copy.deepcopy(escalating)
        probe["authority_capabilities"] = [bad]
        with pytest.raises(ValueError, match="authority"):
            validate_provider_profile(probe)


def test_adv_selection_never_mints_authority_even_when_forced():
    for policy in ({}, {"allow_external": True, "credentials_available": True}):
        sel = select_profile(need=None, policy=policy)
        assert sel.authority_granted is False
        assert sel.to_dict()["authority_granted"] is False

    forced = ProfileSelection(
        profile_id="EXTERNAL_OPTIONAL",
        status=STATUS_SELECTED,
        reason="adversary tries to self-grant",
        authority_granted=True,
        network_enabled=True,
        credentials_released=True,
    )
    assert forced.authority_granted is False
    assert forced.network_enabled is False
    assert forced.credentials_released is False


# ---------------------------------------------------------------------------
# 2. External cannot silently activate network; allow_external default false
# ---------------------------------------------------------------------------


def test_adv_allow_external_defaults_false_and_external_not_silent():
    default_policy = RoutingPolicy.from_mapping(None)
    assert default_policy.allow_external is False
    assert default_policy.allow_network is False
    assert default_policy.external_permitted() is False

    empty = RoutingPolicy.from_mapping({})
    assert empty.allow_external is False

    # EXTERNAL_OPTIONAL is declared network-required but never auto-enabled.
    ext = get_provider_profile("EXTERNAL_OPTIONAL")
    assert ext.requires_network is True
    assert ext.privacy_behavior.get("auto_enable") is False
    assert ext.privacy_behavior.get("requires_explicit_opt_in") is True

    pinned = select_profile(
        need={"profile_id": "EXTERNAL_OPTIONAL"},
        policy={},  # default allow_external=false
    )
    assert pinned.status == STATUS_BLOCKED
    assert pinned.profile_id is None
    assert pinned.network_enabled is False
    assert "allow_external" in pinned.reason

    need_only_external = select_profile(
        need={"capabilities": ["external_optional", "network_optional"]},
        policy={"allow_external": False},
    )
    assert need_only_external.status == STATUS_BLOCKED
    assert need_only_external.profile_id is None
    assert need_only_external.network_enabled is False


def test_adv_even_explicit_external_selection_does_not_enable_network():
    sel = select_profile(
        need={"capabilities": ["external_optional"]},
        policy={"allow_external": True, "allow_network": True},
    )
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "EXTERNAL_OPTIONAL"
    assert sel.network_enabled is False
    assert sel.credentials_released is False
    assert sel.authority_granted is False
    assert "network not auto-enabled" in sel.reason or "not an authority grant" in sel.reason


# ---------------------------------------------------------------------------
# 3. Profile change cannot mutate ProtectedIntent
# ---------------------------------------------------------------------------


def test_adv_profile_bind_and_refresh_do_not_mutate_protected_intent():
    from spe_runtime.portability.spe_artifact import build_context_protocol_lineage

    art = _build_artifact()
    intent_before = protected_intent_of(art)

    # Bind DETERMINISTIC execution_record
    sel_local = select_profile(policy={"allow_external": False})
    assert sel_local.profile_id == "DETERMINISTIC"
    art_local = _build_artifact(
        _execution_record(
            profile_id=sel_local.profile_id,
            status=sel_local.status,
            reason=sel_local.reason,
        )
    )
    assert strict_equal(protected_intent_of(art_local), intent_before)

    # Switch selection narrative to LOCAL_WASM — intent must stay identical.
    sel_wasm = select_profile(need={"profile_id": "LOCAL_WASM"}, policy={})
    record_wasm = _execution_record(
        profile_id=sel_wasm.profile_id,
        status=sel_wasm.status,
        reason=sel_wasm.reason,
    )
    lineage = build_context_protocol_lineage(
        context_snapshot_ids=["snap-adv-0"],
        protocol_id="protocol.adversarial",
        protocol_version="1.0.0",
        depth="STANDARD",
        adapter_id="adversarial-adapter",
        freshness_state="STALE",
        quality_record={"protocol_id": "protocol.adversarial", "status": "UNKNOWN"},
        prompt_digest="adv-digest-old",
    )
    art_wasm = build_spe_artifact(
        {
            "user_request": "adversarial batch-e",
            "category": "Writing",
            "target": "any",
            "envelope": {},
            "rendered_prompt": "prompt",
            "intent": _intent(),
            "execution_record": record_wasm,
        },
        created_at_utc="2026-09-26T00:00:00.000Z",
        context_protocol=lineage,
    )
    assert strict_equal(protected_intent_of(art_wasm), intent_before)
    assert art_wasm["intent"] == art["intent"]

    # Round-trip + refresh must preserve ProtectedIntent bytes-equal.
    rt = roundtrip_spe_artifact(art_wasm)
    assert strict_equal(protected_intent_of(rt), intent_before)

    refreshed = refresh_stale_context(
        art_wasm,
        new_context_snapshot_id="snap-adv-1",
        new_prompt_digest="adv-digest-new",
        freshness_state="FRESH",
        now_iso="2026-09-26T12:00:00Z",
    )
    assert strict_equal(protected_intent_of(refreshed), intent_before)
    assert refreshed["intent"] == art["intent"]
    # Profile lineage on execution_record survives refresh without rewriting intent.
    assert refreshed["execution_record"]["contract"]["provider_profile_id"] == "LOCAL_WASM"


# ---------------------------------------------------------------------------
# 4. Unknown profile cannot become PASS / SELECTED
# ---------------------------------------------------------------------------


def test_adv_unknown_profile_cannot_become_pass_or_selected():
    sel = select_profile(
        need={"profile_id": "CLOUD_GOD_MODE_NOT_REAL"},
        policy={"allow_external": True, "allow_network": True, "credentials_available": True},
    )
    assert sel.status == STATUS_UNAVAILABLE
    assert sel.status != STATUS_SELECTED
    assert sel.profile_id is None
    assert "unknown" in sel.reason.lower()
    # Selection outcome is not a PASS claim — unavailable is closed.
    assert sel.authority_granted is False
    assert sel.to_dict()["status"] == STATUS_UNAVAILABLE

    with pytest.raises(KeyError, match="unknown provider profile"):
        get_provider_profile("CLOUD_GOD_MODE_NOT_REAL")

    # Forged execution_record claiming unknown profile + PASS overall:
    # Durable storage may persist the blob, but re-selecting must stay closed,
    # and conformance overall UNKNOWN/FAIL must not be trusted as SELECTED.
    forged = _execution_record(
        profile_id="CLOUD_GOD_MODE_NOT_REAL",
        status=STATUS_SELECTED,  # adversary lies
        reason="forged pass",
        overall="PASS",
        authority_granted=True,
    )
    art = _build_artifact(forged)
    loaded = loads_spe_artifact(art)
    # Re-run real selector — still UNAVAILABLE, never SELECTED/PASS.
    reselect = select_profile(
        need={"profile_id": loaded["execution_record"]["contract"]["provider_profile_id"]},
        policy={"allow_external": True},
    )
    assert reselect.status == STATUS_UNAVAILABLE
    assert reselect.profile_id is None
    # Honest local records must not treat unknown as SELECTED.
    honest = select_profile(need={"profile_id": "NOPE"}, policy={})
    assert honest.status != STATUS_SELECTED
    assert honest.status in {STATUS_UNAVAILABLE, STATUS_BLOCKED}


# ---------------------------------------------------------------------------
# 5. .spe import cannot escalate capabilities
# ---------------------------------------------------------------------------


def test_adv_spe_import_cannot_escalate_capabilities():
    local = get_provider_profile("DETERMINISTIC")
    external = get_provider_profile("EXTERNAL_OPTIONAL")

    # Capability law: DETERMINISTIC may not claim EXTERNAL-only caps.
    esc = detect_capability_escalation(
        set(local.capabilities),
        set(local.capabilities) | set(external.capabilities) | {"execute", "mint_authority"},
    )
    assert esc["ok"] is False
    assert "execute" in esc["extra"] or "mint_authority" in esc["extra"] or esc["extra"]

    # Forge an imported .spe that claims EXTERNAL caps + authority on a local bind.
    forged_caps = list(local.capabilities) + [
        "external_optional",
        "network_optional",
        "execute",
        "mint_authority",
    ]
    forged_record = _execution_record(
        profile_id="DETERMINISTIC",
        status=STATUS_SELECTED,
        reason="forged escalation import",
        overall="PASS",
        authority_granted=True,
        forged_capabilities=forged_caps,
    )
    art = _build_artifact(forged_record)
    imported = loads_spe_artifact(art)
    rt = roundtrip_spe_artifact(imported)
    verified = verify_integrity(rt)
    assert verified["integrity"]["state"] == "VERIFIED"

    # Registry row is unchanged — import does not mutate authoritative profile.
    registry_row = get_provider_profile("DETERMINISTIC")
    assert set(registry_row.capabilities) == set(local.capabilities)
    assert "execute" not in {c.lower() for c in registry_row.authority_capabilities}
    assert "mint_authority" not in {
        c.lower() for c in registry_row.authority_capabilities
    }

    # Re-select under default policy stays local and non-escalating.
    sel = select_profile(policy={})
    assert sel.profile_id == "DETERMINISTIC"
    assert sel.authority_granted is False
    assert sel.network_enabled is False
    assert set(sel.profile.capabilities).isdisjoint({"execute", "mint_authority"})

    # Escalation detector rejects widening to forged caps.
    again = detect_capability_escalation(
        set(registry_row.capabilities),
        set(forged_caps),
    )
    assert again["ok"] is False

    # validate_provider_profile rejects inventing escalating authority on import path.
    evil = registry_row.to_dict()
    evil["authority_capabilities"] = ["execute"]
    with pytest.raises(ValueError, match="authority"):
        validate_provider_profile(evil)


# ---------------------------------------------------------------------------
# 6. Local failure does not silently switch to cloud
# ---------------------------------------------------------------------------


def test_adv_local_failure_does_not_silently_switch_to_cloud():
    # Need only EXTERNAL can cover, but allow_external=false → BLOCKED, not cloud.
    sel = select_profile(
        need={"capabilities": ["external_optional", "compat_adapter"]},
        policy={
            "allow_external": False,
            "allow_network": False,
            "credentials_available": True,  # credentials alone must not flip path
        },
    )
    assert sel.status == STATUS_BLOCKED
    assert sel.profile_id is None
    assert sel.profile_id != "EXTERNAL_OPTIONAL"
    assert sel.network_enabled is False
    assert "no silent remote fallback" in sel.reason or "allow_external" in sel.reason

    # Network-required need without allow → BLOCKED (not EXTERNAL).
    net = select_profile(
        need={"capabilities": ["offline"], "network_required": True},
        policy={"allow_external": False, "allow_network": False},
    )
    assert net.status == STATUS_BLOCKED
    assert net.profile_id is None

    # Uncovered capability → UNAVAILABLE/BLOCKED, never silent EXTERNAL.
    miss = select_profile(
        need={"capabilities": ["totally_missing_capability_zzzz"]},
        policy={"allow_external": False},
    )
    assert miss.status in {STATUS_UNAVAILABLE, STATUS_BLOCKED}
    assert miss.profile_id is None
    assert miss.profile_id != "EXTERNAL_OPTIONAL"

    # Even with allow_external, local-covering need must not flip to cloud.
    local = select_profile(
        need={"capabilities": ["replay", "offline"]},
        policy={
            "allow_external": True,
            "allow_network": True,
            "credentials_available": True,
        },
    )
    assert local.status == STATUS_SELECTED
    assert local.profile_id == "DETERMINISTIC"
    assert local.profile_id != "EXTERNAL_OPTIONAL"


def test_adv_default_routing_policy_is_local_first_closed():
    sel = select_profile(need=None, policy=None)
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "DETERMINISTIC"
    assert get_provider_profile(sel.profile_id).local_or_external == "local"
    assert sel.network_enabled is False
    assert sel.authority_granted is False
    assert sel.credentials_released is False
