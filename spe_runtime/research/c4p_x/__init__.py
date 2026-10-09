"""
SPE Ω — C4P-X+ (Proof-Carrying Semantic Continuation) Research Package.
Provides transaction-safe escrow, state ledger, continuation synthesizer, and remediation diagnostics.
"""

from .kernel_repaired import (
    NanoUSD,
    PredicateValue,
    EffectStatus,
    EvidenceStatus,
    TransactionSafeEscrow,
)
from .state_ledger import (
    RecordedFact,
    SideEffectRecord,
    ExecutionStateSigma,
)
from .continuation_synthesizer import (
    ContinuationSynthesizer,
)
from .remediation import (
    RemediationActionType,
    RemediationOption,
    RemediationDiagnostic,
    RemediationAnalyzer,
)
from .transition_verifier import (
    TransitionVerifier,
)

__all__ = [
    "NanoUSD",
    "PredicateValue",
    "EffectStatus",
    "EvidenceStatus",
    "TransactionSafeEscrow",
    "RecordedFact",
    "SideEffectRecord",
    "ExecutionStateSigma",
    "ContinuationSynthesizer",
    "RemediationActionType",
    "RemediationOption",
    "RemediationDiagnostic",
    "RemediationAnalyzer",
    "TransitionVerifier",
]
