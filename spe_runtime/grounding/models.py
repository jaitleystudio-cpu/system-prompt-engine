"""Immutable grounding models: ContextNeed + ContextCapsule contracts."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Iterable, Sequence


class ContextType(str, Enum):
    NONE = "NONE"
    STATIC_REFERENCE = "STATIC_REFERENCE"
    CURRENT_FACTS = "CURRENT_FACTS"
    SCHOLARLY_EVIDENCE = "SCHOLARLY_EVIDENCE"
    OFFICIAL_DOCUMENTATION = "OFFICIAL_DOCUMENTATION"
    USER_DATA = "USER_DATA"
    LIVE_DATA = "LIVE_DATA"
    MEDIA_OBSERVATION = "MEDIA_OBSERVATION"
    DETERMINISTIC_COMPUTATION = "DETERMINISTIC_COMPUTATION"
    LOCAL_INFORMATION = "LOCAL_INFORMATION"
    REGULATORY_SOURCE = "REGULATORY_SOURCE"
    COMPARATIVE_MARKET_DATA = "COMPARATIVE_MARKET_DATA"

    def to_dict(self) -> str:
        return self.value


class PrivacyClass(str, Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"
    SENSITIVE = "SENSITIVE"

    def to_dict(self) -> str:
        return self.value


class SupportStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    MIXED = "MIXED"
    INSUFFICIENT = "INSUFFICIENT"
    PREPRINT_ONLY = "PREPRINT_ONLY"
    UNVERIFIED = "UNVERIFIED"

    def to_dict(self) -> str:
        return self.value


_RISK_LEVELS = frozenset({"LOW", "MEDIUM", "HIGH"})


def _as_tuple_str(value: Iterable[str] | Sequence[str] | None) -> tuple[str, ...]:
    if value is None:
        return ()
    return tuple(str(item) for item in value)


def _as_context_types(
    value: Iterable[str | ContextType] | Sequence[str | ContextType],
) -> tuple[ContextType, ...]:
    result: list[ContextType] = []
    for item in value:
        if isinstance(item, ContextType):
            result.append(item)
        else:
            result.append(ContextType(str(item)))
    return tuple(result)


def _as_privacy_class(value: str | PrivacyClass) -> PrivacyClass:
    if isinstance(value, PrivacyClass):
        return value
    return PrivacyClass(str(value))


def _as_support_status(value: str | SupportStatus) -> SupportStatus:
    if isinstance(value, SupportStatus):
        return value
    return SupportStatus(str(value))


def _as_context_type(value: str | ContextType) -> ContextType:
    if isinstance(value, ContextType):
        return value
    return ContextType(str(value))


@dataclass(frozen=True)
class ContextNeed:
    """Immutable request for context acquisition."""

    need_id: str
    domain_tags: tuple[str, ...]
    context_types: tuple[ContextType, ...]
    freshness_required: bool
    risk_level: str
    privacy_class: PrivacyClass
    query_minimization_required: bool
    required_source_classes: tuple[str, ...]
    optional_source_classes: tuple[str, ...]
    max_sources: int
    max_context_bytes: int
    abstain_if_missing: bool
    reason_codes: tuple[str, ...]

    def __post_init__(self) -> None:
        if not str(self.need_id).strip():
            raise ValueError("need_id must be a non-empty string")

        object.__setattr__(self, "domain_tags", _as_tuple_str(self.domain_tags))
        object.__setattr__(self, "context_types", _as_context_types(self.context_types))
        object.__setattr__(
            self, "required_source_classes", _as_tuple_str(self.required_source_classes)
        )
        object.__setattr__(
            self, "optional_source_classes", _as_tuple_str(self.optional_source_classes)
        )
        object.__setattr__(self, "reason_codes", _as_tuple_str(self.reason_codes))
        object.__setattr__(self, "privacy_class", _as_privacy_class(self.privacy_class))

        risk = str(self.risk_level)
        if risk not in _RISK_LEVELS:
            raise ValueError(f"risk_level must be one of {sorted(_RISK_LEVELS)}, got {risk!r}")
        object.__setattr__(self, "risk_level", risk)

        max_sources = int(self.max_sources)
        max_context_bytes = int(self.max_context_bytes)
        if max_sources < 0:
            raise ValueError("max_sources must be >= 0")
        if max_context_bytes < 0:
            raise ValueError("max_context_bytes must be >= 0")
        object.__setattr__(self, "max_sources", max_sources)
        object.__setattr__(self, "max_context_bytes", max_context_bytes)
        object.__setattr__(self, "freshness_required", bool(self.freshness_required))
        object.__setattr__(
            self, "query_minimization_required", bool(self.query_minimization_required)
        )
        object.__setattr__(self, "abstain_if_missing", bool(self.abstain_if_missing))

    def to_dict(self) -> dict[str, Any]:
        return {
            "need_id": self.need_id,
            "domain_tags": list(self.domain_tags),
            "context_types": [ct.value for ct in self.context_types],
            "freshness_required": self.freshness_required,
            "risk_level": self.risk_level,
            "privacy_class": self.privacy_class.value,
            "query_minimization_required": self.query_minimization_required,
            "required_source_classes": list(self.required_source_classes),
            "optional_source_classes": list(self.optional_source_classes),
            "max_sources": self.max_sources,
            "max_context_bytes": self.max_context_bytes,
            "abstain_if_missing": self.abstain_if_missing,
            "reason_codes": list(self.reason_codes),
        }


@dataclass(frozen=True)
class ContextCapsule:
    """Normalized immutable context object with provenance and taint."""

    capsule_id: str
    domain_id: str
    context_type: ContextType
    claim_or_observation: str
    value: str
    source_id: str
    source_class: str
    authority_class: str
    retrieved_at: str
    valid_as_of: str
    fresh_until: str | None
    license: str
    allowed_use: str
    confidence: float
    support_status: SupportStatus
    contradiction_group: str | None
    provenance_digest: str
    taint_labels: tuple[str, ...]
    sensitivity_labels: tuple[str, ...]

    def __post_init__(self) -> None:
        if not str(self.capsule_id).strip():
            raise ValueError("capsule_id must be a non-empty string")
        if not str(self.source_id).strip():
            raise ValueError("source_id must be a non-empty string")
        if not str(self.provenance_digest).strip():
            raise ValueError("provenance_digest must be a non-empty string")

        object.__setattr__(self, "context_type", _as_context_type(self.context_type))
        object.__setattr__(
            self, "support_status", _as_support_status(self.support_status)
        )
        object.__setattr__(self, "taint_labels", _as_tuple_str(self.taint_labels))
        object.__setattr__(
            self, "sensitivity_labels", _as_tuple_str(self.sensitivity_labels)
        )

        confidence = float(self.confidence)
        if not (0.0 <= confidence <= 1.0):
            raise ValueError("confidence must be in range 0.0..1.0")
        object.__setattr__(self, "confidence", confidence)

        if self.fresh_until is not None:
            object.__setattr__(self, "fresh_until", str(self.fresh_until))
        if self.contradiction_group is not None:
            object.__setattr__(
                self, "contradiction_group", str(self.contradiction_group)
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "capsule_id": self.capsule_id,
            "domain_id": self.domain_id,
            "context_type": self.context_type.value,
            "claim_or_observation": self.claim_or_observation,
            "value": self.value,
            "source_id": self.source_id,
            "source_class": self.source_class,
            "authority_class": self.authority_class,
            "retrieved_at": self.retrieved_at,
            "valid_as_of": self.valid_as_of,
            "fresh_until": self.fresh_until,
            "license": self.license,
            "allowed_use": self.allowed_use,
            "confidence": self.confidence,
            "support_status": self.support_status.value,
            "contradiction_group": self.contradiction_group,
            "provenance_digest": self.provenance_digest,
            "taint_labels": list(self.taint_labels),
            "sensitivity_labels": list(self.sensitivity_labels),
        }
