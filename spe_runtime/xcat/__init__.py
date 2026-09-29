"""XCAT semantic kernel (cross-category envelope)."""

from spe_runtime.xcat.auto_route import auto_route_task
from spe_runtime.xcat.handoff import (
    HandoffResult,
    diagnose_refusal_reason,
    record_handoff,
    validate_handoff,
)
from spe_runtime.xcat.models import (
    CATEGORY_IDS,
    AuthorityState,
    CrossCategoryEnvelope,
    FailureRecord,
)
from spe_runtime.xcat.reasons import ReasonCode
from spe_runtime.xcat.router import route_mission_stage

__all__ = [
    "CATEGORY_IDS",
    "AuthorityState",
    "auto_route_task",
    "CrossCategoryEnvelope",
    "FailureRecord",
    "HandoffResult",
    "ReasonCode",
    "diagnose_refusal_reason",
    "record_handoff",
    "route_mission_stage",
    "validate_handoff",
]
