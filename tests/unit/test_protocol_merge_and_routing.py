"""RED/GREEN tests for protocol graph merge + capability auto-routing (Task 6)."""

from __future__ import annotations

import pytest

from spe_runtime.protocols.capability_routing import (
    CapabilityProfile,
    build_auto_route_node,
)
from spe_runtime.protocols.merge import merge_protocol_graphs
from spe_runtime.protocols.models import ProtocolDepth, ProtocolGraph, ProtocolNode


def _node(
    *,
    node_id: str,
    merge_key: str,
    instruction: str,
    required_at_depth: ProtocolDepth = ProtocolDepth.STANDARD,
    prerequisites: tuple[str, ...] = (),
    stage: str = "VERIFY",
    title: str | None = None,
) -> ProtocolNode:
    return ProtocolNode(
        node_id=node_id,
        stage=stage,
        title=title or node_id,
        instruction=instruction,
        required_at_depth=required_at_depth,
        prerequisites=prerequisites,
        evidence_required=True,
        tool_class=None,
        exit_condition="evidence recorded",
        failure_behavior="ABSTAIN",
        merge_key=merge_key,
    )


def research_graph() -> ProtocolGraph:
    return ProtocolGraph(
        protocol_id="protocol.research.standard",
        domain_id="research",
        depth=ProtocolDepth.STANDARD,
        version="1",
        nodes=(
            _node(
                node_id="RESEARCH.MISSION",
                merge_key="research.mission",
                instruction="Compile the research mission.",
                required_at_depth=ProtocolDepth.QUICK,
                stage="MISSION",
            ),
            _node(
                node_id="RESEARCH.VERIFY_EVIDENCE",
                merge_key="verify.evidence",
                instruction="Verify claims against cited evidence.",
                prerequisites=("RESEARCH.MISSION",),
            ),
        ),
    )


def product_graph() -> ProtocolGraph:
    return ProtocolGraph(
        protocol_id="protocol.product_management.standard",
        domain_id="product_management",
        depth=ProtocolDepth.STANDARD,
        version="1",
        nodes=(
            _node(
                node_id="PRODUCT.EXECUTE",
                merge_key="product.execute",
                instruction="Execute the product decision workflow.",
                stage="EXECUTE",
                required_at_depth=ProtocolDepth.QUICK,
            ),
            _node(
                node_id="PRODUCT.VERIFY_EVIDENCE",
                merge_key="verify.evidence",
                instruction="Verify claims against cited evidence.",
                prerequisites=("PRODUCT.EXECUTE",),
                required_at_depth=ProtocolDepth.DEEP,
            ),
        ),
    )


def test_merge_deduplicates_universal_verification_nodes():
    merged = merge_protocol_graphs((research_graph(), product_graph()))
    merge_keys = [n.merge_key for n in merged.nodes]
    assert merge_keys.count("verify.evidence") == 1
    # Domain-specific nodes preserved.
    assert "research.mission" in merge_keys
    assert "product.execute" in merge_keys
    # Non-conflicting prerequisites are unioned; stricter (earlier) depth wins.
    verify = next(n for n in merged.nodes if n.merge_key == "verify.evidence")
    assert set(verify.prerequisites) >= {"RESEARCH.MISSION", "PRODUCT.EXECUTE"}
    assert verify.required_at_depth == ProtocolDepth.STANDARD


def test_unknown_capabilities_render_conditionally():
    node = build_auto_route_node(None, task_benefits_from_tools=True)
    assert node is not None
    assert node.merge_key == "capability.auto_route"
    assert "If your environment provides relevant tools" in node.instruction


def test_many_capabilities_does_not_require_all_tools():
    profile = CapabilityProfile(
        available=("web", "calculator", "image_generation", "deployment")
    )
    node = build_auto_route_node(profile, task_benefits_from_tools=True)
    assert node is not None
    lower = node.instruction.lower()
    assert "smallest sufficient" in lower or "minimal relevant subset" in lower
    assert "use every tool" not in lower
    assert "every available" not in lower


def test_capability_descriptor_with_authority_keys_rejected():
    with pytest.raises(ValueError, match="forbidden"):
        CapabilityProfile.from_descriptor(
            {"available": ["web"], "deployment_authority": True}
        )
    with pytest.raises(ValueError, match="forbidden"):
        CapabilityProfile.from_descriptor(
            {"available": ["web"], "verified_success": True}
        )
    with pytest.raises(ValueError, match="forbidden"):
        CapabilityProfile.from_descriptor(
            {"available": ["web"], "PROMOTE": True}
        )


def test_contradictory_colliding_instructions_fail_closed():
    a = ProtocolGraph(
        protocol_id="a",
        domain_id="research",
        depth=ProtocolDepth.STANDARD,
        version="1",
        nodes=(
            _node(
                node_id="A.VERIFY",
                merge_key="verify.evidence",
                instruction="Always prefer source A.",
            ),
        ),
    )
    b = ProtocolGraph(
        protocol_id="b",
        domain_id="coding",
        depth=ProtocolDepth.STANDARD,
        version="1",
        nodes=(
            _node(
                node_id="B.VERIFY",
                merge_key="verify.evidence",
                instruction="Always prefer source B.",
            ),
        ),
    )
    with pytest.raises(ValueError, match="contradict|conflict|instruction"):
        merge_protocol_graphs((a, b))


def test_no_tool_benefit_returns_none():
    assert build_auto_route_node(None, task_benefits_from_tools=False) is None
