"""
SPE Ω — Semantic Revocation Slicing & Epistemic Non-Interference Package
"""

from spe_runtime.revocation.kernel import (
    RequirementAuthority,
    RequirementNode,
    RequirementOrigin,
    RequirementStatus,
    RevocationRequest,
    SemanticSliceReport,
    compile_clean_contract,
    compute_backward_orphans,
    compute_forward_slice,
    execute_semantic_revocation_slice,
    synthesize_negative_preconditions,
)

__all__ = [
    "RequirementAuthority",
    "RequirementNode",
    "RequirementOrigin",
    "RequirementStatus",
    "RevocationRequest",
    "SemanticSliceReport",
    "compile_clean_contract",
    "compute_backward_orphans",
    "compute_forward_slice",
    "execute_semantic_revocation_slice",
    "synthesize_negative_preconditions",
]
