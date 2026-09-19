"""K2 Proof Transaction — semantic snapshot, obligations, ledger, lease, patch, commit.

In-process deterministic semantic atomicity only.
Durable / distributed / fencing / heartbeat belong to G3 — not implemented here.
"""

from spe_runtime.proof.commit import CommitResult, commit_semantic_patch
from spe_runtime.proof.lease import (
    SemanticProofLease,
    assert_not_authority_grant,
    consume_lease,
    is_authority_grant,
    issue_semantic_lease,
)
from spe_runtime.proof.ledger import ProofLedger, append_entry, empty_ledger
from spe_runtime.proof.obligation import ProofObligation, make_obligation
from spe_runtime.proof.patch import (
    ProofCarryingPatch,
    SemanticDeltaStep,
    apply_semantic_delta,
    make_patch,
)
from spe_runtime.proof.receipt import VerificationReceipt
from spe_runtime.proof.snapshot import SemanticSnapshot, make_snapshot
from spe_runtime.proof.types import (
    DeltaAction,
    LeaseStatus,
    ObligationStatus,
    ProofType,
    Verdict,
    proof_type_compatible,
)
from spe_runtime.proof.verify import verify_obligation

__all__ = [
    "ProofType",
    "Verdict",
    "LeaseStatus",
    "ObligationStatus",
    "DeltaAction",
    "proof_type_compatible",
    "SemanticSnapshot",
    "make_snapshot",
    "ProofObligation",
    "make_obligation",
    "VerificationReceipt",
    "verify_obligation",
    "ProofLedger",
    "empty_ledger",
    "append_entry",
    "SemanticProofLease",
    "issue_semantic_lease",
    "consume_lease",
    "assert_not_authority_grant",
    "is_authority_grant",
    "ProofCarryingPatch",
    "SemanticDeltaStep",
    "make_patch",
    "apply_semantic_delta",
    "CommitResult",
    "commit_semantic_patch",
]
