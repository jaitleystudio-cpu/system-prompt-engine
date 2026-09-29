"""AUTO-XCAT — deterministic task→category receipt (xcat.auto.v1).

Explicit CAT:Cxx evidence still routes, including unrecovered C04/C05/C08–C12.
English and product names for those categories do not mint an id.
Generic Create tasks without a recovered signal stay NEEDS_DISAMBIGUATION.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Mapping

from spe_runtime.xcat.models import CATEGORY_IDS
from spe_runtime.xcat.router import route_mission_stage

# Mirrors spe_runtime.k3.registry display maps. Tests lock Research/Analysis
# to DISPLAY_LABEL_XCAT. Writing is receipt-only and is not a K3 xcat bridge.
_DISPLAY_LABEL_XCAT = {
    "Research": "CAT:C02",
    "Analysis": "CAT:C06",
}
_DISPLAY_LABEL_PROTOCOL = {
    "AI Assistant": "general",
    "Writing": "writing_communication",
    "Coding": "coding",
    "Research": "research",
    "Business": "business_strategy",
    "Education": "education",
    "Analysis": "data_statistics",
    "Structured Data": "data_statistics",
    "Creative": "creative_media",
    "Multilingual": "translation_localization",
    "Website / 3D": "ux_ui_web_design",
    "Image": "image_generation",
    "Video": "video_generation",
}

TWIN_VERSION = "xcat.auto.v1"
EFFECT_PLAN_SENTINEL = "NO_EFFECT_PLAN"

RECOVERED_CATEGORY_IDS = frozenset(
    {"CAT:C01", "CAT:C02", "CAT:C03", "CAT:C06", "CAT:C07"}
)
RECOVERED_SHORT_IDS = frozenset({"C01", "C02", "C03", "C06", "C07"})
HOLD_DISPOSITIONS = frozenset({"NEEDS_DISAMBIGUATION", "PROTOCOL_HOLD", "UNKNOWN"})

_EVIDENCE_KEYS = (
    "category_ref",
    "primary_category",
    "stage_category",
    "xcat_id",
    "self_selected_category",
    "secondary_categories",
    "category_evidence",
    "cross_category_dependencies",
    "stage",
)
_FLAG_ORDER = (
    ("needs_retrieval", "CAT:C02"),
    ("needs_comparison", "CAT:C06"),
    ("needs_revision", "CAT:C03"),
    ("needs_execution_prep", "CAT:C07"),
)
_UNRECOVERED_DISPLAY = frozenset(
    {
        "Coding",
        "Business",
        "Education",
        "Creative",
        "Multilingual",
        "Website / 3D",
        "Image",
        "Video",
    }
)
_UNRECOVERED_PROTOCOLS = frozenset(
    {
        "coding",
        "business_strategy",
        "education",
        "creative_media",
        "translation_localization",
        "ux_ui_web_design",
        "image_generation",
        "video_generation",
    }
)
_UNRECOVERED_TOKENS = frozenset(
    {
        "translate",
        "localize",
        "learn",
        "business",
        "code",
        "coding",
        "multimedia",
        "career",
        "creative",
        "story",
        "roleplay",
        "image",
        "video",
        "multilingual",
        "education",
    }
)
_GOAL_GROUPS = (
    ("CAT:C01", frozenset({"decide", "decision", "advise", "recommend"})),
    ("CAT:C02", frozenset({"research"})),
    ("CAT:C03", frozenset({"write", "rewrite", "draft"})),
    ("CAT:C06", frozenset({"analyze", "analyse", "compare", "extract"})),
)
_TOKEN_SPLIT = re.compile(r"[^0-9A-Za-z]+")


def _strip(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _raw_bool(task: Mapping[str, Any], name: str) -> bool | None:
    value = task.get(name)
    if isinstance(value, bool):
        return value
    return None


def _explicit_evidence(category: Mapping[str, Any]) -> dict[str, Any]:
    return {key: category[key] for key in _EVIDENCE_KEYS if key in category}


def _protocol(category: Mapping[str, Any], display: str | None) -> str | None:
    raw = _strip(category.get("protocol_domain_id"))
    if raw is not None:
        return raw
    if display is not None and display in _DISPLAY_LABEL_PROTOCOL:
        return _DISPLAY_LABEL_PROTOCOL[display]
    return None


def _tokens(goal: str) -> list[str]:
    return [part for part in _TOKEN_SPLIT.split(goal.lower()) if part]


def _routing_id(payload: Mapping[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return "auto-" + hashlib.sha256(raw).hexdigest()


def _receipt(
    *,
    routing_id: str,
    primary: str | None,
    disposition: str,
    protocol_status: str,
    basis: list[str],
    presentation_label: str | None,
    protocol_domain_id: str | None,
    rejected_names: list[str],
) -> dict[str, Any]:
    return {
        "claims_pass": False,
        "confidence_basis": list(basis),
        "disposition": disposition,
        "effect_plan": EFFECT_PLAN_SENTINEL,
        "execution_authorized": False,
        "presentation_label": presentation_label,
        "primary_category": primary,
        "protocol_domain_id": protocol_domain_id,
        "protocol_status": protocol_status,
        "rejected_names": list(rejected_names),
        "routing_id": routing_id,
        "twin_version": TWIN_VERSION,
    }


def auto_route_task(
    category: Mapping[str, Any] | None = None,
    task: Mapping[str, Any] | None = None,
    goal: str = "",
) -> dict[str, Any]:
    """Lawful category receipt. Does not select techniques or authorize execution."""
    category_map = dict(category) if isinstance(category, Mapping) else {}
    task_map = dict(task) if isinstance(task, Mapping) else {}
    goal_text = goal if isinstance(goal, str) else ""
    display = _strip(category_map.get("display_label"))
    protocol = _protocol(category_map, display)
    evidence = _explicit_evidence(category_map)
    flags = {name: _raw_bool(task_map, name) for name, _category_id in _FLAG_ORDER}
    routing_id = _routing_id(
        {
            "display_label": display,
            "explicit_evidence": evidence,
            "goal": goal_text,
            "protocol_domain_id": protocol,
            "task_flags": flags,
        }
    )

    def finish(
        primary: str | None,
        disposition: str,
        protocol_status: str,
        basis: list[str],
        rejected: list[str] | None = None,
    ) -> dict[str, Any]:
        return _receipt(
            routing_id=routing_id,
            primary=primary,
            disposition=disposition,
            protocol_status=protocol_status,
            basis=basis,
            presentation_label=display,
            protocol_domain_id=protocol,
            rejected_names=rejected or [],
        )

    if evidence:
        routed = route_mission_stage(evidence)
        if routed["disposition"] == "ROUTED":
            primary = routed["primary_category"]
            if not isinstance(primary, str) or primary not in CATEGORY_IDS:
                return finish(None, "UNKNOWN", "ABSENT", ["EXPLICIT_CATEGORY_EVIDENCE"])
            status = "RECOVERED" if primary in RECOVERED_CATEGORY_IDS else "NOT_RECOVERED"
            return finish(primary, "ROUTED", status, ["EXPLICIT_CATEGORY_EVIDENCE"])
        if routed["disposition"] == "UNKNOWN":
            rejected = [str(item) for item in routed.get("rejected_categories") or []]
            return finish(None, "UNKNOWN", "ABSENT", ["SELF_SELECTED_WITHOUT_EVIDENCE"], rejected)

    if display == "Writing":
        return finish("CAT:C03", "ROUTED", "RECOVERED", ["AUTO_WRITING_BRIDGE"])
    if display in _DISPLAY_LABEL_XCAT:
        primary = _DISPLAY_LABEL_XCAT[display]
        status = "RECOVERED" if primary in RECOVERED_CATEGORY_IDS else "NOT_RECOVERED"
        return finish(primary, "ROUTED", status, ["DISPLAY_LABEL_XCAT"])

    rejected_names: list[str] = []
    if display in _UNRECOVERED_DISPLAY:
        rejected_names.append(display)
    if protocol in _UNRECOVERED_PROTOCOLS and protocol not in rejected_names:
        rejected_names.append(protocol)
    if rejected_names:
        return finish(
            None,
            "PROTOCOL_HOLD",
            "NOT_RECOVERED",
            ["UNRECOVERED_PROTOCOL_NOT_INFERRED_FROM_NAME"],
            rejected_names,
        )

    fired = [name for name, _category_id in _FLAG_ORDER if flags[name] is True]
    if len(fired) > 1:
        return finish(None, "NEEDS_DISAMBIGUATION", "ABSENT", ["MULTIPLE_RECOVERED_SIGNALS"], fired)
    if len(fired) == 1:
        primary = dict(_FLAG_ORDER)[fired[0]]
        return finish(primary, "ROUTED", "RECOVERED", ["STRUCTURED_TASK_FLAG"])

    tokens = _tokens(goal_text)
    blocked = sorted({token for token in tokens if token in _UNRECOVERED_TOKENS})
    if blocked:
        return finish(
            None,
            "PROTOCOL_HOLD",
            "NOT_RECOVERED",
            ["UNRECOVERED_GOAL_TOKEN"],
            blocked,
        )
    groups = [category_id for category_id, words in _GOAL_GROUPS if any(token in words for token in tokens)]
    if len(groups) == 1:
        return finish(groups[0], "ROUTED", "RECOVERED", ["RECOVERED_GOAL_TOKEN"])
    if len(groups) > 1:
        return finish(None, "NEEDS_DISAMBIGUATION", "ABSENT", ["NO_RECOVERED_CATEGORY_SIGNAL"], groups)
    return finish(None, "NEEDS_DISAMBIGUATION", "ABSENT", ["NO_RECOVERED_CATEGORY_SIGNAL"])
