"""WebRecon foundation.

Authorized capture → Website X-Ray → reconstruction contract.
Observations are untrusted structural data. This package does not fetch,
execute scripts, run WebGL, mint authority, or integrate with K3.
"""

from spe_runtime.webrecon.acquisition import (
    AcquisitionAuthorization,
    AcquisitionDecision,
    decide_acquisition,
)
from spe_runtime.webrecon.contract import (
    CONTRACT_ID,
    LIMITATIONS,
    OBLIGATIONS,
    PROHIBITIONS,
    WebReconstructionContract,
    build_reconstruction_contract,
)
from spe_runtime.webrecon.limits import ObservationLimits
from spe_runtime.webrecon.xray import IR_ID, WebsiteXRay

__all__ = [
    "AI_GENERATION",
    "CONTRACT_ID",
    "HOSTED_PUBLISH",
    "LIVE_RECONSTRUCTION",
    "SCENE_3D",
    "IR_ID",
    "LIMITATIONS",
    "OBLIGATIONS",
    "PROHIBITIONS",
    "AcquisitionAuthorization",
    "AcquisitionDecision",
    "ObservationLimits",
    "WebReconstructionContract",
    "WebsiteXRay",
    "build_reconstruction_contract",
    "decide_acquisition",
]

# G4 mount boundary. The library is on this branch. It is not a product
# route, does not fetch, and must not be labeled available.
LIVE_RECONSTRUCTION = "NOT_AVAILABLE"
HOSTED_PUBLISH = "HOLD"
SCENE_3D = "NOT_AVAILABLE"
AI_GENERATION = "NOT_AVAILABLE"
