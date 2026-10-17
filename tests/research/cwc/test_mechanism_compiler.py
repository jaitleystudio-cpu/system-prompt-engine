"""
Adversarial tests for CWC-1 Mechanism Compiler & Identifiability Analyzer.
"""

import pytest
from spe_runtime.research.cwc.mechanism_compiler import MechanismCompiler
from spe_runtime.research.cwc.types import IdentifiabilityStatus, MechanismClass


def test_competing_mechanisms_structure():
    compiler = MechanismCompiler(epsilon_identifiability=0.05)
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order discovery")

    assert len(mechs) >= 2
    for m in mechs:
        assert m.mechanism_id.startswith("MECH-")
        assert len(m.assumptions) >= 1
        assert len(m.causal_edges) >= 1
        assert len(m.equations) >= 1
        assert len(m.falsification_conditions) >= 1
        assert 0.0 < m.prior_weight <= 1.0


def test_observational_equivalence_at_baseline():
    """At x=1, both y=2x and y=x+x^2 predict y=2.0 (TV gap = 0, OBSERVATIONALLY_EQUIVALENT)."""
    compiler = MechanismCompiler(epsilon_identifiability=0.05)
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order discovery", existing_data_point=1.0)

    status, tv_gap = compiler.compute_identifiability(mechs, "x_baseline")
    assert status == IdentifiabilityStatus.OBSERVATIONALLY_EQUIVALENT
    assert tv_gap < 0.05


def test_identifiability_under_intervention():
    """Under intervention at x=2, y=2x predicts 4.0, while y=x+x^2 predicts 6.0 (TV gap = 0.33 > 0.05)."""
    compiler = MechanismCompiler(epsilon_identifiability=0.05)
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order discovery")

    status, tv_gap = compiler.compute_identifiability(mechs, "x_intervene_2")
    assert status == IdentifiabilityStatus.UNIQUE_IDENTIFIED
    assert tv_gap >= 0.05


def test_multi_domain_compilation():
    compiler = MechanismCompiler()
    # Neuroscience
    neuro_mechs = compiler.compile_competing_mechanisms("neuroscience", "Long-term potentiation expression mechanism")
    assert any("AMPA" in m.name for m in neuro_mechs)
    assert any("Nitric Oxide" in m.name for m in neuro_mechs)

    # Materials Science
    mat_mechs = compiler.compile_competing_mechanisms("materials superconductor", "High-Tc pairing symmetry")
    assert any("Phonon" in m.name for m in mat_mechs)
    assert any("Spin-Fluctuation" in m.name for m in mat_mechs)
