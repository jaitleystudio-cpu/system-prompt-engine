"""Kernel semantic frames for CategoryRouterIR AUTO mode.

This module does not route. ``route_mission_stage`` is the only category
router. Frames are structured acts derived from the goal atom and from
ProjectIR fields that belong to exactly one founder category. The UI label
``AI Assistant`` is a mode flag. It is not evidence and it is not a category.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from spe_runtime.categories.payloads import CATEGORY_PAYLOAD_FIELDS

AUTO_LABEL = "AI Assistant"
AUTO_MODE = "AUTO"

_WS = re.compile(r"\s+")

_PREFIXES: tuple[str, ...] = (
    "i would like you to ",
    "i would like to ",
    "i'd like you to ",
    "i'd like to ",
    "i need you to ",
    "i want you to ",
    "could you ",
    "would you ",
    "i need to ",
    "i want to ",
    "can you ",
    "help me ",
    "please ",
    "kindly ",
)

# Phrase → closed act. Longer phrases win. Acts are not category ids.
_HEADS: tuple[tuple[str, str], ...] = (
    ("business offer", "business"),
    ("business plan", "business"),
    ("business case", "business"),
    ("career plan", "career"),
    ("investigate", "research"),
    ("communicate", "write"),
    ("storyboard", "multimedia"),
    ("translate", "translate"),
    ("recommend", "advise"),
    ("role-play", "creative"),
    ("carry out", "execute"),
    ("localize", "translate"),
    ("localise", "translate"),
    ("roleplay", "creative"),
    ("research", "research"),
    ("analyze", "analyze"),
    ("analyse", "analyze"),
    ("compare", "analyze"),
    ("extract", "analyze"),
    ("execute", "execute"),
    ("rewrite", "write"),
    ("program", "code"),
    ("business", "business"),
    ("advise", "advise"),
    ("decide", "advise"),
    ("career", "career"),
    ("debug", "code"),
    ("draft", "write"),
    ("learn", "learn"),
    ("study", "learn"),
    ("teach", "learn"),
    ("write", "write"),
    ("story", "creative"),
    ("code", "code"),
    ("plan", "advise"),
)

_ACT_CATEGORY: dict[str, str] = {
    "advise": "CAT:C01",
    "research": "CAT:C02",
    "write": "CAT:C03",
    "translate": "CAT:C04",
    "learn": "CAT:C05",
    "analyze": "CAT:C06",
    "execute": "CAT:C07",
    "business": "CAT:C08",
    "code": "CAT:C09",
    "multimedia": "CAT:C10",
    "career": "CAT:C11",
    "creative": "CAT:C12",
}

_FORGED_KEYS: tuple[str, ...] = (
    "xcat_id",
    "category_ref",
    "primary_category",
    "stage_category",
    "self_selected_category",
)


def _exclusive_fields() -> dict[str, str]:
    owners: dict[str, set[str]] = {}
    for category_id, fields in CATEGORY_PAYLOAD_FIELDS.items():
        for field in fields:
            owners.setdefault(field, set()).add(category_id)
    return {field: next(iter(cats)) for field, cats in owners.items() if len(cats) == 1}


EXCLUSIVE_FIELDS: dict[str, str] = _exclusive_fields()


def _norm(text: str) -> str:
    return _WS.sub(" ", text.strip().lower())


def _strip_prefixes(text: str) -> str:
    body = text
    changed = True
    while changed:
        changed = False
        for prefix in sorted(_PREFIXES, key=lambda item: (-len(item), item)):
            if body.startswith(prefix):
                body = body[len(prefix) :]
                changed = True
                break
    return body


def _sorted_heads() -> tuple[tuple[str, str], ...]:
    return tuple(sorted(_HEADS, key=lambda item: (-len(item[0]), item[0])))


def match_act_head(text: str) -> str | None:
    """Clause-initial act, or None. A longer token is not a match."""
    body = _strip_prefixes(_norm(text))
    if not body:
        return None
    for phrase, act in _sorted_heads():
        if not body.startswith(phrase):
            continue
        if len(body) == len(phrase) or not body[len(phrase)].isalnum():
            return act
    return None


def _goal_frames(goal: str) -> tuple[str, list[dict[str, Any]]]:
    """Return ``ok``/``none``/``conflict`` and kernel frames from the goal atom."""
    body = _strip_prefixes(_norm(goal))
    if not body:
        return "none", []
    if " or " in body:
        left, right = body.split(" or ", 1)
        if match_act_head(left) and match_act_head(right):
            return "conflict", []
    acts: list[str] = []
    for segment in body.split(" and "):
        act = match_act_head(segment)
        if act and (not acts or acts[-1] != act):
            acts.append(act)
    cats: list[str] = []
    chosen: list[tuple[str, str]] = []
    for act in acts:
        cat = _ACT_CATEGORY[act]
        if not cats or cats[-1] != cat:
            cats.append(cat)
            chosen.append((act, cat))
    if len(chosen) > 2:
        return "conflict", []
    frames = [_frame(act, cat, index, "goal") for index, (act, cat) in enumerate(chosen)]
    if not frames:
        return "none", []
    return "ok", frames


def _frame(act: str, category: str, ordinal: int, source_ref: str) -> dict[str, Any]:
    return {
        "act": act,
        "category": category,
        "key": "semantic_frame",
        "ordinal": ordinal,
        "provenance": "KERNEL_DERIVED",
        "source_ref": source_ref,
    }


def _structured_frames(objects: list[Mapping[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    chosen: list[str] = []
    for obj in objects:
        owners: set[str] = set()
        for key in obj:
            owner = EXCLUSIVE_FIELDS.get(str(key))
            if owner:
                owners.add(owner)
        if len(owners) > 1:
            return "conflict", []
        if len(owners) == 1:
            cat = next(iter(owners))
            if cat not in chosen:
                chosen.append(cat)
    if len(chosen) > 2:
        return "conflict", []
    frames = [_frame("project_ir", cat, index, "structured_evidence") for index, cat in enumerate(chosen)]
    return "ok", frames


def derive_semantic_frames(
    goal: str,
    structured: list[Mapping[str, Any]] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Derive frames. Status is ``ok``, ``none``, or ``conflict``.

    Prose is only the goal atom, and only a clause-initial act counts.
    The matched characters are not stored on the frame.
    """
    prose_status, prose = _goal_frames(goal)
    struct_status, structured_frames = _structured_frames(list(structured or []))
    if prose_status == "conflict" or struct_status == "conflict":
        return "conflict", prose or structured_frames
    prose_cats = [item["category"] for item in prose]
    struct_cats = [item["category"] for item in structured_frames]
    if prose_cats and struct_cats and prose_cats != struct_cats:
        return "conflict", prose + structured_frames
    if prose:
        return "ok", prose
    if structured_frames:
        return "ok", structured_frames
    return "none", []


