"""Tests for SPE Reality Frontier Python Kernel."""

import pytest
from spe_runtime.reality_frontier.kernel import (
    CANONICAL_WASM_COMPILER_HASH,
    analyze_reality_frontier,
    compile_approved_worldline,
    extract_typed_requirements,
    map_reality_boundaries,
    scan_intent_dark_matter,
    synthesize_pareto_worldlines,
    evaluate_evoi_decision_gate,
)

CORE_DEMO_INPUT = (
    "Build an original cinematic 3D website inspired by this URL. "
    "It must work entirely offline, fetch live remote updates every second, "
    "achieve 60 FPS on every phone, and never transmit private user data."
)


def test_extract_typed_requirements():
    reqs = extract_typed_requirements(CORE_DEMO_INPUT)
    assert len(reqs) >= 5
    req_map = {r.id: r for r in reqs}
    assert "REQ_OFFLINE_01" in req_map
    assert "REQ_LIVE_FETCH_02" in req_map
    assert "REQ_PERF_60FPS_03" in req_map
    assert "REQ_PRIVACY_04" in req_map
    assert req_map["REQ_OFFLINE_01"].authority == "LOCKED_USER"
    assert req_map["REQ_OFFLINE_01"].is_hard_constraint is True


def test_scan_intent_dark_matter():
    omissions = scan_intent_dark_matter(CORE_DEMO_INPUT)
    assert len(omissions) >= 2
    omission_ids = {o.id for o in omissions}
    assert "DARK_MATTER_SYNC_STRATEGY" in omission_ids
    assert "DARK_MATTER_DEVICE_DEGRADATION" in omission_ids
    sync_omission = next(o for o in omissions if o.id == "DARK_MATTER_SYNC_STRATEGY")
    assert sync_omission.rework_weight >= 0.8


def test_reality_boundary_mapping():
    reqs = extract_typed_requirements(CORE_DEMO_INPUT)
    report = map_reality_boundaries(reqs)
    assert report.has_critical_conflict is True
    assert report.satisfiability_verdict == "UNSATISFIABLE"
    boundary_ids = {b.id for b in report.boundaries}
    assert "BOUNDARY_A_CONNECTIVITY" in boundary_ids
    assert "BOUNDARY_B_PERFORMANCE" in boundary_ids
    assert "BOUNDARY_D_PRIVACY" in boundary_ids

    boundary_b = next(b for b in report.boundaries if b.id == "BOUNDARY_B_PERFORMANCE")
    assert boundary_b.unsupported_feasibility is True


def test_pareto_worldline_synthesis():
    reqs = extract_typed_requirements(CORE_DEMO_INPUT)
    report = map_reality_boundaries(reqs)
    worldlines = synthesize_pareto_worldlines(reqs, report)
    assert len(worldlines) == 3
    ids = [w.id for w in worldlines]
    assert "worldline_offline_cinematic" in ids
    assert "worldline_live_adaptive" in ids
    assert "worldline_mobile_performance" in ids
    for w in worldlines:
        assert w.jaccard_distinctness >= 0.40


def test_evoi_decision_gate():
    reqs = extract_typed_requirements(CORE_DEMO_INPUT)
    omissions = scan_intent_dark_matter(CORE_DEMO_INPUT)
    evoi = evaluate_evoi_decision_gate(reqs, omissions)
    assert evoi.entropy_reduction_delta_h >= 0.95
    assert len(evoi.options) >= 2


def test_end_to_end_analysis_and_contract_compilation():
    analysis = analyze_reality_frontier(CORE_DEMO_INPUT)
    assert len(analysis.typed_requirements) >= 5
    assert len(analysis.worldlines) == 3
    assert analysis.boundary_report.has_critical_conflict is True

    contract = compile_approved_worldline(
        "worldline_offline_cinematic",
        analysis,
        user_authorized_relaxations=["REQ_LIVE_FETCH_02"],
    )
    assert contract.selected_worldline_id == "worldline_offline_cinematic"
    assert len(contract.metamorphic_obligations) >= 4
    assert len(contract.evidence_escrow) >= 2
    assert contract.canonical_compiler_hash == CANONICAL_WASM_COMPILER_HASH
    assert contract.is_air_gapped is True
    assert "CLAUDE.md" in contract.claude_md
    assert ".cursorrules" in contract.cursorrules


def test_solvable_baseline_has_no_critical_conflicts():
    solvable = "Build an offline blog with local storage."
    analysis = analyze_reality_frontier(solvable)
    assert analysis.boundary_report.has_critical_conflict is False
    assert analysis.boundary_report.satisfiability_verdict == "SATISFIABLE"
