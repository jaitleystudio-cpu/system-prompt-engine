"""Unit tests for SPE Commercial Licensing, Offline Entitlements & Anti-Piracy Moat."""

import json
from datetime import datetime, timedelta, timezone
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair, rfc8785_canonicalize, ed25519_sign
from spe_runtime.entitlement.license import (
    LicenseVerificationError,
    OfflineLicensePayload,
    OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX,
    create_offline_license,
    verify_offline_license,
)
from spe_runtime.production_bridge import CommercialLicensingAdapter

# Dedicated ephemeral test keypair for unit test suite (never used in production)
TEST_SIGNING_KEY, TEST_PUBLIC_KEY = generate_keypair()
TEST_SIGNING_KEY_HEX = TEST_SIGNING_KEY.hex()
TEST_PUBLIC_KEY_HEX = TEST_PUBLIC_KEY.hex()


def test_production_signing_key_not_in_source():
    """Security Law: Production private signing keys must NEVER be in repository source."""
    import spe_runtime.entitlement.license as lic_module
    assert not hasattr(lic_module, "OFFICIAL_SPE_ROOT_SIGNING_KEY_HEX"), (
        "OFFICIAL_SPE_ROOT_SIGNING_KEY_HEX found in license.py! Must be removed."
    )
    assert "OFFICIAL_SPE_ROOT_SIGNING_KEY_HEX" not in dir(lic_module)
    # The official root public key must be rotated and not equal to compromised key
    assert OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX != "a3aeb249a51355c529fad16734caa8c140bcf8c7b7d35e925ce6de2e51bba6ec"
    assert OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX == "a06705d0f0d4c0c23f0d5b53338c2809cd08dbfc6cd33992369436d9902c3f1e"


def test_issue_license_requires_signing_key_fails_closed():
    """Security Law: Issuance without explicit signing authority must fail closed."""
    with pytest.raises(ValueError, match="requires an authorized private signing key"):
        CommercialLicensingAdapter.issue_license(customer_id="Unauthenticated Corp")


def test_issue_and_verify_active_license_with_test_key():
    issued = CommercialLicensingAdapter.issue_license(
        customer_id="Acme Defense AI",
        plan_tier="ENTERPRISE",
        duration_days=365,
        master_signing_key_hex=TEST_SIGNING_KEY_HEX,
    )
    assert issued["valid"] if "valid" in issued else True
    token = issued["token"]

    # Security Law: Private signing key must NEVER be leaked in output
    assert "signing_key_hex" not in issued, "Private signing key leaked in issuance output!"
    assert issued["public_key_hex"] == TEST_PUBLIC_KEY_HEX

    # Verifying with test trusted key must succeed
    verified = CommercialLicensingAdapter.verify_license(
        token,
        trusted_public_key_hex=TEST_PUBLIC_KEY_HEX,
    )
    assert verified["valid"] is True
    assert verified["status"] == "ACTIVE"
    assert verified["customer_id"] == "Acme Defense AI"
    assert verified["plan_tier"] == "ENTERPRISE"
    assert "ENTERPRISE_CI_GATE" in verified["capabilities"]
    assert "AUTOMATED_CONTINUATION" in verified["capabilities"]

    # Verifying test token against official root authority by default must reject
    default_verified = CommercialLicensingAdapter.verify_license(token)
    assert default_verified["valid"] is False
    assert "untrusted" in default_verified["error"].lower()


def test_untrusted_self_signed_license_rejected_by_default():
    """Security Law: Forged self-signed tokens must be rejected by default verifier."""
    sk, pk = generate_keypair()
    now = datetime.now(timezone.utc)
    payload = OfflineLicensePayload(
        license_id="SPE-FORGED-001",
        customer_id="Malicious Adversary",
        plan_tier="ENTERPRISE",
        issued_at=now.isoformat(),
        expires_at=(now + timedelta(days=365)).isoformat(),
        capabilities=["ALL"],
    )
    forged_token = create_offline_license(payload, sk, pk)

    # Default verification without explicit override must reject the untrusted issuer
    verified = CommercialLicensingAdapter.verify_license(forged_token)
    assert verified["valid"] is False
    assert "untrusted" in verified["error"].lower()


