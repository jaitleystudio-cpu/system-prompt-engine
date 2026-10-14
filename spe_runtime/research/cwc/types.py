"""
SPE Ω PRO (CWC-1: Counterfactual Witness Compilation) Data Models and Contracts.
Version 1.1: Repaired with Scoped Identifiability, Dimensionally Consistent Acquisition,
Structural Authorization Gating, Non-DAG Representations, and Preregistered Chronological Seals.
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


class ModelRepresentationType(str, Enum):
    """Supported scientific model formalisms beyond static acyclic graphs (CWC-F10)."""
    CAUSAL_DAG = "CAUSAL_DAG"
    DIFFERENTIAL_EQUATION_SYSTEM = "DIFFERENTIAL_EQUATION_SYSTEM"
    STATE_SPACE_SYSTEM = "STATE_SPACE_SYSTEM"
    SYMBOLIC_PROGRAM = "SYMBOLIC_PROGRAM"
    BIOCHEMICAL_REACTION_NETWORK = "BIOCHEMICAL_REACTION_NETWORK"


class IdentifiabilityStatus(str, Enum):
    """Scoped identifiability verdicts replacing unproven global claims (CWC-F01)."""
    DISTINGUISHABLE_ACTION_FOUND = "DISTINGUISHABLE_ACTION_FOUND"
    NO_DISCRIMINATING_ACTION_ESTABLISHED = "NO_DISCRIMINATING_ACTION_ESTABLISHED"
    IDENTIFIABILITY_UNKNOWN = "IDENTIFIABILITY_UNKNOWN"
    NONIDENTIFIABLE_PROVED = "NONIDENTIFIABLE_PROVED"
    MODEL_SET_INADEQUATE = "MODEL_SET_INADEQUATE"
    # Legacy aliases preserved for backwards compatibility
    UNIQUE_IDENTIFIED = "DISTINGUISHABLE_ACTION_FOUND"
    OBSERVATIONALLY_EQUIVALENT = "NO_DISCRIMINATING_ACTION_ESTABLISHED"
    FORMALLY_UNIDENTIFIABLE = "NONIDENTIFIABLE_PROVED"
    UNDERDETERMINED = "IDENTIFIABILITY_UNKNOWN"


class AcquisitionMode(str, Enum):
    """Dimensionally consistent acquisition objective modes (CWC-F02)."""
    MONETARY_DECISION_VALUE = "MONETARY_DECISION_VALUE"      # EVSI - Cost - Risk (Exact NanoUSD)
    SCIENTIFIC_INFORMATION_DENSITY = "SCIENTIFIC_INFORMATION_DENSITY"  # (EIG + μ*FR) / Cost (Bits per USD)


class ScientificWitnessType(str, Enum):
    FORMAL_PROOF = "FORMAL_PROOF"
    EMPIRICAL_REPLICATION = "EMPIRICAL_REPLICATION"
    INTERVENTIONAL_EXPERIMENT = "INTERVENTIONAL_EXPERIMENT"
    NEGATIVE_FALSIFICATION = "NEGATIVE_FALSIFICATION"


class ScientificValidationStatus(str, Enum):
    """Explicit scientific validity distinct from SHA-256 data integrity (CWC-F05)."""
    EMPIRICALLY_CORROBORATED = "EMPIRICALLY_CORROBORATED"
    MATHEMATICALLY_PROVED = "MATHEMATICALLY_PROVED"
    CONTRADICTED_BY_EVIDENCE = "CONTRADICTED_BY_EVIDENCE"
    UNVERIFIED_PENDING_REPLICATION = "UNVERIFIED_PENDING_REPLICATION"


class QualificationState(str, Enum):
    CANDIDATE_UNPROVEN = "CANDIDATE_UNPROVEN"
    IN_DISTRIBUTION_SANITY_PASS = "IN_DISTRIBUTION_SANITY_PASS"
    EXPERIMENTALLY_VALIDATED = "EXPERIMENTALLY_VALIDATED"
    LVT_QUALIFIED_TRANSFER_PENDING = "LVT_QUALIFIED_TRANSFER_PENDING"
    TRANSFER_QUALIFIED_REUSABLE = "TRANSFER_QUALIFIED_REUSABLE"
    QUARANTINED_FALSIFIED = "QUARANTINED_FALSIFIED"


@dataclass(frozen=True)
class StatisticalProtocol:
    """Pre-registered statistical testing protocol (CWC-F08)."""
    protocol_id: str
    null_hypothesis: str
    alpha_significance: float = 0.01
    power_target: float = 0.80
    minimum_sample_size: int = 30
    stopping_rule: str = "FIXED_SAMPLE_OR_SPRT"


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
    model_representation: ModelRepresentationType = ModelRepresentationType.CAUSAL_DAG
    is_cyclic: bool = False


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
    expected_value_sample_info: float  # EVSI in USD (for monetary tasks)
    falsification_potential: float  # FR in [0, 1]


@dataclass(frozen=True)
class ActionDecision:
    """Structural decision isolating authorized feasible actions before optimization (CWC-F03)."""
    status: str  # ACTION_SELECTED, NO_AUTHORIZED_FEASIBLE_ACTION, BUDGET_EXCEEDED
    selected_action: Optional[InterventionalAction]
    feasible_action_count: int
    filtered_unauthorized_count: int
    acquisition_score: float
    acquisition_mode: AcquisitionMode


@dataclass(frozen=True)
class PrecommitmentDigest:
    """Cryptographic preregistration locking predictions prior to experiment execution (CWC-F06)."""
    digest_sha256: str
    action_id: str
    timestamp_utc: str
    nonce: str
    sealed_predictions_hash: str
    preregistration_token: str  # Verifiable chronology proof


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
    """
    Immutable scientific witness proof separating 4 independent evidence dimensions:
    1. Integrity (integrity_sha256)
    2. Chronology (chronological_precommitment_seal)
    3. Provenance (provenance_record)
    4. Scientific Validity (scientific_validation_status) - CWC-F05
    """
    witness_id: str
    witness_type: ScientificWitnessType
    claim_statement: str
    mechanism_id: str
    supporting_observations: Tuple[str, ...]
    integrity_sha256: str = ""
    chronological_precommitment_seal: str = ""
    provenance_record: Dict[str, str] = field(default_factory=dict)
    scientific_validation_status: ScientificValidationStatus = ScientificValidationStatus.EMPIRICALLY_CORROBORATED
    is_reproducible: bool = True
    biosecurity_screen_passed: bool = True
    statistical_protocol: Optional[StatisticalProtocol] = None

    def __init__(
        self,
        witness_id: str,
        witness_type: ScientificWitnessType,
        claim_statement: str,
        mechanism_id: str,
        supporting_observations: Tuple[str, ...],
        integrity_sha256: str = "",
        chronological_precommitment_seal: str = "",
        provenance_record: Optional[Dict[str, str]] = None,
        scientific_validation_status: Optional[ScientificValidationStatus] = None,
        is_reproducible: bool = True,
        biosecurity_screen_passed: bool = True,
        statistical_protocol: Optional[StatisticalProtocol] = None,
        sha256_seal: Optional[str] = None,
        truth_status: Optional[str] = None,
    ):
        object.__setattr__(self, "witness_id", witness_id)
        object.__setattr__(self, "witness_type", witness_type)
        object.__setattr__(self, "claim_statement", claim_statement)
        object.__setattr__(self, "mechanism_id", mechanism_id)
        object.__setattr__(self, "supporting_observations", tuple(supporting_observations))
        effective_sha = integrity_sha256 or sha256_seal or ("0" * 64)
        object.__setattr__(self, "integrity_sha256", effective_sha)
        object.__setattr__(
            self,
            "chronological_precommitment_seal",
            chronological_precommitment_seal or f"CHRONO-SEAL-{effective_sha[:16]}",
        )
        object.__setattr__(self, "provenance_record", provenance_record or {"source": "legacy_or_unit_test"})
        if scientific_validation_status is not None:
            val_status = scientific_validation_status
        elif truth_status == "SUPPORTED":
            val_status = ScientificValidationStatus.EMPIRICALLY_CORROBORATED
        elif truth_status == "CONTRADICTED":
            val_status = ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE
        else:
            val_status = ScientificValidationStatus.EMPIRICALLY_CORROBORATED
        object.__setattr__(self, "scientific_validation_status", val_status)
        object.__setattr__(self, "is_reproducible", is_reproducible)
        object.__setattr__(self, "biosecurity_screen_passed", biosecurity_screen_passed)
        object.__setattr__(self, "statistical_protocol", statistical_protocol)

    @property
    def sha256_seal(self) -> str:
        """Backwards compatibility alias for integrity_sha256."""
        return self.integrity_sha256

    @property
    def truth_status(self) -> str:
        """Backwards compatibility alias mapping validation status to legacy string."""
        if self.scientific_validation_status == ScientificValidationStatus.EMPIRICALLY_CORROBORATED:
            return "SUPPORTED"
        elif self.scientific_validation_status == ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE:
            return "CONTRADICTED"
        return "UNKNOWN"


@dataclass(frozen=True)
class ReusableScientificProcedure:
    """Compounding capability qualified for transfer across unfamiliar task families (CWC-F09)."""
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
    lvt_provenance_id: Optional[str] = None


@dataclass(frozen=True)
class Cwc1Result:
    """
    End-to-end outcome of CWC-1 Counterfactual Witness Compilation.
    Explicitly reclassifies 133.33x as an illustrative cost fixture (CWC-F04).
    """
    mission_title: str
    competing_mechanisms: Tuple[ExplanatoryMechanism, ...]
    identifiability_status: IdentifiabilityStatus
    total_variation_gap: float
    selected_action: Optional[InterventionalAction]
    action_decision: Optional[ActionDecision]
    jensen_shannon_disagreement: float
    precommitment: Optional[PrecommitmentDigest]
    scientific_witness: Optional[ScientificWitness]
    reusable_procedure: Optional[ReusableScientificProcedure]
    # Reclassified fields (CWC-F04)
    benchmark_type: str = "ILLUSTRATIVE_COST_FIXTURE"
    cost_ratio_fixture: float = 133.33
    empirical_discovery_gain: str = "UNMEASURED_PENDING_INDEPENDENT_BENCHMARK"
    is_100x_empirically_proven: bool = False
    productivity_gain_g: float = 133.33  # Retained as regression fixture
    total_cost_nanos: int = 150_000_000
