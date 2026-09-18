"""Working Ring-0 contract binding helpers (G1-B01)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKING_CONTRACT_PATH = (
    REPO_ROOT / "specs" / "spe-omega-v2.4.1" / "RING0_WORKING_CONTRACT.json"
)
EXPECTED_SHA256 = (
    "68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3"
)


def working_contract_sha256(path: Path | None = None) -> str:
    target = path or WORKING_CONTRACT_PATH
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    return digest


def verify_working_contract_hash(path: Path | None = None) -> str:
    """Return sha256 if it matches EXPECTED_SHA256; raise SpeTypedError otherwise."""
    from spe_runtime.error_registry import ErrorCode, SpeTypedError

    digest = working_contract_sha256(path)
    if digest != EXPECTED_SHA256:
        raise SpeTypedError(
            ErrorCode.UNKNOWN,
            f"working contract sha256 mismatch: got {digest}, expected {EXPECTED_SHA256}",
        )
    return digest


def load_working_contract(path: Path | None = None) -> dict[str, Any]:
    """Load and hash-verify the working Ring-0 contract."""
    target = path or WORKING_CONTRACT_PATH
    verify_working_contract_hash(target)
    return json.loads(target.read_text(encoding="utf-8"))


__all__ = [
    "WORKING_CONTRACT_PATH",
    "EXPECTED_SHA256",
    "working_contract_sha256",
    "verify_working_contract_hash",
    "load_working_contract",
]
