"""
SPE Ω — WDES Core Types and Formal Algebra.
Defines 3-valued logic, exact integer financial types, security lattices, and verification verdicts.
"""

from enum import Enum, IntEnum
from dataclasses import dataclass
from typing import Dict, Any, Optional

NanoUSD = int  # Exact integer units: 1_000_000_000 Nanos = $1.00 USD


def validate_nanos(amount: NanoUSD, field_name: str = "amount") -> NanoUSD:
    """Validates that a financial amount is a non-negative integer NanoUSD."""
    if not isinstance(amount, int) or isinstance(amount, bool):
        raise TypeError(f"{field_name} must be an integer NanoUSD, got {type(amount).__name__}")
    if amount < 0:
        raise ValueError(f"{field_name} cannot be negative: {amount}")
    return amount



class PredicateValue(Enum):
    """3-Valued Kleene logic."""
    TRUE = 1
    FALSE = 2
    UNKNOWN = 3

    def logical_and(self, other: "PredicateValue") -> "PredicateValue":
        if self == PredicateValue.FALSE or other == PredicateValue.FALSE:
            return PredicateValue.FALSE
        if self == PredicateValue.TRUE and other == PredicateValue.TRUE:
            return PredicateValue.TRUE
        return PredicateValue.UNKNOWN

    def logical_or(self, other: "PredicateValue") -> "PredicateValue":
        if self == PredicateValue.TRUE or other == PredicateValue.TRUE:
            return PredicateValue.TRUE
        if self == PredicateValue.FALSE and other == PredicateValue.FALSE:
            return PredicateValue.FALSE
        return PredicateValue.UNKNOWN

    def logical_not(self) -> "PredicateValue":
        if self == PredicateValue.TRUE:
            return PredicateValue.FALSE
        if self == PredicateValue.FALSE:
            return PredicateValue.TRUE
        return PredicateValue.UNKNOWN


class VerificationVerdict(str, Enum):
    """Four formal evidence verdicts under Evidence Law."""
    PROVEN_WITHIN_FORMAL_SCOPE = "PROVEN_WITHIN_FORMAL_SCOPE"
    EMPIRICALLY_QUALIFIED = "EMPIRICALLY_QUALIFIED"
    COUNTEREXAMPLE_FOUND = "COUNTEREXAMPLE_FOUND"
    INCONCLUSIVE = "INCONCLUSIVE"


class SolverOutcome(str, Enum):
    """Search/Solver status over a declared candidate grammar."""
    SAT = "SAT"
    UNSAT_WITHIN_SCOPE = "UNSAT_WITHIN_SCOPE"
    SEARCH_BUDGET_EXHAUSTED = "SEARCH_BUDGET_EXHAUSTED"
    TIMEOUT = "TIMEOUT"


class ObligationStatus(str, Enum):
    """First-class status of an obligation under Paper 2 (WDIC)."""
    SATISFIED = "SATISFIED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"
    EXPLICITLY_UNFULFILLED = "EXPLICITLY_UNFULFILLED"


class CompilationMode(str, Enum):
    """Two-speed intelligence execution modes."""
    EXPLORATION = "EXPLORATION"      # Spend compute/tokens to discover and qualify a procedure
    SPECIALIZATION = "SPECIALIZATION"  # Execute previously qualified deterministic procedure ($0 tokens)


class EffectStatus(str, Enum):
    """Consequential external side-effect status."""
    UNCOMMITTED = "UNCOMMITTED"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    COMMITTED_IDEMPOTENT = "COMMITTED_IDEMPOTENT"
    COMMITTED_IRREVERSIBLE = "COMMITTED_IRREVERSIBLE"
    REMOTE_OUTCOME_UNKNOWN = "REMOTE_OUTCOME_UNKNOWN"


class EvidenceStatus(str, Enum):
    """Evidentiary weight of a claim."""
    FORMALLY_SUFFICIENT = "FORMALLY_SUFFICIENT"
    EMPIRICALLY_QUALIFIED = "EMPIRICALLY_QUALIFIED"
    INSUFFICIENT_OR_UNKNOWN = "INSUFFICIENT_OR_UNKNOWN"


class ConfidentialityLevel(IntEnum):
    """Information flow confidentiality lattice."""
    PUBLIC = 0
    INTERNAL = 1
    CONFIDENTIAL = 2
    RESTRICTED = 3

    def join(self, other: "ConfidentialityLevel") -> "ConfidentialityLevel":
        return ConfidentialityLevel(max(self.value, other.value))

    def flows_to(self, other: "ConfidentialityLevel") -> bool:
        return self.value <= other.value


class NetworkPolicy(str, Enum):
    """Hard-boundary network egress policies."""
    AIR_GAPPED = "AIR_GAPPED"           # Strict hardware prohibition: zero network egress permitted
    LOCAL_ONLY = "LOCAL_ONLY"           # Local compute only; no remote endpoints
    RESTRICTED_CLOUD = "RESTRICTED_CLOUD" # Explicit allowlist cloud endpoints only
    PUBLIC_EGRESS = "PUBLIC_EGRESS"     # Unrestricted external egress


@dataclass(frozen=True)
class SecurityLabel:
    """Security tuple governing data and operations."""
    confidentiality: ConfidentialityLevel
    network_policy: NetworkPolicy
    integrity_trusted: bool

    def join(self, other: "SecurityLabel") -> "SecurityLabel":
        joined_policy = (
            NetworkPolicy.AIR_GAPPED if NetworkPolicy.AIR_GAPPED in (self.network_policy, other.network_policy)
            else NetworkPolicy.LOCAL_ONLY if NetworkPolicy.LOCAL_ONLY in (self.network_policy, other.network_policy)
            else NetworkPolicy.RESTRICTED_CLOUD if NetworkPolicy.RESTRICTED_CLOUD in (self.network_policy, other.network_policy)
            else NetworkPolicy.PUBLIC_EGRESS
        )
        return SecurityLabel(
            confidentiality=self.confidentiality.join(other.confidentiality),
            network_policy=joined_policy,
            integrity_trusted=self.integrity_trusted and other.integrity_trusted
        )
