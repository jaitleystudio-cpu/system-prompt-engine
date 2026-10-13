"""
Unit & Adversarial Tests for Gilden 24/7 Autonomous Maintenance Bridge
"""

import pytest
from spe_runtime.research.agi_brain.gilden_ops_bridge import GildenOpsBridge

def test_autonomous_dispatch_for_preapproved_low_risk():
    bridge = GildenOpsBridge(spending_cap_nanos=1_000_000_000) # $1.00

    event = bridge.evaluate_and_dispatch(
        event_id="evt-01",
        category="CACHE_REVALIDATION",
        diagnostic="Stale CDN edge asset detected",
        proposed_patch="Invalidate CDN edge path /static/wasm",
        cost_nano_usd=50_000_000, # $0.05
        is_reversible=True,
    )

    assert event.is_authorized is True
    assert "GILDEN-RECEIPT-" in event.audit_receipt
    assert bridge.cumulative_spent_nanos == 50_000_000

def test_critical_production_deploy_requires_explicit_founder_approval():
    bridge = GildenOpsBridge()

    # Attempt without founder approval: Silence is not consent
    event_unauthorized = bridge.evaluate_and_dispatch(
        event_id="evt-deploy-01",
        category="PRODUCTION_DEPLOYMENT",
        diagnostic="Deploy updated WASM runtime bundle",
        proposed_patch="Trigger zero-downtime traffic switch",
        cost_nano_usd=100_000_000,
        founder_approved=False,
    )

    assert event_unauthorized.is_authorized is False
    assert "BLOCKED: Requires explicit founder authorization" in event_unauthorized.audit_receipt

    # Now with explicit founder approval
    event_authorized = bridge.evaluate_and_dispatch(
        event_id="evt-deploy-02",
        category="PRODUCTION_DEPLOYMENT",
        diagnostic="Deploy updated WASM runtime bundle",
        proposed_patch="Trigger zero-downtime traffic switch",
        cost_nano_usd=100_000_000,
        founder_approved=True,
    )

    assert event_authorized.is_authorized is True
    assert "GILDEN-RECEIPT-" in event_authorized.audit_receipt

def test_spending_cap_exceeded_blocks_execution():
    bridge = GildenOpsBridge(spending_cap_nanos=100_000_000) # $0.10 cap

    event = bridge.evaluate_and_dispatch(
        event_id="evt-expensive",
        category="CACHE_REVALIDATION",
        diagnostic="Heavy cache purge",
        proposed_patch="Global purge",
        cost_nano_usd=200_000_000, # $0.20 > $0.10
        founder_approved=False,
    )

    assert event.is_authorized is False
    assert "exceeds spending cap" in event.audit_receipt
