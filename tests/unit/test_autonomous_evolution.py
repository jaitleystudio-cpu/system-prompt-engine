"""Unit tests for SPE Ω Autonomous Website Evolution System."""

import pytest
from spe_runtime.website_evolution.types import (
    AutonomyLevel,
    ChangeRiskLevel,
    DefectCategory,
    EvidenceReceipt,
    ApprovalAuthority,
    FailingTestBeforeFix,
    MinimalPatch,
    ProofCarryingChangeProposal,
    ProposalStatus,
    QualificationResults,
    RollbackReference,
)
from spe_runtime.website_evolution.inventory import WebsiteInventoryAuditorPy
from spe_runtime.website_evolution.search_intent import SearchIntentEnginePy
from spe_runtime.website_evolution.visual_verifier import VisualDomA11yVerifierPy
from spe_runtime.website_evolution.root_cause_repair import RootCauseRepairEnginePy
from spe_runtime.website_evolution.proof_carrying import ProofCarryingEvolutionControllerPy
from spe_runtime.website_evolution.nightly_scheduler import NightlyEvolutionSchedulerPy


def test_inventory_auditor_all_routes():
    auditor = WebsiteInventoryAuditorPy()
    report = auditor.audit_routes()
    assert report["total_routes"] == 24
    assert report["indexable_routes"] == 18
    assert report["noindex_routes"] == 6
    assert len(report["canonical_conflicts"]) == 0
    assert len(report["missing_metadata"]) == 0


def test_inventory_broken_link_resolution():
    auditor = WebsiteInventoryAuditorPy()
    assert auditor.resolve_broken_link("/skills") == "/build-skill"
    assert auditor.resolve_broken_link("/prompt-generator") == "/create"
    assert auditor.resolve_broken_link("/eval") == "/eval-studio"
    assert auditor.resolve_broken_link("/redteam") == "/eval-studio"
    assert auditor.resolve_broken_link("/unknown-random-page") is None


def test_search_intent_query_mapping():
    engine = SearchIntentEnginePy()
    mapping = engine.map_query_to_intent("free ai prompt generator", "/")
    assert mapping.detected_intent == "CREATE_SYSTEM_PROMPT"
    assert mapping.authoritative_route == "/create"
    assert mapping.title_aligned is True

    code_mapping = engine.map_query_to_intent("screenshot to react code", "/code")
    assert code_mapping.detected_intent == "UI_SCREENLOAD_TO_CODE" if hasattr(code_mapping, "x") else "UI_SCREENSHOT_TO_CODE"
    assert code_mapping.authoritative_route == "/code"

    eval_mapping = engine.map_query_to_intent("benchmark prompt with test probe", "/eval-studio")
    assert eval_mapping.detected_intent == "PROMPT_EVALUATION_BENCHMARK"
    assert eval_mapping.authoritative_route == "/eval-studio"


def test_inventory_sitemap_reconciliation_and_duplicate_detection():
    auditor = WebsiteInventoryAuditorPy()
    # Incomplete sitemap
    sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://systempromptengine.com/</loc></url>
</urlset>"""
    recon = auditor.reconcile_sitemap_entries(sitemap_xml)
    assert recon["reconciled"] is False
    assert "/workflows" in recon["missing_routes"]
    assert "/build-skill" in recon["missing_routes"]
    assert "/eval-studio" in recon["missing_routes"]
    assert len(recon["suggested_xml_additions"]) >= 15

    # Leaky sitemap with private route
    leaky_xml = """<urlset><url><loc>https://systempromptengine.com/workspace</loc></url></urlset>"""
    leaky_recon = auditor.reconcile_sitemap_entries(leaky_xml)
    assert "/workspace" in leaky_recon["extraneous_routes"]

    # Duplicate / doorway page detection
    doorway = {
        "route": "/prompts-clone",
        "task": "Search 10,000+ pre-tested production prompts and ready-to-use prompt blueprints",
    }
    dup_res = auditor.detect_duplicate_or_doorway_page(doorway)
    assert dup_res["is_duplicate"] is True
    assert dup_res["conflicting_route"] == "/prompts"

    # Novel distinct page
    novel = {
        "route": "/quantum-spec",
        "task": "Synthesize quantum circuit entanglement specifications",
    }
    novel_res = auditor.detect_duplicate_or_doorway_page(novel)
    assert novel_res["is_duplicate"] is False


