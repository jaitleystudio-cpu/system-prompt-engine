"""SPE Ω Level 5: Autonomous Open-Ended Discovery Engine Package."""

from spe_runtime.discovery.dialectical_arena import (
    AdversarialFalsifier,
    DialecticalArena,
    HypothesisProposer,
)
from spe_runtime.discovery.map_elites import QualityDiversityArchive
from spe_runtime.discovery.models import (
    BoundaryKind,
    DialecticalDuelReceipt,
    DiscoveredAxiom,
    DiscoveryHypothesis,
    EliteRecord,
    FalsificationWorld,
    HypothesisStatus,
)
from spe_runtime.discovery.ontology_graph import DomainOntologyGraph, OntologyNode
from spe_runtime.discovery.open_ended_engine import (
    DiscoveryEpochSummary,
    OpenEndedDiscoveryEngine,
)

__all__ = [
    "BoundaryKind",
    "HypothesisStatus",
    "DiscoveryHypothesis",
    "FalsificationWorld",
    "DialecticalDuelReceipt",
    "DiscoveredAxiom",
    "EliteRecord",
    "HypothesisProposer",
    "AdversarialFalsifier",
    "DialecticalArena",
    "QualityDiversityArchive",
    "OntologyNode",
    "DomainOntologyGraph",
    "DiscoveryEpochSummary",
    "OpenEndedDiscoveryEngine",
]
