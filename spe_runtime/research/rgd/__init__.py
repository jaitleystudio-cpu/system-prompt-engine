"""
SPE Ω PRO — Scientific Discovery Engine (RGD-1: Reality-Grounded Discovery)
October 12, 2026 | Research Quarantine Track
"""

from spe_runtime.research.rgd.types import (
    NANOS_PER_USD,
    EvidenceAccessLevel,
    EvidenceRelationship,
    ResearchVerificationStatus,
    ResponseSpeedClass,
    ReproductionStatus,
    ResearchMission,
    ScholarlyRecord,
    StructuredEvidence,
    EvidenceGraph,
    CompetingTheory,
    DiscriminatingExperiment,
    ResearchVerificationCertificate,
    CompoundingProcedure,
    DeepResearchSection,
    DeepResearchJob,
    Rgd1Result,
)
from spe_runtime.research.rgd.mission_compiler import compile_research_mission
from spe_runtime.research.rgd.knowledge_reconstruction import (
    DOCUMENTED_CURATED_CORE_COUNT,
    DOCUMENTED_EXPANSION_COUNT,
    DOCUMENTED_TOTAL_CATALOG_COUNT,
    DOCUMENTED_CACHED_FULL_TEXT_COUNT,
    ScholarlyCatalogInterface,
    extract_structured_evidence,
    build_evidence_graph,
)
from spe_runtime.research.rgd.counterfactual_compiler import (
    calculate_voi_score,
    compile_competing_theories,
    generate_candidate_experiments,
    select_minimal_discriminating_set,
)
from spe_runtime.research.rgd.verification_certificate import (
    issue_verification_certificate,
    verify_certificate_integrity,
    prevent_self_assessment_promotion,
    compute_certificate_seal,
)
from spe_runtime.research.rgd.compounding_lifecycle import (
    CompoundingCapabilityRegistry,
    compute_procedure_seal,
    verify_procedure_seal,
)
from spe_runtime.research.rgd.deep_research_job import (
    create_deep_research_job,
    checkpoint_section,
    verify_cross_chapter_consistency,
    assemble_final_manuscript,
)
from spe_runtime.research.rgd.engine import SpeRgdEngine

__all__ = [
    "NANOS_PER_USD",
    "EvidenceAccessLevel",
    "EvidenceRelationship",
    "ResearchVerificationStatus",
    "ResponseSpeedClass",
    "ReproductionStatus",
    "ResearchMission",
    "ScholarlyRecord",
    "StructuredEvidence",
    "EvidenceGraph",
    "CompetingTheory",
    "DiscriminatingExperiment",
    "ResearchVerificationCertificate",
    "CompoundingProcedure",
    "DeepResearchSection",
    "DeepResearchJob",
    "Rgd1Result",
    "compile_research_mission",
    "DOCUMENTED_CURATED_CORE_COUNT",
    "DOCUMENTED_EXPANSION_COUNT",
    "DOCUMENTED_TOTAL_CATALOG_COUNT",
    "DOCUMENTED_CACHED_FULL_TEXT_COUNT",
    "ScholarlyCatalogInterface",
    "extract_structured_evidence",
    "build_evidence_graph",
    "calculate_voi_score",
    "compile_competing_theories",
    "generate_candidate_experiments",
    "select_minimal_discriminating_set",
    "issue_verification_certificate",
    "verify_certificate_integrity",
    "prevent_self_assessment_promotion",
    "compute_certificate_seal",
    "compute_procedure_seal",
    "verify_procedure_seal",
    "CompoundingCapabilityRegistry",
    "create_deep_research_job",
    "checkpoint_section",
    "verify_cross_chapter_consistency",
    "assemble_final_manuscript",
    "SpeRgdEngine",
]
