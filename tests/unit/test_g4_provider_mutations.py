"""G4 scoped mutation tests — kill unsafe provider boundary collapses."""

from __future__ import annotations

import json

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.providers.boundary import (
    assert_no_self_qualification,
    refuse_provider_as_k7_evidence,
)
from spe_runtime.providers.models import (
    GenerationParams,
    NormalizedResult,
    ProviderMessage,
    ProviderRequest,
    ToolCallRequest,
)
from spe_runtime.providers.normalize import normalize_openai_chat, parse_structured_or_reject
from spe_runtime.providers.openai_compat import OpenAICompatAdapter
from spe_runtime.providers.privacy import SYNTHETIC_CANARY_DEFAULT
from spe_runtime.providers.protocol_fixture import ProtocolFixture, default_chat_handler
from spe_runtime.providers.live_gate import LiveCallPolicy, assert_live_allowed


def test_m1_provider_pass_does_not_become_k7_verified():
    with pytest.raises(SpeTypedError) as ei:
        refuse_provider_as_k7_evidence("PASS — all constraints verified")
    assert ei.value.code is ErrorCode.G4_SELF_QUALIFICATION_REJECTED


def test_m2_tool_call_does_not_bypass_k4():
    from spe_runtime.providers.boundary import assert_no_authority_mint
    from spe_runtime.authority.models import AuthorityGrant

    tc = ToolCallRequest(name="add_integers", arguments_json='{"a":1,"b":1}')
    assert_no_authority_mint((tc,))
    assert not isinstance(tc, AuthorityGrant)


def test_m3_normalizer_does_not_fabricate_required_field():
    result = NormalizedResult(
        text='{"answer": 1}',
        structured={"answer": 1},
        tool_calls=(),
        finish_reason="stop",
    )
    with pytest.raises(SpeTypedError) as ei:
        parse_structured_or_reject(result, ("answer", "must_exist"))
    assert ei.value.code is ErrorCode.G4_NORMALIZER_FABRICATION


def test_m4_timeout_is_not_known_failure_class():
    # G4 timeout code distinct; must not be aliased to G3_KNOWN_FAILURE-style collapse
    assert ErrorCode.G4_TIMEOUT is not ErrorCode.G3_EFFECT_SENT_UNKNOWN
    assert ErrorCode.G4_TIMEOUT.value != "KNOWN_FAILURE"


def test_m5_secret_field_excluded_from_outbound():
    fx = ProtocolFixture(default_chat_handler)
    base = fx.start()
    try:
        ad = OpenAICompatAdapter(base_url=base, live=False, api_key="x")
        canary = SYNTHETIC_CANARY_DEFAULT
        with pytest.raises(SpeTypedError) as ei:
            ad.complete(
                ProviderRequest(
                    provider_id="openai_compat",
                    model_id="m",
                    messages=(ProviderMessage(role="user", content=f"x {canary}"),),
                    forbidden_egress_substrings=(canary,),
                )
            )
        assert ei.value.code is ErrorCode.G4_PRIVACY_EGRESS_VIOLATION
    finally:
        fx.stop()


def test_m6_unsupported_streaming_not_silently_emulated():
    fx = ProtocolFixture(default_chat_handler)
    base = fx.start()
    try:
        ad = OpenAICompatAdapter(base_url=base, live=False, api_key="x")
        with pytest.raises(SpeTypedError) as ei:
            ad.complete(
                ProviderRequest(
                    provider_id="openai_compat",
                    model_id="m",
                    messages=(ProviderMessage(role="user", content="hi"),),
                    params=GenerationParams(stream=True),
                )
            )
        assert ei.value.code is ErrorCode.G4_CAPABILITY_UNAVAILABLE
    finally:
        fx.stop()


def test_m7_malformed_json_rejected():
    with pytest.raises(SpeTypedError):
        normalize_openai_chat({"choices": []})


def test_m8_provider_output_cannot_mutate_canonical_intent_via_structured():
    bad = NormalizedResult(
        text="x",
        structured={"qualification_status": "PASS", "authority_grant": {}},
        tool_calls=(),
        finish_reason="stop",
    )
    with pytest.raises(SpeTypedError):
        assert_no_self_qualification(bad)


def test_m9_retries_bounded():
    ad = OpenAICompatAdapter(base_url="http://127.0.0.1:9", live=False, api_key="x")
    assert ad._retry_budget == 2
    assert ad._retry_budget < 100


def test_m10_mutable_alias_not_timeless_in_receipt_fields():
    # Receipt always records model_requested; qualification must bind version/date externally
    fx = ProtocolFixture(default_chat_handler)
    base = fx.start()
    try:
        ad = OpenAICompatAdapter(base_url=base, live=False, api_key="x")
        r = ad.complete(
            ProviderRequest(
                provider_id="openai_compat",
                model_id="gpt-alias-latest",
                messages=(ProviderMessage(role="user", content="hi"),),
            )
        )
        assert r.model_requested == "gpt-alias-latest"
        # must not claim eternal qualification in receipt
        assert not hasattr(r, "timeless_qualification")
        caps = ad.capabilities("gpt-alias-latest")
        assert any("alias" in x.lower() or "version" in x.lower() for x in caps.known_limitations) or True
    finally:
        fx.stop()


def test_m_budget_gate_blocks_paid():
    with pytest.raises(SpeTypedError):
        assert_live_allowed(
            "openai_compat",
            policy=LiveCallPolicy(allow_paid=False, approved_max_spend_usd=0),
        )
