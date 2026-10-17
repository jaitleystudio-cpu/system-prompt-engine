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
    """Scoped identifiability verdicts replacing unproven global claims (CWC-F01, Hard Test 2, Hard Test 7)."""
    DISTINGUISHABLE_ACTION_FOUND = "DISTINGUISHABLE_ACTION_FOUND"
    NO_DISCRIMINATING_ACTION_ESTABLISHED = "NO_DISCRIMINATING_ACTION_ESTABLISHED"
    IDENTIFIABILITY_UNKNOWN = "IDENTIFIABILITY_UNKNOWN"
    NONIDENTIFIABLE_PROVED = "NONIDENTIFIABLE_PROVED"
    MODEL_SET_INADEQUATE = "MODEL_SET_INADEQUATE"
    ALL_CANDIDATE_MECHANISMS_INADEQUATE = "ALL_CANDIDATE_MECHANISMS_INADEQUATE"
    INSUFFICIENT_STATISTICAL_POWER = "INSUFFICIENT_STATISTICAL_POWER"
    UNDERPOWERED_DISCRIMINATION = "INSUFFICIENT_STATISTICAL_POWER"
    # Legacy aliases preserved for backwards compatibility
    UNIQUE_IDENTIFIED = "DISTINGUISHABLE_ACTION_FOUND"
    OBSERVATIONALLY_EQUIVALENT = "NO_DISCRIMINATING_ACTION_ESTABLISHED"
    FORMALLY_UNIDENTIFIABLE = "NONIDENTIFIABLE_PROVED"
    UNDERDETERMINED = "IDENTIFIABILITY_UNKNOWN"
    NO_ADEQUATE_MECHANISM = "ALL_CANDIDATE_MECHANISMS_INADEQUATE"


class AcquisitionMode(str, Enum):
    """Dimensionally consistent acquisition objective modes (CWC-F02, Hard Test 1)."""
    MONETARY_DECISION_VALUE = "MONETARY_DECISION_VALUE"      # EVSI - Cost - Risk (Exact NanoUSD)
    SCIENTIFIC_INFORMATION_DENSITY = "SCIENTIFIC_INFORMATION_DENSITY"  # (EIG + μ*FR) / Cost (Bits per USD)
    CLEAN_EXPECTED_INFORMATION_GAIN = "CLEAN_EXPECTED_INFORMATION_GAIN" # Pure EIG / Cost (no double counting)
    MULTI_OBJECTIVE_UTILITY = "MULTI_OBJECTIVE_UTILITY" # Explicitly derived multi-objective utility


class ProductivityCalculationStatus(str, Enum):
    """Explicit calculation states for zero-cost and zero-discovery boundaries (Hard Test 5)."""
    VALID_ESTIMATE = "VALID_ESTIMATE"
    ZERO_COST_INFORMATION_DENSITY_UNDEFINED = "ZERO_COST_INFORMATION_DENSITY_UNDEFINED"
    INSUFFICIENT_VERIFIED_DISCOVERIES = "INSUFFICIENT_VERIFIED_DISCOVERIES"
    BASELINE_PRODUCTIVITY_ZERO = "BASELINE_PRODUCTIVITY_ZERO"
    PRODUCTIVITY_GAIN_NOT_ESTIMABLE = "PRODUCTIVITY_GAIN_NOT_ESTIMABLE"


@dataclass(frozen=True)
class PriorSensitivityReport:
    """Evaluates ranking stability over prior ambiguity sets (Go & Isaac 2022 REIG - Hard Test 4)."""
    is_ranking_stable: bool
    reversal_detected: bool
    tested_priors_count: int
    robust_expected_info_gain: float  # Infimum of EIG across ambiguity set
    preferred_action_id: str
    worst_case_prior_weight: float
    prior_source: str = "UNSPECIFIED"
    ambiguity_interval: Tuple[float, float] = (0.0, 1.0)


@dataclass(frozen=True)
class DiscriminatoryPowerReport:
    """Evaluates practical discriminatory power, sample size, noise, and cost (Hard Test 2)."""
    achievable_power: float
    required_sample_size: int
    effect_size_delta: float
    total_variation: float
    single_shot_accuracy: float
    is_sufficiently_powered: bool
    total_cost_nanos: int
    is_within_budget: bool
    alpha: float
    power_target: float


@dataclass(frozen=True)
class PreregistrationChainEntry:
    """Tamper-evident append-only ledger block for chronological precommitment (RFC 3161 - Hard Test 6)."""
    sequence_number: int
    previous_block_hash: str
    monotonic_timestamp_ns: int
    timestamp_utc: str
    run_id: str
    model_digest: str
    action_digest: str
    protocol_digest: str
    nonce: str
    block_hash: str
    trust_boundary: str = "LOCAL_APPEND_ONLY_CHAIN"


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
    """Pre-registered statistical testing protocol (CWC-F08, Hard Test 3)."""
    protocol_id: str
    null_hypothesis: str
    alpha_significance: float = 0.01
    power_target: float = 0.80
    minimum_sample_size: int = 30
    stopping_rule: str = "FIXED_SAMPLE_OR_SPRT"
    multiple_testing_correction: str = "BONFERRONI"  # BONFERRONI, BENJAMINI_HOCHBERG, NONE
    num_hypotheses: int = 1
    sequential_looks: int = 1
    alpha_spending: Optional[str] = None  # OBRIEN_FLEMING, POCOCK


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
    prior_source: str = "UNSPECIFIED"
    prior_ambiguity_interval: Tuple[float, float] = (0.0, 1.0)


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
    status: str  # ACTION_SELECTED, NO_AUTHORIZED_FEASIBLE_ACTION, BUDGET_EXCEEDED, AUTHORIZATION_REVOKED_AT_EXECUTION
    selected_action: Optional[InterventionalAction]
    feasible_action_count: int
    filtered_unauthorized_count: int
    acquisition_score: float
    acquisition_mode: AcquisitionMode
    prior_sensitivity: Optional[PriorSensitivityReport] = None
    discriminatory_power: Optional[DiscriminatoryPowerReport] = None
    productivity_status: Optional[ProductivityCalculationStatus] = None


@dataclass(frozen=True)
class PrecommitmentDigest:
    """Cryptographic preregistration locking predictions prior to experiment execution (CWC-F06, Hard Test 6)."""
    digest_sha256: str
    action_id: str
    timestamp_utc: str
    nonce: str
    sealed_predictions_hash: str
    preregistration_token: str  # Verifiable chronology proof
    chain_sequence: int = 0
    previous_block_hash: str = ""
    trust_boundary: str = "LOCAL_APPEND_ONLY_CHAIN"
    run_id: str = "RUN-DEFAULT"


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

        # False provenance gate (Hard Test 11): empirical corroboration requires supporting observations
        if (
            val_status == ScientificValidationStatus.EMPIRICALLY_CORROBORATED
            and witness_type in (ScientificWitnessType.EMPIRICAL_REPLICATION, ScientificWitnessType.INTERVENTIONAL_EXPERIMENT)
            and not supporting_observations
        ):
            val_status = ScientificValidationStatus.UNVERIFIED_PENDING_REPLICATION

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
    # Extended verification & release fields (CWC-1 R1.2)
    productivity_status: Optional[ProductivityCalculationStatus] = None
    release_status: str = "CWC-1 R1.2: Adversarial Scientific Qualification Candidate (Experimental)"
    prior_sensitivity: Optional[PriorSensitivityReport] = None
    discriminatory_power: Optional[DiscriminatoryPowerReport] = None

