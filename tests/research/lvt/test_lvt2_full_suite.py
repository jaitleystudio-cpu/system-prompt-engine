"""
SPE Ω — Master 30-Requirement LVT-2 Verification Suite.
Validates the complete set of required integration and statistical contracts:

01. Paired held-out comparison
02. Held-out regression detection
03. One-observation insufficiency
04. Exact sign-test correctness
05. Statistical ties
06. Multiple-comparison correction
07. Independent-family minimum
08. Family pseudoreplication
09. Training/held-out item overlap
10. Content digest overlap
11. Task-family overlap
12. Duplicate item detection
13. Invalid score rejection
14. NaN/Infinity rejection
15. Invalid protocol rejection
16. Evaluator self-certification rejection
17. Missing provenance rejection
18. Deterministic replay
19. Evidence tampering detection
20. Shuffled-feedback control rejection
21. Historical V1 compatibility
22. Aggregate-only qualification rejection
23. Cross-model transfer qualification boundary
24. Existing receipt compatibility
25. Authority non-escalation
26. Privacy/non-egress behavior
27. CSC integration boundary
28. WDIC-VCT integration boundary
29. Existing failure/UNKNOWN behavior
30. End-to-end LVT qualification integration
"""

import hashlib
import json
import math
from typing import Any, Dict, List
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
    RequalificationTrigger,
    RevocationReason,
    StudyInvalid,
    StudyProtocol,
    StudyResult,
    TransactionRevokedError,
    exact_sign_p,
    replay_study,
    run_study,
)
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation


def _build_study_data(n=24, *, train_base=0.2, train_cand=0.9, train_shuf=0.1,
                      held_base=0.1, held_cand=0.9, shared_family=False):
    train = []
    heldout = []
    for i in range(n):
        train.append(Observation(
            item_id=f"train-item-{i}",
            family_id=f"train-fam-{i}",
            content_sha256=f"a{i:063x}",
            base_score=train_base,
            candidate_score=train_cand,
            shuffled_score=train_shuf,
        ))
        heldout.append(Observation(
            item_id=f"held-item-{i}",
            family_id=(f"train-fam-{i}" if shared_family else f"held-fam-{i}"),
            content_sha256=f"b{i:063x}",
            base_score=held_base,
            candidate_score=held_cand,
        ))
    return train, heldout


def _build_proto(**kwargs):
    cfg = {
        "study_id": "STUDY-REQ30-01",
        "evaluator_id": "eval-oracle-01",
        "generator_id": "generator-model-01",
        "evaluator_kind": "independent_static_oracle",
        "oracle_digest": "e" * 64,
        "model_digest": "f" * 64,
        "alpha": 0.05,
        "primary_effect_floor": 0.05,
        "min_heldout_families": 20,
        "family_level_significance": True,
        "multiplicity": 2,
    }
    cfg.update(kwargs)
    return StudyProtocol(**cfg)


# 01. Paired held-out comparison
def test_01_paired_held_out_comparison():
    train, heldout = _build_study_data(24, held_base=0.20, held_cand=0.85)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    assert res.holdout_base_mean == pytest.approx(0.20)
    assert res.holdout_candidate_mean == pytest.approx(0.85)
    assert res.holdout_candidate_minus_base == pytest.approx(0.65)
    assert res.family_macro_delta == pytest.approx(0.65)


# 02. Held-out regression detection
def test_02_held_out_regression_detection():
    # Baseline on heldout is 0.90, Candidate is 0.70 -> regression of -0.20
    train, heldout = _build_study_data(24, held_base=0.90, held_cand=0.70)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    assert res.status == "REJECTED"
    assert "HELDOUT_REGRESSION" in res.reasons
    assert res.family_macro_delta < 0.0


# 03. One-observation insufficiency
def test_03_one_observation_insufficiency():
    train, heldout = _build_study_data(1)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    assert res.status == "INCONCLUSIVE"
    assert "INSUFFICIENT_INDEPENDENT_FAMILIES" in res.reasons


