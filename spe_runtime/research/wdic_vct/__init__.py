"""
WDIC-VCT — Witness-Directed Intelligence Compilation: Verified Continuation Transactions
Part of SPE Ω Research Quarantine.
Includes CWC (Counterfactual Witness Continuation), Evidence Capsules, and Skill Auto-Installer.
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
from spe_runtime.research.wdic_vct.evidence_capsules import (
    EvidenceCapsule,
    EvidenceCapsuleRetriever,
)
from spe_runtime.research.wdic_vct.skill_autoinstaller import (
    SkillRequirement,
    SkillInstallationProposal,
    SkillAutoInstaller,
)
from spe_runtime.research.wdic_vct.cwc_witness import (
    ProbeType,
    CounterfactualProbe,
    CWCReviewedReceipt,
    CWCWitnessEngine,
)

__all__ = [
    "ClaimStatus",
    "TaskClaim",
    "TaskReport",
    "ProofDeficit",
    "NextTaskContract",
    "ReviewSummary",
    "WDICContinuationEngine",
    "EvidenceCapsule",
    "EvidenceCapsuleRetriever",
    "SkillRequirement",
    "SkillInstallationProposal",
    "SkillAutoInstaller",
    "ProbeType",
    "CounterfactualProbe",
    "CWCReviewedReceipt",
    "CWCWitnessEngine",
]
