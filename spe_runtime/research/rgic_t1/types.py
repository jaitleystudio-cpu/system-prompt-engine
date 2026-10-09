"""
Canonical Types and Invariants for RGIC-T1 Tri-Origin Counterfactual Harness.
Part of SPE Ω Research Quarantine.

Enforces:
1. Strict origin categorization (Goal G, World W, Verifier V, Unmodeled).
2. Cryptographic prediction precommitment.
3. Exact integer NanoUSD cost & risk representations.
4. Distinguishability records with observational equivalence tracking.
5. Retractable knowledge DAG representations.
"""

from enum import Enum, IntFlag
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, field
import hashlib
import json


class OriginClass(str, Enum):
    GOAL = "GOAL"                  # Discrepancy in goal interpretation (G)
    WORLD = "WORLD"                # Discrepancy in world dynamics / environment (W)
    VERIFIER = "VERIFIER"          # Discrepancy in evaluation harness / test adequacy (V)
    OTHER_OR_UNMODELED = "OTHER_OR_UNMODELED"  # Open-world unmodeled uncertainty


class FailureOrigin(IntFlag):
    NONE = 0
    GOAL = 1                       # Goal interpretation divergence (G)
    WORLD = 2                      # World dynamics drift (W)
    VERIFIER = 4                   # Verifier inadequacy (V)
    UNMODELED = 8                  # Open-world unmodeled uncertainty
    GOAL_AND_WORLD = GOAL | WORLD  # Compound G + W
    GOAL_AND_VERIFIER = GOAL | VERIFIER  # Compound G + V
    WORLD_AND_VERIFIER = WORLD | VERIFIER  # Compound W + V
    TRI_ORIGIN = GOAL | WORLD | VERIFIER  # Joint G + W + V


@dataclass(frozen=True)
class Hypothesis:
    """
    A candidate causal explanation for an observed discrepancy.
    """
    id: str
    origin_class: OriginClass
    description: str
    # Pre-registered predictions: mapping from probe_id to expected observation dictionary
    predicted_outcomes: Dict[str, Dict[str, Any]]
    prior_probability: float = 0.333


@dataclass(frozen=True)
class PrecommitmentLock:
    """
    Cryptographic seal locking in hypotheses and predictions before a probe is executed.
    Prevents HARKing (Hypothesizing After Results are Known).
    """
    probe_id: str
    commitment_hash: str
    timestamp_ns: int
    salt: str


@dataclass
class DiagnosticProbe:
    """
    A controlled counterfactual intervention or measurement.
    """
    id: str
    description: str
    cost_nano_usd: int           # Exact integer NanoUSD
    risk_score: int              # Integer basis points (0 to 1,000)
    expected_entropy_reduction: int  # Integer units (1 to 1,000)
    is_authorized: bool = True
    # Optional executable intervention
    run: Optional[Callable[[], Dict[str, Any]]] = None


@dataclass(frozen=True)
class DistinguishabilityRecord:
    """
    The formal .spe research artifact recording the diagnostic experiment.
    """
    id: str
    discrepancy_id: str
    evaluated_hypotheses: List[str]
    selected_probe_id: str
    precommitment_hash: str
    observation: Dict[str, Any]
    discriminated_origins: List[OriginClass]
    eliminated_hypotheses: List[str]
    remaining_hypotheses: List[str]
    is_identifiable: bool
    status: str  # DISCRIMINATED, UNIDENTIFIABLE, INVALID_RUN, ABORTED


class EpistemicNodeState(str, Enum):
    VALID = "VALID"
    REQUALIFICATION_REQUIRED = "REQUALIFICATION_REQUIRED"
    INVALIDATED = "INVALIDATED"


@dataclass
class EpistemicNode:
    """
    A node in the Directed Acyclic Epistemic Dependency Graph (DAEDG).
    """
    id: str
    node_type: str  # OBSERVATION, MECHANISM, CAPABILITY, QUALIFICATION
    state: EpistemicNodeState = EpistemicNodeState.VALID
    description: str = ""
    dependencies: List[str] = field(default_factory=list)  # IDs of upstream nodes this node depends on
