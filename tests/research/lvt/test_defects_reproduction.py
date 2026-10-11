"""
SPE Ω — Defect Reproduction and Verification Suite (LVT-F01 through LVT-F06).

Explicitly reproduces and verifies the resolution of historical false-qualification defects:
- DEFECT LVT-F01: One-item experiment false significance (sample_size < 2 cannot be significant)
- DEFECT LVT-F02: Held-out candidate compared against training baseline (unpaired mismatch)
- DEFECT LVT-F03: Train/held-out contamination across item, content digest, family, and provenance
- DEFECT LVT-F04: Invalid protocol parameters (sample_size <= 0, NaNs, infinities)
- DEFECT LVT-F05: Family pseudoreplication inflating effect size and significance
- DEFECT LVT-F06: Self-reported evaluator identity / provenance promoted to qualification
"""

import math
from typing import Any, Dict
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt import (
    ControlledExperimentRunner,
    EvaluatorType,
    ExperimentProtocol,
    FourArmResults,
    GeneratingModelSelfCertificationError,
    LearningClaim,
    LearningTransferProtocol,
    LearningValidityRuleViolation,
    LearningValidityTransaction,
    LearningValidator,
    Observation,
    QualificationStatus,
    RevocationReason,
    StudyInvalid,
    StudyProtocol,
    TransactionRevokedError,
    run_study,
)
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation


def test_defect_lvt_f01_one_sample_insufficient_for_significance():
    """
    DEFECT LVT-F01: A one-item experiment can be reported as statistically significant
    based on aggregate score thresholds alone.
    EXPECTED: Insufficient statistical evidence must fail-closed: is_statistically_significant is False.
    """
    runner = ControlledExperimentRunner()
    protocol = ExperimentProtocol(
        protocol_id="PROTO-F01",
        sample_size=2,  # protocol sample_size >= 2
        significance_threshold_epsilon=0.05,
    )

    # When dataset has only 1 sample, compute_paired_stats must return p_value=1.0, not 0.0001
    scores_base = [0.4]
    scores_cand = [0.9]
    mean_d, p_val, t_stat, ci = runner.compute_paired_stats(scores_base, scores_cand)
    assert p_val == 1.0, f"Single-sample p-value must be 1.0, got {p_val}"
    assert t_stat == 0.0 or not math.isfinite(t_stat)
    assert ci == (0.0, 0.0)


def test_defect_lvt_f02_heldout_candidate_vs_train_baseline_mismatch_rejected():
    """
    DEFECT LVT-F02: Candidate score on held-out data is compared against baseline score on training data.
    Example:
      Baseline train: 0.30, Cand train: 0.90
      Baseline held-out: 0.95, Cand held-out: 0.75
    Flawed comparison: 0.75 - 0.30 = +0.45 (falsely passed)
    Correct paired comparison: 0.75 - 0.95 = -0.20 (correctly rejected)
    EXPECTED: The experiment must not qualify this regression.
    """
    runner = ControlledExperimentRunner()
    validator = LearningValidator()

    protocol = ExperimentProtocol(
        protocol_id="PROTO-F02",
        sample_size=10,
        significance_threshold_epsilon=0.05,
        generalization_tolerance_delta=0.02,
    )

    train_data = [{"id": f"t_{i}"} for i in range(10)]
    held_out_data = [{"id": f"h_{i}"} for i in range(10)]

    def oracle(prompt: str, item: Dict[str, Any]) -> float:
        is_held = item["id"].startswith("h_")
        is_cand = "CANDIDATE" in prompt
        if not is_held:
            return 0.90 if is_cand else 0.30
        else:
            return 0.75 if is_cand else 0.95

    res = runner.run_experiment(
        protocol=protocol,
        evaluator_fn=oracle,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt="BASE",
        refined_prompt="BASE [CANDIDATE]",
    )

    # Must verify true paired held-out retention is -0.20
    assert res.held_out_retention == pytest.approx(-0.20, abs=1e-4)
    assert res.is_statistically_significant is False

    # Also test validator rejects mismatched synthetic results if attempted
    flawed_results = FourArmResults(
        arm_a_baseline_score=0.30,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.35,
        arm_d_generalization_score=0.75,
        arm_d_baseline_score=0.95,
        delta_improvement=0.60,
        control_delta=0.55,
        held_out_retention=0.45,  # Falsely computed as 0.75 - 0.30 = +0.45!
        is_statistically_significant=True,
    )
    claim = LearningClaim("C1", "math", "test", "gen", "p1", "p2", budget_nanos=1000)
    from spe_runtime.research.lvt.types import LearningValidityTransaction
    tx = LearningValidityTransaction("TX-F02", claim, protocol, results=flawed_results, evaluator_id="ev")
    conjuncts = validator.evaluate_conjuncts(tx)
    assert conjuncts["NoDisqualifyingRegression"] is False