def test_search_intent_policy_checks():
    engine = SearchIntentEnginePy()
    # Keyword stuffing
    bad_title = "Prompt Generator Free Prompt AI Prompt Builder Prompt"
    res = engine.validate_seo_copy(bad_title, "Valid description text for SEO test purposes.")
    assert res["valid"] is False
    assert any("Keyword stuffing" in v for v in res["violations"])

    # Forbidden speculative ranking claims
    res2 = engine.validate_seo_copy("Best System Prompt Tool", "Guaranteed first page rank #1 on Google.")
    assert res2["valid"] is False
    assert any("Forbidden ranking claim" in v for v in res2["violations"])

    # Fabricated user rating claim
    res3 = engine.validate_seo_copy("SPE Prompts", "Rated 5 stars by 10 million developers. 100% money back guarantee.")
    assert res3["valid"] is False
    assert any("Fabricated claim" in v for v in res3["violations"])

    # Indexing API eligibility
    elig = engine.evaluate_indexing_api_eligibility("WebPage", "https://systempromptengine.com/create")
    assert elig["eligible"] is False
    assert "strictly ineligible" in elig["rejection_reason"]

    # Structured data mismatch detection and correction
    invalid_schema = {
        "@type": "Article",
        "aggregateRating": {"ratingValue": "4.9"},
    }
    val_res = engine.validate_structured_data("/code", invalid_schema, {
        "title": "Screenshot to Code Prompt",
        "description": "Code prompt description",
        "expectedType": "SoftwareApplication",
    })
    assert val_res["valid"] is False
    assert any("contradicts expected page type" in i for i in val_res["issues"])
    assert any("missing required 'name'" in i for i in val_res["issues"])
    assert any("Fabricated 'aggregateRating'" in i for i in val_res["issues"])
    assert val_res["corrected_data"]["@type"] == "SoftwareApplication"
    assert val_res["corrected_data"]["name"] == "Screenshot to Code Prompt"
    assert "aggregateRating" not in val_res["corrected_data"]


def test_visual_dom_a11y_verifier():
    verifier = VisualDomA11yVerifierPy()

    # Clean pass
    pass_res = verifier.verify_render_snapshot(
        headline_bbox={"width": 350, "height": 40, "scrollWidth": 350, "scrollHeight": 40},
        viewport={"width": 375, "height": 667},
        primary_cta={"text": "Make prompt", "visible": True, "opacity": 1.0, "contrastRatio": 5.0, "tabIndex": 0},
        web_vitals={"lcpMs": 1400, "clsScore": 0.01, "inpMs": 40, "hydrationError": False},
        simulated_task_pass=True,
    )
    assert pass_res["overall_passed"] is True

    # Clipped headline
    clip_res = verifier.verify_render_snapshot(
        headline_bbox={"width": 300, "height": 40, "scrollWidth": 420, "scrollHeight": 40},
        viewport={"width": 375, "height": 667},
        primary_cta={"text": "Make prompt", "visible": True, "opacity": 1.0, "contrastRatio": 5.0, "tabIndex": 0},
        web_vitals={"lcpMs": 1400, "clsScore": 0.01, "inpMs": 40, "hydrationError": False},
        simulated_task_pass=True,
    )
    assert clip_res["clipped_text"] is True
    assert clip_res["overall_passed"] is False

    # INP regression > 200ms
    inp_res = verifier.verify_render_snapshot(
        headline_bbox={"width": 350, "height": 40, "scrollWidth": 350, "scrollHeight": 40},
        viewport={"width": 375, "height": 667},
        primary_cta={"text": "Make prompt", "visible": True, "opacity": 1.0, "contrastRatio": 5.0, "tabIndex": 0},
        web_vitals={"lcpMs": 1400, "clsScore": 0.01, "inpMs": 350, "hydrationError": False},
        simulated_task_pass=True,
    )
    assert inp_res["vitals_passed"] is False
    assert inp_res["overall_passed"] is False

    # Anti-deceptive pass gate (VisualWebArena): Visual passed, but simulated user task failed
    deceptive_res = verifier.verify_render_snapshot(
        headline_bbox={"width": 350, "height": 40, "scrollWidth": 350, "scrollHeight": 40},
        viewport={"width": 375, "height": 667},
        primary_cta={"text": "Make prompt", "visible": True, "opacity": 1.0, "contrastRatio": 5.0, "tabIndex": 0},
        web_vitals={"lcpMs": 1400, "clsScore": 0.01, "inpMs": 40, "hydrationError": False},
        simulated_task_pass=False,
    )
    assert deceptive_res["screenshot_passed"] is True
    assert deceptive_res["overall_passed"] is False


