"""Minimal scholarly search query.

Only the topic may leave SPE. Private sections, profiles, uploaded
documents, project context, and the private_context argument are withheld.
The withheld text is not stored on the evidence package.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_SECTION = re.compile(
    r"^(TOPIC|PRIVATE|PROFILE|DOCUMENT|CONTEXT|CONSTRAINT|UPLOAD)\s*:\s*(.*)$",
    re.IGNORECASE,
)
_PRIVATE_LABELS = frozenset(
    {"PRIVATE", "PROFILE", "DOCUMENT", "CONTEXT", "CONSTRAINT", "UPLOAD"}
)
_EMAIL = re.compile(r"\b[^@\s]+@[^@\s]+\.[^@\s]+\b")
_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_MRN = re.compile(r"\bMRN[:\s#-]*\d{4,}\b", re.IGNORECASE)


@dataclass(frozen=True)
class ScholarlySearchQuery:
    """Outbound topic plus the labels of material that stayed inside SPE."""

    outbound_topic: str
    private_withheld: bool
    withheld_labels: tuple[str, ...]


def _collapse(parts: list[str]) -> str:
    return " ".join(piece for part in parts for piece in part.split())


def _redact_patterns(topic: str) -> tuple[str, tuple[str, ...]]:
    labels: list[str] = []
    cleaned = topic
    if _SSN.search(cleaned):
        cleaned = _SSN.sub(" ", cleaned)
        labels.append("REDACTED_SSN")
    if _EMAIL.search(cleaned):
        cleaned = _EMAIL.sub(" ", cleaned)
        labels.append("REDACTED_EMAIL")
    if _MRN.search(cleaned):
        cleaned = _MRN.sub(" ", cleaned)
        labels.append("REDACTED_MRN")
    return _collapse([cleaned]), tuple(labels)


def minimize_scholarly_query(raw: str) -> ScholarlySearchQuery:
    """Derive the only string a scholarly source is allowed to receive."""
    lines = raw.splitlines() or [raw]
    sections: list[tuple[str, list[str]]] = []
    label = ""
    body: list[str] = []
    labeled = False
    for line in lines:
        match = _SECTION.match(line.strip())
        if match is None:
            body.append(line)
            continue
        labeled = True
        sections.append((label, body))
        label = match.group(1).upper()
        rest = match.group(2)
        body = [rest] if rest else []
    sections.append((label, body))
    if not labeled:
        topic, redactions = _redact_patterns(_collapse([raw]))
        return ScholarlySearchQuery(
            outbound_topic=topic,
            private_withheld=bool(redactions),
            withheld_labels=redactions,
        )
    topics: list[str] = []
    withheld: list[str] = []
    for section_label, section_body in sections:
        text = _collapse(section_body)
        if section_label == "TOPIC":
            if text:
                topics.append(text)
            continue
        if section_label in _PRIVATE_LABELS:
            withheld.append(section_label)
            continue
        if text:
            withheld.append("UNLABELED")
    topic, redactions = _redact_patterns(_collapse(topics))
    labels = tuple(dict.fromkeys((*withheld, *redactions)))
    return ScholarlySearchQuery(
        outbound_topic=topic,
        private_withheld=bool(labels),
        withheld_labels=labels,
    )
