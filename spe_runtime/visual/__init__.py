"""Lane E visual intelligence — semantic input only.

The output boundary is VisualIntentContract. ProtectedIntent, the Requirement
Graph, XCAT, and K3 stay with Lane A. Media authority_delta is always 0.
"""

from spe_runtime.visual.constants import AUTHORITY_DELTA_FROM_MEDIA, SCHEMA_VERSION
from spe_runtime.visual.contract import (
    compile_visual_intent,
    compile_visual_intent_from_mapping,
)
from spe_runtime.visual.envelope import (
    SuppliedOcr,
    VisualAsset,
    VisualInputEnvelope,
    create_envelope,
)
from spe_runtime.visual.errors import (
    UnknownLaunderError,
    VisualAuthorityError,
    VisualInputError,
)
from spe_runtime.visual.models import (
    ClaimVerdict,
    EpistemicStatus,
    InputMode,
    VisualEvidenceGraph,
    VisualIntentContract,
    VisualObservation,
    VisualProvenance,
    VisualUncertainty,
)
from spe_runtime.visual.raster import Raster, raster_with_rects, solid_raster
from spe_runtime.visual.verdict import assert_unknown_is_not_pass, combine_verdicts

__all__ = [
    "AUTHORITY_DELTA_FROM_MEDIA",
    "SCHEMA_VERSION",
    "ClaimVerdict",
    "EpistemicStatus",
    "InputMode",
    "Raster",
    "SuppliedOcr",
    "UnknownLaunderError",
    "VisualAsset",
    "VisualAuthorityError",
    "VisualEvidenceGraph",
    "VisualInputEnvelope",
    "VisualInputError",
    "VisualIntentContract",
    "VisualObservation",
    "VisualProvenance",
    "VisualUncertainty",
    "assert_unknown_is_not_pass",
    "combine_verdicts",
    "compile_visual_intent",
    "compile_visual_intent_from_mapping",
    "create_envelope",
    "raster_with_rects",
    "solid_raster",
]