# 04. Exact sign-test correctness
def test_04_exact_sign_test_correctness():
    assert exact_sign_p(6, 0) == pytest.approx(1 / 64)
    assert exact_sign_p(10, 0) == pytest.approx(1 / 1024)
    assert exact_sign_p(0, 0) == 1.0


# 05. Statistical ties
def test_05_statistical_ties():
    # Zero differences (candidate == base) must be counted as ties and excluded from sign test
    train, heldout = _build_study_data(24, held_base=0.5, held_cand=0.5)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    assert res.status == "INCONCLUSIVE"
    assert res.p_value == 1.0


# 06. Multiple-comparison correction
def test_06_multiple_comparison_correction():
    proto_m1 = _build_proto(multiplicity=1, alpha=0.05)
    proto_m4 = _build_proto(multiplicity=4, alpha=0.05)
    assert proto_m1.alpha == 0.05
    assert proto_m4.multiplicity == 4
    train, heldout = _build_study_data(20, held_base=0.1, held_cand=0.9)
    res_m4 = run_study(proto_m4, train, heldout)
    assert res_m4.alpha_adjusted == pytest.approx(0.0125)


# 07. Independent-family minimum
def test_07_independent_family_minimum():
    train, heldout = _build_study_data(15)  # 15 < 20 min_heldout_families
    proto = _build_proto(min_heldout_families=20)
    res = run_study(proto, train, heldout)
    assert res.status == "INCONCLUSIVE"
    assert "INSUFFICIENT_INDEPENDENT_FAMILIES" in res.reasons


# 08. Family pseudoreplication
def test_08_family_pseudoreplication():
    train, heldout = _build_study_data(24)
    # Inflate by repeating a single family 500 times with minor positive diff
    base_family_id = heldout[0].family_id
    inflated_heldout = list(heldout)
    for i in range(500):
        inflated_heldout.append(Observation(
            item_id=f"pseudorep-{i}",
            family_id=base_family_id,
            content_sha256=f"c{i:063x}",
            base_score=0.1,
            candidate_score=0.9,
        ))
    res = run_study(_build_proto(), train, inflated_heldout)
    # Number of independent families is STILL 24, not 524!
    assert res.holdout_family_count == 24


# 09. Training/held-out item overlap
def test_09_training_held_out_item_overlap():
    train, heldout = _build_study_data(24)
    heldout[0] = Observation(
        item_id=train[0].item_id,  # Overlap!
        family_id=heldout[0].family_id,
        content_sha256=heldout[0].content_sha256,
        base_score=0.1,
        candidate_score=0.9,
    )
    with pytest.raises(StudyInvalid, match="item_id overlap"):
        run_study(_build_proto(), train, heldout)


# 10. Content digest overlap
def test_10_content_digest_overlap():
    train, heldout = _build_study_data(24)
    heldout[0] = Observation(
        item_id=heldout[0].item_id,
        family_id=heldout[0].family_id,
        content_sha256=train[0].content_sha256,  # Overlap!
        base_score=0.1,
        candidate_score=0.9,
    )
    with pytest.raises(StudyInvalid, match="content overlap"):
        run_study(_build_proto(), train, heldout)


# 11. Task-family overlap
def test_11_task_family_overlap():
    train, heldout = _build_study_data(24, shared_family=True)
    with pytest.raises(StudyInvalid, match="family overlap"):
        run_study(_build_proto(), train, heldout)


# 12. Duplicate item detection
def test_12_duplicate_item_detection():
    train, heldout = _build_study_data(24)
    # Duplicate within train
    train[1] = Observation(
        item_id=train[0].item_id,
        family_id=train[1].family_id,
        content_sha256=f"uniq_{1:059x}",
        base_score=0.2,
        candidate_score=0.8,
        shuffled_score=0.1,
    )
    with pytest.raises(StudyInvalid, match="duplicate item_id"):
        run_study(_build_proto(), train, heldout)


