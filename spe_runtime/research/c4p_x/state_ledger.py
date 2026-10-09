"""
SPE Ω — C4P-X+ State Ledger Schema.
Implements execution state Sigma = (F, D, W, A, E, Q) with RFC 8785 canonical JSON digests.
"""
from dataclasses import dataclass, field
from typing import Dict, Set, List, Optional, Any
import hashlib
import json

from .kernel_repaired import EvidenceStatus, EffectStatus

@dataclass
class RecordedFact:
    fact_id: str
    key: str
    value: Any
    digest: str
    is_deterministic: bool
    dependencies: Set[str] = field(default_factory=set)
    evidence_status: EvidenceStatus = EvidenceStatus.INSUFFICIENT_OR_UNKNOWN
    source_model_version: Optional[str] = None

    def to_canonical_dict(self) -> Dict[str, Any]:
        return {
            "dependencies": sorted(list(self.dependencies)),
            "digest": self.digest,
            "evidence_status": self.evidence_status.value,
            "fact_id": self.fact_id,
            "is_deterministic": self.is_deterministic,
            "key": self.key,
            "source_model_version": self.source_model_version,
            "value": self.value if isinstance(self.value, (int, float, str, bool, list, dict, type(None))) else str(self.value),
        }

@dataclass
class SideEffectRecord:
    action_id: str
    target: str
    status: EffectStatus
    payload_digest: str

@dataclass
class ExecutionStateSigma:
    facts: Dict[str, RecordedFact] = field(default_factory=dict)
    active_leases: Set[str] = field(default_factory=set)
    side_effects: List[SideEffectRecord] = field(default_factory=list)
    unfulfilled_obligations: Set[str] = field(default_factory=set)
    total_raw_transcript_tokens: int = 0

    def compute_state_digest(self) -> str:
        """Computes RFC 8785 canonical JSON SHA-256 digest of current verified facts."""
        canonical_facts = [
            f.to_canonical_dict()
            for f in sorted(self.facts.values(), key=lambda x: x.fact_id)
        ]
        payload = {
            "facts": canonical_facts,
            "unfulfilled_obligations": sorted(list(self.unfulfilled_obligations)),
        }
        raw_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(raw_bytes).hexdigest()
