"""Data models for SPE Ω Causal-Serializable Intelligence Fabric (CSI)."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


class LatticeState(str, Enum):
    """Epistemic lattice state of a semantic register."""
    VALID = "VALID"
    INVALID = "INVALID"
    PROVISIONAL = "PROVISIONAL"
    UNKNOWN = "UNKNOWN"


@dataclass
class SemanticRegister:
    """An immutable, versioned semantic register in the Epistemic Address Space (EAS)."""
    reg_id: str
    term: Any
    version: int = 1
    dependencies: List[str] = field(default_factory=list)
    validity_predicate: Optional[Callable[[Any], bool]] = None
    authority_lease: Optional[str] = None
    lattice_state: LatticeState = LatticeState.VALID
    timestamp_iso: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    provenance: Dict[str, Any] = field(default_factory=dict)

    def is_valid(self) -> bool:
        if self.lattice_state != LatticeState.VALID:
            return False
        if self.validity_predicate and not self.validity_predicate(self.term):
            return False
        return True


@dataclass
class SemanticWorkingSet:
    """A minimal paged subset of the Epistemic Address Space for model execution."""
    page_id: str
    registers: Dict[str, SemanticRegister] = field(default_factory=dict)
    pinned_obligations: List[str] = field(default_factory=list)
    estimated_tokens: int = 0

    def get_register(self, reg_id: str) -> SemanticRegister:
        if reg_id not in self.registers:
            raise PageFaultInterrupt(f"Semantic Page Fault: Register '{reg_id}' not in working set page {self.page_id}")
        return self.registers[reg_id]


class PageFaultInterrupt(Exception):
    """Raised when execution references an un-paged semantic register."""


@dataclass
class CounterfactualCommitCertificate:
    """Cryptographic C^4 certificate proving causal grounding and invariance."""
    certificate_id: str
    tx_id: str
    prerequisites_tested: List[str]
    sensitivity_passed: bool
    invariance_passed: bool
    is_grounded: bool
    signer_key_id: str
    payload_digest: str
    signature_hex: str
    timestamp_iso: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


@dataclass
class EffectProposal:
    """Proposed physical side-effect awaiting audit at the Irreversible Effect Barrier."""
    proposal_id: str
    action: str
    target_resource: str
    payload: Dict[str, Any]
    amount_usd: float = 0.0
    authority_grant_id: Optional[str] = None
    required_registers: List[str] = field(default_factory=list)


@dataclass
class SemanticTransaction:
    """An atomic epistemic transaction against the Epistemic Address Space."""
    tx_id: str
    snapshot_timestamp: float
    read_set: Dict[str, int] = field(default_factory=dict)  # reg_id -> version observed
    proposed_writes: Dict[str, Tuple[Any, List[str]]] = field(default_factory=dict)  # reg_id -> (term, deps)
    obligations: List[str] = field(default_factory=list)
    authority_grants: List[str] = field(default_factory=list)
    proposed_effects: List[EffectProposal] = field(default_factory=list)
    committed: bool = False
    aborted: bool = False
    abort_reason: Optional[str] = None
    c4_certificate: Optional[CounterfactualCommitCertificate] = None