def test_expired_license_fails_verification():
    now = datetime.now(timezone.utc)
    expired_time = now - timedelta(days=10)
    issued_time = now - timedelta(days=40)

    payload = OfflineLicensePayload(
        license_id="SPE-LIC-EXPIRED-01",
        customer_id="Lapsed Customer LLC",
        plan_tier="PRO",
        issued_at=issued_time.isoformat(),
        expires_at=expired_time.isoformat(),
        capabilities=["AUTOMATED_CONTINUATION"],
    )
    token = create_offline_license(payload, TEST_SIGNING_KEY, TEST_PUBLIC_KEY)

    verified = CommercialLicensingAdapter.verify_license(
        token,
        trusted_public_key_hex=TEST_PUBLIC_KEY_HEX,
    )
    assert verified["valid"] is False
    assert verified["status"] == "EXPIRED"
    assert "expired" in verified["error"].lower()


def test_tampered_payload_detected_and_rejected():
    issued = CommercialLicensingAdapter.issue_license(
        customer_id="Honest Customer",
        plan_tier="PRO",
        duration_days=30,
        master_signing_key_hex=TEST_SIGNING_KEY_HEX,
    )
    import base64
    raw_env = json.loads(base64.b64decode(issued["token"].encode("ascii")).decode("utf-8"))

    # Tamper with plan_tier without re-signing
    raw_env["payload"]["plan_tier"] = "ENTERPRISE"
    tampered_token = base64.b64encode(json.dumps(raw_env).encode("utf-8")).decode("ascii")

    verified = CommercialLicensingAdapter.verify_license(
        tampered_token,
        trusted_public_key_hex=TEST_PUBLIC_KEY_HEX,
    )
    assert verified["valid"] is False
    assert verified["status"] == "INVALID" or verified["status"] == "TAMPERED"
    assert "tampered" in verified["error"].lower() or "failed" in verified["error"].lower()


def test_untrusted_public_key_rejected_when_pinned():
    issued = CommercialLicensingAdapter.issue_license(
        "Customer A",
        plan_tier="PRO",
        master_signing_key_hex=TEST_SIGNING_KEY_HEX,
    )
    token = issued["token"]

    _, other_pk = generate_keypair()
    verified = CommercialLicensingAdapter.verify_license(token, trusted_public_key_hex=other_pk.hex())
    assert verified["valid"] is False
    assert "untrusted" in verified["error"].lower()


def test_revoked_compromised_root_keys_permanently_rejected():
    """Security Law: Compromised keys from R8 must be permanently rejected."""
    from spe_runtime.entitlement.license import REVOKED_COMPROMISED_KEY_HEXES

    revoked_pk = "a3aeb249a51355c529fad16734caa8c140bcf8c7b7d35e925ce6de2e51bba6ec"
    assert revoked_pk in REVOKED_COMPROMISED_KEY_HEXES

    now = datetime.now(timezone.utc)
    payload = OfflineLicensePayload(
        license_id="SPE-REVOKED-01",
        customer_id="Compromised Entity",
        plan_tier="ENTERPRISE",
        issued_at=now.isoformat(),
        expires_at=(now + timedelta(days=365)).isoformat(),
        capabilities=["ALL"],
    )
    import base64

    fake_env = {
        "payload": payload.__dict__,
        "signature_hex": "00" * 64,
        "public_key_hex": revoked_pk,
    }
    revoked_token = base64.b64encode(json.dumps(fake_env).encode("utf-8")).decode("ascii")

    with pytest.raises(LicenseVerificationError, match="REVOKED_COMPROMISED_AUTHORITY"):
        verify_offline_license(revoked_token, allow_custom_signer=True)
