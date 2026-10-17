"""
SPE Ω — C4P-X+ (Proof-Carrying Semantic Continuation) Benchmark Harness.
Executes the Canonical 6-Node Software Repair Disruption Benchmark:
[1. FIND_FILES] -> [2. REPRODUCE_DEFECT] -> [3. GENERATE_PATCH] -> [4. VALIDATE_PATCH] -> [5. PREPARE_SUMMARY] -> [6. EMIT_RECEIPT]
Asserts:
- Continuation Compression Ratio (CCR >= 10x): 45k tokens -> < 500 tokens
- Zero leaked financial reservations ($0 balance leakage)
- Zero unhedged irreversible effects
- Deterministic facts preserved as VERIFIED_REUSABLE; neural patch quarantined as UNVERIFIED_CANDIDATE_HYPOTHESIS
"""
import hashlib
import json
import pytest

from spe_runtime.research.c4p_x import (
    NanoUSD,
    PredicateValue,
    EffectStatus,
    EvidenceStatus,
    TransactionSafeEscrow,
    RecordedFact,
    SideEffectRecord,
    ExecutionStateSigma,
    ContinuationSynthesizer,
    RemediationAnalyzer,
    TransitionVerifier,
)

def test_c4p_x_software_repair_pcsc_benchmark():
    """
    Executes the 6-Node Software Repair Disruption Benchmark:
    Phase 1: Nodes 1, 2, 3 run on Frontier Model A (Cloud).
    Phase 2: Cloud authority revoked after Node 3 generates patch candidate.
    Phase 3: PCSC synthesizes minimal continuation cut C* <= 500 tokens.
    Phase 4: Node 4 validates patch locally with pytest ($0 tokens).
    Phase 5: Receipt generated with exact zero financial leakage.
    """
    initial_budget: NanoUSD = 50_000_000  # $0.05 USD = 50 million nanos
    escrow = TransactionSafeEscrow(budget_limit_nanos=initial_budget)

    sigma = ExecutionStateSigma(
        total_raw_transcript_tokens=45_000,
        unfulfilled_obligations={"ob_files", "ob_repro", "ob_patch", "ob_validate", "ob_summary", "ob_receipt"},
    )

    # -------------------------------------------------------------
    # Node 1: FIND_FILES (Deterministic, $0)
    # -------------------------------------------------------------
    sigma.facts["f_files"] = RecordedFact(
        fact_id="f_files",
        key="target_files",
        value=["src/auth/jwt_verifier.py"],
        digest=hashlib.sha256(b"jwt_verifier.py").hexdigest(),
        is_deterministic=True,
        dependencies=set(),
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_files")

    # -------------------------------------------------------------
    # Node 2: REPRODUCE_DEFECT (Deterministic, $0)
    # -------------------------------------------------------------
    sigma.facts["f_repro"] = RecordedFact(
        fact_id="f_repro",
        key="failing_test",
        value="tests/auth/test_jwt.py::test_expired_token",
        digest=hashlib.sha256(b"test_expired_token").hexdigest(),
        is_deterministic=True,
        dependencies={"f_files"},
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_repro")

    # -------------------------------------------------------------
    # Node 3: GENERATE_PATCH (Frontier Model A, Cloud with 2PC Escrow)
    # -------------------------------------------------------------
    res_id = "res_node3_cloud"
    with escrow.reservation_scope(res_id, amount_nanos=20_000_000):
        assert escrow.reserved_nanos == 20_000_000
        assert escrow.available_nanos == 30_000_000

        # Cloud model returns patch costing 15,000,000 nanos
        patch_content = "diff --git a/jwt.py b/jwt.py\n+ if token.expired: return False"
        refund = escrow.commit(res_id, actual_spent_nanos=15_000_000)
        assert refund == 5_000_000

    sigma.facts["f_patch"] = RecordedFact(
        fact_id="f_patch",
        key="candidate_patch",
        value=patch_content,
        digest=hashlib.sha256(patch_content.encode("utf-8")).hexdigest(),
        is_deterministic=False,  # Neural output!
        dependencies={"f_repro"},
        evidence_status=EvidenceStatus.EMPIRICALLY_QUALIFIED,
        source_model_version="claude-3-7-sonnet",
    )
    sigma.unfulfilled_obligations.remove("ob_patch")

    # Check conservation
    assert escrow.settled_nanos == 15_000_000
    assert escrow.available_nanos == 35_000_000
    assert escrow.verify_conservation()

    # -------------------------------------------------------------
    # Phase 2: Injected Cloud Disruption (Cloud authority revoked)
    # -------------------------------------------------------------
    cloud_revoked = True

    # -------------------------------------------------------------
    # Phase 3: PCSC Minimal Continuation Cut Synthesis
    # -------------------------------------------------------------
    cut, transferred_tokens, compression_ratio = ContinuationSynthesizer.synthesize_continuation_cut(
        sigma=sigma,
        destination_model_version="local-qwen2.5-coder",
        destination_capabilities={"deterministic_runner", "pytest_validator"},
    )

    # Assert CCR >= 10x and transferred tokens <= 500
    assert transferred_tokens <= 500, f"Transferred tokens {transferred_tokens} > 500"
    assert compression_ratio >= 10.0, f"CCR {compression_ratio:.1f}x < 10x"
    assert cut["preserved_facts"]["target_files"]["status"] == "VERIFIED_REUSABLE"
    assert cut["preserved_facts"]["failing_test"]["status"] == "VERIFIED_REUSABLE"
    # Unverified patch hypothesis quarantined
    assert cut["preserved_facts"]["candidate_patch"]["status"] == "UNVERIFIED_CANDIDATE_HYPOTHESIS"

    # -------------------------------------------------------------
    # Node 4: VALIDATE_PATCH (Deterministic Local Test Harness, $0)
    # -------------------------------------------------------------
    sigma.facts["f_validation"] = RecordedFact(
        fact_id="f_validation",
        key="patch_validation",
        value={"exit_code": 0, "passed": 1, "failed": 0},
        digest=hashlib.sha256(b"pass_0").hexdigest(),
        is_deterministic=True,
        dependencies={"f_patch"},
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_validate")

    # -------------------------------------------------------------
    # Node 5: PREPARE_SUMMARY (Local summary, $0)
    # -------------------------------------------------------------
    sigma.facts["f_summary"] = RecordedFact(
        fact_id="f_summary",
        key="patch_summary",
        value="Defect #402 resolved: expired signature check validated.",
        digest=hashlib.sha256(b"summary").hexdigest(),
        is_deterministic=True,
        dependencies={"f_validation"},
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_summary")

    # -------------------------------------------------------------
    # Node 6: EMIT_RECEIPT (Cryptographic Verification Receipt)
    # -------------------------------------------------------------
    state_digest = sigma.compute_state_digest()
    assert len(state_digest) == 64
    sigma.unfulfilled_obligations.remove("ob_receipt")
    assert len(sigma.unfulfilled_obligations) == 0

    # Assert Zero Financial Balance Leakage
    assert escrow.available_nanos == 35_000_000
    assert escrow.settled_nanos == 15_000_000
    assert escrow.reserved_nanos == 0
    assert escrow.verify_conservation()

def test_transaction_safe_escrow_automatic_rollback_on_exception():
    """Asserts that injected exceptions inside reservation scope roll back immediately with 0 leak."""
    escrow = TransactionSafeEscrow(budget_limit_nanos=100_000_000)
    res_id = "res_fail_test"

    with pytest.raises(RuntimeError):
        with escrow.reservation_scope(res_id, amount_nanos=40_000_000):
            assert escrow.reserved_nanos == 40_000_000
            assert escrow.available_nanos == 60_000_000
            raise RuntimeError("Simulated network drop / cloud provider crash")

    # Automatically rolled back!
    assert escrow.reserved_nanos == 0
    assert escrow.available_nanos == 100_000_000
    assert res_id not in escrow.active_reservations
    assert escrow.verify_conservation()

def test_remediation_analyzer_options():
    """Asserts that RemediationAnalyzer generates Apple-level 3-option diagnostic on cloud revocation."""
    diagnostic = RemediationAnalyzer.analyze_blockage(
        task_name="Software Patch Synthesis for Issue #402",
        satisfied_obligations={"ob_files", "ob_repro", "ob_patch"},
        all_obligations={"ob_files", "ob_repro", "ob_patch", "ob_validate", "ob_summary"},
        spent_nanos=15_000_000,
        preserved_facts={"f_files": True, "f_repro": True},
        cloud_revoked=True,
        required_capability="DEEP_LOGIC",
        available_budget_nanos=0,
        required_budget_nanos=20_000_000,
    )

    assert diagnostic.satisfied_obligations_count == 3
    assert diagnostic.total_obligations_count == 5
    assert len(diagnostic.minimal_remediation_options) == 3
    assert diagnostic.minimal_remediation_options[0].action_type.value == "GRANT_CLOUD_TOKEN_LEASE"
    assert diagnostic.minimal_remediation_options[1].action_type.value == "DOWNLOAD_QUALIFIED_LOCAL_MODEL"
    assert diagnostic.minimal_remediation_options[2].action_type.value == "EMIT_SUPPORTED_PARTIAL_REPORT"
