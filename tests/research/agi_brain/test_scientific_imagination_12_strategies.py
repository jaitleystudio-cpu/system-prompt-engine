"""
Unit & Adversarial Tests for Intelligence III: 12 Invention Strategies
"""

import pytest
from spe_runtime.research.agi_brain.types import (
    ScientificObjective,
    KnowledgeState,
    DomainType,
    InventionStrategy,
)
from spe_runtime.research.agi_brain.scientific_imagination import ScientificImaginationEngine

def test_all_twelve_invention_strategies_generate_valid_candidates():
    engine = ScientificImaginationEngine()
    objective = ScientificObjective(
        objective_id="obj-cs-01",
        description="Design sub-millisecond Byzantine Fault Tolerant consensus",
        domain=DomainType.COMPUTER_SCIENCE,
        frozen_intent="Sub-millisecond BFT consensus with 3f+1 nodes",
        hard_constraints=["p99_latency <= 1ms", "fault_tolerance >= 1/3"],
    )
    knowledge = KnowledgeState()

    for strategy in InventionStrategy:
        candidate = engine.generate_candidate(strategy, objective, knowledge)
        assert candidate.strategy == strategy
        assert len(candidate.hypothesis_statement) > 10
        assert len(candidate.mechanism) > 10
        assert 0.0 <= candidate.feasibility_score <= 1.0
        assert 0.0 <= candidate.novelty_score <= 1.0
        assert 0.0 <= candidate.testability_score <= 1.0
        assert 0.0 <= candidate.prior_art_overlap <= 1.0

def test_diverse_portfolio_prevents_premature_collapse():
    engine = ScientificImaginationEngine()
    objective = ScientificObjective(
        objective_id="obj-opt-01",
        description="Solve non-convex global optimization problem",
        domain=DomainType.MATHEMATICS,
        frozen_intent="Find global minimum without getting trapped in saddle points",
    )
    knowledge = KnowledgeState()

    portfolio = engine.generate_diverse_portfolio(objective, knowledge)
    assert len(portfolio) == len(InventionStrategy)
    # Ensure distinct strategies are represented
    strategies_present = {c.strategy for c in portfolio}
    assert len(strategies_present) == 12
