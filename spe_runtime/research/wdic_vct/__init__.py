"""
WDIC-VCT — Witness-Directed Intelligence Compilation: Verified Continuation Transactions
Part of SPE Ω Research Quarantine.
"""

from spe_runtime.research.wdic_vct.types import (
    ClaimStatus,
    TaskClaim,
    TaskReport,
    ProofDeficit,
    NextTaskContract,
    ReviewSummary,
)
from spe_runtime.research.wdic_vct.continuation_engine import (
    WDICContinuationEngine,
)

__all__ = [
    "ClaimStatus",
    "TaskClaim",
    "TaskReport",
    "ProofDeficit",
    "NextTaskContract",
    "ReviewSummary",
    "WDICContinuationEngine",
]