def structured_evidence_from_graph(graph: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """ProjectIR-shaped node values. Rendering ``category_ref`` nodes are skipped."""
    if not isinstance(graph, Mapping):
        return []
    body = graph.get("graph")
    if not isinstance(body, Mapping):
        return []
    nodes = body.get("nodes")
    if not isinstance(nodes, Mapping):
        return []
    # Lazy: portability package init reaches category modules that import XCAT.
    from spe_runtime.portability.canonical import canonical_dumps

    objects: list[dict[str, Any]] = []
    for node in nodes.values():
        if not isinstance(node, Mapping):
            continue
        if node.get("semantic_key") == "category_ref":
            continue
        value = node.get("value")
        if isinstance(value, Mapping) and not isinstance(value, str):
            objects.append(dict(value))
    objects.sort(key=canonical_dumps)
    return objects


def is_auto_evidence(evidence: Mapping[str, Any]) -> bool:
    if evidence.get("routing_mode") == AUTO_MODE:
        return True
    label = evidence.get("display_label")
    return isinstance(label, str) and label.strip() == AUTO_LABEL


def explicit_category_keys_present(evidence: Mapping[str, Any]) -> bool:
    for key in _FORGED_KEYS:
        if key in evidence and evidence.get(key) not in (None, ""):
            return True
    stage = evidence.get("stage")
    if isinstance(stage, Mapping):
        for key in ("category_ref", "primary_category", "xcat_id"):
            if key in stage and stage.get(key) not in (None, ""):
                return True
    return False


def forged_category_values(evidence: Mapping[str, Any]) -> list[str]:
    found: list[str] = []

    def add(value: object) -> None:
        if isinstance(value, str):
            text = value.strip()
        elif value is None:
            return
        else:
            text = str(value).strip()
        if text and text not in found:
            found.append(text)

    for key in _FORGED_KEYS:
        if key in evidence and evidence.get(key) not in (None, ""):
            add(evidence.get(key))
    stage = evidence.get("stage")
    if isinstance(stage, Mapping):
        for key in ("category_ref", "primary_category", "xcat_id"):
            if key in stage and stage.get(key) not in (None, ""):
                add(stage.get(key))
    raw = evidence.get("category_evidence")
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, Mapping):
                continue
            for key in ("value", "category", "proof"):
                if key in item:
                    add(item.get(key))
    return found


def build_auto_evidence(
    protected: Mapping[str, Any] | None,
    category: Mapping[str, Any] | None,
    graph: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Canonical AUTO evidence. Caller category ids are carried only to be rejected."""
    source = dict(protected or {})
    label_source = dict(category or {})
    label = label_source.get("display_label")
    display = label.strip() if isinstance(label, str) else ""
    goal = source.get("goal")
    evidence: dict[str, Any] = {
        "display_label": display,
        "goal": goal if isinstance(goal, str) else "",
        "routing_mode": AUTO_MODE,
        "structured_evidence": structured_evidence_from_graph(graph),
    }
    xcat = label_source.get("xcat_id")
    if isinstance(xcat, str) and xcat.strip():
        evidence["xcat_id"] = xcat.strip()
    return evidence
