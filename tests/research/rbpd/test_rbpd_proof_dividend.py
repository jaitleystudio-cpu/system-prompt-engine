"""
SPE Ω — Reality-Bound Proof Dividend (RBPD) Falsifiable Verification Suite.

Covers:
- Phase A: 16-field RealityBoundEvidenceAsset contract & 4-state EpistemicStatus (VALID, INVALID, STALE, UNKNOWN).
- Phase B: Sound invalidation & selective re-qualification across 6 edit/drift classes over CausalProofGraph & ObligationHypergraph.
- Phase C: Goodhart-resistant dual-channel reality witness selection (Channel A counterfactual EIG + Channel B sealed stratified random).
- Phase D: Full lifecycle proof-dividend benchmark (VOE, >=90% incremental reverification reduction, 0 escaped defects, mandatory negative control).
- Phase E: Cross-runtime conformance (Python, native Rust spe-core-eval, WebAssembly spe_wasm.wasm) & cross-model non-inheritance.
- Product Human Interface: explain_proof_dividend & CLI audit output.
"""

from __future__ import annotations

import copy
import hashlib
import json
import time
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_oracle_attestation,
    create_owner_validator_attestation,
)
from spe_runtime.research.rbpd import (
    DualChannelWitnessSelector,
    EpistemicStatus,
    InvalidationEvent,
    InvalidationTrigger,
    LifecycleCostLedger,
    PortabilityVerifier,
    ProofContractValidator,
    ProofDividendBenchmark,
    RealityBoundEvidenceAsset,
    SealedIndependentSampler,
    SelectiveRequalificationEngine,
    explain_proof_dividend,
)
from spe_runtime.research.rbpd.cli import run_rbpd_cli


@pytest.fixture(autouse=True)
def _isolated_trust_registries(tmp_path):
    LearningValidator.clear_owner_registries()
    tombstone_path = tmp_path / "rbpd_tombstones.jsonl"
    LearningValidator.set_tombstone_store_path(tombstone_path)
    yield
    LearningValidator.clear_owner_registries()


