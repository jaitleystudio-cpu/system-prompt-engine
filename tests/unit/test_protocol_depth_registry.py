"""RED/GREEN tests for adaptive category protocol depth + registry (Task 5)."""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.protocols.depth import (
    SCORE_DEEP_MAX,
    SCORE_QUICK_MAX,
    SCORE_STANDARD_MAX,
    DepthSignals,
    select_protocol_depth,
)
from spe_runtime.protocols.models import ProtocolDepth, ProtocolGraph, ProtocolNode
from spe_runtime.protocols.registry import load_protocol, list_protocol_domains

REPO_ROOT = Path(__file__).resolve().parents[2]
PROTOCOL_GRAPH_SCHEMA = REPO_ROOT / "schemas" / "protocol_graph.schema.json"

# Approved research CRITICAL 20-stage titles (exact order from design §10).
RESEARCH_CRITICAL_TITLES = (
    "Research Mission Compiler",
    "Question Decomposition",
    "Evidence Plan",
    "Foundational Literature",
    "Frontier / Latest Literature",
    "Contradictory Evidence",
    "Replication / Benchmark Evidence",
    "Full-Source Interrogation",
    "Code / Data / Method Verification",
    "Claim + Evidence Graph",
    "Contradiction Map",
    "Gap / Unknown Map",
    "Diverse Hypotheses",
    "Falsification / Adversarial Elimination",
    "Strongest Surviving Options",
    "Decision / Recommendation With Uncertainty",
    "Prototype / Experiment When Required",
    "Measured Proof",
    "Replication / Independent Check",
    "Only Then -> Product / Business Integration",
)

APPROVED_DOMAIN_FAMILIES = (
    "research",
    "coding",
    "debugging",
    "cybersecurity",
    "data_statistics",
    "math_engineering",
    "health_information",
    "legal_information",
    "finance",
    "business_strategy",
    "marketing_growth",
    "product_management",
    "ux_ui_web_design",
    "writing_communication",
    "education",
    "shopping",
    "travel_local",
    "news_current",
    "creative_media",
    "image_generation",
    "video_generation",
    "translation_localization",
    "career",
    "personal_planning",
    "prompt_engineering",
    "general",
)


def test_trivial_writing_request_routes_quick():
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=0,
                stakes=0,
                uncertainty=0,
                freshness=0,
                evidence=0,
                irreversibility=0,
            )
        )
        == ProtocolDepth.QUICK
    )


def test_high_stakes_multisource_request_routes_critical():
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=3,
                stakes=3,
                uncertainty=3,
                freshness=2,
                evidence=3,
                irreversibility=3,
            )
        )
        == ProtocolDepth.CRITICAL
    )


def test_score_at_quick_max_is_quick():
    # score == SCORE_QUICK_MAX (3): e.g. 1+1+1+0+0+0
    assert SCORE_QUICK_MAX == 3
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=1,
                stakes=1,
                uncertainty=1,
                freshness=0,
                evidence=0,
                irreversibility=0,
            )
        )
        == ProtocolDepth.QUICK
    )


def test_score_just_above_quick_max_is_standard():
    # score == SCORE_QUICK_MAX + 1 == 4
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=1,
                stakes=1,
                uncertainty=1,
                freshness=1,
                evidence=0,
                irreversibility=0,
            )
        )
        == ProtocolDepth.STANDARD
    )


def test_score_at_standard_max_is_standard():
    assert SCORE_STANDARD_MAX == 7
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=2,
                stakes=2,
                uncertainty=1,
                freshness=1,
                evidence=1,
                irreversibility=0,
            )
        )
        == ProtocolDepth.STANDARD
    )


def test_score_just_above_standard_max_is_deep():
    # score == 8
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=2,
                stakes=2,
                uncertainty=2,
                freshness=1,
                evidence=1,
                irreversibility=0,
            )
        )
        == ProtocolDepth.DEEP
    )


