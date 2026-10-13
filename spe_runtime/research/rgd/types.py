"""
SPE Ω PRO — Scientific Discovery Engine (RGD-1: Reality-Grounded Discovery) Core Types
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any

# Exact Integer NanoUSD Conservation: 1 USD = 1,000,000,000 nanos
NANOS_PER_USD: int = 1_000_000_000


class EvidenceAccessLevel(str, Enum):
    """Scholarly publication access levels."""
    METADATA = "METADATA"
    ABSTRACT = "ABSTRACT"
    FULL_TEXT = "FULL_TEXT"


class EvidenceRelationship(str, Enum):
    """Scientific relationship of evidence relative to adjacent findings or theories."""
    SUPPORT = "SUPPORT"
    CONTRADICTION = "CONTRADICTION"
    UNKNOWN = "UNKNOWN"


class ResearchVerificationStatus(str, Enum):
    """Immutable research verification verdicts (Truth Conservation)."""
    SUPPORTED_WITHIN_TESTED_SCOPE = "SUPPORTED_WITHIN_TESTED_SCOPE"
    CONTRADICTED = "CONTRADICTED"
    INCONCLUSIVE = "INCONCLUSIVE"
    NOT_VERIFIED = "NOT_VERIFIED"


class ResponseSpeedClass(str, Enum):
    """Three operational response speed classes."""
    INSTANT_DISCOVERY = "INSTANT_DISCOVERY"  # 1-3 seconds: ranked metadata & initial map
    EVIDENCE_ANSWER = "EVIDENCE_ANSWER"      # 5-15 seconds: grounded answer with DOIs & limits
    DEEP_DISCOVERY = "DEEP_DISCOVERY"        # minutes to hours: full experiments & proofs


class ReproductionStatus(str, Enum):
    """Independent empirical replication status."""
    REPRODUCED = "REPRODUCED"
    UNTESTED = "UNTESTED"
    FAILED = "FAILED"


@dataclass
class ResearchMission:
    """Compiled research mission specifying intent, constraints, and execution plan."""
    mission_id: str
    objective: str
    target_domain: str
    measurable_constraints: List[str]
    unresolved_assumptions: List[str]
    compiled_prompt: str
    execution_plan: List[str]
    speed_class: ResponseSpeedClass
    created_at: float
    budget_nanos: int = 10_000_000_000  # Default $10.00 USD


@dataclass
class ScholarlyRecord:
    """Standardized record within the 400M+ global scholarly catalog."""
    record_id: str
    title: str
    authors: List[str]
    year: int
    doi: str
    venue: str
    corpus_type: str  # "curated_core", "expansion", "preprint", "dataset", "withdrawn"
    access_level: EvidenceAccessLevel
    abstract: Optional[str] = None
    full_text_snippet: Optional[str] = None
    citation_count: int = 0
    is_retracted: bool = False
    quality_score: float = 0.8  # 0.0 to 1.0
    domain: str = "GENERAL_SCIENCE"


@dataclass
class StructuredEvidence:
    """11-field standardized evidence structure extracted from scholarly manuscripts."""
    evidence_id: str
    record_id: str
    research_question: str
    hypothesis: str
    method: str
    population_or_material: str
    intervention_or_mechanism: str
    results: str
    statistical_evidence: str  # Effect sizes, uncertainty, p-values, CI
    limitations: str
    reproducibility: str       # Code, data, Docker availability
    provenance: str            # Exact DOI/PMID, version, page, figure coordinates
    scientific_relationship: EvidenceRelationship
    access_level: EvidenceAccessLevel = EvidenceAccessLevel.ABSTRACT


@dataclass
class EvidenceGraph:
    """Queryable graph of structured scientific evidence nodes and relationships."""
    graph_id: str
    nodes: Dict[str, StructuredEvidence] = field(default_factory=dict)
    support_edges: List[Dict[str, str]] = field(default_factory=list)
    contradiction_edges: List[Dict[str, str]] = field(default_factory=list)
    unknown_edges: List[Dict[str, str]] = field(default_factory=list)
    unresolved_uncertainties: List[str] = field(default_factory=list)


@dataclass
class CompetingTheory:
    """A formal competing scientific explanation for observed phenomena."""
    theory_id: str
    name: str
    statement: str
    mechanism: str
    prior_probability: float  # In [0.0, 1.0]
    supporting_evidence_ids: List[str] = field(default_factory=list)
    contradicting_evidence_ids: List[str] = field(default_factory=list)


@dataclass
class DiscriminatingExperiment:
    """Candidate experiment designed to distinguish competing theories."""
    experiment_id: str
    name: str
    hypothesis_addressed: str
    proposed_protocol: str
    expected_delta_r: float    # Expected reduction in uncertainty in [0.0, 1.0]
    expected_cost_nanos: int   # Cost in integer NanoUSD
    expected_time_sec: float   # Expected execution time in seconds
    voi_score: float           # U(e) = Delta R / (C(e) + lambda * T(e))
    simulated_outcomes: Dict[str, float] = field(default_factory=dict)


@dataclass
class ResearchVerificationCertificate:
    """Cryptographic certificate detailing exactly what has and has not been verified."""
    certificate_id: str
    claim: str
    source_identity: str
    evidence_location: str
    evidence_relationship: EvidenceRelationship
    methodology_check: bool
    statistical_check: bool
    reproduction_state: ReproductionStatus
    contradictions: List[str]
    freshness_state: str
    qualification: ResearchVerificationStatus
    sha256_seal: str
    timestamp: float


@dataclass
class CompoundingProcedure:
    """Reusable, validated research procedure qualified through LVT and CSC."""
    procedure_id: str
    domain: str
    name: str
    qualification_verdict: str
    tested_tasks_count: int
    assumptions: List[str]
    is_valid: bool = True
    invalidation_reason: Optional[str] = None
    cost_savings_pct: float = 0.0
    sha256_seal: str = ""


@dataclass
class DeepResearchSection:
    """Structured chapter section within a 100,000-word persistent deep research job."""
    section_id: str
    chapter_index: int
    title: str
    target_word_count: int
    generated_word_count: int
    content: str
    registered_symbols: List[str] = field(default_factory=list)
    registered_dois: List[str] = field(default_factory=list)
    is_checkpointed: bool = False


@dataclass
class DeepResearchJob:
    """Persistent, resumable 100,000-word research manuscript state coordinator."""
    job_id: str
    mission_id: str
    title: str
    target_total_words: int
    sections: List[DeepResearchSection] = field(default_factory=list)
    global_symbol_registry: Dict[str, str] = field(default_factory=dict)
    global_reference_registry: List[str] = field(default_factory=list)
    is_completed: bool = False
    final_word_count: int = 0
    consistency_verified: bool = False


@dataclass
class Rgd1Result:
    """Unified result of an SPE Ω Reality-Grounded Discovery run."""
    result_id: str
    mission: ResearchMission
    records_scanned: int
    structured_evidences: List[StructuredEvidence]
    evidence_graph: EvidenceGraph
    competing_theories: List[CompetingTheory]
    selected_experiments: List[DiscriminatingExperiment]
    certificates: List[ResearchVerificationCertificate]
    compounding_procedure_id: Optional[str]
    speed_class_achieved: ResponseSpeedClass
    elapsed_ms: int
    total_cost_nanos: int
