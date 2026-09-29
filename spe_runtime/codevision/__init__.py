"""CODEVISION foundation: screenshot observation in, six structure targets out.

Visual fidelity is not measured here. Proof documents stay UNPROVEN.
"""

from spe_runtime.codevision.compiler import StructureDocument, compile_structure
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.observation import normalize_observation, observation_digest
from spe_runtime.codevision.proof import (
    VisualFidelityProof,
    assert_proof_binds,
    build_visual_fidelity_proof,
    load_visual_fidelity_proof,
)
from spe_runtime.codevision.targets import (
    CLAIM_BOUNDARY,
    SIX_TARGETS,
    UNMEASURED_CLAIMS,
    VISUAL_FIDELITY_STATUS,
)

__all__ = [
    "CLAIM_BOUNDARY",
    "CodevisionContractError",
    "SIX_TARGETS",
    "StructureDocument",
    "UNMEASURED_CLAIMS",
    "VISUAL_FIDELITY_STATUS",
    "VisualFidelityProof",
    "assert_proof_binds",
    "build_visual_fidelity_proof",
    "compile_structure",
    "load_visual_fidelity_proof",
    "normalize_observation",
    "observation_digest",
]
