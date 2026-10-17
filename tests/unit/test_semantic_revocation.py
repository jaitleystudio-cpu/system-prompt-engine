"""
Unit tests for SPE Ω Semantic Revocation Slicing & Epistemic Non-Interference Kernel (SRS-ENI)
"""

import pytest
from spe_runtime.revocation.kernel import (
    RequirementAuthority,
    RequirementNode,
    RequirementOrigin,
    RequirementStatus,
    RevocationRequest,
    SemanticSliceReport,
    compile_clean_contract,
    compute_backward_orphans,
    compute_forward_slice,
    execute_semantic_revocation_slice,
    synthesize_negative_preconditions,
)


@pytest.fixture
def stripe_nodes() -> list[RequirementNode]:
    return [
        RequirementNode(
            id="REQ_ORDER_INGEST",
            label="Ingest Order Cart & Quantities",
            category="API",
            origin=RequirementOrigin.EXPLICIT_USER,
            authority=RequirementAuthority.LOCKED_USER,
            status=RequirementStatus.ACTIVE,
            dependencies=[],
            text_directive="Parse line items and totals.",
            associated_symbols=["orderId", "cartItems"],
        ),
        RequirementNode(
            id="REQ_STRIPE_ONLINE_CHARGE",
            label="Execute Stripe Credit Card Charge",
            category="PAYMENT",
            origin=RequirementOrigin.EXPLICIT_USER,
            authority=RequirementAuthority.LOCKED_USER,
            status=RequirementStatus.ACTIVE,
            dependencies=["REQ_ORDER_INGEST"],
            text_directive="Call Stripe SDK charges.create.",
            associated_symbols=["stripeClient", "stripeApiKey", "chargeId"],
        ),
        RequirementNode(
            id="REQ_STRIPE_WEBHOOK",
            label="Listen to Stripe Webhook",
            category="API",
            origin=RequirementOrigin.INFERRED_SPEC,
            authority=RequirementAuthority.FLEXIBLE_SPEC,
            status=RequirementStatus.ACTIVE,
            dependencies=["REQ_STRIPE_ONLINE_CHARGE"],
            text_directive="Verify webhook signatures.",
            associated_symbols=["stripeWebhookSecret"],
        ),
        RequirementNode(
            id="REQ_PCI_TOKEN_STORE",
            label="Store Encrypted Card Vault Token",
            category="SECURITY",
            origin=RequirementOrigin.SYSTEM_SECURITY,
            authority=RequirementAuthority.LOCKED_USER,
            status=RequirementStatus.ACTIVE,
            dependencies=["REQ_STRIPE_ONLINE_CHARGE"],
            text_directive="Store card vault token.",
            associated_symbols=["pciVaultToken"],
        ),
        RequirementNode(
            id="REQ_INVOICE_PDF_RENDER",
            label="Render Printable Invoice PDF",
            category="UI",
            origin=RequirementOrigin.EXPLICIT_USER,
            authority=RequirementAuthority.LOCKED_USER,
            status=RequirementStatus.ACTIVE,
            dependencies=["REQ_ORDER_INGEST"],
            text_directive="Render printable PDF invoice.",
            associated_symbols=["invoicePdfRenderer"],
        ),
    ]


def test_forward_slice(stripe_nodes):
    f_slice = compute_forward_slice(stripe_nodes, "REQ_STRIPE_ONLINE_CHARGE")
    assert len(f_slice) == 2
    assert "REQ_STRIPE_WEBHOOK" in f_slice
    assert "REQ_PCI_TOKEN_STORE" in f_slice
    assert "REQ_INVOICE_PDF_RENDER" not in f_slice


def test_backward_orphans(stripe_nodes):
    f_slice = compute_forward_slice(stripe_nodes, "REQ_STRIPE_ONLINE_CHARGE")
    orphans = compute_backward_orphans(stripe_nodes, "REQ_STRIPE_ONLINE_CHARGE", f_slice)
    # REQ_ORDER_INGEST is still needed by REQ_INVOICE_PDF_RENDER, so not orphaned
    assert len(orphans) == 0


def test_synthesize_negative_invariants(stripe_nodes):
    target = next(n for n in stripe_nodes if n.id == "REQ_STRIPE_ONLINE_CHARGE")
    purged = [n for n in stripe_nodes if n.id in {"REQ_STRIPE_WEBHOOK", "REQ_PCI_TOKEN_STORE"}]
    invariants = synthesize_negative_preconditions(target, purged)
    assert any("NON-INTERFERENCE ROOT" in inv for inv in invariants)
    assert any("SYMBOL QUARANTINE" in inv and "stripeApiKey" in inv for inv in invariants)
    assert any("GOGUEN-MESEGUER OBSERVABILITY" in inv for inv in invariants)


def test_execute_semantic_revocation(stripe_nodes):
    req = RevocationRequest(
        revocation_id="rev-test-01",
        target_requirement_id="REQ_STRIPE_ONLINE_CHARGE",
        reason="Compliance policy",
    )
    report: SemanticSliceReport = execute_semantic_revocation_slice(stripe_nodes, req)
    assert report.target_id == "REQ_STRIPE_ONLINE_CHARGE"
    assert report.forward_slice_count == 2
    assert report.backward_slice_count == 0
    assert report.preserved_node_count == 2
    assert report.intent_flux_contamination_risk == 0.0
    assert "stripeApiKey" in report.purged_symbols
    assert "stripeWebhookSecret" in report.purged_symbols
    assert report.non_interference_proof_digest.startswith("spe:non-interference:sha256:")
    assert "SLICED CONTRACT" in report.compiled_prompt_contract
    assert "charges.create" not in report.compiled_prompt_contract
