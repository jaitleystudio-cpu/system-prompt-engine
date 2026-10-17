"""SPE Ω — Autonomous Website Evolution System (Python Runtime)."""

from spe_runtime.website_evolution.types import (
    AutonomyLevel,
    ChangeRiskLevel,
    DefectCategory,
    EvidenceReceipt,
    FailingTestBeforeFix,
    IntentTaskMapping,
    MinimalPatch,
    ProofCarryingChangeProposal,
    ProposalStatus,
    QualificationResults,
    RollbackReference,
    SearchConsoleQueryRow,
)
from spe_runtime.website_evolution.inventory import WebsiteInventoryAuditorPy
from spe_runtime.website_evolution.search_intent import SearchIntentEnginePy
from spe_runtime.website_evolution.visual_verifier import VisualDomA11yVerifierPy
from spe_runtime.website_evolution.root_cause_repair import RootCauseRepairEnginePy
from spe_runtime.website_evolution.proof_carrying import ProofCarryingEvolutionControllerPy
from spe_runtime.website_evolution.nightly_scheduler import NightlyEvolutionSchedulerPy
from spe_runtime.website_evolution.independent_repair_tournament import (
    CandidatePatchPy,
    FrozenTestOraclePy,
    OracleTestCasePy,
    CandidateEvaluationResultPy,
    TournamentResultPy,
    IndependentRepairTournamentPy,
)
from spe_runtime.website_evolution.privacy_budgeted_evolution import (
    MeasurementRequirementPy,
    MinimizedTelemetryRecordPy,
    PrivacyBudgetStatusPy,
    PrivacyAuditReceiptPy,
    PrivacyBudgetedEvolutionPy,
)

__all__ = [
    "AutonomyLevel",
    "ChangeRiskLevel",
    "DefectCategory",
    "EvidenceReceipt",
    "FailingTestBeforeFix",
    "IntentTaskMapping",
    "MinimalPatch",
    "ProofCarryingChangeProposal",
    "ProposalStatus",
    "QualificationResults",
    "RollbackReference",
    "SearchConsoleQueryRow",
    "WebsiteInventoryAuditorPy",
    "SearchIntentEnginePy",
    "VisualDomA11yVerifierPy",
    "RootCauseRepairEnginePy",
    "ProofCarryingEvolutionControllerPy",
    "NightlyEvolutionSchedulerPy",
    "CandidatePatchPy",
    "FrozenTestOraclePy",
    "OracleTestCasePy",
    "CandidateEvaluationResultPy",
    "TournamentResultPy",
    "IndependentRepairTournamentPy",
    "MeasurementRequirementPy",
    "MinimizedTelemetryRecordPy",
    "PrivacyBudgetStatusPy",
    "PrivacyAuditReceiptPy",
    "PrivacyBudgetedEvolutionPy",
]
