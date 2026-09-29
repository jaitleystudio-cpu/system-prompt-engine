"""Aggregate-only privacy analytics. No user-level tracking and no success scores."""

from spe_runtime.privacy.analytics import (
    SCHEMA_ID,
    AggregateEvent,
    MeasurementSlot,
    PrivacyAnalyticsRegistry,
    admit_event,
    empty_registry,
    import_measurement,
    record_event,
)
from spe_runtime.privacy.checklist import (
    ChecklistItem,
    QualificationReport,
    qualification_checklist,
    registry_document,
)
from spe_runtime.privacy.refusals import (
    UNKNOWN,
    PrivacyRefusal,
    PrivacyRefusalError,
    collect_refusals,
    refusal_catalog,
)

__all__ = (
    "SCHEMA_ID",
    "UNKNOWN",
    "AggregateEvent",
    "ChecklistItem",
    "MeasurementSlot",
    "PrivacyAnalyticsRegistry",
    "PrivacyRefusal",
    "PrivacyRefusalError",
    "QualificationReport",
    "admit_event",
    "collect_refusals",
    "empty_registry",
    "import_measurement",
    "qualification_checklist",
    "record_event",
    "refusal_catalog",
    "registry_document",
)
