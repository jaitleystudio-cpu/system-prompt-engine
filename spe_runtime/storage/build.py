"""K6 SpeArtifact builder — sole canonical writer of spe_artifact_identity.

Also the sole writer of direct parent lineage binding on SpeArtifact.
Does not mutate sources. Does not mint authority, proof, or qualification.
"""

from __future__ import annotations

from typing import Any

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.portability.canonical import canonicalize
from spe_runtime.proof.snapshot import (
    SemanticSnapshot,
    protected_intent_digest,
    requirement_graph_digest,
)
from spe_runtime.prompt.models import PromptArtifact
from spe_runtime.storage.models import (
    ARTIFACT_ID_PREFIX,
    FORMAT_NAME,
    FORMAT_VERSION,
    PROMPT_DIGEST_PREFIX,
    PROOF_LEDGER_PREFIX,
    SpeArtifact,
)
from spe_runtime.storage.validate import compute_artifact_id, validate_spe_artifact


def _assert_prefix(value: str | None, prefix: str, field: str, code: ErrorCode) -> None:
    if value is None:
        return
    if not isinstance(value, str) or not value.startswith(prefix):
        raise SpeTypedError(code, f"{field} must start with {prefix}")


def build_spe_artifact(
    snapshot: SemanticSnapshot,
    *,
    prompt_artifact: PromptArtifact | None = None,
    parent_artifact_id: str | None = None,
    proof_ledger_digest: str | None = None,
) -> SpeArtifact:
    """ONE canonical SpeArtifact / spe_artifact_identity writer (K6).

    Identity preimage (excludes artifact_id):
      format, format_version,
      snapshot_id, snapshot_version,
      protected_intent_digest, requirement_graph_digest,
      prompt_content_digest, proof_ledger_digest,
      parent_artifact_id, contract_validity,
      protected_intent_payload

    Non-identity metadata: none in Ring-0 (no path/filename/timestamps).
    """
    if not isinstance(snapshot, SemanticSnapshot):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "snapshot must be a SemanticSnapshot",
        )

    contract = snapshot.protected_intent
    if not isinstance(contract, ProtectedIntentContract):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "snapshot.protected_intent must be ProtectedIntentContract",
        )

    # Copy-on-write: snapshot fields are read-only; rebuild digests from contract.
    pid = protected_intent_digest(contract)
    rg = requirement_graph_digest(contract)
    if pid != snapshot.protected_intent_digest or rg != snapshot.requirement_graph_digest:
        raise SpeTypedError(
            ErrorCode.K6_SNAPSHOT_BINDING_MISMATCH,
            "snapshot digests do not match protected_intent contents",
        )

    prompt_digest: str | None = None
    if prompt_artifact is not None:
        if not isinstance(prompt_artifact, PromptArtifact):
            raise SpeTypedError(
                ErrorCode.K6_INVALID_ARTIFACT,
                "prompt_artifact must be PromptArtifact or None",
            )
        prompt_digest = prompt_artifact.prompt_content_digest
        _assert_prefix(
            prompt_digest,
            PROMPT_DIGEST_PREFIX,
            "prompt_content_digest",
            ErrorCode.K6_INVALID_ARTIFACT,
        )
        # Binding consistency where verifiable: contract digest vs prompt binding
        # PromptArtifact stores pic- digest of a related payload — if present and
        # contract is CONFLICTED, PromptArtifact should not exist; if VALID,
        # we only require pad- domain, not equality of unrelated digest schemes.
        if prompt_digest.startswith(ARTIFACT_ID_PREFIX):
            raise SpeTypedError(
                ErrorCode.K6_INVALID_ARTIFACT,
                "prompt_content_digest must not use spe- domain",
            )

    _assert_prefix(
        proof_ledger_digest,
        PROOF_LEDGER_PREFIX,
        "proof_ledger_digest",
        ErrorCode.K6_INVALID_ARTIFACT,
    )
    _assert_prefix(
        parent_artifact_id,
        ARTIFACT_ID_PREFIX,
        "parent_artifact_id",
        ErrorCode.K6_INVALID_LINEAGE,
    )

    payload_raw = contract.to_dict()
    # Do NOT reorder requirements/conflicts lists: protected_intent_digest (pid-)
    # hashes contract.to_dict() list order. Reordering would desynchronize
    # embedded payload from the bound pid-/rg- digests (G1R-8R-F01).
    # canonicalize() still sorts object keys (including graph.nodes).
    payload = canonicalize(payload_raw)
    if not isinstance(payload, dict):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload must canonicalize to object",
        )

    validity = contract.validity.value
    # Conflict preservation: embedded validity must remain CONFLICTED when so.
    if payload.get("validity") != validity:
        # contract.to_dict() includes validity — must agree
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "embedded validity mismatch",
        )

    preimage: dict[str, Any] = {
        "format": FORMAT_NAME,
        "format_version": FORMAT_VERSION,
        "snapshot_id": snapshot.snapshot_id,
        "snapshot_version": int(snapshot.version),
        "protected_intent_digest": pid,
        "requirement_graph_digest": rg,
        "prompt_content_digest": prompt_digest,
        "proof_ledger_digest": proof_ledger_digest,
        "parent_artifact_id": parent_artifact_id,
        "contract_validity": validity,
        "protected_intent_payload": payload,
    }
    artifact_id = compute_artifact_id(preimage)

    if parent_artifact_id is not None and parent_artifact_id == artifact_id:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_LINEAGE,
            "direct self-parent lineage is forbidden",
        )

    artifact = SpeArtifact(
        format=FORMAT_NAME,
        format_version=FORMAT_VERSION,
        artifact_id=artifact_id,
        snapshot_id=snapshot.snapshot_id,
        snapshot_version=int(snapshot.version),
        protected_intent_digest=pid,
        requirement_graph_digest=rg,
        prompt_content_digest=prompt_digest,
        proof_ledger_digest=proof_ledger_digest,
        parent_artifact_id=parent_artifact_id,
        contract_validity=validity,
        protected_intent_payload=payload,
    )
    return validate_spe_artifact(artifact)


__all__ = ["build_spe_artifact"]