def test_score_at_deep_max_is_deep():
    assert SCORE_DEEP_MAX == 11
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=2,
                stakes=2,
                uncertainty=2,
                freshness=2,
                evidence=2,
                irreversibility=1,
            )
        )
        == ProtocolDepth.DEEP
    )


def test_score_just_above_deep_max_is_critical():
    # score == 12
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=2,
                stakes=2,
                uncertainty=2,
                freshness=2,
                evidence=2,
                irreversibility=2,
            )
        )
        == ProtocolDepth.CRITICAL
    )


def test_stakes_3_with_irreversibility_2_escalates_to_critical():
    """Explicit escalation: stakes==3 and irreversibility>=2 => CRITICAL."""
    # Raw score = 5 would otherwise be STANDARD.
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=0,
                stakes=3,
                uncertainty=0,
                freshness=0,
                evidence=0,
                irreversibility=2,
            )
        )
        == ProtocolDepth.CRITICAL
    )


def test_stakes_3_with_irreversibility_1_does_not_escalate():
    # score = 4 => STANDARD without escalation
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=0,
                stakes=3,
                uncertainty=0,
                freshness=0,
                evidence=0,
                irreversibility=1,
            )
        )
        == ProtocolDepth.STANDARD
    )


def test_stakes_2_with_high_irreversibility_does_not_escalate():
    # stakes != 3; score = 5 => STANDARD
    assert (
        select_protocol_depth(
            DepthSignals(
                complexity=0,
                stakes=2,
                uncertainty=0,
                freshness=0,
                evidence=0,
                irreversibility=3,
            )
        )
        == ProtocolDepth.STANDARD
    )


def test_protocol_models_are_frozen():
    node = ProtocolNode(
        node_id="n1",
        stage="MISSION",
        title="Mission",
        instruction="Clarify the mission.",
        required_at_depth=ProtocolDepth.QUICK,
        prerequisites=(),
        evidence_required=False,
        tool_class=None,
        exit_condition="mission_clear",
        failure_behavior="ABSTAIN",
        merge_key="mission.compile",
    )
    graph = ProtocolGraph(
        protocol_id="protocol.writing_communication.quick",
        domain_id="writing_communication",
        depth=ProtocolDepth.QUICK,
        version="1",
        nodes=(node,),
    )
    with pytest.raises(FrozenInstanceError):
        node.title = "mutated"  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        graph.nodes = ()  # type: ignore[misc]


def test_research_critical_preserves_approved_20_stages():
    graph = load_protocol("research", ProtocolDepth.CRITICAL)
    titles = tuple(n.title for n in graph.nodes)
    assert titles == RESEARCH_CRITICAL_TITLES
    assert len(graph.nodes) == 20
    assert graph.domain_id == "research"
    assert graph.depth == ProtocolDepth.CRITICAL


def test_protocol_graph_serializes_against_schema():
    graph = load_protocol("research", ProtocolDepth.CRITICAL)
    payload = graph.to_dict()
    schema = json.loads(PROTOCOL_GRAPH_SCHEMA.read_text(encoding="utf-8"))
    jsonschema.validate(payload, schema)


def test_registry_covers_approved_domain_families():
    domains = list_protocol_domains()
    assert len(domains) >= 25
    for domain_id in APPROVED_DOMAIN_FAMILIES:
        assert domain_id in domains
        for depth in ProtocolDepth:
            graph = load_protocol(domain_id, depth)
            assert graph.domain_id == domain_id
            assert graph.depth == depth
            assert len(graph.nodes) >= 1
            # QUICK must not inherit every CRITICAL-only stage for research
            if domain_id == "research" and depth == ProtocolDepth.QUICK:
                assert len(graph.nodes) < 20


def test_writing_quick_is_shallow():
    graph = load_protocol("writing_communication", ProtocolDepth.QUICK)
    assert graph.depth == ProtocolDepth.QUICK
    assert 1 <= len(graph.nodes) <= 5
    for n in graph.nodes:
        assert n.required_at_depth == ProtocolDepth.QUICK
