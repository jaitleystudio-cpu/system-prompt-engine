"""K2 proof-type vocabulary and semantic delta actions."""

from __future__ import annotations

import hashlib
from enum import Enum
from typing import Any

from spe_runtime.portability.canonical import canonical_dumps


class ProofType(str, Enum):
    STRUCTURAL_CONFORMANCE = "STRUCTURAL_CONFORMANCE"
    DETERMINISTIC_INVARIANT = "DETERMINISTIC_INVARIANT"
    EXECUTION_RECEIPT = "EXECUTION_RECEIPT"
    EMPIRICAL_EVIDENCE = "EMPIRICAL_EVIDENCE"
    MODEL_JUDGMENT = "MODEL_JUDGMENT"
    HUMAN_JUDGMENT = "HUMAN_JUDGMENT"
    EXTERNAL_WORLD_OBSERVATION = "EXTERNAL_WORLD_OBSERVATION"


class Verdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"


class LeaseStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CONSUMED = "CONSUMED"
    REVOKED = "REVOKED"


class ObligationStatus(str, Enum):
    OPEN = "OPEN"
    DISCHARGED = "DISCHARGED"
    FAILED = "FAILED"


class DeltaAction(str, Enum):
    """Smallest semantic delta set for K0/K1 mutation via patch."""

    ADD_REQUIREMENT = "ADD_REQUIREMENT"
    CONFIRM_REQUIREMENT = "CONFIRM_REQUIREMENT"


def proof_type_compatible(required: ProofType | str, provided: ProofType | str) -> bool:
    """Exact-match only — no proof-type laundering."""
    req = required if isinstance(required, ProofType) else ProofType(required)
    prov = provided if isinstance(provided, ProofType) else ProofType(provided)
    return req is prov


def content_digest(payload: Any, *, prefix: str, length: int = 32) -> str:
    """Deterministic typed id: prefix + sha256(canonical JSON)[:length]."""
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()
    return f"{prefix}{digest[:length]}"


__all__ = [
    "ProofType",
    "Verdict",
    "LeaseStatus",
    "ObligationStatus",
    "DeltaAction",
    "proof_type_compatible",
    "content_digest",
]
