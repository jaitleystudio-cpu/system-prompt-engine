"""
SPE Ω — REC-0 & REC-1: Reliability Envelope Compiler & Counterfactual Reality Transfer Package.

Exports the 12-field ReliabilityEnvelope contract, ValidityStateMachine,
EvidenceOrigin firewall, CalibratedRiskEstimator (with Fréchet copula bounds),
CostRiskExecutionSelector, CounterfactualWitnessSearch, RealityTransferEngine,
AdversarialQualificationSuite, REC0ExperimentRunner, and 7-view UX explainers.
"""

from spe_runtime.research.rec.adversarial import (
    AdversarialFixtureResult,
    AdversarialQualificationSuite,
)
from spe_runtime.research.rec.envelope import (
    CalibratedRiskEstimator,
    CoverageScope,
    DatasetCommitment,
    DependencyHashes,
    DriftTrigger,
    EnvironmentBinding,
    EnvelopeEvaluationResult,
    EnvelopeValidityState,
    EvaluatorBinding,
    EvidenceOrigin,
    ModelRevisionBinding,
    ObservedSuccessMetrics,
    ReliabilityEnvelope,
    ReliabilityEnvelopeCompiler,
    RiskBoundEstimate,
)
from spe_runtime.research.rec.experiment import (
    BaselineComparisonMetrics,
    IndependentOutcomeEvaluator,
    NegativeControlExperimentResult,
    PreregisteredExperimentProtocol,
    REC0ExperimentReport,
    REC0ExperimentRunner,
    reproduce_rec0_experiment,
)
from spe_runtime.research.rec.explain import explain_rec0_audit_and_ux
from spe_runtime.research.rec.reality_transfer import (
    CounterfactualWitnessSearch,
    DiscriminatingWitnessProbe,
    RealityTransferEngine,
    RealityTransferResult,
    TargetRealitySpec,
)
from spe_runtime.research.rec.selector import (
    AuthorizedStrategyCandidate,
    CostRiskExecutionSelector,
    ExecutionAction,
    ExecutionSelectionDecision,
)

__all__ = [
    "AdversarialFixtureResult",
    "AdversarialQualificationSuite",
    "AuthorizedStrategyCandidate",
    "BaselineComparisonMetrics",
    "CalibratedRiskEstimator",
    "CostRiskExecutionSelector",
    "CounterfactualWitnessSearch",
    "CoverageScope",
    "DatasetCommitment",
    "DependencyHashes",
    "DiscriminatingWitnessProbe",
    "DriftTrigger",
    "EnvironmentBinding",
    "EnvelopeEvaluationResult",
    "EnvelopeValidityState",
    "EvaluatorBinding",
    "EvidenceOrigin",
    "ExecutionAction",
    "ExecutionSelectionDecision",
    "IndependentOutcomeEvaluator",
    "ModelRevisionBinding",
    "NegativeControlExperimentResult",
    "ObservedSuccessMetrics",
    "PreregisteredExperimentProtocol",
    "REC0ExperimentReport",
    "REC0ExperimentRunner",
    "RealityTransferEngine",
    "RealityTransferResult",
    "ReliabilityEnvelope",
    "ReliabilityEnvelopeCompiler",
    "RiskBoundEstimate",
    "TargetRealitySpec",
    "explain_rec0_audit_and_ux",
    "reproduce_rec0_experiment",
]
