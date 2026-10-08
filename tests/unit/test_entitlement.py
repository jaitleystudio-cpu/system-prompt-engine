"""Unit tests for Section 40: Checkout, Entitlement, Offline Licenses & Idempotent Webhooks."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.entitlement.license import (
    LicenseVerificationError,
    OfflineLicensePayload,
    create_offline_license,
    verify_offline_license,
)
from spe_runtime.entitlement.manager import (
    DuplicateWebhookError,
    EntitlementManager,
)
from spe_runtime.entitlement.models import PlanTier, SubscriptionStatus


def test_default_customer_is_free_and_active():
    manager = EntitlementManager()
    cust = manager.get_or_create_customer("cust_001")
    assert cust.plan_tier == PlanTier.FREE
    assert cust.is_active() is True
    assert manager.can_run_evaluation("cust_001") is True


def test_payment_webhook_checkout_success():
    manager = EntitlementManager()
    webhook_event = {
        "id": "evt_checkout_123",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cust_001",
                "metadata": {"tier": "PRO"},
            }
        },
    }
    res = manager.process_payment_webhook(webhook_event)
    assert res["status"] == "SUCCESS"
    assert res["tier"] == "PRO"

    cust = manager.get_or_create_customer("cust_001")
    assert cust.plan_tier == PlanTier.PRO
    assert cust.subscription_status == SubscriptionStatus.ACTIVE


def test_duplicate_webhook_rejected_for_replay_defense():
    manager = EntitlementManager()
    webhook_event = {
        "id": "evt_replay_999",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cust_replay",
                "metadata": {"tier": "PRO"},
            }
        },
    }
    manager.process_payment_webhook(webhook_event)

    # Replay attack with same ID must fail
    with pytest.raises(DuplicateWebhookError):
        manager.process_payment_webhook(webhook_event)


def test_payment_failed_sets_past_due():
    manager = EntitlementManager()
    webhook_event = {
        "id": "evt_fail_1",
        "type": "invoice.payment_failed",
        "data": {"object": {"customer": "cust_delinquent"}},
    }
    res = manager.process_payment_webhook(webhook_event)
    assert res["status"] == "PAST_DUE"

    cust = manager.get_or_create_customer("cust_delinquent")
    assert cust.subscription_status == SubscriptionStatus.PAST_DUE
    assert cust.is_active() is False


def test_refund_downgrades_to_expired():
    manager = EntitlementManager()
    manager.upgrade_plan("cust_refund", PlanTier.PRO)

    webhook_event = {
        "id": "evt_refund_1",
        "type": "charge.refunded",
        "data": {"object": {"customer": "cust_refund"}},
    }
    res = manager.process_payment_webhook(webhook_event)
    assert res["status"] == "REFUNDED"

    cust = manager.get_or_create_customer("cust_refund")
    assert cust.plan_tier == PlanTier.FREE
    assert cust.subscription_status == SubscriptionStatus.EXPIRED
    assert cust.is_active() is False


def test_cancellation_preserves_expired_status():
    manager = EntitlementManager()
    manager.upgrade_plan("cust_cancel", PlanTier.PRO)

    webhook_event = {
        "id": "evt_cancel_1",
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cust_cancel"}},
    }
    res = manager.process_payment_webhook(webhook_event)
    assert res["status"] == "CANCELED"

    cust = manager.get_or_create_customer("cust_cancel")
    assert cust.subscription_status == SubscriptionStatus.CANCELED
    assert cust.is_active() is False


def test_plan_upgrade_and_downgrade():
    manager = EntitlementManager()
    # Upgrade FREE -> PRO
    cust = manager.upgrade_plan("cust_switch", PlanTier.PRO)
    assert cust.plan_tier == PlanTier.PRO

    # Upgrade PRO -> TEAM
    cust = manager.upgrade_plan("cust_switch", PlanTier.TEAM)
    assert cust.plan_tier == PlanTier.TEAM

    # Downgrade TEAM -> FREE
    cust = manager.upgrade_plan("cust_switch", PlanTier.FREE)
    assert cust.plan_tier == PlanTier.FREE


def test_quota_limits_and_exhaustion():
    manager = EntitlementManager()
    cust = manager.get_or_create_customer("cust_limited")
    # Free tier has 100 limit
    assert manager.can_run_evaluation("cust_limited") is True

    # Exhaust quota
    manager.record_evaluation_run("cust_limited", count=100)
    assert manager.can_run_evaluation("cust_limited") is False

    # Upgrade to Pro (2,500 limit) restores permission
    manager.upgrade_plan("cust_limited", PlanTier.PRO)
    assert manager.can_run_evaluation("cust_limited") is True


def test_offline_ed25519_license_generation_and_verification():
    sk, pk = generate_keypair()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=365)

    payload = OfflineLicensePayload(
        license_id="LIC-AIRGAP-001",
        customer_id="enterprise_defense_corp",
        plan_tier=PlanTier.ENTERPRISE.value,
        issued_at=now.isoformat(),
        expires_at=expires.isoformat(),
        capabilities=["LOCAL_COMPILER", "OFFLINE_AUDIT", "UNLIMITED_EVAL"],
        machine_fingerprint="node-sha256-abc12345",
    )

    license_token = create_offline_license(payload, sk, pk)
    assert isinstance(license_token, str)
    assert len(license_token) > 50

    # Verify with trusted public key
    verified = verify_offline_license(license_token, trusted_public_key_hex=pk.hex())
    assert verified.license_id == "LIC-AIRGAP-001"
    assert verified.customer_id == "enterprise_defense_corp"
    assert verified.plan_tier == "ENTERPRISE"


def test_offline_license_tampering_rejected():
    sk, pk = generate_keypair()
    other_sk, other_pk = generate_keypair()
    now = datetime.now(timezone.utc)

    payload = OfflineLicensePayload(
        license_id="LIC-LEGIT",
        customer_id="good_actor",
        plan_tier=PlanTier.ENTERPRISE.value,
        issued_at=now.isoformat(),
        expires_at=(now + timedelta(days=30)).isoformat(),
        capabilities=["ALL"],
    )
    license_token = create_offline_license(payload, sk, pk)

    # Verification with wrong public key must fail
    with pytest.raises(LicenseVerificationError):
        verify_offline_license(license_token, trusted_public_key_hex=other_pk.hex())


def test_offline_license_expiration_rejected():
    sk, pk = generate_keypair()
    past = datetime.now(timezone.utc) - timedelta(days=10)
    expired = past - timedelta(days=5)

    payload = OfflineLicensePayload(
        license_id="LIC-EXPIRED",
        customer_id="cust_expired",
        plan_tier=PlanTier.PRO.value,
        issued_at=past.isoformat(),
        expires_at=expired.isoformat(),
        capabilities=["PRO_FEATURES"],
    )
    token = create_offline_license(payload, sk, pk)

    with pytest.raises(LicenseVerificationError, match="License expired"):
        verify_offline_license(token, trusted_public_key_hex=pk.hex())


def test_clock_skew_tolerance_and_rejection():
    sk, pk = generate_keypair()
    now = datetime.now(timezone.utc)

    # Issued 30 seconds in future: within 60s tolerance -> PASS
    future_30s = now + timedelta(seconds=30)
    payload_ok = OfflineLicensePayload(
        license_id="LIC-SKEW-OK",
        customer_id="cust_skew",
        plan_tier=PlanTier.PRO.value,
        issued_at=future_30s.isoformat(),
        expires_at=(now + timedelta(days=30)).isoformat(),
        capabilities=[],
    )
    token_ok = create_offline_license(payload_ok, sk, pk)
    verified = verify_offline_license(token_ok, trusted_public_key_hex=pk.hex(), clock_skew_seconds=60)
    assert verified.license_id == "LIC-SKEW-OK"

    # Issued 2 hours in future: beyond tolerance -> REJECT
    future_2h = now + timedelta(hours=2)
    payload_bad = OfflineLicensePayload(
        license_id="LIC-SKEW-BAD",
        customer_id="cust_skew",
        plan_tier=PlanTier.PRO.value,
        issued_at=future_2h.isoformat(),
        expires_at=(now + timedelta(days=30)).isoformat(),
        capabilities=[],
    )
    token_bad = create_offline_license(payload_bad, sk, pk)
    with pytest.raises(LicenseVerificationError, match="clock skew"):
        verify_offline_license(token_bad, trusted_public_key_hex=pk.hex(), clock_skew_seconds=60)


def test_concurrent_payment_webhooks():
    """Verify thread-safety and state consistency under high-concurrency webhooks."""
    manager = EntitlementManager()
    events = [
        {
            "id": f"evt_thread_{i}",
            "type": "checkout.session.completed",
            "created": 1000 + i,
            "data": {
                "object": {
                    "customer": f"cust_conc_{i}",
                    "metadata": {"tier": "PRO"},
                }
            },
        }
        for i in range(25)
    ]

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(manager.process_payment_webhook, events))

    assert len(results) == 25
    assert all(r["status"] == "SUCCESS" for r in results)
    for i in range(25):
        cust = manager.get_or_create_customer(f"cust_conc_{i}")
        assert cust.plan_tier == PlanTier.PRO
        assert cust.subscription_status == SubscriptionStatus.ACTIVE


def test_out_of_order_webhook_delivery():
    """Verify that late-arriving older webhook events are safely ignored."""
    manager = EntitlementManager()
    customer_id = "cust_ooo_01"

    # Event 1: Cancellation at timestamp 2000
    cancel_evt = {
        "id": "evt_cancel_2000",
        "type": "customer.subscription.deleted",
        "created": 2000,
        "data": {"object": {"customer": customer_id}},
    }
    res_cancel = manager.process_payment_webhook(cancel_evt)
    assert res_cancel["status"] == "CANCELED"
    assert manager.get_or_create_customer(customer_id).subscription_status == SubscriptionStatus.CANCELED

    # Event 2: Stale update created at timestamp 1000 arrives LATER
    stale_update_evt = {
        "id": "evt_update_1000",
        "type": "customer.subscription.updated",
        "created": 1000,
        "data": {
            "object": {
                "customer": customer_id,
                "metadata": {"tier": "PRO"},
            }
        },
    }
    res_stale = manager.process_payment_webhook(stale_update_evt)
    assert res_stale["status"] == "IGNORED_OUT_OF_ORDER"
    assert "older than last processed" in res_stale["reason"]

    # Customer remains canceled, not resurrected!
    assert manager.get_or_create_customer(customer_id).subscription_status == SubscriptionStatus.CANCELED


def test_subscription_resurrection_defense():
    """Verify that a canceled subscription cannot be revived by subscription.updated."""
    manager = EntitlementManager()
    customer_id = "cust_resurrect_guard"

    # Step 1: Subscribe Pro
    manager.upgrade_plan(customer_id, PlanTier.PRO)

    # Step 2: Cancel
    manager.cancel_subscription(customer_id)
    assert manager.get_or_create_customer(customer_id).subscription_status == SubscriptionStatus.CANCELED

    # Step 3: Ambiguous update webhook arrives with newer timestamp
    update_evt = {
        "id": "evt_update_newer",
        "type": "customer.subscription.updated",
        "created": 5000,
        "data": {
            "object": {
                "customer": customer_id,
                "metadata": {"tier": "PRO"},
            }
        },
    }
    res = manager.process_payment_webhook(update_evt)
    assert res["status"] == "BLOCKED_RESURRECTION"
    assert "Canceled subscription cannot be resurrected" in res["reason"]

    # Status remains CANCELED
    assert manager.get_or_create_customer(customer_id).subscription_status == SubscriptionStatus.CANCELED


def test_clock_rollback_detection():
    """Verify that system clock manipulation backward is detected and rejected."""
    manager = EntitlementManager()
    cust = manager.upgrade_plan("cust_clock", PlanTier.PRO, duration_days=30, current_time_iso="2026-10-08T12:00:00Z")

    # Normal sequential check: T = 12:05:00Z
    assert cust.is_active("2026-10-08T12:05:00Z") is True

    # Clock rewound: T = 10:00:00Z (earlier than 12:05:00Z)
    with pytest.raises(ValueError, match="Clock rollback detected"):
        cust.is_active("2026-10-08T10:00:00Z")


def test_concurrent_duplicate_webhook_race_condition():
    """Verify thread-safety and exact single-execution under concurrent duplicate webhook delivery."""
    manager = EntitlementManager()
    same_event = {
        "id": "evt_race_duplicate_target",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cust_race_single",
                "metadata": {"tier": "ENTERPRISE"},
            }
        },
    }

    successes = 0
    duplicate_errors = 0

    def attempt_process(_):
        nonlocal successes, duplicate_errors
        try:
            res = manager.process_payment_webhook(same_event)
            if res.get("status") == "SUCCESS":
                return "SUCCESS"
        except DuplicateWebhookError:
            return "DUPLICATE"
        return "UNKNOWN"

    with ThreadPoolExecutor(max_workers=8) as executor:
        outcomes = list(executor.map(attempt_process, range(16)))

    assert outcomes.count("SUCCESS") == 1
    assert outcomes.count("DUPLICATE") == 15
    cust = manager.get_or_create_customer("cust_race_single")
    assert cust.plan_tier == PlanTier.ENTERPRISE


def test_replayed_offline_license_tampering():
    """Verify that tampering with any field in an offline license or replaying across machines fails."""
    sk, pk = generate_keypair()
    payload = OfflineLicensePayload(
        license_id="LIC-TEST-001",
        customer_id="cust_enterprise_airgap",
        plan_tier=PlanTier.ENTERPRISE.value,
        issued_at="2026-10-08T00:00:00Z",
        expires_at="2027-10-08T00:00:00Z",
        capabilities=["AIR_GAPPED_COMPILER", "PRIVATE_FAILURE_GENOME"],
        machine_fingerprint="mac_hardware_sha256_abc123",
    )
    token = create_offline_license(payload, sk, pk)

    # Valid verification passes
    verified = verify_offline_license(token, trusted_public_key_hex=pk.hex(), current_time_iso="2026-10-08T12:00:00Z")
    assert verified.license_id == "LIC-TEST-001"

    # Tampered payload in token envelope
    import base64
    import json
    envelope = json.loads(base64.b64decode(token.encode("ascii")).decode("utf-8"))
    envelope["payload"]["plan_tier"] = "FREE"  # Tamper
    tampered_token = base64.b64encode(json.dumps(envelope).encode("utf-8")).decode("ascii")

    with pytest.raises(LicenseVerificationError, match="signature verification failed"):
        verify_offline_license(tampered_token, trusted_public_key_hex=pk.hex(), current_time_iso="2026-10-08T12:00:00Z")