def test_root_cause_repair_and_oscillation():
    repair_engine = RootCauseRepairEnginePy()
    cand = repair_engine.diagnose_and_prepare_repair(
        DefectCategory.BROKEN_INTERNAL_LINK,
        "Internal link 404",
        {"brokenHref": "/skills", "authoritativeDestination": "/build-skill"},
    )
    assert cand["minimal_patch"].target_file == "apps/web/src/routing.ts"
    assert "assert resolve_route" in cand["failing_test_before_fix"].test_name or cand["failing_test_before_fix"].reproduced
    assert not cand["isolated_branch"].startswith("main")

    # Oscillation brake
    assert repair_engine.check_oscillation_brake(1) is False
    assert repair_engine.check_oscillation_brake(3) is True


def test_proof_carrying_governance_and_rollback():
    controller = ProofCarryingEvolutionControllerPy()

    proposal = ProofCarryingChangeProposal(
        id="PROP-PY-01",
        defect_category=DefectCategory.BROKEN_INTERNAL_LINK,
        observed_evidence=EvidenceReceipt("EV-1", "USER_JOURNEY", "2026-10-15", "sha256:test", True, 0.99),
        affected_routes=["/"],
        affected_components=["Nav"],
        root_cause_hypothesis="Legacy route alias missing",
        minimal_patch=MinimalPatch("apps/web/src/routing.ts", "// a", "// b", 1),
        failing_test_before_fix=FailingTestBeforeFix("test_fail", "AssertionError", True),
        expected_user_benefit="Restores working route",
        potential_harm="None",
        risk_level=ChangeRiskLevel.LOW,
        required_autonomy=AutonomyLevel.L4_LIMITED_AUTO_RELEASE,
        qualification_results=QualificationResults(
            targeted_unit_tests_passed=True,
            regression_suite_passed=True,
            security_policy_passed=True,
            visual_a11y_passed=True,
            seo_policy_passed=True,
            oracle_integrity_preserved=True,
            anti_mutation_kill_rate=1.0,
        ),
        approval_authority=ApprovalAuthority(status=ProposalStatus.PROPOSED, authorized_by="SYSTEM"),
        rollback_reference=RollbackReference("9275039a", "git revert HEAD", True),
        verification_digest="",
    )

    digest1 = controller.compute_digest(proposal)
    digest2 = controller.compute_digest(proposal)
    assert digest1 == digest2, "Proposal digest must be deterministic"
    assert digest1.startswith("sha256:prop-")

    decision = controller.evaluate_release_authority(proposal)
    assert decision["status"] == ProposalStatus.PROMOTED
    assert decision["authorized_autonomy"] == AutonomyLevel.L4_LIMITED_AUTO_RELEASE
    assert decision["authorized_for_live_deploy"] is True

    # Inconclusive search data marks proposal HELD_INCONCLUSIVE
    proposal.observed_evidence.confidence_score = 0.2
    decision_inconclusive = controller.evaluate_release_authority(proposal)
    assert decision_inconclusive["status"] == ProposalStatus.HELD_INCONCLUSIVE
    proposal.observed_evidence.confidence_score = 0.99

    # Test tampering rejection (Evaluator Authority Firewall)
    proposal.qualification_results.oracle_integrity_preserved = False
    decision_tampered = controller.evaluate_release_authority(proposal)
    assert decision_tampered["status"] == ProposalStatus.REJECTED
    assert any("Test assertions were modified" in log for log in decision_tampered["audit_log"])

    # Rollback demonstration
    rb = controller.execute_rollback(proposal)
    assert rb["success"] is True
    assert rb["restored_commit"] == "9275039a"


def test_nightly_scheduler_execution():
    scheduler = NightlyEvolutionSchedulerPy()
    receipt = scheduler.execute_nightly_run(dry_run=True, base_commit="9275039a", simulate_milestone=True)
    assert receipt["clock_ist"] == "02:17 AM IST"
    assert len(receipt["phases_executed"]) == 9
    assert receipt["routes_audited"] == 24
    assert receipt["proposals_auto_released"] == 1
    assert receipt["concurrency_lock_acquired"] is True

    # Observe-only with no defects
    clean_receipt = scheduler.execute_nightly_run(dry_run=True, base_commit="9275039a", simulate_milestone=False)
    assert clean_receipt["defects_discovered"] == 0
    assert clean_receipt["proposals_auto_released"] == 0

    alert = scheduler.trigger_outage_alert("Simulated Outage", "Traceback...")
    assert alert["alert_dispatched"] is True
