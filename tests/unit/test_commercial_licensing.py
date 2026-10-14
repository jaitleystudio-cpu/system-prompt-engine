"""Unit tests for SPE Commercial Licensing, Offline Entitlements & Anti-Piracy Moat."""

import json
from datetime import datetime, timedelta, timezone
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair, rfc8785_canonicalize, ed25519_sign
from spe_runtime.entitlement.license import (
    LicenseVerificationError,
    OfflineLicensePayload,
    create_offline_license,
    verify_offline_license,
)
from spe_runtime.production_bridge import CommercialLicensingAdapter


def test_issue_and_verify_active_license():
    issued = CommercialLicensingAdapter.issue_license(
        customer_id="Acme Defense AI",
        plan_tier="ENTERPRISE",
        duration_days=365,
    )
    assert issued["valid"] if "valid" in issued else True
    token = issued["token"]

    verified = CommercialLicensingAdapter.verify_license(token)
    assert verified["valid"] is True
    assert verified["status"] == "ACTIVE"
    assert verified["customer_id"] == "Acme Defense AI"
    assert verified["plan_tier"] == "ENTERPRISE"
    assert "ENTERPRISE_CI_GATE" in verified["capabilities"]
    assert "AUTOMATED_CONTINUATION" in verified["capabilities"]


def test_expired_license_fails_verification():
    now = datetime.now(timezone.utc)
    expired_time = now - timedelta(days=10)
    issued_time = now - timedelta(days=40)

    sk, pk = generate_keypair()
    payload = OfflineLicensePayload(
        license_id="SPE-LIC-EXPIRED-01",
        customer_id="Lapsed Customer LLC",
        plan_tier="PRO",
        issued_at=issued_time.isoformat(),
        expires_at=expired_time.isoformat(),
        capabilities=["AUTOMATED_CONTINUATION"],
    )
    token = create_offline_license(payload, sk, pk)

    verified = CommercialLicensingAdapter.verify_license(token)
    assert verified["valid"] is False
    assert verified["status"] == "EXPIRED"
    assert "expired" in verified["error"].lower()


def test_tampered_payload_detected_and_rejected():
    issued = CommercialLicensingAdapter.issue_license(
        customer_id="Honest Customer",
        plan_tier="PRO",
        duration_days=30,
    )
    import base64
    raw_env = json.loads(base64.b64decode(issued["token"].encode("ascii")).decode("utf-8"))
    
    # Tamper with plan_tier without re-signing
    raw_env["payload"]["plan_tier"] = "ENTERPRISE"
    tampered_token = base64.b64encode(json.dumps(raw_env).encode("utf-8")).decode("ascii")

    verified = CommercialLicensingAdapter.verify_license(tampered_token)
    assert verified["valid"] is False
    assert verified["status"] == "INVALID" or verified["status"] == "TAMPERED"
    assert "tampered" in verified["error"].lower() or "failed" in verified["error"].lower()


def test_untrusted_public_key_rejected_when_pinned():
    issued = CommercialLicensingAdapter.issue_license("Customer A", plan_tier="PRO")
    token = issued["token"]

    _, other_pk = generate_keypair()
    verified = CommercialLicensingAdapter.verify_license(token, trusted_public_key_hex=other_pk.hex())
    assert verified["valid"] is False
    assert "untrusted" in verified["error"].lower()
