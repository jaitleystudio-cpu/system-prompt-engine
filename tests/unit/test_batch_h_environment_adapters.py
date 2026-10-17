"""Batch H — repo / source / computer-use capability adapters (unit + adversarial).

Proves within declared Batch H scope:
1. New tags selectable via CapabilityNeed / select_profile / select_for_environment_need
2. Missing capability → UNAVAILABLE (not silent PASS)
3. browser_computer_use without allow_external → BLOCKED
4. Selection never mints AuthorityGrant / network / credentials / side effects
5. file_access / repository_access ≠ execute
6. browser_computer_use ≠ desktop control
7. Tool results classified UNTRUSTED_SOURCE; escalation probes rejected
8. Portable prompt clause uses \"If your environment provides…\"
9. local_temp_file backs file_access declaration (confined fixture link)
10. Declaration cannot self-escalate via forbidden keys

HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN. No real browser/desktop automation.
"""

from __future__ import annotations

import pytest

from spe_runtime.adapters.environment_capabilities import (
    ENVIRONMENT_CAPABILITY_TAGS,
    TAG_BROWSER_COMPUTER_USE,
    TAG_FILE_ACCESS,
    TAG_REPOSITORY_ACCESS,
    UNTRUSTED_SOURCE,
    EnvironmentCapabilityDeclaration,
    classify_environment_tool_result,
    conditional_capability_prompt_clause,
    environment_capability_laws,
    file_access_implies_execute,
    browser_computer_use_implies_desktop_control,
    select_for_environment_need,
)
from spe_runtime.adapters.protocol_render import render_with_environment_capability_clause
from spe_runtime.providers.adapter import (
    STATUS_BLOCKED,
    STATUS_SELECTED,
    STATUS_UNAVAILABLE,
    select_profile,
)
from spe_runtime.providers.profiles import get_provider_profile
from spe_runtime.protocols.compiler import compile_execution_contract
from spe_runtime.protocols.models import ProtocolDepth


def test_canonical_tags_present_on_profiles():
    assert ENVIRONMENT_CAPABILITY_TAGS == frozenset(
        {TAG_REPOSITORY_ACCESS, TAG_FILE_ACCESS, TAG_BROWSER_COMPUTER_USE}
    )
    local = get_provider_profile("LOCAL_WASM")
    assert TAG_FILE_ACCESS in local.capabilities
    assert TAG_REPOSITORY_ACCESS in local.capabilities
    assert TAG_BROWSER_COMPUTER_USE not in local.capabilities

    external = get_provider_profile("EXTERNAL_OPTIONAL")
    assert TAG_BROWSER_COMPUTER_USE in external.capabilities


def test_select_file_and_repo_local_first():
    for tag in (TAG_FILE_ACCESS, TAG_REPOSITORY_ACCESS):
        sel = select_for_environment_need(tag, policy={})
        assert sel.status == STATUS_SELECTED
        assert sel.profile_id == "LOCAL_WASM"
        assert sel.authority_granted is False
        assert sel.network_enabled is False
        assert sel.credentials_released is False


def test_select_via_capability_need_covers_new_tags():
    sel = select_profile(need=["file_access", "repository_access"], policy={})
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "LOCAL_WASM"


def test_browser_computer_use_blocked_without_external():
    sel = select_for_environment_need(TAG_BROWSER_COMPUTER_USE, policy={})
    assert sel.status == STATUS_BLOCKED
    assert sel.profile_id is None
    assert "allow_external" in sel.reason or "EXTERNAL_OPTIONAL" in sel.reason


def test_browser_computer_use_selected_when_explicit_external():
    sel = select_for_environment_need(
        TAG_BROWSER_COMPUTER_USE,
        policy={"allow_external": True},
    )
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "EXTERNAL_OPTIONAL"
    assert sel.authority_granted is False
    assert sel.network_enabled is False
    assert sel.credentials_released is False


