"""WebRecon foundation.

Authorized capture → Website X-Ray → reconstruction contract.
Observations are untrusted structural data. The default path does not fetch.
The only network path is an explicit https://example.com/ grant. This package
does not execute scripts, run WebGL, mint authority, or integrate with K3.
Live reconstruction stays NOT_AVAILABLE.
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
    emit_observed_page,
)
from spe_runtime.webrecon.limits import ObservationLimits
from spe_runtime.webrecon.scoped_grant import (
    ExampleComGrant,
    ScopedAcquisitionReceipt,
    acquire_scoped_example,
)
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
    "emit_observed_page",
    "decide_acquisition",
    "ExampleComGrant",
    "ScopedAcquisitionReceipt",
    "acquire_scoped_example",
]

# G4 mount boundary. The library is not a product route and must not be
# labeled available. Default acquisition does not fetch. A scoped example.com
# grant is not a product live-URL pass.
LIVE_RECONSTRUCTION = "NOT_AVAILABLE"
HOSTED_PUBLISH = "HOLD"
SCENE_3D = "NOT_AVAILABLE"
AI_GENERATION = "NOT_AVAILABLE"
