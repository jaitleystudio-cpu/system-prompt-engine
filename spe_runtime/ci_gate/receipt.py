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

from decimal import Decimal
import math


def _rfc8785_format_number(val: int | float) -> bytes:
    """Format finite numbers per RFC 8785 Section 3.2.2.3 (ECMAScript Number::toString)."""
    if isinstance(val, int) and not isinstance(val, bool):
        return str(val).encode("utf-8")
    fval = float(val)
    if math.isnan(fval) or math.isinf(fval):
        raise ValueError("RFC 8785 forbids NaN and Infinity in canonical JSON")
    if fval == 0.0:
        return b"0"

    sign = "-" if fval < 0 else ""
    abs_val = abs(fval)
    # Use Python's shortest round-trip IEEE-754 representation via repr()
    dec = Decimal(repr(abs_val)).normalize()
    sign_dec, digit_tuple, exponent = dec.as_tuple()
    digits = "".join(str(d) for d in digit_tuple)
    # Remove trailing zeros if any remain
    digits = digits.rstrip("0") or "0"
    k = len(digits)
    # Value is (digits as integer) * 10**exponent = 0.<digits> * 10**(k + exponent)
    # Wait: dec = int(digits) * 10**(exponent + (len(digit_tuple) - k))
    adj_exp = int(exponent) + (len(digit_tuple) - k)
    n = k + adj_exp  # Scientific exponent + 1 (so 10**(n-1) <= abs_val < 10**n)

    if k <= n <= 21:
        formatted = digits + ("0" * (n - k))
    elif 0 < n < k:
        formatted = digits[:n] + "." + digits[n:]
    elif -5 <= n <= 0:
        formatted = "0." + ("0" * (-n)) + digits
    else:
        mantissa = digits[0] if k == 1 else (digits[0] + "." + digits[1:])
        exp_val = n - 1
        exp_sign = "+" if exp_val >= 0 else "-"
        formatted = f"{mantissa}e{exp_sign}{abs(exp_val)}"

    return (sign + formatted).encode("utf-8")


def _rfc8785_format_string(s: str) -> bytes:
    """Escape string per RFC 8785 Section 3.2.2.2."""
    out: list[str] = ['"']
    for ch in s:
        code = ord(ch)
        if code == 0x22:
            out.append('\\"')
        elif code == 0x5C:
            out.append("\\\\")
        elif code == 0x08:
            out.append("\\b")
        elif code == 0x09:
            out.append("\\t")
        elif code == 0x0A:
            out.append("\\n")
        elif code == 0x0C:
            out.append("\\f")
        elif code == 0x0D:
            out.append("\\r")
        elif code < 0x20:
            out.append(f"\\u{code:04x}")
        elif 0xD800 <= code <= 0xDFFF:
            raise ValueError(f"RFC 8785 forbids lone UTF-16 surrogate U+{code:04X}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out).encode("utf-8")


def rfc8785_canonicalize(data: Any) -> bytes:
    """Canonicalize Python data structure per RFC 8785 (JCS)."""
    if data is None:
        return b"null"
    elif isinstance(data, bool):
        return b"true" if data else b"false"
    elif isinstance(data, (int, float)):
        return _rfc8785_format_number(data)
    elif isinstance(data, str):
        return _rfc8785_format_string(data)
    elif isinstance(data, (list, tuple)):
        items = [rfc8785_canonicalize(x) for x in data]
        return b"[" + b",".join(items) + b"]"
    elif isinstance(data, dict):
        # RFC 8785 Section 3.2.3: Sort keys lexicographically by UTF-16 code units
        for k in data.keys():
            if not isinstance(k, str):
                raise TypeError(f"RFC 8785 requires string object keys, got {type(k)}")
        sorted_keys = sorted(data.keys(), key=lambda k: k.encode("utf-16-be"))
        entries = []
        for k in sorted_keys:
            key_bytes = _rfc8785_format_string(k)
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
