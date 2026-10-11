"""
SPE Ω — REC-0: Reliability Envelope Compiler Research Package.

Exports the 12-field ReliabilityEnvelope contract, 4-state ValidityStateMachine,
CalibratedRiskEstimator, CostRiskExecutionSelector, AdversarialQualificationSuite,
REC0ExperimentRunner, and 7-view UX explainers.
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
    "CoverageScope",
    "DatasetCommitment",
    "DependencyHashes",
    "DriftTrigger",
    "EnvironmentBinding",
    "EnvelopeEvaluationResult",
    "EnvelopeValidityState",
    "EvaluatorBinding",
    "ExecutionAction",
    "ExecutionSelectionDecision",
    "IndependentOutcomeEvaluator",
    "ModelRevisionBinding",
    "NegativeControlExperimentResult",
    "ObservedSuccessMetrics",
    "PreregisteredExperimentProtocol",
    "REC0ExperimentReport",
    "REC0ExperimentRunner",
    "ReliabilityEnvelope",
    "ReliabilityEnvelopeCompiler",
    "RiskBoundEstimate",
    "explain_rec0_audit_and_ux",
    "reproduce_rec0_experiment",
]
