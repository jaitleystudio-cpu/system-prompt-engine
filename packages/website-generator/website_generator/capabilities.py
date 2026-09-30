"""Honest capability answers for work this package does not do."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class CapabilityHold:
    """A non-PASS result. UNKNOWN and HOLD are not success."""

    status: Literal["UNSUPPORTED", "HOLD"]
    capability: str
    reason: str
    network_mode: Literal["NONE"] = "NONE"

    @property
    def passed(self) -> bool:
        return False


def sandbox_preview(_spec: Any = None) -> CapabilityHold:
    """Interactive sandbox is not implemented."""
    return CapabilityHold(
        status="UNSUPPORTED",
        capability="sandbox",
        reason=(
            "Interactive sandbox is out of scope for website-generator v1. "
            "compile_site emits static HTML and CSS offline."
        ),
    )


def hosted_export(_spec: Any = None) -> CapabilityHold:
    """Hosting and deploy stay refused."""
    return CapabilityHold(
        status="HOLD",
        capability="hosted_export",
        reason=(
            "Hosting and deploy are forbidden. "
            "write_static writes local files only and does not publish them."
        ),
    )
