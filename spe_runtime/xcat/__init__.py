"""XCAT semantic kernel (cross-category envelope)."""

from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.models import (
    CATEGORY_IDS,
    AuthorityState,
    CrossCategoryEnvelope,
    FailureRecord,
)
from spe_runtime.xcat.reasons import ReasonCode

__all__ = [
    "CATEGORY_IDS",
    "AuthorityState",
    "CrossCategoryEnvelope",
    "FailureRecord",
    "HandoffResult",
    "ReasonCode",
    "validate_handoff",
]
