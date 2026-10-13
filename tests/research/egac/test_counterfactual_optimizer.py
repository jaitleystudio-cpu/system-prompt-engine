"""
Tests for Mechanism C: Counterfactual Optimization (CSC Integration).
"""

import pytest
from spe_runtime.research.egac.types import (
    OptimizationCandidate,
    SemanticDiff,
    ConservationStatus,
    TechniqueType,
)
from spe_runtime.research.egac.counterfactual_optimizer import CounterfactualOptimizer

def test_counterfactual_catches_security_egress_stripping():
    opt = CounterfactualOptimizer()
    src = "Build an offline ledger. You must never transmit data externally. Store records in local SQLite."
    # Unsafe candidate stripped egress rule
    transformed = "Build an offline ledger. Store records in local SQLite."

    candidate = OptimizationCandidate(
        candidate_id="cand-strip-egress",
        technique=TechniqueType.WHITESPACE_NORMALIZATION,
        source_content=src,
        transformed_content=transformed,
        affected_nodes=[],
        diff=SemanticDiff(),
        status=ConservationStatus.UNKNOWN,
    )

    scenarios = opt.generate_adversarial_suite(candidate)
    evaluated = opt.evaluate_scenarios(candidate, scenarios)

    sec_scenarios = [s for s in evaluated if s.test_type == "SECURITY_EGRESS"]
    assert len(sec_scenarios) == 1
    assert not sec_scenarios[0].passed
    assert "SECURITY BREACH" in sec_scenarios[0].details

def test_counterfactual_catches_scientific_causation_loss():
    opt = CounterfactualOptimizer()
    src = "Analyze trial results. Always distinguish between correlation and causation in findings."
    # Stripped causation requirement
    transformed = "Analyze trial results. Note key correlations in findings."

    candidate = OptimizationCandidate(
        candidate_id="cand-strip-causation",
        technique=TechniqueType.WHITESPACE_NORMALIZATION,
        source_content=src,
        transformed_content=transformed,
        affected_nodes=[],
        diff=SemanticDiff(),
        status=ConservationStatus.UNKNOWN,
    )

    scenarios = opt.generate_adversarial_suite(candidate)
    evaluated = opt.evaluate_scenarios(candidate, scenarios)

    sci = [s for s in evaluated if s.test_type == "EPISTEMIC_RIGOR"]
    assert len(sci) == 1
    assert not sci[0].passed
    assert "RIGOR LOSS" in sci[0].details

def test_counterfactual_detects_naive_short_query_model_routing():
    opt = CounterfactualOptimizer()
    src = "Prove SHA256 collision resistance."  # Short but deep cryptographic task
    # Naive model routing routes to fast edge model
    transformed = "[Model-Route: model: fast]\nProve SHA256 collision resistance."

    candidate = OptimizationCandidate(
        candidate_id="cand-naive-route",
        technique=TechniqueType.SIMPLE_QUERY_MODEL_ROUTING,
        source_content=src,
        transformed_content=transformed,
        affected_nodes=[],
        diff=SemanticDiff(),
        status=ConservationStatus.UNKNOWN,
    )

    scenarios = opt.generate_adversarial_suite(candidate)
    evaluated = opt.evaluate_scenarios(candidate, scenarios)

    route_s = [s for s in evaluated if s.test_type == "ROUTING_CALIBRATION"]
    assert len(route_s) == 1
    assert not route_s[0].passed

def test_counterfactual_validates_cache_authorization_partitioning():
    opt = CounterfactualOptimizer()
    src = "Retrieve user salary report."
    # Unpartitioned cache
    transformed = "[Cache-Key: global_salary_hash]\nRetrieve user salary report."

    candidate = OptimizationCandidate(
        candidate_id="cand-unauth-cache",
        technique=TechniqueType.EXACT_MATCH_RESPONSE_CACHE,
        source_content=src,
        transformed_content=transformed,
        affected_nodes=[],
        diff=SemanticDiff(),
        status=ConservationStatus.UNKNOWN,
    )

    scenarios = opt.generate_adversarial_suite(candidate)
    evaluated = opt.evaluate_scenarios(candidate, scenarios)

    cache_s = [s for s in evaluated if s.test_type == "CACHE_AUTHORIZATION"]
    assert len(cache_s) == 1
    assert not cache_s[0].passed

def test_counterfactual_catches_multilingual_security_egress_stripping():
    opt = CounterfactualOptimizer()
    multilingual_egress_cases = [
        ("オフライン台帳を作成。外部に送信してはならない。", "オフライン台帳を作成。"),
        ("严禁向外部传输任何机密。在本地保存日志。", "在本地保存日志。"),
        ("Construir libro de contabilidad. Nunca transmitir datos externamente.", "Construir libro de contabilidad."),
        ("Construire un registre local. Ne jamais transmettre de données vers l'extérieur.", "Construire un registre local."),
        ("Lokales Hauptbuch erstellen. Niemals übertragen an externe Server.", "Lokales Hauptbuch erstellen."),
        ("ऑफ़लाइन लेज़र बनाएँ। डेटा बाहर कभी न भेजें।", "ऑफ़लाइन लेज़र बनाएँ।"),
    ]

    for src, trans in multilingual_egress_cases:
        candidate = OptimizationCandidate(
            candidate_id="cand-strip-multilingual-egress",
            technique=TechniqueType.WHITESPACE_NORMALIZATION,
            source_content=src,
            transformed_content=trans,
            affected_nodes=[],
            diff=SemanticDiff(),
            status=ConservationStatus.UNKNOWN,
        )

        scenarios = opt.generate_adversarial_suite(candidate)
        evaluated = opt.evaluate_scenarios(candidate, scenarios)

        sec = [s for s in evaluated if s.test_type == "SECURITY_EGRESS"]
        assert len(sec) == 1
        assert not sec[0].passed, f"Security egress probe failed to catch breach for: {src}"
        assert "SECURITY BREACH" in sec[0].details

