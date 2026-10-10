"""Unit tests for Level 5 MAP-Elites Quality-Diversity Archive."""

import pytest

from spe_runtime.discovery.dialectical_arena import DialecticalArena, HypothesisProposer
from spe_runtime.discovery.map_elites import QualityDiversityArchive


def test_map_elites_discretization():
    archive = QualityDiversityArchive(complexity_bins=3, sparsity_bins=3, generality_bins=3)

    coords_low = archive.discretize(complexity=1.5, sparsity=180.0, generality=1)
    assert coords_low == (0, 0, 0)

    coords_high = archive.discretize(complexity=8.0, sparsity=20.0, generality=5)
    assert coords_high == (2, 2, 2)


def test_map_elites_add_and_replacement():
    archive = QualityDiversityArchive()
    proposer = HypothesisProposer()
    arena = DialecticalArena()

    hypo1 = proposer.propose("RATE_LIMITER", seed_index=1)
    receipt1 = arena.duel(hypo1, [])

    # Add first candidate
    added1 = archive.add(
        hypothesis=hypo1,
        fitness_score=1.2,
        complexity=2.0,
        sparsity=80.0,
        generality=2,
        duel_receipt=receipt1,
    )
    assert added1 is True
    assert archive.total_elites() == 1

    # Add inferior candidate to same niche -> should not replace
    hypo2 = proposer.propose("RATE_LIMITER", seed_index=2)
    receipt2 = arena.duel(hypo2, [])
    added2 = archive.add(
        hypothesis=hypo2,
        fitness_score=0.9,
        complexity=2.0,
        sparsity=80.0,
        generality=2,
        duel_receipt=receipt2,
    )
    assert added2 is False
    assert archive.total_elites() == 1

    # Add superior candidate to same niche -> should replace
    hypo3 = proposer.propose("RATE_LIMITER", seed_index=3)
    receipt3 = arena.duel(hypo3, [])
    added3 = archive.add(
        hypothesis=hypo3,
        fitness_score=1.8,
        complexity=2.0,
        sparsity=80.0,
        generality=2,
        duel_receipt=receipt3,
    )
    assert added3 is True
    assert archive.total_elites() == 1
    champions = archive.get_champions(1)
    assert champions[0].hypothesis.hypothesis_id == hypo3.hypothesis_id
    assert champions[0].fitness_score == 1.8
