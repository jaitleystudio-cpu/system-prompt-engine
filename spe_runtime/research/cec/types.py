"""
SPE Ω — Constraint-and-Evidence Conservation (CEC) Core Types & Schemas.
Formalizes conserved contracts, content-addressable obligation records,
information security lattices, environment fingerprints, and transition witnesses.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional, Set

from spe_runtime.ci_gate.receipt import rfc8785_canonicalize


class Disposition(str, Enum):
    """Lifecycle and verification disposition of a tracked obligation."""
    OPEN                   = "OPEN"
    IN_PROGRESS            = "IN_PROGRESS"
    VERIFIED               = "VERIFIED"
    FAILED                 = "FAILED"
    UNKNOWN                = "UNKNOWN"
    STALE_RECHECK_REQUIRED = "STALE_RECHECK_REQUIRED"


class InformationLabel(str, Enum):
    """Information security confidentiality lattice."""
    PUBLIC       = "PUBLIC"
    INTERNAL     = "INTERNAL"
    RESTRICTED   = "RESTRICTED"
    CONFIDENTIAL = "CONFIDENTIAL"
    AIR_GAPPED   = "AIR_GAPPED"

    def rank(self) -> int:
        ranks = {
            InformationLabel.PUBLIC: 0,
            InformationLabel.INTERNAL: 1,
            InformationLabel.RESTRICTED: 2,
            InformationLabel.CONFIDENTIAL: 3,
            InformationLabel.AIR_GAPPED: 4,
        }
        return ranks.get(self, 0)


@dataclass(frozen=True)
class EnvironmentFingerprint:
    """Hardware and software environment envelope governing evidence validity."""
    os_name: str
    git_commit: str
    runtime_version: str
    tool_digest: str
    epoch_timestamp: float = 0.0

    def canonical_digest(self) -> str:
        d = {
            "os": self.os_name,
            "git": self.git_commit,
            "runtime": self.runtime_version,
            "tools": self.tool_digest,
        }
        return hashlib.sha256(rfc8785_canonicalize(d)).hexdigest()


@dataclass(frozen=True)
class ObligationRecord:
    """
    Tracked obligation in a conserved contract.
    Content-addressed by the SHA-256 hash of its normative specification.
    """
    obligation_id: str
    requirement_ref: str
    predicate_spec: Dict[str, Any]
    disposition: Disposition = Disposition.OPEN
    assigned_agent_id: Optional[str] = None
    witness_receipt_ref: Optional[str] = None
    is_mandatory: bool = True

    @staticmethod
    def compute_content_id(requirement_ref: str, predicate_spec: Dict[str, Any]) -> str:
        """Computes immutable RFC 8785 content address for an obligation."""
        payload = {
            "ref": requirement_ref,
            "spec": predicate_spec,
        }
        return f"obl-{hashlib.sha256(rfc8785_canonicalize(payload)).hexdigest()[:16]}"


@dataclass
class ConservedContract:
    """
    Portable .spe conserved contract companion.
    Preserves obligations, authority, privacy, and evidence across heterogeneous model handoffs.
    """
    contract_id: str
    protected_intent_ref: str
    root_commitment: str
    obligations: Dict[str, ObligationRecord]
    permitted_authorities: Set[str]
    information_label: InformationLabel = InformationLabel.INTERNAL
    environment_fingerprint: Optional[EnvironmentFingerprint] = None
    parent_contract_id: Optional[str] = None
    delegation_depth: int = 0
    transition_witness_ref: Optional[str] = None
    schema_version: str = "research-0.1"

    def canonical_hash(self) -> str:
        """Computes cryptographic digest of contract state."""
        ob_dicts = {}
        for k, v in sorted(self.obligations.items()):
            ob_dicts[k] = {
                "id": v.obligation_id,
                "ref": v.requirement_ref,
                "disp": v.disposition.value,
                "mand": v.is_mandatory,
                "witness": v.witness_receipt_ref or "",
            }

        payload = {
            "contract_id": self.contract_id,
            "intent": self.protected_intent_ref,
            "root_commitment": self.root_commitment,
            "obligations": ob_dicts,
            "authorities": sorted(list(self.permitted_authorities)),
            "label": self.information_label.value,
            "env": self.environment_fingerprint.canonical_digest() if self.environment_fingerprint else "",
            "depth": self.delegation_depth,
            "version": self.schema_version,
        }
        return hashlib.sha256(rfc8785_canonicalize(payload)).hexdigest()


@dataclass(frozen=True)
class TransitionWitness:
    """
    Cryptographic or structural proof justifying a contract transition T(S_i, S_j).
    """
    witness_id: str
    source_contract_id: str
    target_contract_id: str
    source_hash: str
    target_hash: str
    transition_type: str            # "DELEGATION", "MODEL_HANDOFF", "MERGE_JOIN", "SUMMARIZATION"
    issuer_agent_id: str
    signature: str = ""
    timestamp_iso: str = ""
    reconciliation_details: Dict[str, Any] = field(default_factory=dict)