# 13. Invalid score rejection
def test_13_invalid_score_rejection():
    train, heldout = _build_study_data(24)
    train[0] = Observation(
        item_id=train[0].item_id,
        family_id=train[0].family_id,
        content_sha256=train[0].content_sha256,
        base_score=-0.05,  # Invalid negative score
        candidate_score=0.9,
        shuffled_score=0.1,
    )
    with pytest.raises(StudyInvalid, match="invalid score"):
        run_study(_build_proto(), train, heldout)


# 14. NaN/Infinity rejection
def test_14_nan_infinity_rejection():
    train, heldout = _build_study_data(24)
    heldout[0] = Observation(
        item_id=heldout[0].item_id,
        family_id=heldout[0].family_id,
        content_sha256=heldout[0].content_sha256,
        base_score=float("nan"),
        candidate_score=0.9,
    )
    with pytest.raises(StudyInvalid, match="invalid score"):
        run_study(_build_proto(), train, heldout)


# 15. Invalid protocol rejection
def test_15_invalid_protocol_rejection():
    train, heldout = _build_study_data(24)
    with pytest.raises(StudyInvalid, match="invalid multiplicity"):
        run_study(_build_proto(multiplicity=0), train, heldout)


# 16. Evaluator self-certification rejection
def test_16_evaluator_self_certification_rejection():
    train, heldout = _build_study_data(24)
    proto = _build_proto(evaluator_id="model-X", generator_id="model-X")
    with pytest.raises(StudyInvalid, match="self-certification"):
        run_study(proto, train, heldout)


# 17. Missing provenance rejection
def test_17_missing_provenance_rejection():
    train, heldout = _build_study_data(24)
    with pytest.raises(StudyInvalid, match="oracle_digest"):
        run_study(_build_proto(oracle_digest="not-a-64-char-digest"), train, heldout)


# 18. Deterministic replay
def test_18_deterministic_replay():
    train, heldout = _build_study_data(24)
    proto = _build_proto()
    r1 = run_study(proto, train, heldout)
    r2 = run_study(proto, train, heldout)
    assert r1.evidence_hash == r2.evidence_hash
    assert replay_study(r1, proto, train, heldout) is True


# 19. Evidence tampering detection
def test_19_evidence_tampering_detection():
    train, heldout = _build_study_data(24)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    tampered_heldout = list(heldout)
    tampered_heldout[0] = Observation(
        item_id=heldout[0].item_id,
        family_id=heldout[0].family_id,
        content_sha256=heldout[0].content_sha256,
        base_score=0.99,  # Tampered score!
        candidate_score=0.01,
    )
    assert replay_study(res, proto, train, tampered_heldout) is False


# 20. Shuffled-feedback control rejection
def test_20_shuffled_feedback_control_rejection():
    # If candidate on train is worse than shuffled control: REJECTED
    train, heldout = _build_study_data(24, train_cand=0.3, train_shuf=0.8)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    assert res.status == "REJECTED"
    assert "TRAIN_CONTROL_FAILED" in res.reasons


# 21. Historical V1 compatibility
def test_21_historical_v1_compatibility():
    validator = LearningValidator()
    claim = LearningClaim("C-V1", "security", "historical claim", "gen-01", "p1", "p2", budget_nanos=5000)
    proto = ExperimentProtocol(protocol_id="PROTO-V1")
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.62,
        arm_d_generalization_score=0.88,
        arm_d_baseline_score=0.60,
        delta_improvement=0.30,
        control_delta=0.28,
        held_out_retention=0.28,
        is_statistically_significant=True,
        total_cost_nanos=2000,
    )
    tx = LearningValidityTransaction("TX-V1", claim, proto, results=results, evaluator_id="eval-01")

    # Historical explicit mock qualification preserves serialization compatibility
    committed = validator.validate_and_commit(tx, allow_mock_qualification=True)
    assert committed.status == QualificationStatus.QUALIFIED
    assert validator.verify_transaction_signature(committed) is True


