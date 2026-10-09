"""
Tests for Counterfactual Witness Continuation (CWC) in WDIC-VCT.
Verifies distinguishing probe generation, dependency invalidation,
and dual-product emission (Product A receipt & Product B contract)
at zero inference cost.
"""

import pytest
from spe_runtime.research.wdic_vct.cwc_witness import (
    CWCWitnessEngine,
    ProbeType,
    CounterfactualProbe,
    CWCReviewedReceipt,
)
from spe_runtime.research.wdic_vct.types import (
    ClaimStatus,
    TaskClaim,
    TaskReport,
    NextTaskContract,
)


def test_distinguishing_witness_generation_egress():
    cwc = CWCWitnessEngine()
    probe = cwc.generate_distinguishing_witness(
        requirement_id="REQ-PRIVACY",
        claim_description="Network egress disabled and privacy verified",
        files_modified=["spe_runtime/grounding/firewall.py"]
    )

    assert probe.probe_type == ProbeType.EGRESS_CHECK
    assert probe.cost_nano_usd == 0
    assert "Egress" in probe.name or "Isolation" in probe.name
    assert "0 external network connections" in probe.expected_compliant


def test_distinguishing_witness_generation_race():
    cwc = CWCWitnessEngine()
    probe = cwc.generate_distinguishing_witness(
        requirement_id="REQ-CONCURRENCY",
        claim_description="Resolved async worker race condition",
        files_modified=["src/audio/worker.ts"]
    )

    assert probe.probe_type == ProbeType.MUTATION_CHECK
    assert probe.cost_nano_usd == 0
    assert "Causal" in probe.name or "Race" in probe.name


def test_dependency_invalidation_matrix():
    cwc = CWCWitnessEngine()

    verified_obligations = {
        "REQ-AUDIO-CALIB": ["src/audio/calibration.ts", "src/audio/room_probe.ts"],
        "REQ-AUTH-MIDDLEWARE": ["src/auth/session.ts", "src/auth/token.ts"],
        "REQ-UI-LAYOUT": ["src/components/Layout.tsx"],
    }

    # Only audio files were modified
    files_modified = ["src/audio/calibration.ts"]

    reusable, invalidated = cwc.compute_invalidation_matrix(
        verified_obligations, files_modified
    )

    # REQ-AUDIO-CALIB invalidated because its dependency was modified
    assert "REQ-AUDIO-CALIB" in invalidated
    # REQ-AUTH-MIDDLEWARE and REQ-UI-LAYOUT remain valid and reusable!
    assert "REQ-AUTH-MIDDLEWARE" in reusable
    assert "REQ-UI-LAYOUT" in reusable


def test_evaluate_task_cwc_full_flow():
    cwc = CWCWitnessEngine()

    verified_obligations = {
        "REQ-01": ["spe_runtime/core.py"],
        "REQ-02": ["spe_runtime/storage.py"],
    }
    all_reqs = ["REQ-01", "REQ-02", "REQ-03"]

    report = TaskReport(
        task_id="task-147",
        summary="Offline storage engine implemented with SQLite sync",
        files_modified=["spe_runtime/storage.py"],
        tests_passed=15,
        tests_failed=0,
        tests_skipped=0,
        claims=[
            TaskClaim(
                id="claim-1",
                requirement_id="REQ-02",
                description="Storage sync completed",
                status=ClaimStatus.VERIFIED,
            )
        ],
        commit_sha="abcd1234ef",
    )

    receipt, next_contract = cwc.evaluate_task_cwc(
        parent_mission_id="MISSION-OFFLINE-APP",
        report=report,
        verified_obligations=verified_obligations,
        all_required_requirements=all_reqs,
    )

    # Product A Receipt checks
    assert receipt.task_id == "task-147"
    assert receipt.mission_id == "MISSION-OFFLINE-APP"
    assert receipt.reusable_proof_count == 1  # REQ-01 preserved
    assert receipt.invalidated_proof_count == 1  # REQ-02 invalidated by storage.py
    receipt_md = receipt.to_markdown()
    assert "SPE TASK REVIEW RECEIPT" in receipt_md
    assert "Distinguishing Witness Probe" in receipt_md

    # Product B Contract checks
    assert next_contract.task_title == "task-147-CWC-CONTINUATION"
    assert next_contract.cost_nano_usd == 0
    assert next_contract.tier_used == "T0_CWC_DETERMINISTIC"
    contract_md = next_contract.to_markdown()
    assert "EMPIRICAL RESEARCH BLUEPRINT" in next_contract.objective
    assert "@skill:" in next_contract.objective
    assert "Distinguishing probe" in next_contract.acceptance_criteria
