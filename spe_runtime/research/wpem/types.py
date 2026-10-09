"""
SPE Ω — Witness-Preserving Execution Morphing (WPEM) Core Types & Algebra.
Formalizes admissible execution transformations, hardware state envelopes,
and the governing admissibility predicate.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional, Set

from spe_runtime.research.wdes.types import (
    PredicateValue,
    VerificationVerdict,
    NanoUSD,
    validate_nanos,
    NetworkPolicy,
    SecurityLabel,
    ConfidentialityLevel,
)
from spe_runtime.ci_gate.receipt import rfc8785_canonicalize


class TransformationType(str, Enum):
    """The five admissible WPEM execution transformations."""
    MODEL_TO_PROGRAM       = "MODEL_TO_PROGRAM"       # T1: Repetitive reasoning -> deterministic code ($0)
    PROGRAM_TO_PROCEDURE   = "PROGRAM_TO_PROCEDURE"   # T2: Repeated work -> qualified cached procedure ($0)
    LARGE_TO_SMALL_MODEL   = "LARGE_TO_SMALL_MODEL"   # T3: Heavy model -> local SLM within capability envelope
    SELECTIVE_RECHECK      = "SELECTIVE_RECHECK"      # T4: Full graph re-exec -> dependency-sliced delta
    HONEST_DEFERRAL        = "HONEST_DEFERRAL"        # T5: Unsafe under pressure -> qualified partial result + delta


class AdmissibilityStatus(str, Enum):
    """Admissibility outcome under Admissible(P, H_t, K, O, A, E)."""
    ADMITTED = "ADMITTED"
    REJECTED = "REJECTED"
    DEFERRED = "DEFERRED"


@dataclass(frozen=True)
class HardwareEnvelope:
    """
    Hardware state H_t at time t.
    Supplied by DeviceProfiler or host OS metrics.
    """
    timestamp_ms: float
    thermal_state: str                  # "NOMINAL", "FAIR", "SERIOUS", "CRITICAL"
    available_memory_bytes: int        # Free RAM/Unified memory
    accelerator_available: bool         # Metal / CUDA / NPU active
    battery_level_pct: float            # 0.0 to 100.0
    is_charging: bool = True
    cpu_utilization_pct: float = 0.0

    def requires_downscaling(self) -> bool:
        """Determines if current thermal/power pressure forbids heavy models."""
        return self.thermal_state in ("SERIOUS", "CRITICAL") or (self.battery_level_pct < 15.0 and not self.is_charging)

    def memory_headroom_satisfied(self, required_bytes: int, multiplier: float = 1.5) -> bool:
        """Enforces the 1.5x memory headroom rule to prevent OS swap thrashing."""
        return self.available_memory_bytes >= int(required_bytes * multiplier)


@dataclass(frozen=True)
class TransformationRecord:
    """
    Registered execution transformation in WPEM library.
    Records applicability bounds, evidence requirements, and requalification triggers.
    """
    transformation_id: str
    transformation_type: TransformationType
    source_operation: str
    target_operation: str
    preconditions: Dict[str, Any]
    obligation_mapping: Dict[str, str]       # Map of obligations accounted for
    evidence_requirements: List[str]         # Evidence required to justify target
    privacy_boundary: NetworkPolicy
    required_memory_bytes: int
    estimated_api_cost_nanos: NanoUSD = 0
    estimated_latency_ms: float = 10.0
    estimated_energy_mj: int = 50            # Millijoules
    counterexamples: List[str] = field(default_factory=list)
    requalification_triggers: List[str] = field(default_factory=list)

    def __post_init__(self):
        validate_nanos(self.estimated_api_cost_nanos, "estimated_api_cost_nanos")

    def canonical_hash(self) -> str:
        d = {
            "id": self.transformation_id,
            "type": self.transformation_type.value,
            "source": self.source_operation,
            "target": self.target_operation,
            "preconditions": self.preconditions,
            "obligations": self.obligation_mapping,
            "evidence": sorted(self.evidence_requirements),
            "privacy": self.privacy_boundary.value,
            "memory": self.required_memory_bytes,
            "cost_nanos": self.estimated_api_cost_nanos,
        }
        return hashlib.sha256(rfc8785_canonicalize(d)).hexdigest()


@dataclass
class ExecutionPlanNode:
    """A computational step in candidate execution plan P."""
    node_id: str
    operation_name: str
    is_deterministic: bool
    is_committed: bool = False               # 2PC Isolation: committed nodes CANNOT be morphed
    required_memory_bytes: int = 100_000_000
    estimated_cost_nanos: NanoUSD = 0
    estimated_latency_ms: float = 50.0
    estimated_energy_mj: int = 100
    accounted_obligations: Set[str] = field(default_factory=set)
    required_authority: Set[str] = field(default_factory=lambda: {"LOCAL_EXECUTION"})
    network_policy: NetworkPolicy = NetworkPolicy.AIR_GAPPED


@dataclass
class CandidateExecutionPlan:
    """Complete candidate plan P evaluated by WPEM."""
    plan_id: str
    nodes: List[ExecutionPlanNode]
    total_cost_nanos: NanoUSD = 0
    total_latency_ms: float = 0.0
    total_energy_mj: int = 0

    def __post_init__(self):
        self.total_cost_nanos = sum(n.estimated_cost_nanos for n in self.nodes)
        self.total_latency_ms = sum(n.estimated_latency_ms for n in self.nodes)
        self.total_energy_mj = sum(n.estimated_energy_mj for n in self.nodes)

    def all_accounted_obligations(self) -> Set[str]:
        obs = set()
        for n in self.nodes:
            obs.update(n.accounted_obligations)
        return obs
