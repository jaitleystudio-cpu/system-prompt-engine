"""Models for Capability Firewall, Grants, and Delegation Contracts."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class CapabilityType(str, Enum):
    READ_FILE = "READ_FILE"
    WRITE_FILE = "WRITE_FILE"
    DELETE_FILE = "DELETE_FILE"
    NETWORK = "NETWORK"
    SEND_EMAIL = "SEND_EMAIL"
    CALENDAR_READ = "CALENDAR_READ"
    CALENDAR_WRITE = "CALENDAR_WRITE"
    DATABASE_READ = "DATABASE_READ"
    DATABASE_WRITE = "DATABASE_WRITE"
    SECRET_READ = "SECRET_READ"
    GIT_COMMIT = "GIT_COMMIT"
    GIT_PUSH = "GIT_PUSH"
    DEPLOY = "DEPLOY"
    PRODUCTION_CHANGE = "PRODUCTION_CHANGE"
    PURCHASE = "PURCHASE"
    PAYMENT = "PAYMENT"
    EXTERNAL_MESSAGE = "EXTERNAL_MESSAGE"
    TOOL_EXECUTE = "TOOL_EXECUTE"


class Decision(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRES_APPROVAL = "REQUIRES_APPROVAL"
    UNKNOWN = "UNKNOWN"


@dataclass
class CapabilityGrant:
    grant_id: str
    capability: CapabilityType
    resource_scope: str   # Glob pattern or URI, e.g. "/tmp/*", "https://api.github.com/*"
    action_scope: str     # e.g. "read", "write", "execute"
    issuer: str
    approval_identity: str
    expiration_iso: str   # ISO timestamp
    nonce: str
    signature: str
    amount_budget: float | None = None  # Currency / tokens / operation count
    remaining_budget: float | None = None

    def __post_init__(self) -> None:
        if self.amount_budget is not None and self.remaining_budget is None:
            self.remaining_budget = self.amount_budget


@dataclass
class CapabilityRequest:
    capability: CapabilityType
    target_resource: str
    action: str
    agent_id: str
    amount: float = 0.0
    nonce: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class PolicyEvaluationResult:
    decision: Decision
    reason: str
    matched_grant_id: str | None = None
    remaining_budget: float | None = None


@dataclass
class A2ADelegationContract:
    contract_id: str
    delegator_agent_id: str
    delegatee_agent_id: str
    allowed_capabilities: list[CapabilityType]
    forbidden_capabilities: list[CapabilityType]
    expiration_iso: str
    max_subdelegation_depth: int = 0


class SecurityPolicyViolationError(PermissionError, ValueError):
    """Raised when an operation violates security policy, lattice confidentiality, or air-gap egress boundary."""


@dataclass(frozen=True)
class SecurityAlert:
    alert_id: str
    threat_level: str  # CRITICAL, HIGH, MEDIUM, LOW
    attack_vector: str
    details: str
    timestamp_iso: str

