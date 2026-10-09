"""
RGIC-E1 Evidence Closure Planner — Canonical Types & Invariants
Part of SPE Ω Research Quarantine (Strictly isolated from RC core).

Implements the formal data structures for:
- 4-state Kleene obligations (PASS, FAIL, UNKNOWN, NOT_APPLICABLE)
- Exact NanoUSD integer arithmetic cost modeling
- Immutable rule digests (anti-tamper)
- Independent evidence policies and non-self-certifying receipts
- Scope adjudication (VERIFIED, LIMITED, UNRESOLVED)
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict
import hashlib
import json

class ObligationState(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"

class ClaimScope(Enum):
    VERIFIED = "VERIFIED"
    LIMITED = "LIMITED"
    UNRESOLVED = "UNRESOLVED"

class EvidenceType(Enum):
    DETERMINISTIC_TEST = "DETERMINISTIC_TEST"
    RUNTIME_OBSERVATION = "RUNTIME_OBSERVATION"
    HUMAN_PREFERENCE = "HUMAN_PREFERENCE"
    SECURITY_AUDIT = "SECURITY_AUDIT"
    STATIC_ANALYSIS = "STATIC_ANALYSIS"
    BROWSER_RENDER = "BROWSER_RENDER"
    INDEPENDENT_ORACLE = "INDEPENDENT_ORACLE"

class VerificationActionKind(Enum):
    TOOL_CALL = "TOOL_CALL"
    TARGETED_QUESTION = "TARGETED_QUESTION"
    INDEPENDENT_TEST = "INDEPENDENT_TEST"
    STATIC_ANALYSIS = "STATIC_ANALYSIS"
    UNRESOLVABLE_PROBE = "UNRESOLVABLE_PROBE"

@dataclass
class EvidencePolicy:
    policy_id: str
    required_evidence_type: str
    min_receipts: int = 1
    allow_self_reporting: bool = False  # Hard invariant: agent self-reporting is rejected

@dataclass
class AuthorityBoundary:
    boundary_id: str
    allowed_tools: List[str] = field(default_factory=list)
    max_cost_nano_usd: int = 10_000_000_000  # Default 10 USD in nanos
    network_egress_allowed: bool = False
    filesystem_write_allowed: bool = False

@dataclass
class JustifiedExclusion:
    reason: str
    justification_hash: str
    authorized_by: str

@dataclass
class VerificationAction:
    id: str
    description: str
    cost_nano_usd: int
    risk_score: int  # 0 to 1000
    is_authorized: bool
    kind: VerificationActionKind = VerificationActionKind.TOOL_CALL
    target_obligation_id: str = ""
    expected_entropy_reduction: int = 100  # 1 to 1000
    clarification_friction_score: int = 0  # penalty for interrupting human

@dataclass
class EvidenceReceipt:
    id: str
    data: Any
    is_valid: bool
    action_id: str = ""
    evidence_type: str = "DETERMINISTIC_TEST"
    issuer_id: str = "oracle-default"
    timestamp_ns: int = 0
    digest: str = ""

@dataclass
class Obligation:
    id: str
    requirement: str
    acceptance_rule_ref: str
    state: ObligationState = ObligationState.UNKNOWN
    criticality: int = 5  # 1 (low) to 10 (critical safety/invariant)
    rule_digest: str = ""
    evidence_policy: Optional[EvidencePolicy] = None
    authority_boundary: Optional[AuthorityBoundary] = None
    justified_exclusion: Optional[JustifiedExclusion] = None
    evidence_receipts: List[EvidenceReceipt] = field(default_factory=list)

    def __post_init__(self):
        if not self.rule_digest and self.acceptance_rule_ref:
            # Deterministic hash of initial rule reference
            h = hashlib.sha256(self.acceptance_rule_ref.encode('utf-8')).hexdigest()
            self.rule_digest = h

@dataclass
class EvidenceClosureContract:
    schema_version: str
    protected_intent_ref: str
    obligations: List[Obligation]
    claim_scope: ClaimScope = ClaimScope.UNRESOLVED
    contract_id: str = "contract-default"
    agent_id: str = "agent-candidate"
    created_at_ns: int = 0
    adjudicated_at_ns: Optional[int] = None
    digest: Optional[str] = None
