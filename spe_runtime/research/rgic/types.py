from enum import Enum
from typing import List, Optional, Callable, Dict, Any
from dataclasses import dataclass, field

class ClaimedRole(str, Enum):
    PREDICTIVE = "PREDICTIVE"
    CAUSAL = "CAUSAL"
    STRUCTURAL = "STRUCTURAL"

class RepresentationType(str, Enum):
    SYMBOLIC = "SYMBOLIC"
    NUMERIC = "NUMERIC"
    LATENT = "LATENT"
    OTHER = "OTHER"

@dataclass
class OperationalMeasurement:
    procedure_ref: str
    required_observations: List[str]
    temporal_constraints: List[str]
    validity_preconditions: List[str]
    # Executable procedure to compute z_t from history h_t
    procedure: Optional[Callable[[List[Any]], Any]] = None

@dataclass
class ExperimentRegistry:
    permitted_interventions: List[str]
    preregistration_ref: str
    independent_evaluator_ref: str

@dataclass
class ConceptQualification:
    scope_ref: str
    transfer_evidence_refs: List[str]
    requalification_triggers: List[str]
    status: str = "UNQUALIFIED"

@dataclass
class ConceptCandidate:
    concept_id: str
    description: str
    representation_type: RepresentationType
    operational_definition: OperationalMeasurement
    claimed_role: ClaimedRole
    competing_explanations: List[str]
    registered_predictions: List[str]
    experiment: ExperimentRegistry
    observation_refs: List[str]
    negative_control_refs: List[str]
    counterexample_refs: List[str]
    heldout_result_ref: Optional[str]
    qualification: ConceptQualification
    protected_intent_ref: str
    authority_ref: str
    proof_owner_ref: str

@dataclass
class TransferMapping:
    source_concept_id: str
    target_environment_ref: str
    mapping_procedure: Callable[[Any], Any]
