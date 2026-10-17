"""
SPE Ω — WPEM Hardware Collapse Recovery & 2PC In-Flight Effect Isolation Tests.
Simulates mid-execution hardware degradation (thermal throttle + memory drop)
and validates:
1. 2PC Isolation: Committed external effect nodes are never mutated or re-executed.
2. Uncommitted nodes are cleanly morphed to deterministic alternatives.
3. Zero financial leakage: API costs drop according to plan without phantom reservations.
4. Total hardware blackout gracefully triggers honest deferral (T5).
"""

import pytest
from spe_runtime.research.wdes.types import NetworkPolicy
from spe_runtime.research.wpem import (
    TransformationType,
    AdmissibilityStatus,
    HardwareEnvelope,
    TransformationRecord,
    ExecutionPlanNode,
    CandidateExecutionPlan,
    ExecutionGraphRewriter,
)


def test_2pc_committed_effect_isolation_during_collapse():
    """
    Verifies that committed irreversible side-effects remain untouched during graph recompilation,
    while uncommitted steps are dynamically morphed.
    """
    # Plan with 1 committed side effect and 1 uncommitted heavy LLM reasoning step
    node_committed = ExecutionPlanNode(
        node_id="db_insert_01",
        operation_name="postgres_insert_audit_entry",
        is_deterministic=True,
        is_committed=True,  # Already committed in phase 1 of 2PC
        required_memory_bytes=5_000_000,
        estimated_cost_nanos=0,
        estimated_latency_ms=15.0,
        accounted_obligations={"AUDIT_LOG_COMMITTED"},
    )

    node_uncommitted = ExecutionPlanNode(
        node_id="llm_eval_02",
        operation_name="heavy_llm_code_review",
        is_deterministic=False,
        is_committed=False,  # Uncommitted: candidate for morphing
        required_memory_bytes=4_000_000_000,  # 4GB
        estimated_cost_nanos=8_000_000,        # $0.008
        estimated_latency_ms=1500.0,
        accounted_obligations={"STATIC_ANALYSIS_COMPLIANCE"},
    )

    initial_plan = CandidateExecutionPlan(
        plan_id="plan_hybrid_2pc",
        nodes=[node_committed, node_uncommitted],
    )

    # T1 transformation available for the uncommitted operation
    t1_linter = TransformationRecord(
        transformation_id="t1_ast_linter",
        transformation_type=TransformationType.MODEL_TO_PROGRAM,
        source_operation="heavy_llm_code_review",
        target_operation="deterministic_ast_linter",
        preconditions={"ruleset": "strict_security"},
        obligation_mapping={"STATIC_ANALYSIS_COMPLIANCE": "linter_clean"},
        evidence_requirements=["linter_ast_proof"],
        privacy_boundary=NetworkPolicy.AIR_GAPPED,
        required_memory_bytes=50_000_000,  # 50MB
        estimated_api_cost_nanos=0,
        estimated_latency_ms=12.0,
        estimated_energy_mj=15,
    )

    rewriter = ExecutionGraphRewriter(transformation_library=[t1_linter])

    # Sudden hardware collapse: CRITICAL thermal state and RAM drops from 8GB to 400MB
    hw_collapsed = HardwareEnvelope(
        timestamp_ms=5000.0,
        thermal_state="CRITICAL",
        available_memory_bytes=400_000_000,
        accelerator_available=False,
        battery_level_pct=12.0,
        is_charging=False,
    )

    morphed_plan, status, transforms = rewriter.rewrite_plan(
        initial_plan=initial_plan,
        hardware=hw_collapsed,
        mandatory_obligations={"AUDIT_LOG_COMMITTED", "STATIC_ANALYSIS_COMPLIANCE"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
        current_time_s=5.0,
    )

    assert status == AdmissibilityStatus.ADMITTED
    assert TransformationType.MODEL_TO_PROGRAM in transforms
    assert len(morphed_plan.nodes) == 2

    # Node 1: Committed node is completely preserved and untouched
    assert morphed_plan.nodes[0].node_id == "db_insert_01"
    assert morphed_plan.nodes[0].is_committed is True
    assert morphed_plan.nodes[0].operation_name == "postgres_insert_audit_entry"

    # Node 2: Uncommitted node has been morphed into deterministic linter
    assert morphed_plan.nodes[1].operation_name == "deterministic_ast_linter"
    assert morphed_plan.nodes[1].is_deterministic is True
    assert morphed_plan.nodes[1].estimated_cost_nanos == 0

    # Total cost dropped from 8,000,000 nanos to 0 nanos
    assert morphed_plan.total_cost_nanos == 0


def test_hardware_blackout_clean_honest_deferral():
    """
    Under total hardware collapse where even the deterministic program exceeds 1.5x memory headroom,
    WPEM gracefully defers (T5) without leaking state or crashing.
    """
    node = ExecutionPlanNode(
        node_id="minimal_step",
        operation_name="light_step",
        is_deterministic=True,
        required_memory_bytes=50_000_000,  # 50MB
        accounted_obligations={"OBLIGATION_A"},
    )
    plan = CandidateExecutionPlan(plan_id="plan_min", nodes=[node])

    # Available memory is only 10MB (cannot satisfy 50MB * 1.5 = 75MB)
    hw_blackout = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="CRITICAL",
        available_memory_bytes=10_000_000,
        accelerator_available=False,
        battery_level_pct=2.0,
        is_charging=False,
    )

    rewriter = ExecutionGraphRewriter(transformation_library=[])
    morphed, status, transforms = rewriter.rewrite_plan(
        initial_plan=plan,
        hardware=hw_blackout,
        mandatory_obligations={"OBLIGATION_A"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )

    assert status == AdmissibilityStatus.DEFERRED
    assert TransformationType.HONEST_DEFERRAL in transforms
