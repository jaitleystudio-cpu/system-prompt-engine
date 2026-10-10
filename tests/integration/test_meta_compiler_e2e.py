"""End-to-end integration tests for Level 4 Meta-Compiler Self-Evolution."""

import pytest
from spe_runtime.supercompiler import (
    CandidatePipeline,
    CompilerPass,
    EvolutionLedger,
    FormalEquivalenceVerifier,
    MetaCompilerEvolver,
    PromotionRecord,
)


def test_meta_compiler_e2e_evolution_promotion_and_rollback(tmp_path):
    ledger_file = tmp_path / "evolution_ledger.json"
    ledger = EvolutionLedger(storage_path=ledger_file)
    verifier = FormalEquivalenceVerifier()

    evolver = MetaCompilerEvolver(
        verifier=verifier,
        ledger=ledger,
        population_size=4,
        random_seed=42,
    )

    # 1. Baseline starts at Generation 0
    active_baseline = ledger.get_active()
    assert active_baseline is not None
    assert active_baseline.generation == 0
    assert active_baseline.status == "ACTIVE"

    # 2. Run genetic evolution over 2 generations
    report = evolver.evolve(num_generations=2)
    assert report["final_generation"] == 2
    assert len(report["generations"]) == 2
    champion = evolver.champion

    # Champion must have zero semantic drift
    assert champion.verified is True
    assert champion.proof_certificate is not None
    assert champion.proof_certificate.is_verified is True
    assert champion.proof_certificate.drift_detected is False

    # 3. Promote champion to the evolution ledger
    record: PromotionRecord = evolver.promote_champion()
    assert record.status == "ACTIVE"
    assert record.pipeline_id == champion.pipeline_id
    assert record.is_verified is True
    assert record.parent_promotion_hash == active_baseline.promotion_hash

    # Verify disk persistence
    reloaded_ledger = EvolutionLedger(storage_path=ledger_file)
    reloaded_active = reloaded_ledger.get_active()
    assert reloaded_active.promotion_hash == record.promotion_hash
    assert reloaded_active.status == "ACTIVE"

    # 4. Rollback test: Instant fallback
    rolled_back_record = evolver.rollback()
    assert rolled_back_record.status == "ACTIVE"
    # Fallback must be previous valid record (baseline in this case)
    assert rolled_back_record.generation == 0

    # Ensure active hash matches baseline
    active_now = ledger.get_active()
    assert active_now.promotion_hash == active_baseline.promotion_hash

    # 5. Targeted rollback: can roll forward or back to specific hash
    target_reactivated = evolver.rollback(target_hash=record.promotion_hash)
    assert target_reactivated.promotion_hash == record.promotion_hash
    assert target_reactivated.status == "ACTIVE"


def test_cannot_promote_unverified_candidate_with_drift():
    ledger = EvolutionLedger()
    verifier = FormalEquivalenceVerifier()

    # Construct an unverified candidate with deliberate regression
    bad_candidate = CandidatePipeline(
        pipeline_id="bad_regressed_pipeline",
        passes=[
            CompilerPass(pass_id="p_bad", name="Bad Pass", pass_type="pruning", parameters={"order": "DROP_ALL"})
        ],
        generation=1,
        verified=False,
    )

    # Fake certificate reporting drift
    class FakeCertWithDrift:
        def to_dict(self):
            return {
                "is_verified": False,
                "drift_detected": True,
                "divergence_witness": "Regressed on tenant isolation invariant",
            }

    with pytest.raises(ValueError, match="Promotion rejected"):
        ledger.record_promotion(bad_candidate, FakeCertWithDrift())


def test_tripwire_check_triggers_instant_fallback():
    ledger = EvolutionLedger()
    # Promoting a valid dummy record
    baseline = ledger.get_active()

    class DummyCandidate:
        pipeline_id = "pipe_candidate_tripwire"
        generation = 1
        speedup_ratio = 1.2
        token_reduction_pct = 5.0
        passes = []
        def compute_digest(self):
            return "tripwire_digest"

    class ValidCert:
        def to_dict(self):
            return {
                "is_verified": True,
                "drift_detected": False,
                "signature": "valid_sig",
            }

    rec = ledger.record_promotion(DummyCandidate(), ValidCert())
    assert ledger.get_active().pipeline_id == "pipe_candidate_tripwire"

    # Simulate active record failing tripwire verification
    ledger.get_active().is_verified = False
    ok, fallback = ledger.tripwire_check_and_fallback(verifier=None, adversarial_suite=None)
    assert ok is False
    assert fallback is not None
    assert fallback.generation == 0
    assert ledger.get_active().generation == 0