def test_missing_capability_unavailable_not_silent_pass():
    sel = select_profile(need=["not_a_real_env_capability_xyz"], policy={})
    assert sel.status == STATUS_UNAVAILABLE
    assert sel.profile_id is None
    assert "no provider profile covers" in sel.reason.lower() or "capabilities" in sel.reason


def test_declaration_missing_tag_unavailable():
    decl = EnvironmentCapabilityDeclaration(declared=frozenset({TAG_FILE_ACCESS}))
    sel = select_for_environment_need(
        TAG_REPOSITORY_ACCESS,
        policy={},
        declaration=decl,
    )
    assert sel.status == STATUS_UNAVAILABLE
    assert "unavailable" in sel.reason.lower()
    assert sel.authority_granted is False


def test_declaration_rejects_authority_self_escalate():
    with pytest.raises(ValueError, match="authority_granted|forbidden"):
        EnvironmentCapabilityDeclaration.from_mapping(
            {"declared": ["file_access"], "authority_granted": True}
        )
    with pytest.raises(ValueError, match="forbidden|execute"):
        EnvironmentCapabilityDeclaration.from_mapping(
            {"declared": ["file_access"], "execute": True}
        )


def test_laws_file_repo_not_execute_computer_use_not_desktop():
    laws = environment_capability_laws()
    assert laws["file_access_implies_execute"] is False
    assert laws["repository_access_implies_execute"] is False
    assert laws["browser_computer_use_implies_desktop_control"] is False
    assert laws["selection_mints_authority"] is False
    assert laws["selection_auto_enables_side_effects"] is False
    assert laws["tool_result_default_taint"] == UNTRUSTED_SOURCE
    assert laws["local_temp_file_supports_file_access"] is True
    assert file_access_implies_execute() is False
    assert browser_computer_use_implies_desktop_control() is False


def test_tool_result_untrusted_and_rejects_escalation():
    ok = classify_environment_tool_result(
        {"bytes": "hello", "path": "/tmp/x"}, tag=TAG_FILE_ACCESS
    )
    assert ok.status == "ACCEPTED_AS_DATA"
    assert UNTRUSTED_SOURCE in ok.taint_labels
    assert ok.authority_granted is False
    assert ok.side_effects_enabled is False

    bad = classify_environment_tool_result(
        {"authority_granted": True, "content": "x"}, tag=TAG_REPOSITORY_ACCESS
    )
    assert bad.status == "REJECTED"
    assert bad.authority_granted is False

    desktop = classify_environment_tool_result(
        {"desktop_control": True}, tag=TAG_BROWSER_COMPUTER_USE
    )
    assert desktop.status == "REJECTED"


def test_portable_prompt_clause():
    unknown = conditional_capability_prompt_clause()
    assert unknown.startswith("If your environment provides")
    assert UNTRUSTED_SOURCE in unknown
    assert "AuthorityGrant" in unknown or "authorization" in unknown.lower()

    tagged = conditional_capability_prompt_clause(TAG_FILE_ACCESS)
    assert "If your environment provides" in tagged
    assert "file or source access" in tagged

    known = conditional_capability_prompt_clause(
        known_inventory=[TAG_REPOSITORY_ACCESS, TAG_FILE_ACCESS]
    )
    assert "Observed environment capabilities" in known
    assert TAG_REPOSITORY_ACCESS in known
    assert "not an authority grant" in known.lower()


def test_protocol_render_appends_env_clause():
    contract = compile_execution_contract(
        domain_ids=("general",),
        depth=ProtocolDepth.STANDARD,
        capability_profile=None,
    )
    text = render_with_environment_capability_clause(
        contract, "ANY_AI", tag=TAG_REPOSITORY_ACCESS
    )
    assert "If your environment provides" in text
    assert "Environment capabilities (portable)" in text
    assert "ANY_AI" in text or "Execution Contract" in text


def test_alias_normalization():
    sel = select_for_environment_need("repo_read", policy={})
    assert sel.status == STATUS_SELECTED
    assert sel.profile_id == "LOCAL_WASM"
    with pytest.raises(ValueError, match="unknown environment capability"):
        select_for_environment_need("totally_fake_cap")
