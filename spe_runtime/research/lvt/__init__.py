"""
SPE Ω — Learning-Validity Transactions (LVT-0) Research Subsystem.
Strictly isolated research track for formal 4-arm learning verification,
anti-self-certification enforcement, and cross-model portability.
"""

from .controlled_experiment import ControlledExperimentRunner
from .learning_validator import LearningValidator
from .transfer_protocol import LearningTransferProtocol
from .types import (
    EvaluatorType,
    ExperimentProtocol,
    FourArmResults,
    GeneratingModelSelfCertificationError,
    LearningClaim,
    LearningValidityRuleViolation,
    LearningValidityTransaction,
    NanoUSD,
    QualificationStatus,
    RequalificationTrigger,
    RevocationReason,
    TransactionRevokedError,
    validate_nanos,
)

__all__ = [
    "QualificationStatus",
    "RequalificationTrigger",
    "RevocationReason",
    "EvaluatorType",
    "GeneratingModelSelfCertificationError",
    "LearningValidityRuleViolation",
    "TransactionRevokedError",
    "LearningClaim",
    "ExperimentProtocol",
    "FourArmResults",
    "LearningValidityTransaction",
    "NanoUSD",
    "validate_nanos",
    "ControlledExperimentRunner",
    "LearningValidator",
    "LearningTransferProtocol",
]
