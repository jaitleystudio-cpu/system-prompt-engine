"""Canonical implementation of the Capability Capsule chi = (P, C, G, W, I, T, R)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

import jsonschema

SCHEMA_PATH = (
    Path(__file__).resolve().parents[2]
    / "schemas"
    / "capability_capsule.schema.json"
)


class AdmissionState(str, Enum):
    HYPOTHESIS = "HYPOTHESIS"
    STRUCTURALLY_VALID = "STRUCTURALLY_VALID"
    BEHAVIORALLY_QUALIFIED = "BEHAVIORALLY_QUALIFIED"
    TRANSFER_QUALIFIED = "TRANSFER_QUALIFIED"
    DEPLOYMENT_ELIGIBLE = "DEPLOYMENT_ELIGIBLE"
    SUSPENDED = "SUSPENDED"
    REJECTED = "REJECTED"


class ProcedureFormat(str, Enum):
    AST_JSON = "ast_json"
    PYTHON_SANDBOX = "python_sandbox"
    WASM_BYTES = "wasm_bytes"


@dataclass(frozen=True)
class ProcedurePayload:
    format: ProcedureFormat
    entrypoint: str
    payload: str
    sha256: str = field(default="")

    def __post_init__(self) -> None:
        if not self.sha256:
            computed = hashlib.sha256(self.payload.encode("utf-8")).hexdigest()
            object.__setattr__(self, "sha256", computed)
        elif len(self.sha256) != 64:
            raise ValueError(f"Invalid sha256 hash length: {len(self.sha256)}")


@dataclass(frozen=True)
class CapabilityContracts:
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    deterministic: bool = True
    allowed_effects: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class CapabilityGuards:
    applicability_conditions: List[str] = field(default_factory=list)
    invalidation_conditions: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class CapabilityWitness:
    witness_id: str
    verified_at: str
    proof_type: str
    hash: str


@dataclass(frozen=True)
class CausalInterventions:
    trial_count: int
    active_success_rate: float
    baseline_success_rate: float
    placebo_success_rate: float
    lcb_95_delta: float
    early_stopped: bool = False


@dataclass(frozen=True)
class TransferMatrix:
    qualified_models: List[str] = field(default_factory=list)
    rejected_models: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class RevocationRules:
    dependency_hashes: Dict[str, str] = field(default_factory=dict)
    max_drift_tolerance: float = 0.05


@dataclass
class CapabilityCapsule:
    capsule_id: str
    name: str
    version: str
    admission_state: AdmissionState
    procedure: ProcedurePayload
    contracts: CapabilityContracts
    guards: CapabilityGuards
    witnesses: List[CapabilityWitness]
    interventions: CausalInterventions
    transfer: TransferMatrix
    revocation_rules: RevocationRules

    def to_dict(self) -> Dict[str, Any]:
        """Serialize capsule to canonical JSON dictionary."""
        return {
            "capsule_id": self.capsule_id,
            "name": self.name,
            "version": self.version,
            "admission_state": self.admission_state.value,
            "procedure": {
                "format": self.procedure.format.value,
                "entrypoint": self.procedure.entrypoint,
                "payload": self.procedure.payload,
                "sha256": self.procedure.sha256,
            },
            "contracts": {
                "input_schema": self.contracts.input_schema,
                "output_schema": self.contracts.output_schema,
                "deterministic": self.contracts.deterministic,
                "allowed_effects": list(self.contracts.allowed_effects),
            },
            "guards": {
                "applicability_conditions": list(self.guards.applicability_conditions),
                "invalidation_conditions": list(self.guards.invalidation_conditions),
            },
            "witnesses": [
                {
                    "witness_id": w.witness_id,
                    "verified_at": w.verified_at,
                    "proof_type": w.proof_type,
                    "hash": w.hash,
                }
                for w in self.witnesses
            ],
            "interventions": {
                "trial_count": self.interventions.trial_count,
                "active_success_rate": self.interventions.active_success_rate,
                "baseline_success_rate": self.interventions.baseline_success_rate,
                "placebo_success_rate": self.interventions.placebo_success_rate,
                "lcb_95_delta": self.interventions.lcb_95_delta,
                "early_stopped": self.interventions.early_stopped,
            },
            "transfer": {
                "qualified_models": list(self.transfer.qualified_models),
                "rejected_models": list(self.transfer.rejected_models),
            },
            "revocation_rules": {
                "dependency_hashes": dict(self.revocation_rules.dependency_hashes),
                "max_drift_tolerance": self.revocation_rules.max_drift_tolerance,
            },
        }

    def validate_schema(self) -> None:
        """Validate current state against JSON schema."""
        if not SCHEMA_PATH.exists():
            raise FileNotFoundError(f"Missing schema file at {SCHEMA_PATH}")
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        jsonschema.validate(instance=self.to_dict(), schema=schema)

    def transition_to(self, new_state: AdmissionState, reason: str = "") -> None:
        """Apply lifecycle state transitions according to admissible rules."""
        valid_transitions = {
            AdmissionState.HYPOTHESIS: {
                AdmissionState.STRUCTURALLY_VALID,
                AdmissionState.REJECTED,
            },
            AdmissionState.STRUCTURALLY_VALID: {
                AdmissionState.BEHAVIORALLY_QUALIFIED,
                AdmissionState.REJECTED,
            },
            AdmissionState.BEHAVIORALLY_QUALIFIED: {
                AdmissionState.TRANSFER_QUALIFIED,
                AdmissionState.DEPLOYMENT_ELIGIBLE,
                AdmissionState.REJECTED,
            },
            AdmissionState.TRANSFER_QUALIFIED: {
                AdmissionState.DEPLOYMENT_ELIGIBLE,
                AdmissionState.SUSPENDED,
                AdmissionState.REJECTED,
            },
            AdmissionState.DEPLOYMENT_ELIGIBLE: {
                AdmissionState.SUSPENDED,
                AdmissionState.REJECTED,
            },
            AdmissionState.SUSPENDED: {
                AdmissionState.DEPLOYMENT_ELIGIBLE,
                AdmissionState.REJECTED,
            },
            AdmissionState.REJECTED: set(),
        }

        allowed = valid_transitions.get(self.admission_state, set())
        if new_state not in allowed:
            raise ValueError(
                f"Illegal state transition from {self.admission_state.value} to {new_state.value}. (Reason: {reason})"
            )

        self.admission_state = new_state
