"""Interaction inventory. Targets that would execute script are neutralized."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Interaction:
    kind: str
    node_id: str | None
    target: str | None
    method: str | None
    fields: tuple[str, ...]
    states_observed: tuple[str, ...]
    neutralized: bool

    def __post_init__(self) -> None:
        kinds = {
            "LINK",
            "BUTTON",
            "FORM",
            "FIELD",
            "DISCLOSURE",
            "DIALOG",
            "PSEUDO_STATE",
        }
        if self.kind not in kinds:
            raise ValueError(f"unknown interaction kind: {self.kind}")
        object.__setattr__(self, "fields", tuple(self.fields))
        object.__setattr__(self, "states_observed", tuple(self.states_observed))

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "node_id": self.node_id,
            "target": self.target,
            "method": self.method,
            "fields": list(self.fields),
            "states_observed": list(self.states_observed),
            "neutralized": self.neutralized,
        }
