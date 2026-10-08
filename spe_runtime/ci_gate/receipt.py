"""Cryptographic Evidence Receipts: RFC 8785 JCS Canonicalization + SHA-256 + Ed25519."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from typing import Any

# ==============================================================================
# 1. RFC 8785 JSON Canonicalization Scheme (JCS)
# ==============================================================================

def rfc8785_canonicalize(data: Any) -> bytes:
    """Canonicalize Python data structure per RFC 8785 (JCS)."""
    if data is None:
        return b"null"
    elif isinstance(data, bool):
        return b"true" if data else b"false"
    elif isinstance(data, (int, float)):
        # Format finite numbers canonically
        if isinstance(data, float):
            if data.is_integer():
                return str(int(data)).encode("utf-8")
            s = f"{data:.14g}"
            return s.encode("utf-8")
        return str(data).encode("utf-8")
    elif isinstance(data, str):
        # Escape string according to JSON specification
        return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    elif isinstance(data, list):
        items = [rfc8785_canonicalize(x) for x in data]
        return b"[" + b",".join(items) + b"]"
    elif isinstance(data, dict):
        # Keys sorted lexicographically by UTF-16 code units (standard in Python UTF-8/unicode)
        sorted_keys = sorted(data.keys())
        entries = []
        for k in sorted_keys:
            key_bytes = json.dumps(k, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            val_bytes = rfc8785_canonicalize(data[k])
            entries.append(key_bytes + b":" + val_bytes)
        return b"{" + b",".join(entries) + b"}"
    else:
        raise TypeError(f"Unsupported type for RFC 8785 canonicalization: {type(data)}")


# ==============================================================================
# 2. Pure-Python Ed25519 (RFC 8032) Implementation (Zero external C deps)
# ==============================================================================

b = 256
q = 2**255 - 19
l = 2**252 + 27742317777372353535851937790883648493
d = -121665 * pow(121666, q - 2, q) % q
I = pow(2, (q - 1) // 4, q)

def xrecover(y: int) -> int:
    xx = (y * y - 1) * pow(d * y * y + 1, q - 2, q) % q
    x = pow(xx, (q + 3) // 8, q)
    if (x * x - xx) % q != 0:
        x = (x * I) % q
    if x % 2 != 0:
        x = q - x
    return x

By = 4 * pow(5, q - 2, q) % q
Bx = xrecover(By)
B = (Bx, By)

def edwards(P, Q):
    x1, y1 = P
    x2, y2 = Q
    x3 = (x1 * y2 + x2 * y1) * pow(1 + d * x1 * x2 * y1 * y2, q - 2, q) % q
    y3 = (y1 * y2 + x1 * x2) * pow(1 - d * x1 * x2 * y1 * y2, q - 2, q) % q
    return (x3, y3)

def scalarmult(P, e):
    if e == 0:
        return (0, 1)
    Q = scalarmult(P, e // 2)
    Q = edwards(Q, Q)
    if e & 1:
        Q = edwards(Q, P)
    return Q

def encodepoint(P) -> bytes:
    x, y = P
    bits = [(y >> i) & 1 for i in range(b - 1)] + [x & 1]
    return bytes(sum(bits[i * 8 + j] << j for j in range(8)) for i in range(b // 8))

def decodepoint(s: bytes):
    y = sum(2**i * ((s[i // 8] >> (i % 8)) & 1) for i in range(b - 1))
    x = xrecover(y)
    if bool(x & 1) != bool((s[b // 8 - 1] >> 7) & 1):
        x = q - x
    P = (x, y)
    return P

def generate_keypair() -> tuple[bytes, bytes]:
    """Returns (secret_key_32_bytes, public_key_32_bytes)."""
    sk = os.urandom(32)
    h = hashlib.sha512(sk).digest()
    a = int.from_bytes(h[:32], "little")
    a &= (1 << 254) - 8
    a |= (1 << 254)
    A = scalarmult(B, a)
    pk = encodepoint(A)
    return sk, pk

def ed25519_sign(sk: bytes, pk: bytes, message: bytes) -> bytes:
    h = hashlib.sha512(sk).digest()
    a = int.from_bytes(h[:32], "little")
    a &= (1 << 254) - 8
    a |= (1 << 254)
    r = int.from_bytes(hashlib.sha512(h[32:] + message).digest(), "little") % l
    R = scalarmult(B, r)
    R_bytes = encodepoint(R)
    k = int.from_bytes(hashlib.sha512(R_bytes + pk + message).digest(), "little") % l
    S = (r + k * a) % l
    S_bytes = S.to_bytes(32, "little")
    return R_bytes + S_bytes

def ed25519_verify(pk: bytes, message: bytes, sig: bytes) -> bool:
    if len(sig) != 64 or len(pk) != 32:
        return False
    try:
        R = decodepoint(sig[:32])
        A = decodepoint(pk)
        S = int.from_bytes(sig[32:], "little")
        if S >= l:
            return False
        k = int.from_bytes(hashlib.sha512(sig[:32] + pk + message).digest(), "little") % l
        return scalarmult(B, S) == edwards(R, scalarmult(A, k))
    except Exception:
        return False


# ==============================================================================
# 3. Authenticated Evidence Receipt
# ==============================================================================

@dataclass(frozen=True)
class AuthenticatedReceipt:
    spec_version: str
    digest_sha256: str
    signature_ed25519: str
    signer_key_id: str
    canonical_payload: dict[str, Any]
    verified: bool

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)


def generate_authenticated_receipt(
    payload: dict[str, Any],
    signing_key: bytes | None = None,
    public_key: bytes | None = None,
    key_id: str = "spe-ephemeral-authority",
) -> AuthenticatedReceipt:
    # 1. Canonicalize per RFC 8785
    jcs_bytes = rfc8785_canonicalize(payload)

    # 2. SHA-256 Digest
    digest = hashlib.sha256(jcs_bytes).hexdigest()

    # 3. Cryptographic Signature (Ed25519)
    if signing_key is None or public_key is None:
        signing_key, public_key = generate_keypair()

    sig = ed25519_sign(signing_key, public_key, digest.encode("utf-8"))
    sig_hex = sig.hex()
    pk_hex = public_key.hex()

    # 4. Verify self
    is_valid = ed25519_verify(public_key, digest.encode("utf-8"), sig)

    return AuthenticatedReceipt(
        spec_version="0.1.0",
        digest_sha256=digest,
        signature_ed25519=sig_hex,
        signer_key_id=f"{key_id}:{pk_hex[:16]}",
        canonical_payload=payload,
        verified=is_valid,
    )


def verify_receipt_signature(receipt: AuthenticatedReceipt, public_key_hex: str) -> bool:
    try:
        pk = bytes.fromhex(public_key_hex)
        sig = bytes.fromhex(receipt.signature_ed25519)
        jcs_bytes = rfc8785_canonicalize(receipt.canonical_payload)
        digest = hashlib.sha256(jcs_bytes).hexdigest()
        if digest != receipt.digest_sha256:
            return False
        return ed25519_verify(pk, digest.encode("utf-8"), sig)
    except Exception:
        return False
