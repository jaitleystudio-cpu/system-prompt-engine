"""
SPE AGI BRAIN Ω — Frontier-Science Core Data Models & Types
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Any

# Exact Integer NanoUSD Conservation: 1 USD = 1,000,000,000 nanos
NANOS_PER_USD: int = 1_000_000_000

class DomainType(str, Enum):
    MATHEMATICS = "MATHEMATICS"
    PHYSICS = "PHYSICS"
    COMPUTER_SCIENCE = "COMPUTER_SCIENCE"
    CHEMISTRY = "CHEMISTRY"
    BIOLOGY = "BIOLOGY"
    ELECTRONICS = "ELECTRONICS"
    MATERIALS_SCIENCE = "MATERIALS_SCIENCE"
    ECONOMICS = "ECONOMICS"

class InventionStrategy(str, Enum):
    CONTRADICTION_DRIVEN = "CONTRADICTION_DRIVEN"
    CROSS_DOMAIN_TRANSFER = "CROSS_DOMAIN_TRANSFER"
    INVERSE_DESIGN = "INVERSE_DESIGN"
    FIRST_PRINCIPLES = "FIRST_PRINCIPLES"
    EVOLUTIONARY_PROGRAM_SEARCH = "EVOLUTIONARY_PROGRAM_SEARCH"
    NEURO_SYMBOLIC_SYNTHESIS = "NEURO_SYMBOLIC_SYNTHESIS"
    CAUSAL_INTERVENTION = "CAUSAL_INTERVENTION"
    CONSTRAINT_RELAXATION = "CONSTRAINT_RELAXATION"
    BOUNDARY_CONDITION_SEARCH = "BOUNDARY_CONDITION_SEARCH"
    REPRESENTATION_DISCOVERY = "REPRESENTATION_DISCOVERY"
    COMPOSITIONAL_INVENTION = "COMPOSITIONAL_INVENTION"
    COUNTEREXAMPLE_GUIDED = "COUNTEREXAMPLE_GUIDED"

class VerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED"
    UNKNOWN = "UNKNOWN"
    REJECTED = "REJECTED"

class ProvenanceType(str, Enum):
    VERIFIED_EXPERIMENTAL = "VERIFIED_EXPERIMENTAL"
    CITED_PEER_REVIEWED = "CITED_PEER_REVIEWED"
    PROPOSED_UNEXECUTED = "PROPOSED_UNEXECUTED"
    THEORETICAL_DERIVATION = "THEORETICAL_DERIVATION"
    SPECULATIVE_HYPOTHESIS = "SPECULATIVE_HYPOTHESIS"

@dataclass(frozen=True)
class ScientificObjective:
    objective_id: str
    description: str
    domain: DomainType
    frozen_intent: str
    hard_constraints: List[str] = field(default_factory=list)

@dataclass
class KnowledgeState:
    theoretical_assumptions: List[str] = field(default_factory=list)
    definitions: Dict[str, str] = field(default_factory=dict)
    boundary_conditions: List[str] = field(default_factory=list)
    direct_evidence_claims: List[str] = field(default_factory=list)
    citation_chain_claims: List[str] = field(default_factory=list)
    divergent_predictions: List[Dict[str, str]] = field(default_factory=list)
    unresolved_gaps: List[str] = field(default_factory=list)

@dataclass
class WorldModelInstance:
    model_id: str
    domain: DomainType
    executable_representation: str
    simulated_predictions: Dict[str, Any] = field(default_factory=dict)
    independent_observations: Dict[str, Any] = field(default_factory=dict)
    formal_lean_statement: Optional[str] = None
    is_falsified: bool = False

@dataclass
class InventionCandidate:
    candidate_id: str
    strategy: InventionStrategy
    hypothesis_statement: str
    mechanism: str
    feasibility_score: float  # 0.0 to 1.0
    novelty_score: float      # 0.0 to 1.0
    testability_score: float  # 0.0 to 1.0
    prior_art_overlap: float  # 0.0 to 1.0

@dataclass
class VerificationResult:
    result_id: str
    candidate_id: str
    status: VerificationStatus
    formal_proof_verified: bool = False
    property_tests_passed: int = 0
    property_tests_total: int = 0
    statistical_p_value: Optional[float] = None
    reasons: List[str] = field(default_factory=list)
    receipt_hash: str = ""

@dataclass
class DiscoveryMetaPolicy:
    policy_id: str
    domain_weights: Dict[InventionStrategy, float] = field(default_factory=dict)
    success_counts: Dict[InventionStrategy, int] = field(default_factory=dict)
    heldout_transfer_score: float = 0.0

@dataclass
class ClaimEvidenceLink:
    claim_id: str
    statement: str
    provenance: ProvenanceType
    evidence_ref: str

@dataclass
class SectionNode:
    section_id: str
    title: str
    target_words: int
    dependencies: List[str] = field(default_factory=list)
    claims: List[ClaimEvidenceLink] = field(default_factory=list)
    content: str = ""

@dataclass
class ChapterNode:
    chapter_id: str
    title: str
    sections: List[SectionNode] = field(default_factory=list)

@dataclass
class DocumentSpecification:
    doc_id: str
    title: str
    target_word_count: int
    chapters: List[ChapterNode] = field(default_factory=list)
    is_consistent: bool = False
    actual_word_count: int = 0

@dataclass
class GildenMaintenanceEvent:
    event_id: str
    category: str
    diagnostic: str
    proposed_patch: str
    is_authorized: bool
    cost_nano_usd: int
    is_reversible: bool
    audit_receipt: str = ""

@dataclass
class ScientificPromptContract:
    original_objective: str
    optimized_specification: str
    execution_record: str
    material_improvement_rationale: str
    final_deliverable: str
    verification_status: VerificationStatus
