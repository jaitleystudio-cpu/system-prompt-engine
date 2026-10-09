"""
SPE Ω — WPEM Transformation & Admissibility Tests.
Tests the 5 admissible transformations (T1-T5), RFC 8785 canonical hashing,
and the Multi-Objective Lagrangian Cost Solver J(P).
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
    AdmissibilitySolver,
    ExecutionGraphRewriter,
)


def test_transformation_record_canonical_hash_determinism():
    """Verifies that RFC 8785 canonical hashing produces identical digests regardless of field ordering."""
    t1 = TransformationRecord(
        transformation_id="T1-JSON-PARSER",
        transformation_type=TransformationType.MODEL_TO_PROGRAM,
        source_operation="llm_json_extract",
        target_operation="simdjson_parse",
        preconditions={"schema_version": "v1.0", "encoding": "utf-8"},
        obligation_mapping={"VALID_JSON_SCHEMA": "simdjson_validated"},
        evidence_requirements=["schema_witness"],
        privacy_boundary=NetworkPolicy.AIR_GAPPED,
        required_memory_bytes=10_000_000,
        estimated_api_cost_nanos=0,
        estimated_latency_ms=2.5,
        estimated_energy_mj=5,
    )

    t2 = TransformationRecord(
        transformation_id="T1-JSON-PARSER",
        transformation_type=TransformationType.MODEL_TO_PROGRAM,
        source_operation="llm_json_extract",
        target_operation="simdjson_parse",
        preconditions={"encoding": "utf-8", "schema_version": "v1.0"},  # reversed keys
        obligation_mapping={"VALID_JSON_SCHEMA": "simdjson_validated"},
        evidence_requirements=["schema_witness"],
        privacy_boundary=NetworkPolicy.AIR_GAPPED,
        required_memory_bytes=10_000_000,
        estimated_api_cost_nanos=0,
        estimated_latency_ms=2.5,
        estimated_energy_mj=5,
    )

    assert t1.canonical_hash() == t2.canonical_hash()
    assert len(t1.canonical_hash()) == 64


def test_t1_model_to_program_transformation():
    """T1: Replaces expensive stochastic LLM reasoning with deterministic code under thermal/memory pressure."""
    # LLM node: stochastic, 2GB RAM required, $0.002 = 2_000_000 nanos
    initial_node = ExecutionPlanNode(
        node_id="step_json_extract",
        operation_name="llm_json_extract",
        is_deterministic=False,
        is_committed=False,
        required_memory_bytes=2_000_000_000,
        estimated_cost_nanos=2_000_000,
        estimated_latency_ms=850.0,
        accounted_obligations={"PARSE_USER_INTENT"},
    )
    plan = CandidateExecutionPlan(plan_id="plan_t1", nodes=[initial_node])

    # Transform T1 available in library
    t1_transform = TransformationRecord(
        transformation_id="t1_rule_engine",
        transformation_type=TransformationType.MODEL_TO_PROGRAM,
        source_operation="llm_json_extract",
        target_operation="deterministic_ast_parser",
        preconditions={"input_format": "ast"},
        obligation_mapping={"PARSE_USER_INTENT": "ast_parse_success"},
        evidence_requirements=["grammar_spec"],
        privacy_boundary=NetworkPolicy.AIR_GAPPED,
        required_memory_bytes=50_000_000,  # only 50MB
        estimated_api_cost_nanos=0,
        estimated_latency_ms=5.0,
        estimated_energy_mj=10,
    )

    rewriter = ExecutionGraphRewriter(transformation_library=[t1_transform])

    # Hardware with low RAM (only 200MB free, cannot fit 2GB LLM)
    hw = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="SERIOUS",
        available_memory_bytes=200_000_000,
        accelerator_available=True,
        battery_level_pct=25.0,
    )

    morphed_plan, status, transforms = rewriter.rewrite_plan(
        initial_plan=plan,
        hardware=hw,
        mandatory_obligations={"PARSE_USER_INTENT"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )

    assert status == AdmissibilityStatus.ADMITTED
    assert TransformationType.MODEL_TO_PROGRAM in transforms
    assert len(morphed_plan.nodes) == 1
    morphed_node = morphed_plan.nodes[0]
    assert morphed_node.operation_name == "deterministic_ast_parser"
    assert morphed_node.is_deterministic is True
    assert morphed_node.estimated_cost_nanos == 0
    assert "PARSE_USER_INTENT" in morphed_node.accounted_obligations


def test_t2_program_to_procedure_transformation():
    """T2: Replaces ad-hoc program execution with cached specialized procedure."""
    initial_node = ExecutionPlanNode(
        node_id="adhoc_search",
        operation_name="dynamic_regex_search",
        is_deterministic=True,
        required_memory_bytes=300_000_000,
        estimated_cost_nanos=0,
        estimated_latency_ms=250.0,
        accounted_obligations={"SEARCH_MATCH"},
    )
    plan = CandidateExecutionPlan(plan_id="plan_t2", nodes=[initial_node])

    t2_transform = TransformationRecord(
        transformation_id="t2_cached_dfa",
        transformation_type=TransformationType.PROGRAM_TO_PROCEDURE,
        source_operation="dynamic_regex_search",
        target_operation="cached_precompiled_automaton",
        preconditions={"automaton_cached": True},
        obligation_mapping={"SEARCH_MATCH": "dfa_match"},
        evidence_requirements=["dfa_digest"],
        privacy_boundary=NetworkPolicy.AIR_GAPPED,
        required_memory_bytes=20_000_000,
        estimated_api_cost_nanos=0,
        estimated_latency_ms=1.5,
        estimated_energy_mj=2,
    )

    rewriter = ExecutionGraphRewriter(transformation_library=[t2_transform])
    hw = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="NOMINAL",
        available_memory_bytes=50_000_000,  # 50MB free: 300MB fails 1.5x headroom, 20MB fits
        accelerator_available=True,
        battery_level_pct=80.0,
    )

    morphed_plan, status, transforms = rewriter.rewrite_plan(
        initial_plan=plan,
        hardware=hw,
        mandatory_obligations={"SEARCH_MATCH"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )

    assert status == AdmissibilityStatus.ADMITTED
    assert TransformationType.PROGRAM_TO_PROCEDURE in transforms
    assert morphed_plan.nodes[0].operation_name == "cached_precompiled_automaton"
    assert morphed_plan.total_latency_ms == 1.5


def test_t3_large_to_small_model_transformation():
    """T3: Morphs frontier cloud model to local SLM when thermal state is FAIR/SERIOUS, but blocks under CRITICAL."""
    initial_node = ExecutionPlanNode(
        node_id="cloud_frontier_step",
        operation_name="frontier_cloud_reasoning",
        is_deterministic=False,
        required_memory_bytes=100_000_000,
        estimated_cost_nanos=5_000_000,  # $0.005
        estimated_latency_ms=1200.0,
        accounted_obligations={"REASONING_OBLIGATION"},
        network_policy=NetworkPolicy.RESTRICTED_CLOUD,
    )
    plan = CandidateExecutionPlan(plan_id="plan_t3", nodes=[initial_node])

    t3_transform = TransformationRecord(
        transformation_id="t3_slm_npu",
        transformation_type=TransformationType.LARGE_TO_SMALL_MODEL,
        source_operation="frontier_cloud_reasoning",
        target_operation="local_quantized_slm",
        preconditions={"quant_bits": 4},
        obligation_mapping={"REASONING_OBLIGATION": "slm_reasoning"},
        evidence_requirements=["slm_eval_receipt"],
        privacy_boundary=NetworkPolicy.AIR_GAPPED,
        required_memory_bytes=800_000_000,  # 800MB
        estimated_api_cost_nanos=0,
        estimated_latency_ms=300.0,
        estimated_energy_mj=500,
    )

    rewriter = ExecutionGraphRewriter(transformation_library=[t3_transform])

    # Case A: Thermal state is FAIR, RAM 2GB (fits 800MB * 1.5 = 1.2GB)
    hw_fair = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="FAIR",
        available_memory_bytes=2_000_000_000,
        accelerator_available=True,
        battery_level_pct=60.0,
    )

    morphed, status, transforms = rewriter.rewrite_plan(
        initial_plan=plan,
        hardware=hw_fair,
        mandatory_obligations={"REASONING_OBLIGATION"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )
    assert status == AdmissibilityStatus.ADMITTED
    assert TransformationType.LARGE_TO_SMALL_MODEL in transforms
    assert morphed.nodes[0].operation_name == "local_quantized_slm"

    # Case B: Thermal state is CRITICAL -> stochastic SLM must NOT be admitted
    hw_critical = HardwareEnvelope(
        timestamp_ms=2000.0,
        thermal_state="CRITICAL",
        available_memory_bytes=2_000_000_000,
        accelerator_available=True,
        battery_level_pct=60.0,
    )
    morphed_crit, status_crit, transforms_crit = rewriter.rewrite_plan(
        initial_plan=plan,
        hardware=hw_critical,
        mandatory_obligations={"REASONING_OBLIGATION"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )
    # Since SLM is stochastic, CRITICAL forbids it and falls back to honest deferral
    assert status_crit == AdmissibilityStatus.DEFERRED
    assert TransformationType.HONEST_DEFERRAL in transforms_crit


def test_t5_honest_deferral_under_unresolvable_constraints():
    """T5: When physical constraints cannot be satisfied, returns DEFERRED rather than hallucinating success."""
    node = ExecutionPlanNode(
        node_id="heavy_step",
        operation_name="monolithic_task",
        is_deterministic=False,
        required_memory_bytes=8_000_000_000,  # 8GB
        accounted_obligations={"MANDATORY_CRITICAL_REQ"},
    )
    plan = CandidateExecutionPlan(plan_id="plan_unresolvable", nodes=[node])

    # No library transforms available
    rewriter = ExecutionGraphRewriter(transformation_library=[])

    hw = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="CRITICAL",
        available_memory_bytes=100_000_000,  # 100MB free
        accelerator_available=False,
        battery_level_pct=5.0,
        is_charging=False,
    )

    morphed, status, transforms = rewriter.rewrite_plan(
        initial_plan=plan,
        hardware=hw,
        mandatory_obligations={"MANDATORY_CRITICAL_REQ"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )

    assert status == AdmissibilityStatus.DEFERRED
    assert TransformationType.HONEST_DEFERRAL in transforms


def test_multi_objective_lagrangian_cost_solver():
    """Verifies that multi-objective Lagrangian cost J(P) balances API cost, latency, and energy."""
    solver = AdmissibilitySolver(
        alpha_latency_weight=1.0,     # 1 nano per ms
        beta_energy_weight=0.5,       # 0.5 nano per mJ
        max_permitted_latency_ms=5000.0,
    )

    # Plan 1: Fast cloud API ($0.001 = 1,000,000 nanos, 100ms, 10mJ)
    p1_node = ExecutionPlanNode(
        node_id="p1",
        operation_name="cloud_fast",
        is_deterministic=False,
        estimated_cost_nanos=1_000_000,
        estimated_latency_ms=100.0,
        estimated_energy_mj=10,
    )
    plan1 = CandidateExecutionPlan(plan_id="p1", nodes=[p1_node])
    cost1 = solver.compute_lagrangian_cost(plan1)
    # J(P1) = 1_000_000 + 1.0*100 + 0.5*10 = 1_000_105.0
    assert cost1 == 1_000_105.0

    # Plan 2: Slow local CPU emulation (0 nanos, 8000ms latency - exceeds 5000ms ceiling)
    p2_node = ExecutionPlanNode(
        node_id="p2",
        operation_name="cpu_slow",
        is_deterministic=True,
        estimated_cost_nanos=0,
        estimated_latency_ms=8000.0,
        estimated_energy_mj=40_000,
        accounted_obligations={"TASK_REQ"},
    )
    plan2 = CandidateExecutionPlan(plan_id="p2", nodes=[p2_node])

    # Admissibility check should strictly reject Plan 2 on latency ceiling
    hw = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="NOMINAL",
        available_memory_bytes=10_000_000_000,
        accelerator_available=True,
        battery_level_pct=100.0,
    )
    status, reason = solver.evaluate_admissibility(
        plan=plan2,
        hardware=hw,
        mandatory_obligations={"TASK_REQ"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )
    assert status == AdmissibilityStatus.REJECTED
    assert "Latency ceiling exceeded" in str(reason)


def test_authority_and_network_policy_boundaries():
    """Verifies that WPEM never violates capability authority or network air-gap boundaries."""
    solver = AdmissibilitySolver()
    hw = HardwareEnvelope(
        timestamp_ms=1000.0,
        thermal_state="NOMINAL",
        available_memory_bytes=10_000_000_000,
        accelerator_available=True,
        battery_level_pct=100.0,
    )

    # Authority violation test
    priv_node = ExecutionPlanNode(
        node_id="priv_step",
        operation_name="write_system_files",
        is_deterministic=True,
        accounted_obligations={"SYS_WRITE"},
        required_authority={"ROOT_FILESYSTEM_ACCESS"},
    )
    plan_priv = CandidateExecutionPlan(plan_id="p_priv", nodes=[priv_node])
    status_priv, reason_priv = solver.evaluate_admissibility(
        plan=plan_priv,
        hardware=hw,
        mandatory_obligations={"SYS_WRITE"},
        granted_authorities={"LOCAL_EXECUTION"},  # missing ROOT_FILESYSTEM_ACCESS
        current_network_policy=NetworkPolicy.AIR_GAPPED,
    )
    assert status_priv == AdmissibilityStatus.REJECTED
    assert "Authority boundary violation" in str(reason_priv)

    # Network air-gap violation test
    net_node = ExecutionPlanNode(
        node_id="net_step",
        operation_name="fetch_cloud_weights",
        is_deterministic=True,
        accounted_obligations={"WEIGHTS_FETCH"},
        required_authority={"LOCAL_EXECUTION"},
        network_policy=NetworkPolicy.PUBLIC_EGRESS,
    )
    plan_net = CandidateExecutionPlan(plan_id="p_net", nodes=[net_node])
    status_net, reason_net = solver.evaluate_admissibility(
        plan=plan_net,
        hardware=hw,
        mandatory_obligations={"WEIGHTS_FETCH"},
        granted_authorities={"LOCAL_EXECUTION"},
        current_network_policy=NetworkPolicy.AIR_GAPPED,  # air-gapped environment
    )
    assert status_net == AdmissibilityStatus.REJECTED
    assert "Network policy violation" in str(reason_net)