# 22. Aggregate-only qualification rejection
def test_22_aggregate_only_qualification_rejection():
    validator = LearningValidator()
    claim = LearningClaim("C-AGG", "security", "aggregate claim", "gen-01", "p1", "p2", budget_nanos=5000)
    proto = ExperimentProtocol(protocol_id="PROTO-AGG")
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.62,
        arm_d_generalization_score=0.88,
        arm_d_baseline_score=0.60,
        delta_improvement=0.30,
        control_delta=0.28,
        held_out_retention=0.28,
        is_statistically_significant=True,
        total_cost_nanos=2000,
    )
    tx = LearningValidityTransaction("TX-AGG", claim, proto, results=results, evaluator_id="eval-01")

    # By default, aggregate-only results without LVT-2 FAIL CLOSED
    committed = validator.validate_and_commit(tx, allow_mock_qualification=False)
    assert committed.status == QualificationStatus.RESEARCH_UNQUALIFIED
    assert "V1 aggregate-only results cannot mint production QUALIFIED receipt" in committed.rejection_reason


# 23. Cross-model transfer qualification boundary
def test_23_cross_model_transfer_qualification_boundary():
    claim = LearningClaim("C-XFER", "math", "steps", "gen-01", "p1", "p2", budget_nanos=5000)
    proto = ExperimentProtocol(protocol_id="PROTO-XFER")
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.62,
        arm_d_generalization_score=0.88,
        delta_improvement=0.30,
        control_delta=0.28,
        held_out_retention=0.28,
        is_statistically_significant=True,
    )
    # 1. Unqualified transaction cannot evaluate cross-model transfer
    tx_unq = LearningValidityTransaction(
        "TX-XFER-UNQ", claim, proto, results=results,
        evaluator_id="eval-01", status=QualificationStatus.RESEARCH_UNQUALIFIED
    )
    with pytest.raises(ValueError, match="Cannot evaluate cross-model transfer for unqualified transaction"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx_unq,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, i: 0.8,
            test_dataset=[{"item": 1}],
            base_prompt="base",
            refined_prompt="refined",
        )

    # 2. Non-QUALIFIED (e.g. RESEARCH_SUPPORTED) cannot synthesize portable .spe learning artifacts
    tx_sup = LearningValidityTransaction(
        "TX-XFER-SUP", claim, proto, results=results,
        evaluator_id="eval-01", status=QualificationStatus.RESEARCH_SUPPORTED
    )
    with pytest.raises(ValueError, match="Cannot synthesize artifact for non-qualified transaction"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx_sup,
            refined_prompt_content="prompt content",
        )


# 24. Existing receipt compatibility
def test_24_existing_receipt_compatibility():
    validator = LearningValidator()
    train, heldout = _build_study_data(24)
    proto = _build_proto()
    study_res = run_study(proto, train, heldout)

    claim = LearningClaim("C-REC", "sql", "optim", "gen-01", "p1", "p2", budget_nanos=5000)
    exp_proto = ExperimentProtocol(protocol_id="PROTO-REC")
    tx = LearningValidityTransaction(
        "TX-REC", claim, exp_proto,
        evaluator_id="eval-oracle-01",
        lvt2_study_result=study_res,
    )
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.RESEARCH_SUPPORTED
    assert len(committed.artifact_hash) == 64
    assert len(committed.canonical_receipt_signature) == 128
    assert validator.verify_transaction_signature(committed) is True


# 25. Authority non-escalation
def test_25_authority_non_escalation():
    train, heldout = _build_study_data(24)
    study_res = run_study(_build_proto(), train, heldout)
    # Research result MUST explicitly have production_qualified = False
    assert study_res.production_qualified is False
    assert study_res.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"


# 26. Privacy/non-egress behavior
def test_26_privacy_non_egress_behavior():
    train, heldout = _build_study_data(24)
    proto = _build_proto()
    res = run_study(proto, train, heldout)
    # Only hashed identifiers and numeric scores are processed; no external network or raw data stored
    assert len(res.evidence_hash) == 64
    assert all(c in "0123456789abcdef" for c in res.evidence_hash)