def test_defect_lvt_f03_training_heldout_family_and_content_contamination_rejected():
    """
    DEFECT LVT-F03: Training and held-out data contamination is not adequately rejected.
    EXPECTED: Reject overlaps in:
      - item identity
      - declared content digest
      - task family
      - applicable provenance identity
    """
    runner = ControlledExperimentRunner()
    protocol = ExperimentProtocol(protocol_id="PROTO-F03", sample_size=2)

    # 1. Task family contamination
    train_fam = [{"id": "t1", "family_id": "fam_alpha"}, {"id": "t2", "family_id": "fam_alpha"}]
    held_fam = [{"id": "h1", "family_id": "fam_alpha"}, {"id": "h2", "family_id": "fam_beta"}]
    with pytest.raises(ValueError, match="contamination.*family"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 0.8,
            train_dataset=train_fam,
            held_out_dataset=held_fam,
            base_prompt="BASE",
            refined_prompt="REFINED",
        )

    # 2. Content digest contamination
    train_digest = [{"id": "t1", "content_sha256": "abc123"}, {"id": "t2", "content_sha256": "def456"}]
    held_digest = [{"id": "h1", "content_sha256": "abc123"}, {"id": "h2", "content_sha256": "ghi789"}]
    with pytest.raises(ValueError, match="contamination.*digest"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 0.8,
            train_dataset=train_digest,
            held_out_dataset=held_digest,
            base_prompt="BASE",
            refined_prompt="REFINED",
        )

    # 3. Provenance identity contamination
    train_prov = [{"id": "t1", "provenance_id": "src_prov_A"}, {"id": "t2", "provenance_id": "src_prov_B"}]
    held_prov = [{"id": "h1", "provenance_id": "src_prov_A"}, {"id": "h2", "provenance_id": "src_prov_C"}]
    with pytest.raises(ValueError, match="contamination.*provenance"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 0.8,
            train_dataset=train_prov,
            held_out_dataset=held_prov,
            base_prompt="BASE",
            refined_prompt="REFINED",
        )


def test_defect_lvt_f04_invalid_sample_size_at_protocol_boundary_rejected():
    """
    DEFECT LVT-F04: Invalid sample sizes may reach unsafe slicing or arithmetic behavior.
    EXPECTED: Reject invalid sample-size configurations at the protocol boundary.
    """
    # sample_size <= 0
    with pytest.raises(ValueError, match="sample_size"):
        ExperimentProtocol(protocol_id="PROTO-BAD-N", sample_size=0)

    with pytest.raises(ValueError, match="sample_size"):
        ExperimentProtocol(protocol_id="PROTO-BAD-N", sample_size=-5)

    with pytest.raises(ValueError, match="sample_size"):
        ExperimentProtocol(protocol_id="PROTO-BAD-N", sample_size=1)

    # NaN / Inf parameters
    with pytest.raises(ValueError, match="significance_threshold_epsilon"):
        ExperimentProtocol(protocol_id="PROTO-BAD", significance_threshold_epsilon=float("nan"))

    with pytest.raises(ValueError, match="generalization_tolerance_delta"):
        ExperimentProtocol(protocol_id="PROTO-BAD", generalization_tolerance_delta=float("inf"))


