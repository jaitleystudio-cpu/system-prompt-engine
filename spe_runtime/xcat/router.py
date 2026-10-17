"""CategoryRouterIR — deterministic mission-stage routing (no LLM / network / randomness)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Mapping

from spe_runtime.xcat.auto_route import (
    derive_semantic_frames,
    explicit_category_keys_present,
    forged_category_values,
    is_auto_evidence,
)
from spe_runtime.xcat.models import CATEGORY_IDS

TWIN_VERSION = "xcat.router.v1"


@dataclass(frozen=True)
class CategoryRouterIR:
    routing_id: str
    twin_version: str
    primary_category: str | None
    secondary_categories: tuple[str, ...]
    confidence_basis: tuple[str, ...]
    category_evidence: tuple[Mapping[str, Any], ...]
    rejected_categories: tuple[str, ...]
    cross_category_dependencies: tuple[Mapping[str, Any], ...]
    escalation_conditions: tuple[str, ...]
    routing_receipt: Mapping[str, Any]
    disposition: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "routing_id": self.routing_id,
            "twin_version": self.twin_version,
            "primary_category": self.primary_category,
            "secondary_categories": list(self.secondary_categories),
            "confidence_basis": list(self.confidence_basis),
            "category_evidence": [dict(e) for e in self.category_evidence],
            "rejected_categories": list(self.rejected_categories),
            "cross_category_dependencies": [
                dict(d) for d in self.cross_category_dependencies
            ],
            "escalation_conditions": list(self.escalation_conditions),
            "routing_receipt": dict(self.routing_receipt),
            "disposition": self.disposition,
        }


def _canonical_bytes(evidence: Mapping[str, Any]) -> bytes:
    return json.dumps(evidence, sort_keys=True, separators=(",", ":"), default=str).encode(
        "utf-8"
    )


def _routing_id(evidence: Mapping[str, Any]) -> str:
    digest = hashlib.sha256(_canonical_bytes(evidence)).hexdigest()
    return f"route-{digest}"


def _as_category(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if candidate in CATEGORY_IDS:
        return candidate
    return None


def _collect_evidence_refs(evidence: Mapping[str, Any]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for key in ("category_ref", "primary_category", "stage_category", "xcat_id"):
        if key in evidence:
            refs.append({"key": key, "value": evidence.get(key)})
    stage = evidence.get("stage")
    if isinstance(stage, Mapping):
        for key in ("category_ref", "primary_category", "xcat_id"):
            if key in stage:
                refs.append({"key": f"stage.{key}", "value": stage.get(key)})
    explicit = evidence.get("category_evidence")
    if isinstance(explicit, list):
        for item in explicit:
            if isinstance(item, Mapping):
                refs.append(dict(item))
    return refs


def _auto_result(
    *,
    rid: str,
    primary: str | None,
    secondaries: tuple[str, ...],
    basis: tuple[str, ...],
    frames: tuple[Mapping[str, Any], ...],
    rejected: tuple[str, ...],
    deps: tuple[Mapping[str, Any], ...],
    escalation: tuple[str, ...],
    receipt_basis: str,
    disposition: str,
) -> dict[str, Any]:
    receipt: dict[str, Any] = {"routing_id": rid, "basis": receipt_basis}
    if primary is not None:
        receipt["primary_category"] = primary
        receipt["frame_acts"] = [str(frame.get("act")) for frame in frames]
    return CategoryRouterIR(
        routing_id=rid,
        twin_version=TWIN_VERSION,
        primary_category=primary,
        secondary_categories=secondaries,
        confidence_basis=basis,
        category_evidence=frames,
        rejected_categories=rejected,
        cross_category_dependencies=deps,
        escalation_conditions=escalation,
        routing_receipt=receipt,
        disposition=disposition,
    ).to_dict()


def _route_auto(evidence_map: dict[str, Any]) -> dict[str, Any]:
    """AUTO mode. Kernel frames govern. Caller category ids do not."""
    rid = _routing_id(evidence_map)
    goal = evidence_map.get("goal")
    goal_text = goal if isinstance(goal, str) else ""
    raw_structured = evidence_map.get("structured_evidence")
    structured: list[Mapping[str, Any]] = []
    if isinstance(raw_structured, list):
        structured = [item for item in raw_structured if isinstance(item, Mapping)]
    status, frames = derive_semantic_frames(goal_text, structured)
    frame_tuple = tuple(frames)
    forged = tuple(forged_category_values(evidence_map))
    if status == "conflict":
        rejected = tuple(
            dict.fromkeys(
                [str(frame.get("category")) for frame in frames if frame.get("category")] + list(forged)
            )
        )
        return _auto_result(
            rid=rid,
            primary=None,
            secondaries=(),
            basis=("CONFLICTING_CATEGORY_EVIDENCE",),
            frames=frame_tuple,
            rejected=rejected,
            deps=(),
            escalation=("CONFLICTING_CATEGORY_EVIDENCE",),
            receipt_basis="conflicting_category_evidence",
            disposition="UNKNOWN",
        )
    if not frames and forged:
        return _auto_result(
            rid=rid,
            primary=None,
            secondaries=(),
            basis=("SELF_SELECTED_WITHOUT_EVIDENCE",),
            frames=(),
            rejected=forged,
            deps=(),
            escalation=("REQUIRE_EXPLICIT_CATEGORY_EVIDENCE",),
            receipt_basis="rejected_self_selection",
            disposition="UNKNOWN",
        )
    if not frames:
        nonempty = bool(goal_text.strip())
        return _auto_result(
            rid=rid,
            primary=None,
            secondaries=(),
            basis=("AMBIGUOUS_REQUEST",) if nonempty else ("NO_EXPLICIT_CATEGORY_EVIDENCE",),
            frames=(),
            rejected=(),
            deps=(),
            escalation=("NEEDS_DISAMBIGUATION",),
            receipt_basis="ambiguous_request" if nonempty else "insufficient_evidence",
            disposition="NEEDS_DISAMBIGUATION",
        )
    primary = str(frames[0]["category"])
    secondaries = tuple(str(frame["category"]) for frame in frames[1:] if frame["category"] != primary)
    deps: tuple[Mapping[str, Any], ...] = ()
    if secondaries:
        deps = (
            {
                "from_category": primary,
                "relation": "COORDINATED_ACT",
                "to_category": secondaries[0],
            },
        )
    return _auto_result(
        rid=rid,
        primary=primary,
        secondaries=secondaries,
        basis=tuple(str(frame["act"]) for frame in frames),
        frames=frame_tuple,
        rejected=forged,
        deps=deps,
        escalation=(),
        receipt_basis="semantic_frame",
        disposition="ROUTED",
    )


def _display_label_bridge(display: str) -> str | None:
    """Explicit Research/Analysis product bridge. Not used for AUTO.

    Imported lazily because ``spe_runtime.k3`` package init imports this router.
    """
    from spe_runtime.k3.registry import DISPLAY_LABEL_XCAT

    bridged = DISPLAY_LABEL_XCAT.get(display)
    if isinstance(bridged, str):
        return bridged
    return None


def route_mission_stage(evidence: Mapping[str, Any]) -> dict[str, Any]:
    """Route from explicit evidence, or from kernel frames in AUTO mode.

    If category cannot be determined: disposition NEEDS_DISAMBIGUATION / UNKNOWN.
    Never default to C01. Reject self-selected category without evidence.
    ``AI Assistant`` is AUTO mode, not a category.
    """
    if not isinstance(evidence, Mapping):
        raise ValueError("evidence must be a mapping")

    evidence_map = dict(evidence)
    if is_auto_evidence(evidence_map):
        return _route_auto(evidence_map)
    rid = _routing_id(evidence_map)
    refs = _collect_evidence_refs(evidence_map)

    # Self-selected without supporting evidence is rejected.
    self_selected = evidence_map.get("self_selected_category")
    if self_selected is not None and not refs:
        result = CategoryRouterIR(
            routing_id=rid,
            twin_version=TWIN_VERSION,
            primary_category=None,
            secondary_categories=(),
            confidence_basis=("SELF_SELECTED_WITHOUT_EVIDENCE",),
            category_evidence=(),
            rejected_categories=((_as_category(self_selected) or str(self_selected)),),
            cross_category_dependencies=(),
            escalation_conditions=("REQUIRE_EXPLICIT_CATEGORY_EVIDENCE",),
            routing_receipt={
                "routing_id": rid,
                "basis": "rejected_self_selection",
            },
            disposition="UNKNOWN",
        )
        return result.to_dict()

    if not explicit_category_keys_present(evidence_map):
        display = evidence_map.get("display_label")
        if isinstance(display, str):
            bridged = _display_label_bridge(display.strip())
            if bridged:
                refs.append({"key": "display_label_bridge", "value": bridged})

    candidates: list[str] = []
    basis: list[str] = []
    for ref in refs:
        cat = _as_category(ref.get("value") if "value" in ref else ref.get("category"))
        if cat is not None and cat not in candidates:
            candidates.append(cat)
            basis.append(str(ref.get("key", "category_ref")))

    secondaries: list[str] = []
    raw_secondary = evidence_map.get("secondary_categories")
    if isinstance(raw_secondary, (list, tuple)):
        for item in raw_secondary:
            cat = _as_category(item)
            if cat is not None and cat not in secondaries and cat not in candidates[:1]:
                secondaries.append(cat)

    deps: list[dict[str, Any]] = []
    raw_deps = evidence_map.get("cross_category_dependencies")
    if isinstance(raw_deps, list):
        deps = [dict(d) for d in raw_deps if isinstance(d, Mapping)]

    if not candidates:
        result = CategoryRouterIR(
            routing_id=rid,
            twin_version=TWIN_VERSION,
            primary_category=None,
            secondary_categories=tuple(secondaries),
            confidence_basis=("NO_EXPLICIT_CATEGORY_EVIDENCE",),
            category_evidence=tuple(refs),
            rejected_categories=(),
            cross_category_dependencies=tuple(deps),
            escalation_conditions=("NEEDS_DISAMBIGUATION",),
            routing_receipt={
                "routing_id": rid,
                "basis": "insufficient_evidence",
            },
            disposition="NEEDS_DISAMBIGUATION",
        )
        return result.to_dict()

    primary = candidates[0]
    extras = tuple(c for c in candidates[1:] if c != primary) + tuple(secondaries)
    # Dedupe preserving order
    seen: set[str] = set()
    ordered_extra: list[str] = []
    for c in extras:
        if c not in seen and c != primary:
            seen.add(c)
            ordered_extra.append(c)

    result = CategoryRouterIR(
        routing_id=rid,
        twin_version=TWIN_VERSION,
        primary_category=primary,
        secondary_categories=tuple(ordered_extra),
        confidence_basis=tuple(basis) or ("EXPLICIT_CATEGORY_REF",),
        category_evidence=tuple(refs),
        rejected_categories=(),
        cross_category_dependencies=tuple(deps),
        escalation_conditions=(),
        routing_receipt={
            "routing_id": rid,
            "basis": "explicit_evidence",
            "primary_category": primary,
        },
        disposition="ROUTED",
    )
    return result.to_dict()