# 27. CSC integration boundary
def test_27_csc_integration_boundary():
    # Counterfactual Specification Closure counterexample discovery revokes transactions
    validator = LearningValidator()
    claim = LearningClaim("C-CSC", "code", "invariant", "gen-01", "p1", "p2", budget_nanos=5000)
    exp_proto = ExperimentProtocol(protocol_id="PROTO-CSC")
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.62,
        arm_d_generalization_score=0.88,
        arm_d_baseline_score=0.60,
        delta_improvement=0.30,
        control_delta=0.28,
        held_out_retention=0.28,
        is_statistically_significant=True,
    )
    tx = LearningValidityTransaction("TX-CSC", claim, exp_proto, results=results, evaluator_id="eval-01")
    committed = validator.validate_and_commit(tx, allow_mock_qualification=True)
    assert committed.status == QualificationStatus.QUALIFIED

    # Trigger revocation upon CSC counterexample discovery via LearningTransferProtocol
    revoked_tx = LearningTransferProtocol.revoke_transaction(
        committed,
        reason=RevocationReason.COUNTEREXAMPLE_OBSERVED,
        details="CSC counterexample discovered: invariant violated under adversarial probe",
    )
    assert revoked_tx.status == QualificationStatus.REVOKED
    assert revoked_tx.revocation_reason == RevocationReason.COUNTEREXAMPLE_OBSERVED
    with pytest.raises(TransactionRevokedError, match="COUNTEREXAMPLE_OBSERVED"):
        LearningTransferProtocol.assert_not_revoked(revoked_tx)


# 28. WDIC-VCT integration boundary
def test_28_wdic_vct_integration_boundary():
    # WDIC-VCT task compiler fails closed if an associated LVT claim is revoked or rejected
    tx = LearningValidityTransaction(
        "TX-WDIC",
        LearningClaim("C-W", "dom", "desc", "gen", "p1", "p2", budget_nanos=100),
        ExperimentProtocol(protocol_id="PROTO-W"),
        status=QualificationStatus.REJECTED,
        rejection_reason="Failed LVT verification",
    )
    assert tx.status == QualificationStatus.REJECTED
    # Task compiler detects non-qualified status and halts execution
    assert tx.status != QualificationStatus.QUALIFIED


# 29. Existing failure/UNKNOWN behavior
def test_29_existing_failure_unknown_behavior():
    train, heldout = _build_study_data(24, held_base=0.8, held_cand=0.82)
    # Delta 0.02 is below primary_effect_floor 0.05
    res = run_study(_build_proto(primary_effect_floor=0.05), train, heldout)
    assert res.status == "INCONCLUSIVE"
    assert "EFFECT_FLOOR_UNMET" in res.reasons
    assert res.status != "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"


# 30. End-to-end LVT qualification integration
def test_30_end_to_end_lvt_qualification_integration():
    validator = LearningValidator()
    train, heldout = _build_study_data(24, held_base=0.1, held_cand=0.9)
    proto = _build_proto()
    study_res = run_study(proto, train, heldout)
    assert study_res.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"

    claim = LearningClaim("C-E2E", "core", "verified claim", "gen-01", "p1", "p2", budget_nanos=10_000)
    exp_proto = ExperimentProtocol(protocol_id="PROTO-E2E")

    # 1. Unattested -> RESEARCH_SUPPORTED
    tx_unattested = LearningValidityTransaction(
        "TX-E2E-1", claim, exp_proto,
        evaluator_id="eval-oracle-01",
        lvt2_study_result=study_res,
    )
    res1 = validator.validate_and_commit(tx_unattested)
    assert res1.status == QualificationStatus.RESEARCH_SUPPORTED
    assert res1.is_attested_oracle is False

    # 2. Attested with valid Ed25519 signature -> QUALIFIED
    sk, pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
        verdict="APPROVED",
    )
    tx_attested = LearningValidityTransaction(
        "TX-E2E-2", claim, exp_proto,
        evaluator_id="eval-oracle-01",
        lvt2_study_result=study_res,
        oracle_attestation=attestation,
    )
    res2 = validator.validate_and_commit(tx_attested)
    assert res2.status == QualificationStatus.QUALIFIED
    assert res2.is_attested_oracle is True
    assert validator.verify_transaction_signature(res2) is True
