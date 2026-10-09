from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Any

class ObligationState(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"

class ClaimScope(Enum):
    VERIFIED = "VERIFIED"
    LIMITED = "LIMITED"
    UNRESOLVED = "UNRESOLVED"

@dataclass
class VerificationAction:
    id: str
    description: str
    cost_nano_usd: int
    risk_score: int
    is_authorized: bool

@dataclass
class EvidenceReceipt:
    id: str
    data: Any
    is_valid: bool

@dataclass
class Obligation:
    id: str
    requirement: str
    acceptance_rule_ref: str
    state: ObligationState = ObligationState.UNKNOWN
    evidence_receipts: List[EvidenceReceipt] = field(default_factory=list)

@dataclass
class EvidenceClosureContract:
    schema_version: str
    protected_intent_ref: str
    obligations: List[Obligation]
    claim_scope: ClaimScope = ClaimScope.UNRESOLVED
