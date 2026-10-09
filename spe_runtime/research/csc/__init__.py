"""
SPE Ω — Counterfactual Specification Closure (CSC) Research Subsystem.
Implements Paper 3: Self-Challenging, Self-Qualifying Intelligence.
"""

from .models import (
    WorldType,
    HypothesisStatus,
    OracleStatus,
    ProbeVerdict,
    QualificationMethod,
    WorldModel,
    WorldPair,
    DistinguishingProbe,
    CounterfactualChallengeRecord,
    CounterexampleRecord,
    ProvenanceRecord,
    CandidateObligationProposal,
    DiscriminationResult,
    PredicateValue,
    VerificationVerdict,
    NanoUSD,
    validate_nanos,
    NetworkPolicy,
    SecurityLabel,
    ConfidentialityLevel,
)
from .models import CounterfactualWorld

from .world_discriminator import WorldDiscriminator
from .world_generator import WorldGenerator
from .probe_optimizer import ProbeOptimizer
from .probe_synthesizer import ProbeSynthesizer
from .counterexample_library import CounterexampleLibrary
from .feedback_governor import FeedbackGovernor
from .assumption_verifier import (
    AssumptionVerifier,
    MetamorphicRelation,
    OracleQualifier,
    make_invariance_relation,
    make_reversibility_relation,
)

__all__ = [
    # Models & Enums
    "WorldType",
    "HypothesisStatus",
    "OracleStatus",
    "ProbeVerdict",
    "QualificationMethod",
    "WorldModel",
    "CounterfactualWorld",
    "WorldPair",
    "DistinguishingProbe",
    "CounterfactualChallengeRecord",
    "CounterexampleRecord",
    "ProvenanceRecord",
    "CandidateObligationProposal",
    "DiscriminationResult",
    "PredicateValue",
    "VerificationVerdict",
    "NanoUSD",
    "validate_nanos",
    "NetworkPolicy",
    "SecurityLabel",
    "ConfidentialityLevel",
    # Core Engines & Governors
    "WorldDiscriminator",
    "WorldGenerator",
    "ProbeOptimizer",
    "ProbeSynthesizer",
    "CounterexampleLibrary",
    "FeedbackGovernor",
    "AssumptionVerifier",
    "MetamorphicRelation",
    "OracleQualifier",
    "make_invariance_relation",
    "make_reversibility_relation",
]
