"""Unit tests for the SPE Possibility Engine (The Living Outcome Contract)."""

import pytest
from spe_runtime.possibility_engine import (
    synthesize_topologies,
    compute_evoi_decision,
    compile_living_outcome_contract,
    perform_causal_bisection,
)


def test_synthesize_topologies_returns_three_orthogonal_branches():
    intent = "Build an offline-first inventory dashboard with barcode scanning and export"
    topologies = synthesize_topologies(intent)

    assert len(topologies) == 3
    topo_ids = [t.id for t in topologies]
    assert "topology_speed" in topo_ids
    assert "topology_resilient" in topo_ids
    assert "topology_high_throughput" in topo_ids

    speed_topo = next(t for t in topologies if t.id == "topology_speed")
    assert speed_topo.network_policy == "OFFLINE_ONLY"
    assert speed_topo.max_bundle_kb <= 150
    assert speed_topo.estimated_cold_start_ms < 50


def test_compute_evoi_decision_calculates_high_information_question():
    intent = "Build an offline-first inventory dashboard with barcode scanning and export"
    decision = compute_evoi_decision(intent)

    assert decision.decision_id == "evoi_execution_location"
    assert decision.expected_value_of_info >= 0.80
    assert decision.entropy_reduction_delta_h >= 0.90
    assert len(decision.options) == 2
    assert decision.options[0].key == "local_worker"


def test_compile_living_outcome_contract_satisfies_all_invariants():
    intent = "Build an offline-first inventory dashboard with barcode scanning and export"
    contract = compile_living_outcome_contract(
        raw_intent=intent,
        topology_id="topology_resilient",
        decision_choice_key="local_worker",
    )

    assert contract.contract_id.startswith("loc_")
    assert contract.truth_lattice_value == "TRUE"
    assert len(contract.hard_boundaries) >= 4
    assert len(contract.metamorphic_obligations) >= 4

    # Verify model-portable exports are generated
    assert "# CLAUDE.md" in contract.claude_md
    assert "PROJECT_INTENT" in contract.cursorrules
    assert "promptfoo.yaml" in contract.promptfoo_yaml
    assert "spe.living-outcome-contract.v1" in contract.spe_manifest_json
    assert len(contract.rfc8785_canonical_digest) == 64


def test_causal_bisection_isolates_network_egress_violation():
    intent = "Offline tool"
    contract = compile_living_outcome_contract(intent)
    error_trace = "Error: connect ECONNREFUSED 127.0.0.1:443 at fetch (https://api.external.com/data)"

    result = perform_causal_bisection(contract, error_trace)

    assert result.status == "ROOT_CAUSE_ISOLATED"
    assert "Network Policy" in result.isolated_failing_edge
    assert result.regressions_prevented_count > 0
    assert "def test_rejects_external_network_requests" in result.immunized_test_snippet


def test_causal_bisection_isolates_unauthorized_scope_path():
    intent = "Scoped tool"
    contract = compile_living_outcome_contract(intent)
    error_trace = "PermissionError: [Errno 13] Permission denied to write '.env.production'"

    result = perform_causal_bisection(contract, error_trace)

    assert result.status == "ROOT_CAUSE_ISOLATED"
    assert "Scope" in result.isolated_failing_edge
    assert "def test_blocks_file_access_outside_scope" in result.immunized_test_snippet


def test_causal_bisection_handles_clean_pass_trace():
    intent = "Clean run"
    contract = compile_living_outcome_contract(intent)
    clean_trace = "All 42 tests PASSED in 0.45s."

    result = perform_causal_bisection(contract, clean_trace)

    assert result.status == "NO_FAILURE_DETECTED"
    assert result.regressions_prevented_count == 0
