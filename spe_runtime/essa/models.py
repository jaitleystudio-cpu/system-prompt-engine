"""Data models for Epistemic Static Single Assignment (ESSA)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class EpistemicStatus(str, Enum):
    """The truth/validity state in the epistemic lattice."""
    VALID = "VALID"
    INVALID = "INVALID"
    PROVISIONAL = "PROVISIONAL"
    UNKNOWN = "UNKNOWN"


class EpistemicNodeType(str, Enum):
    """Type of epistemic value in the execution graph."""
    CLAIM = "CLAIM"
    ASSUMPTION = "ASSUMPTION"
    OBSERVATION = "OBSERVATION"
    TOOL_RESULT = "TOOL_RESULT"
    AUTHORITY_GRANT = "AUTHORITY_GRANT"
    CONCLUSION = "CONCLUSION"


@dataclass(frozen=True)
class ESSANode:
    """An immutable, versioned semantic register in ESSA form."""
    register_id: str
    node_type: EpistemicNodeType
    content: Any
    status: EpistemicStatus = EpistemicStatus.VALID
    confidence: float = 1.0
    dependencies: Set[str] = field(default_factory=set)
    provenance_digest: str = ""
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    metadata: Dict[str, Any] = field(default_factory=dict)

    def compute_digest(self) -> str:
        payload = {
            "register_id": self.register_id,
            "node_type": self.node_type.value,
            "content": str(self.content),
            "dependencies": sorted(list(self.dependencies)),
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


@dataclass
class InvalidationResult:
    """Outcome of cascading dependency invalidation across an ESSA graph."""
    root_cause_register: str
    reason: str
    invalidated_registers: List[str]
    preserved_registers: List[str]
    salvaged_compute_ratio: float