def test_defect_lvt_f05_repeated_family_pseudoreplication_controlled_by_family_macro():
    """
    DEFECT LVT-F05: Repeated examples from one task family may artificially inflate
    effect size or significance.
    EXPECTED: Family-level independent units control statistical inference and primary effect.
    """
    # Create study where 1 family has +0.80 delta, and 23 families have +0.01 delta
    # If 200 copies of family 24 are added, sample-weighted mean would be +0.70!
    # Family-macro delta correctly averages to (23 * 0.01 + 0.80) / 24 = 0.0429 < 0.05 floor
    train_items = [
        Observation(f"t-{i}", f"t-fam-{i}", f"{i:064x}", 0.2, 0.9, 0.1)
        for i in range(24)
    ]
    heldout_items = [
        Observation(f"h-{i}", f"h-fam-{i}", f"{i+100:064x}", 0.1, 0.9 if i == 23 else 0.11)
        for i in range(24)
    ]
    # Add 200 repeated items from the 24th family
    for j in range(200):
        heldout_items.append(
            Observation(f"repeat-{j}", "h-fam-23", f"{1_000_000+j:064x}", 0.1, 0.9)
        )

    proto = StudyProtocol(
        study_id="PROTO-F05",
        evaluator_id="eval-01",
        generator_id="gen-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="a" * 64,
        model_digest="b" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    result = run_study(proto, train_items, heldout_items)
    assert result.status == "INCONCLUSIVE"
    assert "EFFECT_FLOOR_UNMET" in result.reasons
    assert result.family_macro_delta == pytest.approx((23 * 0.01 + 0.80) / 24, abs=1e-6)
    assert result.family_macro_delta < 0.05


def test_defect_lvt_f06_self_reported_provenance_cannot_mint_production_qualification():
    """
    DEFECT LVT-F06: Self-reported evaluator identity or self-generated evidence
    may be promoted into qualification.
    EXPECTED: Unverified provenance cannot produce production qualification.
    """
    validator = LearningValidator()
    train_items = [
        Observation(f"t-{i}", f"t-fam-{i}", f"{i:064x}", 0.2, 0.9, 0.1)
        for i in range(24)
    ]
    heldout_items = [
        Observation(f"h-{i}", f"h-fam-{i}", f"{i+100:064x}", 0.1, 0.9)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="PROTO-F06",
        evaluator_id="eval-self-reported",
        generator_id="gen-model",
        evaluator_kind="independent_static_oracle",
        oracle_digest="c" * 64,
        model_digest="d" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    study_result = run_study(proto, train_items, heldout_items)
    assert study_result.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    assert study_result.production_qualified is False

    claim = LearningClaim("C-F06", "reasoning", "claim", "gen-model", "p1", "p2", budget_nanos=10_000)
    exp_proto = ExperimentProtocol(protocol_id="PROTO-F06-EXP")
    from spe_runtime.research.lvt.types import LearningValidityTransaction
    tx = LearningValidityTransaction(
        tx_id="TX-F06",
        claim=claim,
        protocol=exp_proto,
        evaluator_id="eval-self-reported",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
        lvt2_study_result=study_result,
        # No OracleAttestation provided!
    )

    committed = validator.validate_and_commit(tx)
    # Must NOT be QUALIFIED! Must remain RESEARCH_SUPPORTED
    assert committed.status == QualificationStatus.RESEARCH_SUPPORTED
    assert committed.is_attested_oracle is False
    assert "external oracle attestation required" in committed.rejection_reason


def test_defect_lvt_f07_runner_run_lvt2_study_and_run_experiment_lvt2():
    """
    DEFECT LVT-F07: ControlledExperimentRunner was missing LVT-2 bridge methods.
    EXPECTED: ControlledExperimentRunner.run_lvt2_study and run_experiment_lvt2
    bridge directly to paired_gate_v2.run_study and return StudyResult.
    """
    runner = ControlledExperimentRunner()
    train_data = [
        {"id": f"t_{i}", "family_id": f"tfam_{i}", "content_sha256": f"a{i:063x}"}
        for i in range(24)
    ]
    held_data = [
        {"id": f"h_{i}", "family_id": f"hfam_{i}", "content_sha256": f"b{i:063x}"}
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="PROTO-F07",
        evaluator_id="eval-01",
        generator_id="gen-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )

    def mock_evaluator(prompt: str, item: Dict[str, Any]) -> float:
        if "REFINED" in prompt:
            return 0.90
        elif "[SHUFFLED" in prompt:
            return 0.15
        return 0.20

    study_res = runner.run_experiment_lvt2(
        protocol=proto,
        evaluator_fn=mock_evaluator,
        train_dataset=train_data,
        held_out_dataset=held_data,
        base_prompt="BASE PROMPT",
        refined_prompt="REFINED PROMPT",
    )
    assert study_res.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    assert study_res.family_macro_delta == pytest.approx(0.70)
    assert study_res.holdout_family_count == 24
    assert len(study_res.evidence_hash) == 64


def test_defect_lvt_f08_evaluate_conjuncts_fails_closed_on_inconclusive_lvt2_study():
    """
    DEFECT LVT-F08: evaluate_conjuncts previously returned True for ImprovementSupported
    and NoDisqualifyingRegression on INCONCLUSIVE LVT-2 studies.
    EXPECTED: Inconclusive studies fail ImprovementSupported and NoDisqualifyingRegression,
    and strict validate_and_commit raises LearningValidityRuleViolation.
    """
    validator = LearningValidator()
    train_items = [
        Observation(f"t-{i}", f"tfam-{i}", f"a{i:063x}", 0.2, 0.9, 0.1)
        for i in range(24)
    ]
    heldout_items = [
        Observation(f"h-{i}", f"hfam-{i}", f"b{i:063x}", 0.80, 0.82)  # delta 0.02 < floor 0.05
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="PROTO-F08",
        evaluator_id="eval-01",
        generator_id="gen-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    study_res = run_study(proto, train_items, heldout_items)
    assert study_res.status == "INCONCLUSIVE"
    assert "EFFECT_FLOOR_UNMET" in study_res.reasons

    claim = LearningClaim("C-F08", "math", "test", "gen-01", "p1", "p2", budget_nanos=5000)
    exp_proto = ExperimentProtocol(protocol_id="P-F08")
    tx = LearningValidityTransaction("TX-F08", claim, exp_proto, evaluator_id="eval-01", lvt2_study_result=study_res)

    conjuncts = validator.evaluate_conjuncts(tx)
    assert conjuncts["ImprovementSupported"] is False
    assert conjuncts["NoDisqualifyingRegression"] is False

    with pytest.raises(LearningValidityRuleViolation, match="inconclusive"):
        validator.validate_and_commit(tx, strict=True)


def test_defect_lvt_f09_lvt2_artifact_synthesis_and_drift_monitoring():
    """
    DEFECT LVT-F09: synthesize_spe_learning_artifact and check_distribution_drift_and_revoke
    previously ignored lvt2_study_result, zeroing out empirical gains and disabling drift revocation.
    EXPECTED: LVT-2 empirical gains are recorded and distribution drift triggers revocation.
    """
    validator = LearningValidator()
    train_items = [
        Observation(f"t-{i}", f"tfam-{i}", f"a{i:063x}", 0.2, 0.9, 0.1)
        for i in range(24)
    ]
    heldout_items = [
        Observation(f"h-{i}", f"hfam-{i}", f"b{i:063x}", 0.1, 0.9)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="PROTO-F09",
        evaluator_id="eval-01",
        generator_id="gen-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    study_res = run_study(proto, train_items, heldout_items)

    sk, pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-01",
        evidence_hash=study_res.evidence_hash,
        verdict="APPROVED",
    )
    claim = LearningClaim("C-F09", "code", "claim", "gen-01", "p1", "p2", budget_nanos=5000)
    tx = LearningValidityTransaction(
        "TX-F09", claim, ExperimentProtocol(protocol_id="P-F09"),
        evaluator_id="eval-01", lvt2_study_result=study_res, oracle_attestation=attestation,
    )
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.QUALIFIED

    # Artifact synthesis MUST embed actual LVT-2 empirical gains (not 0.0)
    import json
    artifact_json = LearningTransferProtocol.synthesize_spe_learning_artifact(
        tx=committed,
        refined_prompt_content="prompt content",
    )
    doc = json.loads(artifact_json)
    assert doc["empirical_gain"]["delta_improvement"] == pytest.approx(0.80)
    assert doc["empirical_gain"]["held_out_retention"] == pytest.approx(0.80)

    # Drift monitoring MUST revoke if monitored performance drops below generalization baseline
    degraded_scores = [0.20] * 50  # 0.20 << 0.90 - 0.15
    revoked = LearningTransferProtocol.check_distribution_drift_and_revoke(committed, degraded_scores, drift_tolerance=0.15)
    assert revoked is True
    assert committed.status == QualificationStatus.REVOKED
    assert committed.revocation_reason == RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED


def test_defect_lvt_f10_boolean_scores_and_parameters_strictly_rejected():
    """
    DEFECT LVT-F10: Booleans (True/False) were accepted as int/float scores or thresholds.
    EXPECTED: Reject bool types at ExperimentProtocol, FourArmResults, and evaluator boundary.
    """
    with pytest.raises(ValueError, match="sample_size"):
        ExperimentProtocol(protocol_id="P-BOOL", sample_size=True)

    with pytest.raises(ValueError, match="significance_threshold_epsilon"):
        ExperimentProtocol(protocol_id="P-BOOL", significance_threshold_epsilon=True)

    with pytest.raises(ValueError, match="generalization_tolerance_delta"):
        ExperimentProtocol(protocol_id="P-BOOL", generalization_tolerance_delta=False)

    with pytest.raises(ValueError, match="Score True out of bounds"):
        FourArmResults(
            arm_a_baseline_score=True,  # Boolean passed as float!
            arm_b_authentic_score=0.9,
            arm_c_shuffled_control_score=0.1,
            arm_d_generalization_score=0.9,
            delta_improvement=0.8,
            control_delta=0.8,
            held_out_retention=0.8,
            is_statistically_significant=True,
        )

    runner = ControlledExperimentRunner()
    with pytest.raises(ValueError, match="out-of-bounds"):
        runner._eval_item(lambda p, i: True, "prompt", {"id": "1"})


def test_defect_lvt_f11_receipt_dict_binds_evidence_hash_and_protocol_version():
    """
    DEFECT LVT-F11: Receipt dictionary generated for LVT-2 study did not bind evidence_hash.
    EXPECTED: Receipt dictionary includes evidence_hash and protocol_version: 'LVT-2'.
    """
    validator = LearningValidator()
    train_items = [
        Observation(f"t-{i}", f"tfam-{i}", f"a{i:063x}", 0.2, 0.9, 0.1)
        for i in range(24)
    ]
    heldout_items = [
        Observation(f"h-{i}", f"hfam-{i}", f"b{i:063x}", 0.1, 0.9)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="PROTO-F11",
        evaluator_id="eval-01",
        generator_id="gen-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    study_res = run_study(proto, train_items, heldout_items)
    claim = LearningClaim("C-F11", "code", "claim", "gen-01", "p1", "p2", budget_nanos=5000)
    tx = LearningValidityTransaction(
        "TX-F11", claim, ExperimentProtocol(protocol_id="P-F11"),
        evaluator_id="eval-01", lvt2_study_result=study_res,
    )
    committed = validator.validate_and_commit(tx)
    receipt_dict = validator._build_receipt_dict(committed)
    assert receipt_dict["evidence_hash"] == study_res.evidence_hash
    assert receipt_dict["protocol_version"] == "LVT-2"
    assert committed.protocol_version == "LVT-2"
    assert validator.verify_transaction_signature(committed) is True
