"""
SPE Ω PRO (CWC-1: Counterfactual Witness Compilation) Data Models and Contracts.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class MechanismClass(str, Enum):
    CAUSAL_DAG = "CAUSAL_DAG"
    EQUATION_SYSTEM = "EQUATION_SYSTEM"
    ALGORITHMIC_PROGRAM = "ALGORITHMIC_PROGRAM"
    BIOCHEMICAL_PATHWAY = "BIOCHEMICAL_PATHWAY"
    MATERIALS_PHASE_TRANSITION = "MATERIALS_PHASE_TRANSITION"


class IdentifiabilityStatus(str, Enum):
    UNIQUE_IDENTIFIED = "UNIQUE_IDENTIFIED"
    OBSERVATIONALLY_EQUIVALENT = "OBSERVATIONALLY_EQUIVALENT"
    FORMALLY_UNIDENTIFIABLE = "FORMALLY_UNIDENTIFIABLE"
    UNDERDETERMINED = "UNDERDETERMINED"


class ScientificWitnessType(str, Enum):
    FORMAL_PROOF = "FORMAL_PROOF"
    EMPIRICAL_REPLICATION = "EMPIRICAL_REPLICATION"
    INTERVENTIONAL_EXPERIMENT = "INTERVENTIONAL_EXPERIMENT"
    NEGATIVE_FALSIFICATION = "NEGATIVE_FALSIFICATION"


class QualificationState(str, Enum):
    CANDIDATE_UNPROVEN = "CANDIDATE_UNPROVEN"
    EXPERIMENTALLY_VALIDATED = "EXPERIMENTALLY_VALIDATED"
    TRANSFER_QUALIFIED_REUSABLE = "TRANSFER_QUALIFIED_REUSABLE"
    QUARANTINED_FALSIFIED = "QUARANTINED_FALSIFIED"


@dataclass(frozen=True)
class ExplanatoryMechanism:
    """Represents a formal candidate scientific mechanism explaining observed phenomena."""
    mechanism_id: str
    name: str
    mechanism_class: MechanismClass
    hypothesis: str
    assumptions: Tuple[str, ...]
    causal_edges: Tuple[Tuple[str, str], ...]
    equations: Tuple[str, ...]
    predictions: Dict[str, float]  # mapping condition -> expected scalar value
    falsification_conditions: Tuple[str, ...]
    prior_weight: float  # w_i in [0, 1]


@dataclass(frozen=True)
class InterventionalAction:
    """Represents a candidate experimental intervention do(a) to discriminate mechanisms."""
    action_id: str
    target_variable: str
    intervention_value: float
    description: str
    is_authorized: bool
    cost_nanos: int  # Exact integer NanoUSD ($1.00 USD = 1,000,000,000 nanos)
    risk_nanos: int
    expected_information_gain: float  # EIG in bits
    expected_value_sample_info: float  # EVSI
    falsification_potential: float  # FR in [0, 1]


@dataclass(frozen=True)
class PrecommitmentDigest:
    """Cryptographic commitment locking predictions prior to experiment execution (Anti-HARKing)."""
    digest_sha256: str
    action_id: str
    timestamp_utc: str
    nonce: str
    sealed_predictions_hash: str


@dataclass(frozen=True)
class ObservationWitness:
    """Tangible experimental or computational measurement receipt."""
    observation_id: str
    action_id: str
    measured_variable: str
    observed_value: float
    standard_error: float
    is_negative_control: bool
    reproducible_artifact_uri: str
    timestamp_utc: str


@dataclass(frozen=True)
class ScientificWitness:
    """Immutable, cryptographically sealed scientific witness proof."""
    witness_id: str
    witness_type: ScientificWitnessType
    claim_statement: str
    mechanism_id: str
    supporting_observations: Tuple[str, ...]
    sha256_seal: str
    truth_status: str  # SUPPORTED, CONTRADICTED, UNKNOWN
    is_reproducible: bool
    biosecurity_screen_passed: bool


@dataclass(frozen=True)
class ReusableScientificProcedure:
    """Compounding capability qualified for transfer across unfamiliar task families."""
    procedure_id: str
    name: str
    formal_method: str
    underlying_mechanism_id: str
    qualification_state: QualificationState
    transfer_pass_rate: float
    unseen_tasks_evaluated: int
    cryptographic_seal: str
    conditions_of_applicability: Tuple[str, ...]
    known_counterexamples: Tuple[str, ...]


@dataclass(frozen=True)
class Cwc1Result:
    """End-to-end outcome of CWC-1 Counterfactual Witness Compilation."""
    mission_title: str
    competing_mechanisms: Tuple[ExplanatoryMechanism, ...]
    identifiability_status: IdentifiabilityStatus
    total_variation_gap: float
    selected_action: Optional[InterventionalAction]
    jensen_shannon_disagreement: float
    precommitment: Optional[PrecommitmentDigest]
    scientific_witness: Optional[ScientificWitness]
    reusable_procedure: Optional[ReusableScientificProcedure]
    productivity_gain_g: float
    total_cost_nanos: int
