"""Privacy qualification checklist.

Structural laws are ENCODED. Measurement rows stay UNKNOWN until an import.
The verdict is never a success score, and missing measurements stay UNKNOWN.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from spe_runtime.privacy.analytics import (
    PrivacyAnalyticsRegistry,
    admit_event,
    empty_registry,
    is_default_slot_document,
)
from spe_runtime.privacy.refusals import (
    PrivacyRefusal,
    PrivacyRefusalError,
    collect_refusals,
    unique_refusals,
)

STRUCTURAL_LAWS: tuple[tuple[str, str, str], ...] = (
    ("PA-01", "aggregate_only", "Events are counts over closed public buckets."),
    ("PA-02", "no_user_level_tracking", "User, session, device, and cookie identifiers are refused."),
    ("PA-03", "no_raw_prompt_storage", "Raw prompts are refused and are not stored."),
    ("PA-04", "no_fingerprinting", "Browser and device fingerprints are refused."),
    ("PA-05", "no_third_party_ad_beacons", "Third-party ad beacons and click ids are refused."),
    ("PA-06", "no_user_content", "User content fields are refused."),
    ("PA-07", "no_identifiers", "Emails, network addresses, and account identifiers are refused."),
    ("PA-08", "no_pass_scores", "Success scores and numeric grades are refused."),
    ("PA-09", "no_invented_metrics", "Missing measurements stay UNKNOWN."),
)
MEASUREMENT_LAWS: tuple[tuple[str, str, str], ...] = (
    ("PA-10", "search_console", "Search Console stays UNKNOWN until a real import with evidence."),
    ("PA-11", "core_web_vitals", "Core Web Vitals stay UNKNOWN until a real import with evidence."),
    ("PA-12", "revenue", "Revenue stays UNKNOWN until a real import with evidence."),
)


@dataclass(frozen=True)
class ChecklistItem:
    id: str
    name: str
    disposition: str
    law: str

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "name": self.name,
            "disposition": self.disposition,
            "law": self.law,
        }


@dataclass(frozen=True)
class QualificationReport:
    """Checklist result. `verdict` is ARCHITECTURE_HOLD, EVIDENCE_RECORDED, or REFUSED."""

    verdict: str
    items: tuple[ChecklistItem, ...]
    refusals: tuple[PrivacyRefusal, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "verdict": self.verdict,
            "items": [item.to_dict() for item in self.items],
            "refusals": [code.value for code in self.refusals],
        }


def qualification_checklist(
    registry: PrivacyAnalyticsRegistry | None = None,
    candidate: object = None,
) -> QualificationReport:
    """Qualify the registry and, when given, an untrusted candidate payload."""

    current = empty_registry() if registry is None else registry
    refusals: tuple[PrivacyRefusal, ...] = ()
    if candidate is not None:
        refusals = _assess_candidate(candidate)
    items: list[ChecklistItem] = [
        ChecklistItem(item_id, name, "ENCODED", law)
        for item_id, name, law in STRUCTURAL_LAWS
    ]
    for (item_id, name, law), slot in zip(MEASUREMENT_LAWS, current.slots, strict=True):
        disposition = "UNKNOWN" if slot.status == "UNKNOWN" else "EVIDENCE_RECORDED"
        items.append(ChecklistItem(item_id, name, disposition, law))
    if refusals:
        verdict = "REFUSED"
    elif any(slot.status == "IMPORTED" for slot in current.slots):
        verdict = "EVIDENCE_RECORDED"
    else:
        verdict = "ARCHITECTURE_HOLD"
    return QualificationReport(verdict=verdict, items=tuple(items), refusals=refusals)


def registry_document(registry: PrivacyAnalyticsRegistry) -> dict[str, object]:
    """Closed document for the registry. It carries no success score."""

    report = qualification_checklist(registry)
    return {
        "schema_id": registry.schema_id,
        "events": [event.to_dict() for event in registry.events],
        "slots": [slot.to_dict() for slot in registry.slots],
        "qualification": report.to_dict(),
    }


def _assess_candidate(candidate: object) -> tuple[PrivacyRefusal, ...]:
    found = list(collect_refusals(candidate))
    if not isinstance(candidate, Mapping):
        if not found:
            found.append(PrivacyRefusal.SCHEMA_INVALID)
        return unique_refusals(found)
    keys = set(candidate)
    if keys & {"event_kind", "route_family", "count"}:
        try:
            admit_event(candidate)
        except PrivacyRefusalError as exc:
            found.append(exc.code)
    elif keys & {"slot", "metrics", "status"}:
        found.extend(_assess_slot_document(candidate))
    elif not found:
        found.append(PrivacyRefusal.SCHEMA_INVALID)
    return unique_refusals(found)


def _assess_slot_document(payload: Mapping[str, object]) -> list[PrivacyRefusal]:
    codes: list[PrivacyRefusal] = []
    status = payload.get("status")
    if isinstance(status, str) and status.upper() == "PASS":
        codes.append(PrivacyRefusal.PASS_SCORE_FORBIDDEN)
    metrics = payload.get("metrics")
    if isinstance(metrics, Mapping):
        for value in metrics.values():
            if value is None or value == "":
                codes.append(PrivacyRefusal.UNKNOWN_COLLAPSED)
            elif isinstance(value, (int, float)) and not isinstance(value, bool):
                if status == "IMPORTED":
                    codes.append(PrivacyRefusal.EVIDENCE_REQUIRED)
                else:
                    codes.append(PrivacyRefusal.INVENTED_METRIC)
    if status == "IMPORTED":
        codes.append(PrivacyRefusal.EVIDENCE_REQUIRED)
    if status == "UNKNOWN" and not codes:
        if not is_default_slot_document(payload):
            codes.append(PrivacyRefusal.SCHEMA_INVALID)
    elif not codes:
        codes.append(PrivacyRefusal.SCHEMA_INVALID)
    return codes
