"""
SPE Ω — Adversarial Mutation Testing Suite for LVT-2.

Formally evaluates the integrated repository against 10 critical adversarial mutations:
1. Replace held-out baseline with training baseline -> KILLED
2. Replace family macro effect with item-weighted effect -> KILLED
3. Remove family contamination rejection -> KILLED
4. Force production_qualified=True on study result -> KILLED
5. Bypass evaluator-independence checks -> KILLED
6. Substitute an altered oracle digest -> KILLED
7. Reuse stale evidence after protocol changes -> KILLED
8. Replay a receipt against altered observations -> KILLED
9. Bypass insufficient-sample handling -> KILLED
10. Convert UNKNOWN / INCONCLUSIVE into QUALIFIED -> KILLED

Every mutation is subjected to fail-closed verification.
"""

from dataclasses import asdict
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
    LearningValidityTransaction,
    LearningValidator,
    Observation,
    QualificationStatus,
    StudyInvalid,
    StudyProtocol,
    StudyResult,
    replay_study,
    run_study,
)
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation


def _fixtures(n=24, *, train_base=0.2, train_cand=0.9, train_shuf=0.1,
              held_base=0.1, held_cand=0.9):
    train = [
        Observation(f"t-{i}", f"tfam-{i}", f"a{i:063x}", train_base, train_cand, train_shuf)
        for i in range(n)
    ]
    heldout = [
        Observation(f"h-{i}", f"hfam-{i}", f"b{i:063x}", held_base, held_cand)
        for i in range(n)
    ]
    proto = StudyProtocol(
        study_id="STUDY-MUTANT",
        evaluator_id="eval-ext",
        generator_id="gen-model",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    return proto, train, heldout


def test_mutant_1_replace_heldout_base_with_train_base_is_killed():
    """Mutant 1: Replace held-out baseline with training baseline."""
    # Heldout baseline = 0.95, Heldout candidate = 0.75 (true delta = -0.20: regression!)
    # Training baseline = 0.30 (if mistakenly subtracted, 0.75 - 0.30 = +0.45: false pass!)
    proto, train, heldout = _fixtures(held_base=0.95, held_cand=0.75, train_base=0.30)
    res = run_study(proto, train, heldout)
    # The mutant MUST be killed: status must be REJECTED, never passed!
    assert res.status == "REJECTED", "Mutant 1 survived: held-out regression was not rejected!"
    assert "HELDOUT_REGRESSION" in res.reasons
    assert res.holdout_candidate_minus_base == pytest.approx(-0.20)


def test_mutant_2_replace_family_macro_with_item_weighted_is_killed():
    """Mutant 2: Replace family macro effect with item-weighted effect."""
    proto, train, heldout = _fixtures()
    # 23 families have tiny gain +0.01; 1 family has +0.80 with 200 duplicates
    modified_heldout = [
        Observation(h.item_id, h.family_id, h.content_sha256, 0.1, 0.9 if i == 23 else 0.11)
        for i, h in enumerate(heldout)
    ]
    for j in range(200):
        modified_heldout.append(
            Observation(f"rep-{j}", heldout[23].family_id, f"d{j:063x}", 0.1, 0.9)
        )
    res = run_study(proto, train, modified_heldout)
    # Item-weighted mean would be > 0.70. Family-macro delta is 0.0429 < 0.05.
    # The mutant MUST be killed: status must be INCONCLUSIVE due to EFFECT_FLOOR_UNMET!
    assert res.status == "INCONCLUSIVE", "Mutant 2 survived: item-weighted mean bypassed family macro floor!"
    assert "EFFECT_FLOOR_UNMET" in res.reasons
    assert res.family_macro_delta < 0.05


def test_mutant_3_remove_family_contamination_rejection_is_killed():
    """Mutant 3: Remove family contamination rejection."""
    proto, train, heldout = _fixtures()
    # Inject family overlap
    leaked_heldout = [
        Observation(h.item_id, train[i].family_id, h.content_sha256, h.base_score, h.candidate_score)
        for i, h in enumerate(heldout)
    ]
    # The mutant MUST be killed: raising StudyInvalid
    with pytest.raises(StudyInvalid, match="family overlap"):
        run_study(proto, train, leaked_heldout)


def test_mutant_4_force_production_qualified_is_killed():
    """Mutant 4: Force production_qualified=True on study result or transaction."""
    proto, train, heldout = _fixtures()
    res = run_study(proto, train, heldout)
    # Research result MUST ALWAYS have production_qualified=False
    assert res.production_qualified is False

    # Validator without attested oracle attestation MUST NEVER set QUALIFIED
    validator = LearningValidator()
    claim = LearningClaim("C-M4", "dom", "desc", "gen-model", "p1", "p2", budget_nanos=1000)
    tx = LearningValidityTransaction(
        "TX-M4", claim, ExperimentProtocol(protocol_id="P-M4"),
        evaluator_id="eval-ext", lvt2_study_result=res
    )
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.RESEARCH_SUPPORTED
    assert committed.status != QualificationStatus.QUALIFIED, "Mutant 4 survived: unearned QUALIFIED minted!"


def test_mutant_5_bypass_evaluator_independence_is_killed():
    """Mutant 5: Bypass evaluator-independence checks."""
    proto, train, heldout = _fixtures()
    bad_proto = StudyProtocol(
        study_id="S-M5", evaluator_id="self-model", generator_id="self-model",
        evaluator_kind="generating_model_self", oracle_digest="0"*64, model_digest="1"*64,
        alpha=0.05, primary_effect_floor=0.05, min_heldout_families=20,
        family_level_significance=True, multiplicity=1
    )
    with pytest.raises(StudyInvalid, match="self-certification prohibited"):
        run_study(bad_proto, train, heldout)


def test_mutant_6_substitute_altered_oracle_digest_is_killed():
    """Mutant 6: Substitute an altered oracle digest."""
    validator = LearningValidator()
    proto, train, heldout = _fixtures()
    study_res = run_study(proto, train, heldout)

    # Oracle attestation signed over altered evidence hash
    sk, pk = generate_keypair()
    fake_attestation = create_oracle_attestation(
        signing_key=sk, public_key=pk, oracle_id="eval-ext",
        evidence_hash="f" * 64,  # Altered evidence hash!
        verdict="APPROVED"
    )
    ok, msg = validator.verify_oracle_attestation(fake_attestation, study_res.evidence_hash)
    assert ok is False
    assert "evidence hash mismatch" in msg


def test_mutant_7_reuse_stale_evidence_after_protocol_change_is_killed():
    """Mutant 7: Reuse stale evidence after protocol changes."""
    proto, train, heldout = _fixtures()
    old_res = run_study(proto, train, heldout)

    # Change protocol parameter (multiplicity changed from 1 to 3)
    altered_proto = StudyProtocol(**{**asdict(proto), "multiplicity": 3})
    # replay_study MUST return False
    assert replay_study(old_res, altered_proto, train, heldout) is False, "Mutant 7 survived: stale evidence replayed across protocol change!"


def test_mutant_8_replay_receipt_against_altered_observations_is_killed():
    """Mutant 8: Replay a receipt against altered observations."""
    proto, train, heldout = _fixtures()
    res = run_study(proto, train, heldout)

    tampered_heldout = list(heldout)
    tampered_heldout[0] = Observation(
        heldout[0].item_id, heldout[0].family_id, heldout[0].content_sha256, 0.99, 0.01
    )
    assert replay_study(res, proto, train, tampered_heldout) is False, "Mutant 8 survived: tampered observations matched old evidence hash!"


def test_mutant_9_bypass_insufficient_sample_handling_is_killed():
    """Mutant 9: Bypass insufficient-sample handling."""
    proto, train, heldout = _fixtures(n=3)
    res = run_study(proto, train, heldout)
    assert res.status == "INCONCLUSIVE", "Mutant 9 survived: sample size < 20 families was not inconclusive!"
    assert "INSUFFICIENT_INDEPENDENT_FAMILIES" in res.reasons

    runner = ControlledExperimentRunner()
    m, p, t, ci = runner.compute_paired_stats([0.2], [0.9])
    assert p == 1.0, "Mutant 9 survived: single sample produced p != 1.0!"


def test_mutant_10_convert_unknown_into_qualified_is_killed():
    """Mutant 10: Convert UNKNOWN or INCONCLUSIVE study into QUALIFIED."""
    proto, train, heldout = _fixtures(held_base=0.8, held_cand=0.82)  # delta 0.02 < floor 0.05
    res = run_study(proto, train, heldout)
    assert res.status == "INCONCLUSIVE"

    validator = LearningValidator()
    claim = LearningClaim("C-M10", "dom", "desc", "gen-model", "p1", "p2", budget_nanos=1000)
    tx = LearningValidityTransaction(
        "TX-M10", claim, ExperimentProtocol(protocol_id="P-M10"),
        evaluator_id="eval-ext", lvt2_study_result=res
    )
    committed = validator.validate_and_commit(tx)
    # UNKNOWN != PASS: status must be INCONCLUSIVE, NEVER QUALIFIED!
    assert committed.status == QualificationStatus.INCONCLUSIVE
    assert committed.status != QualificationStatus.QUALIFIED
