"""Integration tests for protocol compiler + adapter rendering (Task 7)."""

from __future__ import annotations

from spe_runtime.adapters.protocol_render import render_execution_contract
from spe_runtime.protocols.capability_routing import CapabilityProfile
from spe_runtime.protocols.compiler import (
    ExecutionContract,
    compile_execution_contract,
)
from spe_runtime.protocols.models import ProtocolDepth


def contract_with_unknown_capabilities() -> ExecutionContract:
    return compile_execution_contract(
        domain_ids=("general",),
        depth=ProtocolDepth.STANDARD,
        capability_profile=None,
    )


def critical_research_contract() -> ExecutionContract:
    return compile_execution_contract(
        domain_ids=("research",),
        depth=ProtocolDepth.CRITICAL,
        capability_profile=None,
    )


def test_any_ai_includes_conditional_auto_routing_without_vendor_names():
    text = render_execution_contract(contract_with_unknown_capabilities(), "ANY_AI")
    assert "If your environment provides relevant tools" in text
    assert "OpenAI" not in text and "Anthropic" not in text and "Google" not in text


def test_adapter_cannot_drop_required_research_stage():
    contract = critical_research_contract()
    text = render_execution_contract(contract, "ANY_AI")
    assert "Contradictory Evidence" in text
    assert "Replication / Independent Check" in text


def test_render_emits_auditable_stage_titles_not_hidden_cot():
    text = render_execution_contract(critical_research_contract(), "ANY_AI")
    # Auditable stage titles present
    assert "Research Mission Compiler" in text
    # Must not request private/hidden reasoning scratchpads
    lower = text.lower()
    assert "think privately" not in lower
    assert "secret scratchpad" not in lower
    assert "hidden reasoning" not in lower


def test_compile_merges_multi_domain_and_preserves_auto_route():
    contract = compile_execution_contract(
        domain_ids=("research", "coding"),
        depth=ProtocolDepth.DEEP,
        capability_profile=CapabilityProfile(available=()),
    )
    assert isinstance(contract, ExecutionContract)
    text = render_execution_contract(contract, "ANY_AI")
    assert "If your environment provides relevant tools" in text
    merge_keys = [n.merge_key for n in contract.graph.nodes]
    assert merge_keys.count("capability.auto_route") == 1
