"""Lane C scholarly evidence fabric.

Research query → validated scholarly evidence package.
Not wired to XCAT, K3, Quality, or the grounding ContextCapsule type.
"""

from spe_runtime.scholarly.models import (
    ClaimAssertion,
    EvidencePackage,
    PackageStatus,
)
from spe_runtime.scholarly.pipeline import compile_evidence_package
from spe_runtime.scholarly.registry import load_registry

__all__ = [
    "ClaimAssertion",
    "EvidencePackage",
    "PackageStatus",
    "compile_evidence_package",
    "load_registry",
]

INTEGRATION_STATUS = "NOT_WIRED"
LATER_PATH = "EvidencePackage → ContextCapsule → CategoryProtocol → K3"
