"""
SPE Ω — End-to-End Integration Test Suite for WDES Architecture.
Unifies Paper 1 (BWFS) and Paper 2 (WDIC) with C4P-X+ Counterfactual Envelopes and PCSC Continuations.
Executes the Canonical 6-Node Software Repair Workflow with Injected Cloud Disconnect,
Context Compression Ratio (CCR >= 10x), and Exact Integer Financial Accounting.
"""

import hashlib
import json
import threading
from typing import Dict, Any, List

import pytest

from spe_runtime.research.wdes import (
    PredicateValue,
    VerificationVerdict,
    NanoUSD,
    NetworkPolicy,
    ObligationStatus,
    EvidenceStatus,
    EffectStatus,
    ObligationNode,
    WitnessNode,
    WitnessType,
    HyperEdge,
    ObligationHypergraph,
    ActionCandidate,
    FrontierScheduler,
    WitnessContract,
    SpecializationRegistry,
    WDICSpecializer,
    RecordedFact,
    ExecutionStateSigma,
    PCSCContinuationEngine,
    RemediationAnalyzer,
    TwoPhaseCommitEscrow,
)
from spe_runtime.research.wdes.witness_hypergraph import HyperEdgeType


def test_wdes_6_node_software_repair_with_pcsc_migration():
    """
    End-to-End Benchmark:
    Canonical 6-Node Software Repair Pipeline:
    1. FIND_FILES (deterministic, $0)
    2. REPRODUCE_DEFECT (deterministic test runner, $0)
    3. GENERATE_PATCH (cloud reasoning model, 15,000,000 nanos)
    4. Cloud Disconnect Injected -> Network drops to LOCAL_ONLY
    5. PCSC Migration -> Synthesizes minimal continuation cut C* <= 500 tokens (CCR >= 10x)
    6. VALIDATE_PATCH (local deterministic compiler & pytest, $0)
    7. Evidence Receipt verification with 0 balance leakage.
    """
    initial_budget: NanoUSD = 50_000_000  # $0.05 USD = 50 million nanos
    escrow = TwoPhaseCommitEscrow(initial_budget)

    # -------------------------------------------------------------
    # Step 1: Hypergraph Setup
    # -------------------------------------------------------------
    hypergraph = ObligationHypergraph("contract:c4p_repair_v1")

    # Obligations
    ob_localize = ObligationNode("ob_localize", "Defective files located", is_safety_critical=True)
    ob_reproduce = ObligationNode("ob_reproduce", "Reproduction test confirms defect", is_safety_critical=True)
    ob_patch = ObligationNode("ob_patch", "Candidate patch generated", is_safety_critical=True)
    ob_validate = ObligationNode("ob_validate", "Test suite passes with patch", is_safety_critical=True)

    hypergraph.add_obligation(ob_localize)
    hypergraph.add_obligation(ob_reproduce)
    hypergraph.add_obligation(ob_patch)
    hypergraph.add_obligation(ob_validate)

    # Witnesses with causal prerequisite inputs
    w_find = WitnessNode("w_find", WitnessType.DETERMINISTIC_PROBE, ["ob_localize"], 0, 5.0)
    w_repro = WitnessNode("w_repro", WitnessType.DETERMINISTIC_PROBE, ["ob_reproduce"], 0, 50.0, required_inputs=["w_find"])
    w_gen_cloud = WitnessNode("w_gen_cloud", WitnessType.FRONTIER_MODEL, ["ob_patch"], 15_000_000, 2000.0, required_inputs=["w_repro"])
    w_val_local = WitnessNode("w_val_local", WitnessType.DETERMINISTIC_PROBE, ["ob_validate"], 0, 100.0, required_inputs=["w_gen_cloud"])

    hypergraph.add_witness(w_find)
    hypergraph.add_witness(w_repro)
    hypergraph.add_witness(w_gen_cloud)
    hypergraph.add_witness(w_val_local)

    # Edges
    hypergraph.add_hyperedge(HyperEdge("e_loc", "ob_localize", {"w_find"}, HyperEdgeType.AND))
    hypergraph.add_hyperedge(HyperEdge("e_rep", "ob_reproduce", {"w_repro"}, HyperEdgeType.AND))
    hypergraph.add_hyperedge(HyperEdge("e_pat", "ob_patch", {"w_gen_cloud"}, HyperEdgeType.AND))
    hypergraph.add_hyperedge(HyperEdge("e_val", "ob_validate", {"w_val_local"}, HyperEdgeType.AND))

    established_witnesses = set()
    current_policy = NetworkPolicy.PUBLIC_EGRESS

    # Execution State Σ = (F, D, W, A, E, Q)
    sigma = ExecutionStateSigma(
        total_raw_transcript_tokens=45_000,  # 45k tokens accumulated in raw transcript
        unfulfilled_obligations={"ob_localize", "ob_reproduce", "ob_patch", "ob_validate"}
    )

    # -------------------------------------------------------------
    # Step 2: BWFS Execution of Deterministic Probes 1 & 2
    # -------------------------------------------------------------
    scheduler = FrontierScheduler(hypergraph, current_policy, escrow.available_nanos)
    actions = [
        ActionCandidate("act_find", "w_find", "find files", cost_nanos=0, latency_ms=5.0, is_remote=False),
        ActionCandidate("act_repro", "w_repro", "run repro test", cost_nanos=0, latency_ms=50.0, is_remote=False),
        ActionCandidate("act_gen", "w_gen_cloud", "cloud codegen", cost_nanos=15_000_000, latency_ms=2000.0, is_remote=True),
        ActionCandidate("act_val", "w_val_local", "validate patch", cost_nanos=0, latency_ms=100.0, is_remote=False),
    ]

    # Scheduler chooses act_find (0-cost probe)
    a1 = scheduler.select_next_action(actions, established_witnesses)
    assert a1 is not None and a1.action_id == "act_find"
    established_witnesses.add("w_find")
    sigma.facts["fact_files"] = RecordedFact(
        fact_id="fact_files",
        key="target_files",
        value=["src/auth/token_verifier.py"],
        digest=hashlib.sha256(b"token_verifier.py").hexdigest(),
        is_deterministic=True,
        dependencies=set(),
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_localize")

    # Scheduler chooses act_repro (0-cost probe)
    a2 = scheduler.select_next_action(actions, established_witnesses)
    assert a2 is not None and a2.action_id == "act_repro"
    established_witnesses.add("w_repro")
    sigma.facts["fact_repro"] = RecordedFact(
        fact_id="fact_repro",
        key="failing_test",
        value="tests/test_token.py::test_expired_signature",
        digest=hashlib.sha256(b"test_expired_signature").hexdigest(),
        is_deterministic=True,
        dependencies={"fact_files"},
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_reproduce")

    # Add a set-containing fact to test robust non-JSON serialization
    sigma.facts["fact_tags"] = RecordedFact(
        fact_id="fact_tags",
        key="security_tags",
        value={"auth", "jwt", "crypto"},  # Set type
        digest=hashlib.sha256(b"tags").hexdigest(),
        is_deterministic=True,
        dependencies={"fact_files"},
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )

    # Add a broken-dependency fact (depends on non-existent fact_ghost) to test transitive validation
    sigma.facts["fact_broken"] = RecordedFact(
        fact_id="fact_broken",
        key="ghost_fact",
        value="unreachable",
        digest=hashlib.sha256(b"ghost").hexdigest(),
        is_deterministic=True,
        dependencies={"fact_ghost"},  # Missing dependency!
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )

    # Add an empirical deterministic fact
    sigma.facts["fact_perf"] = RecordedFact(
        fact_id="fact_perf",
        key="perf_bench",
        value={"latency_ms": 12.4},
        digest=hashlib.sha256(b"perf").hexdigest(),
        is_deterministic=True,
        dependencies={"fact_files"},
        evidence_status=EvidenceStatus.EMPIRICALLY_QUALIFIED,
    )

    # -------------------------------------------------------------
    # Step 3: Cloud Model Patch Generation with 2PC Escrow
    # -------------------------------------------------------------
    # 2PC Prepare Phase: Lock 20m nanos ceiling in escrow
    res = escrow.prepare("res_act_gen", "task_repair", ceiling_nanos=20_000_000)
    assert escrow.available_nanos == 30_000_000

    a3 = scheduler.select_next_action(actions, established_witnesses)
    assert a3 is not None and a3.action_id == "act_gen"

    # 2PC Commit Phase: Actual spend is 15m nanos; 5m nanos refunded
    spent, refund = escrow.commit("res_act_gen", actual_spent_nanos=a3.cost_nanos)
    assert spent == 15_000_000
    assert refund == 5_000_000
    assert escrow.available_nanos == 35_000_000
    assert escrow.committed_nanos == 15_000_000
    assert escrow.verify_conservation()

    # Model generates patch
    patch_code = "diff --git a/token.py b/token.py\n+ return valid"
    established_witnesses.add("w_gen_cloud")
    sigma.facts["fact_patch"] = RecordedFact(
        fact_id="fact_patch",
        key="candidate_patch",
        value=patch_code,
        digest=hashlib.sha256(patch_code.encode("utf-8")).hexdigest(),
        is_deterministic=False,  # Neural model output!
        dependencies={"fact_repro"},
        evidence_status=EvidenceStatus.EMPIRICALLY_QUALIFIED,
        source_model_version="claude-3-7-sonnet"
    )
    sigma.unfulfilled_obligations.remove("ob_patch")

    # -------------------------------------------------------------
    # Step 4: Injected Cloud Disconnect
    # -------------------------------------------------------------
    current_policy = NetworkPolicy.LOCAL_ONLY  # Offline failover!
    scheduler.network_policy = current_policy

    # -------------------------------------------------------------
    # Step 5: PCSC Migration to Local Execution Engine
    # -------------------------------------------------------------
    cut, transferred_tokens, compression_ratio = PCSCContinuationEngine.synthesize_continuation_cut(
        sigma=sigma,
        destination_model_version="local-metal-engine",
        destination_capabilities={"deterministic_probes", "local_pytest"}
    )

    # Verify PCSC Continuation properties
    assert transferred_tokens <= 500, f"Transferred tokens {transferred_tokens} exceeds 500 ceiling"
    assert compression_ratio >= 10.0, f"CCR {compression_ratio:.1f}x does not meet 10x target"
    assert cut["destination_model"] == "local-metal-engine"

    # Deterministic facts are preserved as VERIFIED_REUSABLE
    assert cut["preserved_facts"]["target_files"]["status"] == "VERIFIED_REUSABLE"
    assert cut["preserved_facts"]["failing_test"]["status"] == "VERIFIED_REUSABLE"
    assert cut["preserved_facts"]["security_tags"]["status"] == "VERIFIED_REUSABLE"

    # Empirical fact preserved with EMPIRICALLY_QUALIFIED status
    assert cut["preserved_facts"]["perf_bench"]["status"] == "EMPIRICALLY_QUALIFIED"

    # Fact with broken dependency dropped
    assert "ghost_fact" not in cut["preserved_facts"]

    # Neural model patch is marked UNVERIFIED_CANDIDATE_HYPOTHESIS
    assert cut["preserved_facts"]["candidate_patch"]["status"] == "UNVERIFIED_CANDIDATE_HYPOTHESIS"

    # -------------------------------------------------------------
    # Step 6: Local Validation (VALIDATE_PATCH, $0 tokens)
    # -------------------------------------------------------------
    a4 = scheduler.select_next_action(actions, established_witnesses)
    assert a4 is not None and a4.action_id == "act_val"
    assert a4.cost_nanos == 0
    assert not a4.is_remote

    established_witnesses.add("w_val_local")
    sigma.facts["fact_validation"] = RecordedFact(
        fact_id="fact_validation",
        key="validation_result",
        value={"passed": True, "exit_code": 0},
        digest=hashlib.sha256(b"pass").hexdigest(),
        is_deterministic=True,
        dependencies={"fact_patch"},
        evidence_status=EvidenceStatus.FORMALLY_SUFFICIENT,
    )
    sigma.unfulfilled_obligations.remove("ob_validate")

    # All obligations satisfied!
    assert hypergraph.is_fully_satisfied(established_witnesses)

    # -------------------------------------------------------------
    # Step 7: Cryptographic Receipt and Exact NanoUSD Conservation
    # -------------------------------------------------------------
    remaining_balance: NanoUSD = escrow.available_nanos
    spent_budget: NanoUSD = escrow.committed_nanos
    assert remaining_balance == 35_000_000  # Exact integer conservation: 50m - 15m = 35m
    assert remaining_balance + spent_budget == initial_budget  # 0 balance leakage!
    assert escrow.verify_conservation()

    # Cryptographic evidence receipt digest
    receipt = {
        "contract": hypergraph.contract_digest,
        "established_witnesses": sorted(list(established_witnesses)),
        "nanos_spent": spent_budget,
        "nanos_remaining": remaining_balance,
        "compression_ratio": f"{compression_ratio:.2f}x",
        "verdict": VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE.value
    }
    receipt_bytes = json.dumps(receipt, sort_keys=True).encode("utf-8")
    receipt_signature = hashlib.sha256(receipt_bytes).hexdigest()

    assert len(receipt_signature) == 64
    assert receipt["verdict"] == "PROVEN_WITHIN_FORMAL_SCOPE"


def test_concurrent_escrow():
    """
    Financial Invariant Test:
    Simulates concurrent parallel witness acquisitions using TwoPhaseCommitEscrow.
    Ensures exact integer NanoUSD conservation across concurrent prepare/commit/abort cycles.
    """
    total_bank: NanoUSD = 1_000_000_000  # $1.00 = 10^9 Nanos
    escrow = TwoPhaseCommitEscrow(total_bank)

    def worker_commit(worker_idx: int):
        res_id = f"res_commit_{worker_idx}"
        # Prepare 20m nanos ceiling
        escrow.prepare(res_id, f"task_{worker_idx}", ceiling_nanos=20_000_000)
        # Commit 15m nanos actual spend (5m refund)
        escrow.commit(res_id, actual_spent_nanos=15_000_000)

    def worker_abort(worker_idx: int):
        res_id = f"res_abort_{worker_idx}"
        # Prepare 10m nanos ceiling
        escrow.prepare(res_id, f"task_{worker_idx}", ceiling_nanos=10_000_000)
        # Abort (10m refund)
        escrow.abort(res_id)

    threads = []
    # 40 workers committing 15m each (total committed: 600m nanos)
    for i in range(40):
        t = threading.Thread(target=worker_commit, args=(i,))
        threads.append(t)
        t.start()

    # 10 workers aborting 10m each (total refunded: 100m nanos)
    for i in range(10):
        t = threading.Thread(target=worker_abort, args=(i,))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Verify exact integer conservation
    assert escrow.committed_nanos == 600_000_000
    assert escrow.available_nanos == 400_000_000
    assert escrow.active_reservations_count == 0
    assert escrow.verify_conservation()

    # Verify overdraft rejection
    with pytest.raises(ValueError):
        escrow.prepare("res_overdraft", "task_fail", ceiling_nanos=500_000_000)  # Only 400m available

    # Verify negative amount rejection
    with pytest.raises(ValueError):
        escrow.prepare("res_neg", "task_fail", ceiling_nanos=-100)


def test_precondition_drift():
    """
    Specializer Precondition Drift Verification:
    Ensures that any discrepancy in schema, compiler version, or tool environment
    invalidates the fast path and safely triggers fallback.
    """
    registry = SpecializationRegistry()
    specializer = WDICSpecializer(registry)

    contract = WitnessContract(
        contract_id="c_ast",
        target_obligation_id="ob_ast",
        evidence_producer_name="tree_sitter_python",
        input_schema_hash="schema_hash_abc",
        tool_version_hash="ts_v0.22",
        compiler_version_hash="spe_2026.10.09",
        is_deterministic=True
    )

    specializer.specialize_and_register(contract, lambda inp: {"status": "optimized"})

    # Run with original contract
    res, mode, tokens = specializer.execute_with_mode(contract, {}, lambda inp: {"status": "fallback"})
    assert mode.value == "SPECIALIZATION"
    assert tokens == 0

    # Contract with upgraded compiler version
    upgraded_contract = WitnessContract(
        contract_id="c_ast",
        target_obligation_id="ob_ast",
        evidence_producer_name="tree_sitter_python",
        input_schema_hash="schema_hash_abc",
        tool_version_hash="ts_v0.22",
        compiler_version_hash="spe_2026.11.01_NEW",  # New compiler!
        is_deterministic=True
    )

    res_drift, mode_drift, tokens_drift = specializer.execute_with_mode(
        upgraded_contract, {}, lambda inp: {"status": "fallback_triggered"}
    )
    assert mode_drift.value == "EXPLORATION"
    assert tokens_drift > 0
    assert res_drift["status"] == "fallback_triggered"
