"""Website X-Ray intermediate representation.

The IR records structural observations from an authorized capture.
It has no semantic authority and it does not integrate with K3.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.webrecon.assets import Asset
from spe_runtime.webrecon.breakpoints import Breakpoint
from spe_runtime.webrecon.html_css import DocumentMetadata
from spe_runtime.webrecon.interactions import Interaction
from spe_runtime.webrecon.isolation import IsolationReport
from spe_runtime.webrecon.layout import LayoutNode
from spe_runtime.webrecon.motion import MotionDescription
from spe_runtime.webrecon.typography import TypographyToken
from spe_runtime.webrecon.webgl import WebGlObservation

IR_ID = "spe.webrecon.website-xray.v1"


@dataclass(frozen=True)
class WebsiteXRay:
    """Observed structure of one captured page. Missing facts stay unobserved."""

    ir_id: str
    observation_id: str
    source_url: str
    url_identity: str
    fragment: str | None
    authorization_id: str
    captured_at: str | None
    document_digest: str
    semantic_authority: str
    network_performed: bool
    isolation: IsolationReport
    metadata: DocumentMetadata
    assets: tuple[Asset, ...]
    layout: LayoutNode
    typography: tuple[TypographyToken, ...]
    breakpoints: tuple[Breakpoint, ...]
    interactions: tuple[Interaction, ...]
    motion: MotionDescription
    webgl: WebGlObservation
    gaps: tuple[str, ...]
    taint_labels: tuple[str, ...]

    def __post_init__(self) -> None:
        if self.ir_id != IR_ID:
            raise ValueError(f"ir_id must be {IR_ID}")
        object.__setattr__(self, "semantic_authority", "NONE")
        object.__setattr__(self, "network_performed", False)
        object.__setattr__(self, "gaps", tuple(self.gaps))
        object.__setattr__(self, "taint_labels", tuple(dict.fromkeys(self.taint_labels)))

    def to_dict(self) -> dict[str, Any]:
        return {
            "ir_id": self.ir_id,
            "observation_id": self.observation_id,
            "source_url": self.source_url,
            "url_identity": self.url_identity,
            "fragment": self.fragment,
            "authorization_id": self.authorization_id,
            "captured_at": self.captured_at,
            "document_digest": self.document_digest,
            "semantic_authority": "NONE",
            "network_performed": False,
            "isolation": self.isolation.to_dict(),
            "metadata": self.metadata.to_dict(),
            "assets": [asset.to_dict() for asset in self.assets],
            "layout": self.layout.to_dict(),
            "typography": [token.to_dict() for token in self.typography],
            "breakpoints": [item.to_dict() for item in self.breakpoints],
            "interactions": [item.to_dict() for item in self.interactions],
            "motion": self.motion.to_dict(),
            "webgl": self.webgl.to_dict(),
            "gaps": list(self.gaps),
            "taint_labels": list(self.taint_labels),
        }
