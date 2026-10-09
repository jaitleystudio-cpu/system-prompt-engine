"""
Tests for SPE Ω Verified Business Workflow Models and Catalog.
"""

import json
from pathlib import Path
import pytest

from spe_runtime.workflows.models import (
    BusinessWorkflow,
    BusinessWorkflowCatalog,
    PermissionCeiling,
    WorkflowCategory,
    WorkflowStep,
)


def test_permission_ceiling_violations():
    ceiling = PermissionCeiling(
        allow_network=False,
        allow_credentials=False,
        allowed_filesystem_paths=["./docs"],
        max_cost_nanousd=0,
    )

    violated, msgs = ceiling.violates_policy({"NETWORK"})
    assert violated is True
    assert any("Network" in m for m in msgs)

    violated_cred, msgs_cred = ceiling.violates_policy({"CREDENTIALS"})
    assert violated_cred is True

    safe_violated, safe_msgs = ceiling.violates_policy({"FILESYSTEM_SCOPED_READ"})
    assert safe_violated is False
    assert len(safe_msgs) == 0


def test_workflow_serialization_roundtrip():
    step = WorkflowStep(
        step_id="step-1",
        title="Parse commits",
        instruction="Read recent git commits and summarize.",
        recommended_skill="git-pr-review",
        verification_probe="test -f output.md",
        required_inputs=["commits.txt"],
        produced_outputs=["output.md"],
    )
    workflow = BusinessWorkflow(
        workflow_id="WF-1234abcd",
        slug="test-workflow",
        title="Test Workflow",
        job_category=WorkflowCategory.BUSINESS_OPERATIONS,
        summary="A test workflow for serialization verification.",
        required_capabilities=["git-log"],
        input_artifacts=["commits.txt"],
        output_artifacts=["output.md"],
        max_permissions=PermissionCeiling(),
        steps=[step],
        verification_fixture_id="FIXTURE-TEST-001",
        top_skills=["git-pr-review"],
        average_token_savings_pct=25.0,
        reproducibility_rate=0.99,
    )

    d = workflow.to_dict()
    assert d["slug"] == "test-workflow"
    assert d["job_category"] == "business-operations"

    reconstructed = BusinessWorkflow.from_dict(d)
    assert reconstructed.workflow_id == workflow.workflow_id
    assert reconstructed.slug == workflow.slug
    assert len(reconstructed.steps) == 1
    assert reconstructed.steps[0].instruction == step.instruction


def test_compile_agent_instructions():
    step = WorkflowStep(
        step_id="step-1",
        title="Extract Invoices",
        instruction="Parse fields from invoice raw data.",
        recommended_skill="xlsx-official",
        verification_probe="jq . ledger.json",
    )
    workflow = BusinessWorkflow(
        workflow_id="WF-invoice",
        slug="invoice-extraction",
        title="Invoice Extraction Workflow",
        job_category=WorkflowCategory.DOCUMENT_AUTOMATION,
        summary="Extract structured invoice details.",
        required_capabilities=["ocr", "math"],
        input_artifacts=["invoice.txt"],
        output_artifacts=["ledger.json"],
        max_permissions=PermissionCeiling(allow_network=False),
        steps=[step],
        verification_fixture_id="FIXTURE-INV-1",
        top_skills=["xlsx-official"],
    )

    instructions = workflow.compile_agent_instructions(target_agent="claude-code")
    assert "# SPE Ω VERIFIED WORKFLOW: INVOICE EXTRACTION WORKFLOW" in instructions
    assert "PROHIBITED ($0 / LOCAL-FIRST)" in instructions
    assert "- **Specialized Skill**: `xlsx-official`" in instructions
    assert "- **Verification Check**: `jq . ledger.json`" in instructions


def test_catalog_seed_workflows_loading():
    seed_path = Path(__file__).parent.parent.parent / "data" / "workflows" / "seed_workflows.json"
    assert seed_path.exists(), f"Seed workflows file missing at {seed_path}"

    catalog = BusinessWorkflowCatalog.load_from_json(seed_path)
    all_workflows = catalog.list_all()
    assert len(all_workflows) >= 5

    # Slug retrieval
    status_wf = catalog.get_by_slug("weekly-project-status")
    assert status_wf is not None
    assert status_wf.job_category == WorkflowCategory.BUSINESS_OPERATIONS

    # Category filter
    doc_workflows = catalog.filter_by_category(WorkflowCategory.DOCUMENT_AUTOMATION)
    assert len(doc_workflows) >= 2
    for dw in doc_workflows:
        assert dw.job_category == WorkflowCategory.DOCUMENT_AUTOMATION

    # Intent search
    search_results = catalog.search_by_intent("meeting transcript action items")
    assert len(search_results) > 0
    assert search_results[0].slug == "meeting-followup-synthesis"

    invoice_results = catalog.search_by_intent("invoice math calculation")
    assert len(invoice_results) > 0
    assert invoice_results[0].slug == "invoice-data-extraction"