def _make_attested_validator_and_oracle():
    owner_sk, owner_pk = generate_keypair()
    val_sk, val_pk = generate_keypair()
    oracle_sk, oracle_pk = generate_keypair()

    LearningValidator.register_owner_root_key(owner_pk)
    owner_att = create_owner_validator_attestation(
        owner_signing_key=owner_sk,
        owner_public_key=owner_pk,
        validator_public_key=val_pk,
    )
    validator = LearningValidator(
        default_signing_key=val_sk,
        default_public_key=val_pk,
        trusted_oracles={"oracle-rbpd-01": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=owner_att,
        require_cryptographic_owner_authority=True,
    )
    return validator, owner_sk, owner_pk, oracle_sk, oracle_pk


# =============================================================================
# PHASE A: REALITY-BOUND EVIDENCE ASSET CONTRACT
# =============================================================================


def test_phase_a_16_field_evidence_asset_schema_and_valid_verification():
    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    contract_validator = ProofContractValidator(validator=validator)

    now = time.time()
    asset = contract_validator.mint_asset(
        asset_id="ASSET-RBPD-001",
        claim_id="CLAIM-AUTH-BOUNDARY-01",
        subject_digest="a" * 64,
        requirement_atoms=("REQ-ATOM-01", "REQ-ATOM-02"),
        assumption_boundaries={"os": "darwin", "max_latency_ms": 50},
        proof_slice_digest="b" * 64,
        witness_protocol_digest="c" * 64,
        oracle_identity="oracle-rbpd-01",
        oracle_class="independent_static_oracle",
        model_or_runtime_digest="d" * 64,
        model_digest_type="VERIFIED_MODEL_REVISION",
        validity_horizon=now + 3600.0,
        invalidation_triggers=(
            InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value,
            InvalidationTrigger.ASSUMPTION_VIOLATED.value,
            InvalidationTrigger.MODEL_REVISION_CHANGED.value,
            InvalidationTrigger.ORACLE_UNTRUSTED.value,
            InvalidationTrigger.TOMBSTONE_REVOKED.value,
        ),
        generator_id="gpt-4o-2026-08",
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    # Verify all 16 mandatory fields exist on the frozen dataclass
    expected_16_fields = {
        "asset_id",
        "claim_id",
        "subject_digest",
        "requirement_atoms",
        "assumption_boundaries",
        "proof_slice_digest",
        "witness_protocol_digest",
        "oracle_identity",
        "oracle_class",
        "model_or_runtime_digest",
        "model_digest_type",
        "validity_horizon",
        "invalidation_triggers",
        "revocation_tombstone_ref",
        "receipt_hash",
        "signature",
    }
    asset_dict = asset.to_dict()
    assert expected_16_fields.issubset(set(asset_dict.keys()))
    assert len(asset.receipt_hash) == 64
    assert len(asset.signature) == 128

    # Verify SpePackage container round-trip
    from spe_runtime.spe_package import verify_package_integrity

    pkg = contract_validator.package_asset(asset)
    pkg_report = verify_package_integrity(pkg.root)
    assert pkg_report["status"] == "PASS"

    # Verify VALID epistemic status under matching reality context
    verdict = contract_validator.validate_asset(
        asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"os": "darwin", "max_latency_ms": 50},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert verdict.status == EpistemicStatus.VALID
    assert verdict.can_reuse is True


def test_phase_a_adversarial_forgery_synthetic_model_and_tombstone_fail_closed(tmp_path):
    tombstone_file = tmp_path / "phase_a_tombstones.jsonl"
    LearningValidator.set_tombstone_store_path(tombstone_file)
    validator, owner_sk, owner_pk, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    contract_validator = ProofContractValidator(validator=validator)
    now = time.time()

    asset = contract_validator.mint_asset(
        asset_id="ASSET-RBPD-002",
        claim_id="CLAIM-02",
        subject_digest="a" * 64,
        requirement_atoms=("REQ-01",),
        assumption_boundaries={"env": "prod"},
        proof_slice_digest="b" * 64,
        witness_protocol_digest="c" * 64,
        oracle_identity="oracle-rbpd-01",
        oracle_class="independent_static_oracle",
        model_or_runtime_digest="d" * 64,
        model_digest_type="VERIFIED_MODEL_REVISION",
        validity_horizon=now + 3600.0,
        invalidation_triggers=(InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value,),
        generator_id="gpt-4o",
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    # 1. Tampered signature -> INVALID
    forged_sig_asset = dataclasses_replace(asset, signature="0" * 128)
    v_forged = contract_validator.validate_asset(
        forged_sig_asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert v_forged.status == EpistemicStatus.INVALID
    assert v_forged.can_reuse is False

    # 2. Synthetic model digest claiming VERIFIED_MODEL_REVISION -> rejected at mint & validation
    synthetic_digest = hashlib.sha256(b"spe-model-v1:gpt-4o").hexdigest()
    with pytest.raises(ValueError, match="(?i)(synthetic|model_digest)"):
        contract_validator.mint_asset(
            asset_id="ASSET-SYNTH-BAD",
            claim_id="CLAIM-SYNTH",
            subject_digest="a" * 64,
            requirement_atoms=("REQ-01",),
            assumption_boundaries={"env": "prod"},
            proof_slice_digest="b" * 64,
            witness_protocol_digest="c" * 64,
            oracle_identity="oracle-rbpd-01",
            oracle_class="independent_static_oracle",
            model_or_runtime_digest=synthetic_digest,
            model_digest_type="VERIFIED_MODEL_REVISION",
            validity_horizon=now + 3600.0,
            invalidation_triggers=(InvalidationTrigger.MODEL_REVISION_CHANGED.value,),
            generator_id="gpt-4o",
            oracle_signing_key=oracle_sk,
            oracle_public_key=oracle_pk,
        )

    # 3. Self-certifying oracle -> rejected
    with pytest.raises(ValueError, match="(?i)(self-certification|independent)"):
        contract_validator.mint_asset(
            asset_id="ASSET-SELF-CERT",
            claim_id="CLAIM-SELF",
            subject_digest="a" * 64,
            requirement_atoms=("REQ-01",),
            assumption_boundaries={"env": "prod"},
            proof_slice_digest="b" * 64,
            witness_protocol_digest="c" * 64,
            oracle_identity="gpt-4o",
            oracle_class="generating_model_self",
            model_or_runtime_digest="d" * 64,
            model_digest_type="VERIFIED_MODEL_REVISION",
            validity_horizon=now + 3600.0,
            invalidation_triggers=(InvalidationTrigger.ORACLE_UNTRUSTED.value,),
            generator_id="gpt-4o",
            oracle_signing_key=oracle_sk,
            oracle_public_key=oracle_pk,
        )

    # 4. Revocation tombstone persists across simulated restart and defeats backup restore
    backup_asset = copy.deepcopy(asset)
    contract_validator.revoke_asset(
        asset,
        reason="COUNTEREXAMPLE_FOUND",
        details="Adversarial witness refuted claim",
    )

    # Simulate process restart
    val_sk, val_pk = validator._sk, validator._pk
    LearningValidator.clear_owner_registries()
    LearningValidator.set_tombstone_store_path(tombstone_file)
    LearningValidator.register_owner_root_key(owner_pk)
    owner_att = create_owner_validator_attestation(
        owner_signing_key=owner_sk,
        owner_public_key=owner_pk,
        validator_public_key=val_pk,
    )
    fresh_validator = LearningValidator(
        default_signing_key=val_sk,
        default_public_key=val_pk,
        trusted_oracles={"oracle-rbpd-01": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=owner_att,
        require_cryptographic_owner_authority=True,
    )
    fresh_contract_validator = ProofContractValidator(validator=fresh_validator)

    v_restored = fresh_contract_validator.validate_asset(
        backup_asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert v_restored.status == EpistemicStatus.INVALID
    assert v_restored.can_reuse is False
    assert "tombstone" in v_restored.reason.lower() or "revoked" in v_restored.reason.lower()


def test_phase_a_stale_and_unknown_epistemic_states():
    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    contract_validator = ProofContractValidator(validator=validator)
    now = time.time()

    asset = contract_validator.mint_asset(
        asset_id="ASSET-RBPD-003",
        claim_id="CLAIM-03",
        subject_digest="a" * 64,
        requirement_atoms=("REQ-01",),
        assumption_boundaries={"env": "prod", "region": "us-east"},
        proof_slice_digest="b" * 64,
        witness_protocol_digest="c" * 64,
        oracle_identity="oracle-rbpd-01",
        oracle_class="independent_static_oracle",
        model_or_runtime_digest="d" * 64,
        model_digest_type="VERIFIED_MODEL_REVISION",
        validity_horizon=now + 300.0,
        invalidation_triggers=(
            InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value,
            InvalidationTrigger.ASSUMPTION_VIOLATED.value,
            InvalidationTrigger.MODEL_REVISION_CHANGED.value,
        ),
        generator_id="gpt-4o",
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    # 1. Expired horizon -> STALE
    v_expired = contract_validator.validate_asset(
        asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod", "region": "us-east"},
        current_model_digest="d" * 64,
        current_time=now + 600.0,
    )
    assert v_expired.status == EpistemicStatus.STALE
    assert v_expired.can_reuse is False

    # 2. Mutated subject digest -> STALE
    v_subject = contract_validator.validate_asset(
        asset,
        current_subject_digest="e" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod", "region": "us-east"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert v_subject.status == EpistemicStatus.STALE

    # 3. Violated assumption boundary -> STALE
    v_assumption = contract_validator.validate_asset(
        asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "staging", "region": "us-east"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert v_assumption.status == EpistemicStatus.STALE

    # 4. Missing asset or held external gate -> UNKNOWN
    v_missing = contract_validator.validate_asset(
        None,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert v_missing.status == EpistemicStatus.UNKNOWN
    assert v_missing.can_reuse is False


def dataclasses_replace(obj, **changes):
    from dataclasses import replace
    return replace(obj, **changes)


# =============================================================================
# PHASE B: SOUND INVALIDATION & SELECTIVE RE-QUALIFICATION
# =============================================================================


def test_phase_b_selective_invalidation_matrix_all_six_classes():
    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    engine = SelectiveRequalificationEngine.build_modular_benchmark_graph(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
        num_modules=10,
    )

    # Class 1: Unrelated edit outside obligation graph -> 100% reused, 0% invalidated
    plan_unrelated = engine.compute_requalification_plan(
        InvalidationEvent(
            event_type="UNRELATED_MODULE_EDIT",
            touched_modules=("docs/README.md",),
        )
    )
    assert len(plan_unrelated.reused_obligations) == 10
    assert len(plan_unrelated.stale_obligations) == 0
    assert len(plan_unrelated.invalid_obligations) == 0

    # Class 2: Localized leaf module edit -> only 1 obligation (10%) STALE, 9 (90%) reused
    plan_leaf = engine.compute_requalification_plan(
        InvalidationEvent(
            event_type="DIRECT_REQUIREMENT_EDIT",
            touched_modules=("mod-leaf-09",),
        )
    )
    assert len(plan_leaf.stale_obligations) == 1
    assert "OBL-09" in plan_leaf.stale_obligations
    assert len(plan_leaf.reused_obligations) == 9

    # Class 3: Shared dependency / environment assumption mutation -> invalidates transitive cone (OBL-00 and its dependent OBL-01)
    plan_shared = engine.compute_requalification_plan(
        InvalidationEvent(
            event_type="SHARED_ASSUMPTION_MUTATION",
            violated_assumptions={"shared_core_assumption": "mutated"},
        )
    )
    assert "OBL-00" in plan_shared.stale_obligations
    assert "OBL-01" in plan_shared.stale_obligations
    assert len(plan_shared.stale_obligations) == 2
    assert len(plan_shared.reused_obligations) == 8

    # Class 4: Model revision digest change -> all model-bound obligations become STALE
    plan_model = engine.compute_requalification_plan(
        InvalidationEvent(
            event_type="MODEL_REVISION_CHANGED",
            new_model_digest="f" * 64,
        )
    )
    assert len(plan_model.stale_obligations) == 10
    assert len(plan_model.reused_obligations) == 0

    # Class 5: Oracle version / trust change -> assets bound to untrusted oracle become INVALID
    plan_oracle = engine.compute_requalification_plan(
        InvalidationEvent(
            event_type="ORACLE_TRUST_REVOKED",
            revoked_oracle_id="oracle-rbpd-01",
        )
    )
    assert len(plan_oracle.invalid_obligations) == 10
    assert len(plan_oracle.reused_obligations) == 0

    # Class 6: Revocation tombstone on OBL-04 -> OBL-04 becomes permanently INVALID
    engine.revoke_obligation_asset("OBL-04", reason="COUNTEREXAMPLE_FOUND")
    plan_tombstone = engine.compute_requalification_plan(
        InvalidationEvent(event_type="NO_OP")
    )
    assert "OBL-04" in plan_tombstone.invalid_obligations
    assert len(plan_tombstone.reused_obligations) == 9


# =============================================================================
# PHASE C: GOODHART-RESISTANT REALITY WITNESS SELECTION
# =============================================================================


def test_phase_c_dual_channel_witness_selector_catches_goodhart_proxy_overfit():
    sampler = SealedIndependentSampler(
        sealed_families=[f"sealed-fam-{i:02d}" for i in range(12)],
        items_per_family=4,
        min_sealed_fraction=0.25,
        min_sealed_families=3,
    )
    selector = DualChannelWitnessSelector(sampler=sampler, goodhart_gap_threshold=0.25)

    selection = selector.select_witnesses(
        stale_obligations=["OBL-02", "OBL-03"],
        parent_receipt_hash="a" * 64,
        edit_commit_digest="b" * 64,
        epoch_nonce="epoch-2026-10-11",
        total_budget_probes=12,
    )
    assert len(selection.channel_a_probes) >= 1
    assert len(selection.channel_b_witnesses) >= 3
    assert selection.sealed_fraction >= 0.25
    assert selection.distinct_sealed_families >= 3

    # Evaluate a Goodhart proxy-overfit candidate that scores 0.95 on Channel A (active probes)
    # but collapses to 0.20 on Channel B (sealed reality witnesses)
    active_only_verdict = selector.evaluate_candidate(
        selection=selection,
        strategy="ACTIVE_ONLY",
        channel_a_evaluator=lambda probe: 0.95,
        channel_b_evaluator=lambda witness: 0.20,
    )
    assert active_only_verdict.passed is True  # ACTIVE_ONLY is fooled by Goodhart gaming!

    rbpd_verdict = selector.evaluate_candidate(
        selection=selection,
        strategy="RBPD_DUAL_CHANNEL",
        channel_a_evaluator=lambda probe: 0.95,
        channel_b_evaluator=lambda witness: 0.20,
    )
    assert rbpd_verdict.passed is False
    assert rbpd_verdict.goodhart_divergence_detected is True
    assert rbpd_verdict.epistemic_status == EpistemicStatus.INVALID

    # Attempting to configure a SealedIndependentSampler below the 25% floor must fail closed
    with pytest.raises(ValueError, match="(?i)(min_sealed_fraction|0.25)"):
        SealedIndependentSampler(
            sealed_families=["fam-1", "fam-2", "fam-3"],
            items_per_family=2,
            min_sealed_fraction=0.05,
            min_sealed_families=3,
        )


# =============================================================================
# PHASE D: LIFECYCLE PROOF-DIVIDEND BENCHMARK & NEGATIVE CONTROL
# =============================================================================


def test_phase_d_lifecycle_proof_dividend_and_negative_control():
    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    benchmark = ProofDividendBenchmark(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    report = benchmark.run_lifecycle_comparison(num_modules=20, num_incremental_steps=6)

    rbpd_metrics = report.strategy_results["RBPD_DUAL_CHANNEL"]
    full_metrics = report.strategy_results["FULL_RERUN"]
    random_metrics = report.strategy_results["RANDOM_ONLY"]
    active_metrics = report.strategy_results["ACTIVE_ONLY"]

    # 1. Incremental reverification reduction >= 90% on localized edits
    assert rbpd_metrics.incremental_reverification_reduction >= 0.90
    # 2. Positive net lifecycle dividend after amortizing initial proof construction cost
    assert rbpd_metrics.net_dividend_positive is True
    assert rbpd_metrics.ledger.total_lifecycle_cost < full_metrics.ledger.total_lifecycle_cost
    assert rbpd_metrics.verified_outcome_efficiency > full_metrics.verified_outcome_efficiency
    # 3. Zero escaped defects and zero false reuse for RBPD_DUAL_CHANNEL
    assert rbpd_metrics.escaped_defect_rate == 0.0
    assert rbpd_metrics.false_reuse_rate == 0.0
    # 4. Baselines exhibit their structural weaknesses:
    #    RANDOM_ONLY misses localized boundary regressions; ACTIVE_ONLY misses Goodhart traps
    assert random_metrics.escaped_defect_rate > 0.0
    assert active_metrics.escaped_defect_rate > 0.0

    # 5. Mandatory Negative Control: global root assumption mutation / unamortized single-shot change
    neg_control = benchmark.run_negative_control_benchmark(num_modules=20)
    assert neg_control.net_dividend_positive is False
    assert neg_control.claim_status == "NO_DIVIDEND_CLAIMED"
    assert neg_control.ledger.total_lifecycle_cost >= neg_control.full_rerun_cost


# =============================================================================
# PHASE E: CROSS-RUNTIME (PYTHON / RUST / WASM) & CROSS-MODEL PORTABILITY
# =============================================================================


def test_phase_e_cross_runtime_python_rust_wasm_and_cross_model_portability():
    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    verifier = PortabilityVerifier(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    # 1. Cross-runtime differential conformance across Python, native Rust, and WebAssembly
    runtime_report = verifier.verify_cross_runtime_conformance()
    assert runtime_report["all_runtimes_conform"] is True
    assert runtime_report["case_count"] >= 3
    for case in runtime_report["cases"]:
        assert case["python_verdict"] == case["rust_verdict"] == case["wasm_verdict"]
        assert case["conformant"] is True

    # 2. Cross-model portability discipline: asset qualified on gpt-4o cannot silently inherit to claude-3-7-sonnet
    model_report = verifier.verify_cross_model_portability(
        source_model_id="gpt-4o",
        target_model_id="claude-3-7-sonnet",
    )
    assert model_report["untransferred_status"] == EpistemicStatus.STALE.value
    assert model_report["untransferred_can_reuse"] is False
    assert model_report["transferred_status"] == EpistemicStatus.VALID.value
    assert model_report["transferred_can_reuse"] is True
    assert len(model_report["transfer_receipt_hash"]) == 64


# =============================================================================
# PRODUCT HUMAN INTERFACE: EXPLAIN & CLI
# =============================================================================


def test_product_human_interface_explain_and_cli():
    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    benchmark = ProofDividendBenchmark(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )
    verifier = PortabilityVerifier(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    bench_report = benchmark.run_lifecycle_comparison(num_modules=20, num_incremental_steps=6)
    neg_report = benchmark.run_negative_control_benchmark(num_modules=20)
    port_report = verifier.verify_cross_runtime_conformance()

    explanation = explain_proof_dividend(
        benchmark_report=bench_report,
        negative_control_report=neg_report,
        portability_report=port_report,
    )

    # Must contain all 5 product human interface sections
    for section_key in ("ESTABLISHED", "REUSED", "REVERIFIED", "UNKNOWN_OR_HELD", "WHY"):
        assert section_key in explanation["sections"]
        assert section_key in explanation["human_text"]

    # Held external gates must remain explicitly marked BLOCKED / HOLD
    held_gates = explanation["sections"]["UNKNOWN_OR_HELD"]["held_external_gates"]
    assert held_gates["EXTERNAL_MODEL_QUALIFICATION"] == "BLOCKED_HOLD"
    assert held_gates["G6_H_BLINDED_HUMAN_EVALUATION"] == "BLOCKED_HOLD"

    # Verify CLI execution in both text and JSON modes
    cli_text_out = run_rbpd_cli(["--modules", "6", "--steps", "4"])
    assert "ESTABLISHED" in cli_text_out
    assert "REUSED" in cli_text_out
    assert "REVERIFIED" in cli_text_out
    assert "UNKNOWN_OR_HELD" in cli_text_out
    assert "WHY" in cli_text_out

    cli_json_out = run_rbpd_cli(["--json", "--modules", "6", "--steps", "4"])
    parsed = json.loads(cli_json_out)
    assert parsed["sections"]["UNKNOWN_OR_HELD"]["held_external_gates"]["G6_H_BLINDED_HUMAN_EVALUATION"] == "BLOCKED_HOLD"


def test_adversarial_review_closures_contract_diamond_invalidation_and_sealed_floor():
    """
    Regression suite verifying fixes for all adversarial review findings:
    1. All 16 canonical Section 5 contract fields present and bound; AuthorityGrant revocation/expiry enforced.
    2. Protected intent, environment fingerprint, dataset commitment, and dependency evidence tombstones enforced.
    3. Transitive invalidation propagates INVALID (tombstone/oracle revocation) and STALE across multi-hop
       diamond graphs, and marks obligations with unregistered upstream dependencies as UNKNOWN.
    4. All 6 change classes (requirements, models, tools, datasets, permissions, environmental assumptions)
       selectively invalidate affected obligations.
    5. DualChannelWitnessSelector preserves sealed_fraction >= 0.25 even when len(stale_obligations) > total_budget_probes.
    6. ProofDividendBenchmark dynamically computes escaped defects, false rejections, and failed attempt recovery cost.
    """
    from spe_runtime.authority import AuthorityGrant
    from spe_runtime.proof_graph.models import CausalEdge, CausalNode, EdgeType, NodeType
    from spe_runtime.research.wdes.witness_hypergraph import ObligationNode

    validator, _, _, oracle_sk, oracle_pk = _make_attested_validator_and_oracle()
    contract_validator = ProofContractValidator(validator=validator)
    now = time.time()

    dep_hash = "7" * 64
    asset = contract_validator.mint_asset(
        asset_id="ASSET-CANONICAL-16",
        claim_id="CLAIM-CANONICAL-16",
        subject_digest="a" * 64,
        requirement_atoms=("REQ-101",),
        assumption_boundaries={"env": "prod", "tool": "z3-solver", "permission": "perm:verify"},
        proof_slice_digest="b" * 64,
        witness_protocol_digest="c" * 64,
        oracle_identity="oracle-rbpd-01",
        oracle_class="independent_static_oracle",
        model_or_runtime_digest="d" * 64,
        model_digest_type="VERIFIED_MODEL_REVISION",
        validity_horizon=now + 3600.0,
        invalidation_triggers=(InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value,),
        generator_id="gpt-4o",
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
        dependency_evidence_hashes=(dep_hash,),
    )

    canonical_16_keys = {
        "OBJECTIVE_DIGEST",
        "PROTECTED_INTENT_DIGEST",
        "REQUIREMENT_VERSION",
        "MODEL_ID",
        "VERIFIED_MODEL_REVISION",
        "ENVIRONMENT_FINGERPRINT",
        "DEPENDENCY_EVIDENCE_HASHES",
        "VERIFICATION_METHOD",
        "VALIDITY_ASSUMPTIONS",
        "INDEPENDENT_EVALUATOR_ID",
        "EVALUATION_DATASET_COMMITMENT",
        "COUNTEREXAMPLE_COVERAGE",
        "AUTHORITY_SCOPE",
        "EXPIRY_OR_REQUALIFICATION_CONDITIONS",
        "REVOCATION_REFERENCE",
        "PROOF_RECEIPT",
    }
    assert canonical_16_keys == set(asset.essential_contract_dict().keys())
    assert canonical_16_keys.issubset(set(asset.to_dict().keys()))

    # Revoked AuthorityGrant -> INVALID
    revoked_grant = AuthorityGrant(
        grant_id="GRANT-REVOKED-01",
        principal="validator:test",
        capability="RBPD_EVIDENCE_MINT_AND_VERIFY",
        target="spe_runtime.research.rbpd",
        argument_constraints={"require_cryptographic_owner_authority": True},
        purpose="Test revoked grant",
        issued_at="1970-01-01T00:00:00Z",
        expires_at="2099-12-31T23:59:59Z",
        use_limit=100,
        revocation_state="REVOKED",
    )
    v_revoked_grant = contract_validator.validate_asset(
        asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod", "tool": "z3-solver", "permission": "perm:verify"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
        current_authority_grant=revoked_grant,
    )
    assert v_revoked_grant.status == EpistemicStatus.INVALID
    assert v_revoked_grant.can_reuse is False

    # Protected intent change -> STALE
    v_intent = contract_validator.validate_asset(
        asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod", "tool": "z3-solver", "permission": "perm:verify"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
        current_protected_intent_digest="e" * 64,
    )
    assert v_intent.status == EpistemicStatus.STALE
    assert v_intent.can_reuse is False

    # Tombstoning upstream dependency_evidence_hash -> STALE
    validator.record_tombstone(receipt_hash=dep_hash, reason="UPSTREAM_REVOKED")
    v_dep_tomb = contract_validator.validate_asset(
        asset,
        current_subject_digest="a" * 64,
        current_proof_slice_digest="b" * 64,
        current_assumptions={"env": "prod", "tool": "z3-solver", "permission": "perm:verify"},
        current_model_digest="d" * 64,
        current_time=now + 10.0,
    )
    assert v_dep_tomb.status == EpistemicStatus.STALE
    assert v_dep_tomb.can_reuse is False

    # Multi-hop diamond graph + transitive propagation of INVALID & UNKNOWN + 6 change classes
    engine = SelectiveRequalificationEngine.build_modular_benchmark_graph(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
        num_modules=6,
    )
    # Create diamond: OBL-00 -> {OBL-01, OBL-02} -> OBL-03 via CausalProofGraph edges
    engine.proof_graph.add_edge(
        CausalEdge(edge_id="EDGE-00-02", source_id="OBL-00", target_id="OBL-02", edge_type=EdgeType.DERIVES_FROM)
    )
    engine.proof_graph.add_edge(
        CausalEdge(edge_id="EDGE-01-03", source_id="OBL-01", target_id="OBL-03", edge_type=EdgeType.DERIVES_FROM)
    )
    engine.proof_graph.add_edge(
        CausalEdge(edge_id="EDGE-02-03", source_id="OBL-02", target_id="OBL-03", edge_type=EdgeType.DERIVES_FROM)
    )
    engine.base_assumptions["OBL-04"]["tool"] = "tool-alpha"
    engine.base_assumptions["OBL-05"]["permission"] = "perm-admin"

    # Tool change on tool-alpha -> OBL-04 STALE
    plan_tool = engine.compute_requalification_plan(
        InvalidationEvent(event_type="TOOL_CHANGED", touched_tools=("tool-alpha",))
    )
    assert "OBL-04" in plan_tool.stale_obligations
    assert len(plan_tool.reused_obligations) == 5

    # Dataset commitment change -> all obligations STALE
    plan_dataset = engine.compute_requalification_plan(
        InvalidationEvent(event_type="DATASET_CHANGED", new_dataset_commitment="8" * 64)
    )
    assert len(plan_dataset.stale_obligations) == 6

    # Permission revocation on perm-admin -> OBL-05 INVALID
    plan_perm = engine.compute_requalification_plan(
        InvalidationEvent(event_type="PERMISSION_REVOKED", revoked_permissions=("perm-admin",))
    )
    assert "OBL-05" in plan_perm.invalid_obligations
    assert len(plan_perm.reused_obligations) == 5

    # Revoking OBL-00 (root of diamond) makes OBL-00 INVALID and transitively makes OBL-01, OBL-02, OBL-03 STALE!
    engine.revoke_obligation_asset("OBL-00", reason="ROOT_COMPROMISED")
    plan_diamond = engine.compute_requalification_plan(InvalidationEvent(event_type="NO_OP"))
    assert "OBL-00" in plan_diamond.invalid_obligations
    assert {"OBL-01", "OBL-02", "OBL-03"}.issubset(set(plan_diamond.stale_obligations))
    assert set(plan_diamond.reused_obligations) == {"OBL-04", "OBL-05"}

    # Registering an obligation with an unknown upstream dependency -> conservative UNKNOWN
    engine.obligation_dependencies["OBL-04"].add("OBL-UNREGISTERED-99")
    plan_unknown = engine.compute_requalification_plan(InvalidationEvent(event_type="NO_OP"))
    assert "OBL-04" in plan_unknown.unknown_obligations
    assert plan_unknown.verdicts_by_obligation["OBL-04"].can_reuse is False

    # Phase C: 25% sealed witness floor holds even when len(stale_obligations)=10 > total_budget_probes=8
    sampler = SealedIndependentSampler(
        sealed_families=[f"sealed-fam-{i:02d}" for i in range(12)],
        items_per_family=4,
        min_sealed_fraction=0.25,
        min_sealed_families=3,
    )
    selector = DualChannelWitnessSelector(sampler=sampler)
    sel_large = selector.select_witnesses(
        stale_obligations=[f"OBL-{i:02d}" for i in range(10)],
        parent_receipt_hash="a" * 64,
        edit_commit_digest="b" * 64,
        epoch_nonce="epoch-large",
        total_budget_probes=8,
    )
    assert sel_large.sealed_fraction >= 0.25

    # Phase D: Benchmark tracks recovery cost and false acceptance/rejection rates
    benchmark = ProofDividendBenchmark(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )
    bench_rep = benchmark.run_lifecycle_comparison(num_modules=20, num_incremental_steps=6)
    assert bench_rep.strategy_results["RBPD_DUAL_CHANNEL"].ledger.failed_attempt_recovery_cost == 0.0
    assert bench_rep.strategy_results["RBPD_DUAL_CHANNEL"].false_rejection_rate == 0.0
    assert bench_rep.strategy_results["RANDOM_ONLY"].ledger.failed_attempt_recovery_cost > 0.0
    assert bench_rep.strategy_results["ACTIVE_ONLY"].ledger.failed_attempt_recovery_cost > 0.0

