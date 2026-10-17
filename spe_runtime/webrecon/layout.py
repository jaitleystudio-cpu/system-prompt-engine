"""Layout tree. Element structure only. Event handlers and field values are not stored."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LayoutAttribute:
    name: str
    value: str

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "value": self.value}


@dataclass(frozen=True)
class LayoutNode:
    """One element in source order. Children are elements, not a browser box tree."""

    node_id: str
    tag: str
    attributes: tuple[LayoutAttribute, ...]
    text_excerpt: str | None
    children: tuple[LayoutNode, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "tag": self.tag,
            "attributes": [attr.to_dict() for attr in self.attributes],
            "text_excerpt": self.text_excerpt,
            "children": [child.to_dict() for child in self.children],
        }
