"""Unit tests for Level 5 Dialectical Co-Evolution Arena."""

import pytest

from spe_runtime.discovery.dialectical_arena import (
    AdversarialFalsifier,
    DialecticalArena,
    HypothesisProposer,
)
from spe_runtime.discovery.models import (
    BoundaryKind,
    DiscoveryHypothesis,
    FalsificationWorld,
    HypothesisStatus,
)


def test_proposer_generates_valid_hypotheses():
    proposer = HypothesisProposer()
    for domain in ["FINANCIAL_RISK", "PRIVACY_SHIELD", "AST_OPTIMIZER", "RATE_LIMITER"]:
        hypo = proposer.propose(domain, seed_index=1)
        assert hypo.domain == domain
        assert len(hypo.invariants) >= 1
        assert "op" in hypo.synthesized_procedure
        assert hypo.status == HypothesisStatus.CONJECTURE
        assert len(hypo.compute_digest()) == 64


def test_falsifier_synthesizes_targeted_counter_worlds():
    proposer = HypothesisProposer()
    falsifier = AdversarialFalsifier()

    hypo_fin = proposer.propose("FINANCIAL_RISK")
    worlds = falsifier.synthesize_counter_worlds(hypo_fin)
    assert len(worlds) >= 3
    kinds = {w.boundary_kind for w in worlds}
    assert BoundaryKind.AUTHORITY_REVOKED in kinds
    assert BoundaryKind.ADVERSARIAL_PAYLOAD in kinds


def test_dialectical_arena_duel_survival():
    proposer = HypothesisProposer()
    falsifier = AdversarialFalsifier()
    arena = DialecticalArena()

    hypo = proposer.propose("FINANCIAL_RISK")
    worlds = falsifier.synthesize_counter_worlds(hypo)

    receipt = arena.duel(hypo, worlds)
    assert receipt.hypothesis_id == hypo.hypothesis_id
    assert not receipt.falsified
    assert receipt.survived_worlds == len(worlds)
    assert receipt.wald_sprt_lcb95 > 0.0
    assert len(receipt.proof_hash) == 64
    assert hypo.status == HypothesisStatus.SURVIVED
