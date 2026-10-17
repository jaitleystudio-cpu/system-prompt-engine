"""Offline Cryptographic License Generator and Verifier using RFC 8785 + Ed25519."""

from __future__ import annotations

import base64
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from spe_runtime.ci_gate.receipt import (
    ed25519_sign,
    ed25519_verify,
    generate_keypair,
    rfc8785_canonicalize,
)
from spe_runtime.entitlement.models import PlanTier


class LicenseVerificationError(Exception):
    """Raised when an offline license key is invalid, expired, or tampered."""


@dataclass(frozen=True)
class OfflineLicensePayload:
    license_id: str
    customer_id: str
    plan_tier: str
    issued_at: str
    expires_at: str
    capabilities: list[str]
    machine_fingerprint: str | None = None


def create_offline_license(
    payload: OfflineLicensePayload,
    signing_key: bytes,
    public_key: bytes,
) -> str:
    """Signs payload with Ed25519 and returns compact base64-encoded license key."""
    canonical_bytes = rfc8785_canonicalize(asdict(payload))
    sig = ed25519_sign(signing_key, public_key, canonical_bytes)

    envelope = {
        "payload": asdict(payload),
        "signature_hex": sig.hex(),
        "public_key_hex": public_key.hex(),
    }
    return base64.b64encode(json.dumps(envelope).encode("utf-8")).decode("ascii")


# Official SPE Production License Authority Root Verification Public Key (Rotated & Pinned)
# Production private signing keys are strictly maintained in offline air-gapped cold storage
# and are NEVER committed to repository source code, distributed packages, or CLI bundles.
OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX = "a06705d0f0d4c0c23f0d5b53338c2809cd08dbfc6cd33992369436d9902c3f1e"

# Permanently Revoked & Compromised Keys (From R8 exposure)
REVOKED_COMPROMISED_KEY_HEXES = {
    "a3aeb249a51355c529fad16734caa8c140bcf8c7b7d35e925ce6de2e51bba6ec",  # Revoked R8 public key
    "e5b1a8448f4697bb0789a32d7e162a26ce9415455eb5f4538da0530baf7aedac",  # Revoked R8 private seed
}


def verify_offline_license(
    license_token: str,
    trusted_public_key_hex: str | None = None,
    allow_custom_signer: bool = False,
    current_time_iso: str | None = None,
    clock_skew_seconds: int = 60,
) -> OfflineLicensePayload:
    """Verifies cryptographic signature, expiry date, and clock skew for an offline license."""
    try:
        raw_json = base64.b64decode(license_token.encode("ascii")).decode("utf-8")
        envelope = json.loads(raw_json)
    except Exception as e:
        raise LicenseVerificationError(f"Malformed license token: {e}") from e

    payload_dict = envelope.get("payload")
    sig_hex = envelope.get("signature_hex")
    pk_hex = envelope.get("public_key_hex")

    if not payload_dict or not sig_hex or not pk_hex:
        raise LicenseVerificationError("Missing fields in license envelope")

    # 1. Enforce Permanent Key Revocation Check
    if pk_hex in REVOKED_COMPROMISED_KEY_HEXES:
        raise LicenseVerificationError(
            f"REVOKED_COMPROMISED_AUTHORITY: Signer key '{pk_hex[:12]}...' was permanently revoked due to prior security exposure. Re-issuance with rotated root authority is mandatory."
        )

    # 2. Verify trusted authority: Pin strictly to OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX by default
    effective_trusted_key = trusted_public_key_hex or (None if allow_custom_signer else OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX)
    if effective_trusted_key and pk_hex != effective_trusted_key:
        raise LicenseVerificationError(
            f"Untrusted license authority: signer '{pk_hex[:12]}...' does not match pinned SPE root authority ('{OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX[:12]}...')"
        )

    # 1. Verify Ed25519 signature
    canonical_bytes = rfc8785_canonicalize(payload_dict)
    try:
        pk_bytes = bytes.fromhex(pk_hex)
        sig_bytes = bytes.fromhex(sig_hex)
    except Exception as e:
        raise LicenseVerificationError(f"Invalid hex in signature or public key: {e}") from e

    if not ed25519_verify(pk_bytes, canonical_bytes, sig_bytes):
        raise LicenseVerificationError("Cryptographic signature verification failed (tampered license)")

    payload = OfflineLicensePayload(**payload_dict)

    # 2. Check expiration and clock skew
    now_dt = datetime.fromisoformat(current_time_iso) if current_time_iso else datetime.now(timezone.utc)
    expires_dt = datetime.fromisoformat(payload.expires_at)
    issued_dt = datetime.fromisoformat(payload.issued_at)

    # Rejection of future issuance beyond clock skew
    if (issued_dt - now_dt).total_seconds() > clock_skew_seconds:
        raise LicenseVerificationError("License issuance time is in the future beyond allowed clock skew")

    # Expiration check
    if (now_dt - expires_dt).total_seconds() > clock_skew_seconds:
        raise LicenseVerificationError(f"License expired at {payload.expires_at}")

    return payload
