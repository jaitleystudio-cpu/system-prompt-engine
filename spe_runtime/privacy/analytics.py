"""Aggregate-only analytics types.

Events are counts over closed public buckets. Search Console, Core Web Vitals,
and revenue stay UNKNOWN until `import_measurement` accepts evidence bytes.
This module does not fetch, store prompts, or emit a success score.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import date
from types import MappingProxyType
from typing import Mapping

from spe_runtime.privacy.refusals import (
    UNKNOWN,
    PrivacyRefusal,
    PrivacyRefusalError,
    collect_refusals,
)

SCHEMA_ID = "spe.privacy-analytics.v1"

EVENT_KINDS: tuple[str, ...] = ("PAGE_VIEW_BUCKET", "NAVIGATION_BUCKET")
ROUTE_FAMILIES: tuple[str, ...] = (
    "HOME",
    "CREATE",
    "CAPABILITIES",
    "CONTRACT",
    "OTHER_PUBLIC",
)
SLOT_IDS: tuple[str, ...] = ("SEARCH_CONSOLE", "CORE_WEB_VITALS", "REVENUE")
SLOT_METRICS: dict[str, tuple[str, ...]] = {
    "SEARCH_CONSOLE": ("clicks", "impressions", "ctr", "position"),
    "CORE_WEB_VITALS": ("lcp_ms", "inp_ms", "cls", "ttfb_ms"),
    "REVENUE": ("amount_minor", "transaction_count", "currency"),
}
_COUNT_METRICS = frozenset(
    {"clicks", "impressions", "amount_minor", "transaction_count"}
)
_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
_DIGEST = re.compile(r"[0-9a-f]{64}")
_CURRENCY = re.compile(r"[A-Z]{3}")
_ARTIFACT = re.compile(r"[a-z0-9][a-z0-9_./-]{0,200}")
_EVIDENCE_GATE = object()

_EVENT_FIELDS = frozenset({"schema_id", "event_kind", "day", "route_family", "count"})
_SLOT_FIELDS = frozenset(
    {"slot", "status", "metrics", "evidence_digest", "artifact_ref", "imported_on"}
)


def _refuse(code: PrivacyRefusal, detail: str) -> PrivacyRefusalError:
    return PrivacyRefusalError(code, detail)


def require_day(value: object, detail: str = "day") -> str:
    if not isinstance(value, str) or _DAY.fullmatch(value) is None:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail)
    try:
        date.fromisoformat(value)
    except ValueError:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail) from None
    return value


def _safe_artifact_ref(value: object) -> bool:
    if not isinstance(value, str) or value == UNKNOWN:
        return False
    if ".." in value or "\\" in value or "://" in value or "?" in value or value.startswith("/"):
        return False
    return _ARTIFACT.fullmatch(value) is not None


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _check_metric(name: str, value: object, *, imported: bool) -> None:
    if value is None or value == "":
        raise _refuse(PrivacyRefusal.UNKNOWN_COLLAPSED, name)
    if isinstance(value, str) and value.upper() == "PASS":
        raise _refuse(PrivacyRefusal.PASS_SCORE_FORBIDDEN, name)
    if name == "currency":
        if value == UNKNOWN:
            return
        if not imported:
            raise _refuse(PrivacyRefusal.INVENTED_METRIC, name)
        if not isinstance(value, str) or _CURRENCY.fullmatch(value) is None:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, name)
        return
    if value == UNKNOWN:
        return
    if not _is_number(value):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, name)
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, name)
    if value < 0:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, name)
    if not imported:
        raise _refuse(PrivacyRefusal.INVENTED_METRIC, name)
    if name in _COUNT_METRICS and type(value) is not int:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, name)
    if name == "ctr" and value > 1:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, name)


def _unknown_metrics(slot: str) -> Mapping[str, str]:
    return MappingProxyType({name: UNKNOWN for name in SLOT_METRICS[slot]})


@dataclass(frozen=True)
class AggregateEvent:
    """One aggregate bucket. No user, prompt, or device field exists on this type."""

    schema_id: str
    event_kind: str
    day: str
    route_family: str
    count: int

    def __post_init__(self) -> None:
        if self.schema_id != SCHEMA_ID:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "schema_id")
        if self.event_kind not in EVENT_KINDS:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "event_kind")
        if self.route_family not in ROUTE_FAMILIES:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "route_family")
        require_day(self.day, "day")
        if type(self.count) is not int or self.count < 0:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "count")

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_id": self.schema_id,
            "event_kind": self.event_kind,
            "day": self.day,
            "route_family": self.route_family,
            "count": self.count,
        }


@dataclass(frozen=True)
class MeasurementSlot:
    """A measurement that stays UNKNOWN until evidence bytes are imported."""

    slot: str
    status: str
    metrics: Mapping[str, object]
    evidence_digest: str
    artifact_ref: str
    imported_on: str
    _import_token: object = field(default=None, compare=False, repr=False, hash=False)

    def __post_init__(self) -> None:
        if self.slot not in SLOT_METRICS:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "slot")
        if not isinstance(self.metrics, MappingProxyType):
            object.__setattr__(
                self, "metrics", MappingProxyType(dict(self.metrics))
            )
        if tuple(self.metrics) != SLOT_METRICS[self.slot]:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "metrics")
        if self.status == "PASS":
            raise _refuse(PrivacyRefusal.PASS_SCORE_FORBIDDEN, "status")
        if self.status not in ("UNKNOWN", "IMPORTED"):
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "status")
        imported = self.status == "IMPORTED"
        if imported and self._import_token is not _EVIDENCE_GATE:
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "import")
        for name, value in self.metrics.items():
            _check_metric(name, value, imported=imported)
        if not imported:
            for label, current in (
                ("evidence_digest", self.evidence_digest),
                ("artifact_ref", self.artifact_ref),
                ("imported_on", self.imported_on),
            ):
                if current != UNKNOWN:
                    raise _refuse(PrivacyRefusal.INVENTED_METRIC, label)
            return
        if not isinstance(self.evidence_digest, str) or _DIGEST.fullmatch(self.evidence_digest) is None:
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "evidence_digest")
        if not _safe_artifact_ref(self.artifact_ref):
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "artifact_ref")
        require_day(self.imported_on, "imported_on")
        if all(value == UNKNOWN for value in self.metrics.values()):
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "metrics")
        if not any(
            _is_number(value) for name, value in self.metrics.items() if name != "currency"
        ):
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "metrics")

    def to_dict(self) -> dict[str, object]:
        return {
            "slot": self.slot,
            "status": self.status,
            "metrics": dict(self.metrics),
            "evidence_digest": self.evidence_digest,
            "artifact_ref": self.artifact_ref,
            "imported_on": self.imported_on,
        }


def default_slots() -> tuple[MeasurementSlot, ...]:
    return tuple(
        MeasurementSlot(
            slot=slot,
            status="UNKNOWN",
            metrics=_unknown_metrics(slot),
            evidence_digest=UNKNOWN,
            artifact_ref=UNKNOWN,
            imported_on=UNKNOWN,
        )
        for slot in SLOT_IDS
    )


@dataclass(frozen=True)
class PrivacyAnalyticsRegistry:
    """Admitted aggregate events plus the three measurement slots."""

    schema_id: str
    events: tuple[AggregateEvent, ...]
    slots: tuple[MeasurementSlot, ...]

    def __post_init__(self) -> None:
        if self.schema_id != SCHEMA_ID:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "schema_id")
        if type(self.events) is not tuple or any(
            not isinstance(event, AggregateEvent) for event in self.events
        ):
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "events")
        if tuple(slot.slot for slot in self.slots) != SLOT_IDS:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "slots")

    def replace_slot(self, slot: MeasurementSlot) -> PrivacyAnalyticsRegistry:
        return PrivacyAnalyticsRegistry(
            schema_id=self.schema_id,
            events=self.events,
            slots=tuple(
                slot if current.slot == slot.slot else current for current in self.slots
            ),
        )


def empty_registry() -> PrivacyAnalyticsRegistry:
    """Registry with no events and every measurement UNKNOWN."""

    return PrivacyAnalyticsRegistry(
        schema_id=SCHEMA_ID,
        events=(),
        slots=default_slots(),
    )


def admit_event(payload: Mapping[str, object]) -> AggregateEvent:
    """Accept one aggregate event or raise the highest-priority refusal."""

    if not isinstance(payload, Mapping):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "payload")
    refusals = collect_refusals(payload)
    if refusals:
        raise PrivacyRefusalError(refusals[0], "payload")
    if set(payload) != _EVENT_FIELDS:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "fields")
    schema_id = payload["schema_id"]
    event_kind = payload["event_kind"]
    day = payload["day"]
    route_family = payload["route_family"]
    count = payload["count"]
    if (
        not isinstance(schema_id, str)
        or not isinstance(event_kind, str)
        or not isinstance(day, str)
        or not isinstance(route_family, str)
        or type(count) is not int
    ):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "fields")
    return AggregateEvent(
        schema_id=schema_id,
        event_kind=event_kind,
        day=day,
        route_family=route_family,
        count=count,
    )


def record_event(
    registry: PrivacyAnalyticsRegistry, payload: Mapping[str, object]
) -> PrivacyAnalyticsRegistry:
    """Return a new registry with the admitted event appended.

    The registry does not sum events into a live total.
    """

    event = admit_event(payload)
    return PrivacyAnalyticsRegistry(
        schema_id=registry.schema_id,
        events=registry.events + (event,),
        slots=registry.slots,
    )


def import_measurement(
    registry: PrivacyAnalyticsRegistry,
    slot: str,
    evidence_bytes: bytes,
    *,
    artifact_ref: str,
    imported_on: str,
) -> PrivacyAnalyticsRegistry:
    """Record metrics copied from evidence bytes.

    Evidence bytes are hashed and discarded. The artifact path is an audit
    label and is not opened. Omitted metrics stay UNKNOWN. Currency is not
    defaulted. Status becomes IMPORTED, which is not a success score.
    """

    if slot not in SLOT_METRICS:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "slot")
    if not isinstance(evidence_bytes, (bytes, bytearray)) or not bytes(evidence_bytes).strip():
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "evidence_bytes")
    evidence = bytes(evidence_bytes)
    ref_refusals = collect_refusals(artifact_ref)
    if ref_refusals:
        raise PrivacyRefusalError(ref_refusals[0], "artifact_ref")
    if not _safe_artifact_ref(artifact_ref):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "artifact_ref")
    require_day(imported_on, "imported_on")
    try:
        parsed = json.loads(evidence)
    except json.JSONDecodeError:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "evidence") from None
    parsed_refusals = collect_refusals(parsed)
    if parsed_refusals:
        raise PrivacyRefusalError(parsed_refusals[0], "evidence")
    if not isinstance(parsed, dict):
        raise _refuse(PrivacyRefusal.NOT_AGGREGATE, "evidence")
    if "source" not in parsed:
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "source")
    if parsed["source"] != slot:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "source")
    allowed = {"source", *SLOT_METRICS[slot]}
    if set(parsed) - allowed:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "evidence")
    metrics: dict[str, object] = {name: UNKNOWN for name in SLOT_METRICS[slot]}
    numeric = False
    for name in SLOT_METRICS[slot]:
        if name not in parsed or parsed[name] == UNKNOWN:
            continue
        _check_metric(name, parsed[name], imported=True)
        metrics[name] = parsed[name]
        if name != "currency":
            numeric = True
    if not numeric:
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "metrics")
    digest = hashlib.sha256(evidence).hexdigest()
    imported = MeasurementSlot(
        slot=slot,
        status="IMPORTED",
        metrics=metrics,
        evidence_digest=digest,
        artifact_ref=artifact_ref,
        imported_on=imported_on,
        _import_token=_EVIDENCE_GATE,
    )
    return registry.replace_slot(imported)


def is_default_slot_document(payload: Mapping[str, object]) -> bool:
    """True when a document is an UNKNOWN slot with no measurement values."""

    if set(payload) != _SLOT_FIELDS:
        return False
    slot = payload.get("slot")
    if slot not in SLOT_METRICS:
        return False
    if payload.get("status") != "UNKNOWN":
        return False
    if any(payload.get(label) != UNKNOWN for label in ("evidence_digest", "artifact_ref", "imported_on")):
        return False
    metrics = payload.get("metrics")
    if not isinstance(metrics, Mapping) or tuple(metrics) != SLOT_METRICS[slot]:
        return False
    return all(value == UNKNOWN for value in metrics.values())
