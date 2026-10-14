"""
Adversarial tests for CWC-1 Transfer Engine & 100X Productivity Metric.
"""

import pytest
from spe_runtime.research.cwc.transfer_engine import TransferEngine
from spe_runtime.research.cwc.mechanism_compiler import MechanismCompiler
from spe_runtime.research.cwc.types import (
    ExplanatoryMechanism,
    QualificationState,
    ScientificWitness,
    ScientificWitnessType,
)


def test_ood_transfer_qualification_success():
    transfer_engine = TransferEngine(min_transfer_pass_rate=0.80)
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order")
    linear_mech = mechs[0]  # y = 2x

    witness = ScientificWitness(
        witness_id="WIT-01",
        witness_type=ScientificWitnessType.INTERVENTIONAL_EXPERIMENT,
        claim_statement="Linear scaling confirmed",
        mechanism_id=linear_mech.mechanism_id,
        supporting_observations=("OBS-01",),
        sha256_seal="a" * 64,
        truth_status="SUPPORTED",
        is_reproducible=True,
        biosecurity_screen_passed=True,
    )

    # 4 unseen test tasks that obey y = 2x
    unseen_cases = [
        {"x": 4.0, "expected_y": 8.0, "is_negative_control": False},
        {"x": 5.0, "expected_y": 10.0, "is_negative_control": False},
        {"x": 8.0, "expected_y": 16.0, "is_negative_control": False},
        {"x": 10.0, "expected_y": 0.0, "is_negative_control": True},  # Negative control: output must deviate from 0
    ]

    # Without external LVT token: qualifies as IN_DISTRIBUTION_SANITY_PASS (CWC-F09)
    proc_local = transfer_engine.evaluate_ood_transfer(linear_mech, witness, unseen_cases)
    assert proc_local.qualification_state == QualificationState.IN_DISTRIBUTION_SANITY_PASS
    assert proc_local.transfer_pass_rate == 1.0
    assert len(proc_local.known_counterexamples) == 0
    assert len(proc_local.cryptographic_seal) == 64

    # With verified external LVT token: promotes to TRANSFER_QUALIFIED_REUSABLE
    proc_lvt = transfer_engine.evaluate_ood_transfer(
        linear_mech, witness, unseen_cases, lvt_transfer_token="LVT-TRANSFER-VERIFIED-EXP01"
    )
    assert proc_lvt.qualification_state == QualificationState.TRANSFER_QUALIFIED_REUSABLE
    assert proc_lvt.lvt_provenance_id == "LVT-TRANSFER-VERIFIED-EXP01"


def test_ood_transfer_quarantine_on_failure():
    transfer_engine = TransferEngine(min_transfer_pass_rate=0.80)
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order")
    linear_mech = mechs[0]  # y = 2x

    witness = ScientificWitness(
        witness_id="WIT-01",
        witness_type=ScientificWitnessType.INTERVENTIONAL_EXPERIMENT,
        claim_statement="Linear scaling confirmed",
        mechanism_id=linear_mech.mechanism_id,
        supporting_observations=("OBS-01",),
        sha256_seal="a" * 64,
        truth_status="SUPPORTED",
        is_reproducible=True,
        biosecurity_screen_passed=True,
    )

    # 4 unseen tasks where the system actually behaved nonlinearly (overfitting failure)
    failing_cases = [
        {"x": 4.0, "expected_y": 20.0, "is_negative_control": False},
        {"x": 5.0, "expected_y": 30.0, "is_negative_control": False},
        {"x": 8.0, "expected_y": 72.0, "is_negative_control": False},
    ]

    proc = transfer_engine.evaluate_ood_transfer(linear_mech, witness, failing_cases)
    assert proc.qualification_state == QualificationState.QUARANTINED_FALSIFIED
    assert proc.transfer_pass_rate == 0.0
    assert len(proc.known_counterexamples) > 0


def test_100x_productivity_gain_calculation():
    transfer_engine = TransferEngine()

    # CWC cost = $0.15 (150,000,000 nanos) to produce 1 verified outcome
    # Baseline cost = $20.00 to produce 1 outcome
    # Gain = (1 / 0.15) / (1 / 20.0) = 20 / 0.15 = 133.33x
    gain = transfer_engine.calculate_100x_productivity_gain(
        verified_outcomes_cwc=1,
        cost_nanos_cwc=150_000_000,
        verified_outcomes_baseline=1,
        cost_usd_baseline=20.0,
    )
    assert gain >= 100.0
    assert gain == 133.33
