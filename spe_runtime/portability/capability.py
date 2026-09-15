"""Capability IDs + downgrade/escalation law — never fake success."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from spe_runtime.portability.reasons import PortabilityReason


class CapabilityId(str, Enum):
    CORE_CONTRACT = "CORE_CONTRACT"
    XCAT_HANDOFF = "XCAT_HANDOFF"
    C02_RESEARCH = "C02_RESEARCH"
    C06_ANALYZE = "C06_ANALYZE"
    C01_DECIDE = "C01_DECIDE"
    C03_COMMUNICATE = "C03_COMMUNICATE"
    C07_EXECUTION_INTENT = "C07_EXECUTION_INTENT"
    AUTHORITY_VALIDATION = "AUTHORITY_VALIDATION"
    PROVENANCE = "PROVENANCE"
    UNCERTAINTY = "UNCERTAINTY"
    PRIVACY_LABELS = "PRIVACY_LABELS"
    PROOF_RECEIPTS = "PROOF_RECEIPTS"
    LOCAL_STORAGE = "LOCAL_STORAGE"
    LOCAL_EXECUTION = "LOCAL_EXECUTION"
    NETWORK_OPTIONAL = "NETWORK_OPTIONAL"
    OFFLINE_MODE = "OFFLINE_MODE"


CAPABILITY_IDS: frozenset[str] = frozenset(c.value for c in CapabilityId)


class CapabilityStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    MISSING = "MISSING"
    BLOCKED = "BLOCKED"
    DEFER = "DEFER"


@dataclass(frozen=True)
class CapabilityDecision:
    capability: str
    status: CapabilityStatus
    reason: str | None
    outcome: str


def evaluate_capability(
    capability: str,
    *,
    available: frozenset[str] | set[str],
    blocked: frozenset[str] | set[str] | None = None,
    defer: frozenset[str] | set[str] | None = None,
) -> CapabilityDecision:
    """Downgrade law: MISSING/BLOCKED/DEFER never report SUCCESS."""
    blocked = frozenset(blocked or ())
    defer = frozenset(defer or ())
    avail = frozenset(available)

    if capability in blocked:
        return CapabilityDecision(
            capability=capability,
            status=CapabilityStatus.BLOCKED,
            reason=PortabilityReason.CAPABILITY_BLOCKED.value,
            outcome="CAPABILITY_BLOCKED",
        )
    if capability in defer:
        return CapabilityDecision(
            capability=capability,
            status=CapabilityStatus.DEFER,
            reason=PortabilityReason.CAPABILITY_DEFER.value,
            outcome="CAPABILITY_DEFER",
        )
    if capability not in avail:
        return CapabilityDecision(
            capability=capability,
            status=CapabilityStatus.MISSING,
            reason=PortabilityReason.CAPABILITY_MISSING.value,
            outcome="CAPABILITY_MISSING",
        )
    return CapabilityDecision(
        capability=capability,
        status=CapabilityStatus.AVAILABLE,
        reason=None,
        outcome="SUCCESS",
    )


def detect_capability_escalation(
    source_capabilities: frozenset[str] | set[str],
    target_capabilities: frozenset[str] | set[str],
) -> dict[str, object]:
    """Target may not claim capabilities outside the source allowance."""
    src = frozenset(source_capabilities)
    tgt = frozenset(target_capabilities)
    extra = tgt - src
    if extra:
        return {
            "ok": False,
            "reason": PortabilityReason.CAPABILITY_ESCALATION.value,
            "extra": sorted(extra),
        }
    return {"ok": True, "reason": None, "extra": []}
