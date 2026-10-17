"""SPE Commercial Entitlement, Plans, Offline Licenses, and Webhook Architecture."""

from .license import (
    LicenseVerificationError,
    OfflineLicensePayload,
    create_offline_license,
    verify_offline_license,
)
from .manager import (
    DuplicateWebhookError,
    EntitlementError,
    EntitlementManager,
)
from .models import (
    DEFAULT_PLANS,
    EntitlementState,
    PlanDefinition,
    PlanTier,
    SubscriptionStatus,
    UsageQuota,
)

__all__ = [
    "PlanTier",
    "SubscriptionStatus",
    "PlanDefinition",
    "DEFAULT_PLANS",
    "UsageQuota",
    "EntitlementState",
    "OfflineLicensePayload",
    "LicenseVerificationError",
    "create_offline_license",
    "verify_offline_license",
    "EntitlementManager",
    "DuplicateWebhookError",
    "EntitlementError",
]
