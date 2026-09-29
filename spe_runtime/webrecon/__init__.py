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
    "CONTRACT_ID",
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
