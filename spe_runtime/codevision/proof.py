"""Visual-fidelity proof format.

The format can be carried beside a structure document. In this foundation the
only legal fidelity status is UNPROVEN. Numeric pixel scores are rejected.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from spe_runtime.codevision.canonical import thaw
from spe_runtime.codevision.compiler import StructureDocument
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.schema_check import validate_instance
from spe_runtime.codevision.targets import (
    CLAIM_BOUNDARY,
    COUNTS_ARE,
    PROOF_SCHEMA_VERSION,
    SIX_TARGETS,
    STRUCTURE_CONTRACT_STATUS,
    UNMEASURED_CLAIMS,
    VISUAL_FIDELITY_STATUS,
)

_DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")
_PROOF_KEYS = frozenset(
    {
        "schema_version",
        "proof_id",
        "observation_id",
        "observation_digest",
        "structure_digest",
        "targets_emitted",
        "target_counts",
        "counts_are",
        "visual_fidelity_status",
        "visual_fidelity_proven",
        "pixel_comparison",
        "numeric_fidelity_score",
        "measured",
        "unmeasured",
        "structure_contract_status",
        "claim_boundary",
    }
)


@dataclass(frozen=True)
class VisualFidelityProof:
    """A proof record that refuses to claim visual fidelity."""

    schema_version: str
    proof_id: str
    observation_id: str
    observation_digest: str
    structure_digest: str
    targets_emitted: tuple[str, ...]
    target_counts: Mapping[str, int]
    counts_are: str
    visual_fidelity_status: str
    visual_fidelity_proven: bool
    pixel_comparison: None
    numeric_fidelity_score: None
    measured: tuple[str, ...]
    unmeasured: tuple[str, ...]
    structure_contract_status: str
    claim_boundary: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "proof_id": self.proof_id,
            "observation_id": self.observation_id,
            "observation_digest": self.observation_digest,
            "structure_digest": self.structure_digest,
            "targets_emitted": list(self.targets_emitted),
            "target_counts": thaw(self.target_counts),
            "counts_are": self.counts_are,
            "visual_fidelity_status": self.visual_fidelity_status,
            "visual_fidelity_proven": self.visual_fidelity_proven,
            "pixel_comparison": self.pixel_comparison,
            "numeric_fidelity_score": self.numeric_fidelity_score,
            "measured": list(self.measured),
            "unmeasured": list(self.unmeasured),
            "structure_contract_status": self.structure_contract_status,
            "claim_boundary": self.claim_boundary,
        }


def build_visual_fidelity_proof(
    structure: StructureDocument, proof_id: str
) -> VisualFidelityProof:
    """Build an UNPROVEN proof bound to a compiled structure document."""
    if not isinstance(structure, StructureDocument):
        raise CodevisionContractError("STRUCTURE_TYPE_INVALID")
    if not isinstance(proof_id, str) or _ID_RE.fullmatch(proof_id) is None:
        raise CodevisionContractError("PROOF_ID_INVALID")
    document = structure.to_dict()
    counts = {
        "region_tree": len(document["targets"]["region_tree"]["nodes"]),
        "element_inventory": len(document["targets"]["element_inventory"]["nodes"]),
        "text_runs": len(document["targets"]["text_runs"]["runs"]),
        "style_observations": len(
            document["targets"]["style_observations"]["observations"]
        ),
        "spatial_relations": len(document["targets"]["spatial_relations"]["relations"]),
        "repeat_groups": len(document["targets"]["repeat_groups"]["groups"]),
    }
    payload = {
        "schema_version": PROOF_SCHEMA_VERSION,
        "proof_id": proof_id,
        "observation_id": structure.observation_id,
        "observation_digest": structure.observation_digest,
        "structure_digest": structure.structure_digest,
        "targets_emitted": list(SIX_TARGETS),
        "target_counts": counts,
        "counts_are": COUNTS_ARE,
        "visual_fidelity_status": VISUAL_FIDELITY_STATUS,
        "visual_fidelity_proven": False,
        "pixel_comparison": None,
        "numeric_fidelity_score": None,
        "measured": [],
        "unmeasured": list(UNMEASURED_CLAIMS),
        "structure_contract_status": STRUCTURE_CONTRACT_STATUS,
        "claim_boundary": CLAIM_BOUNDARY,
    }
    return load_visual_fidelity_proof(payload)


def load_visual_fidelity_proof(payload: Mapping[str, Any]) -> VisualFidelityProof:
    """Load a proof and refuse any visual-fidelity claim or numeric score."""
    if not isinstance(payload, Mapping):
        raise CodevisionContractError("PROOF_TYPE_INVALID")
    keys = set(payload)
    extra = keys - _PROOF_KEYS
    missing = _PROOF_KEYS - keys
    if extra:
        raise CodevisionContractError(
            "PROOF_FIELD_UNKNOWN", ",".join(sorted(str(key) for key in extra))
        )
    if missing:
        raise CodevisionContractError(
            "PROOF_FIELD_MISSING", ",".join(sorted(missing))
        )
    if payload["schema_version"] != PROOF_SCHEMA_VERSION:
        raise CodevisionContractError(
            "SCHEMA_VERSION_UNSUPPORTED", str(payload["schema_version"])
        )
    if payload["visual_fidelity_status"] != VISUAL_FIDELITY_STATUS:
        raise CodevisionContractError("FIDELITY_CLAIM_FORBIDDEN")
    if payload["visual_fidelity_proven"] is not False:
        raise CodevisionContractError("FIDELITY_CLAIM_FORBIDDEN")
    if payload["numeric_fidelity_score"] is not None:
        raise CodevisionContractError("NUMERIC_SCORE_FORBIDDEN")
    if payload["pixel_comparison"] is not None:
        raise CodevisionContractError("PIXEL_COMPARISON_FORBIDDEN")
    if payload["measured"] != []:
        raise CodevisionContractError("MEASURED_CLAIM_FORBIDDEN")
    if list(payload["unmeasured"]) != list(UNMEASURED_CLAIMS):
        raise CodevisionContractError("UNMEASURED_SET_MISMATCH")
    if payload["claim_boundary"] != CLAIM_BOUNDARY:
        raise CodevisionContractError("CLAIM_BOUNDARY_MISMATCH")
    if payload["counts_are"] != COUNTS_ARE:
        raise CodevisionContractError("COUNTS_KIND_MISMATCH")
    if payload["structure_contract_status"] != STRUCTURE_CONTRACT_STATUS:
        raise CodevisionContractError("STRUCTURE_CONTRACT_STATUS_MISMATCH")
    if list(payload["targets_emitted"]) != list(SIX_TARGETS):
        raise CodevisionContractError("TARGET_SET_MISMATCH")
    _require_digest(payload["observation_digest"], "OBSERVATION_DIGEST_INVALID")
    _require_digest(payload["structure_digest"], "STRUCTURE_DIGEST_INVALID")
    _require_id(payload["proof_id"], "PROOF_ID_INVALID")
    _require_id(payload["observation_id"], "OBSERVATION_ID_INVALID")
    counts = _require_counts(payload["target_counts"])
    document = {
        "schema_version": PROOF_SCHEMA_VERSION,
        "proof_id": payload["proof_id"],
        "observation_id": payload["observation_id"],
        "observation_digest": payload["observation_digest"],
        "structure_digest": payload["structure_digest"],
        "targets_emitted": list(SIX_TARGETS),
        "target_counts": counts,
        "counts_are": COUNTS_ARE,
        "visual_fidelity_status": VISUAL_FIDELITY_STATUS,
        "visual_fidelity_proven": False,
        "pixel_comparison": None,
        "numeric_fidelity_score": None,
        "measured": [],
        "unmeasured": list(UNMEASURED_CLAIMS),
        "structure_contract_status": STRUCTURE_CONTRACT_STATUS,
        "claim_boundary": CLAIM_BOUNDARY,
    }
    validate_instance(document, "codevision_visual_fidelity_proof.schema.json")
    return VisualFidelityProof(
        schema_version=PROOF_SCHEMA_VERSION,
        proof_id=str(payload["proof_id"]),
        observation_id=str(payload["observation_id"]),
        observation_digest=str(payload["observation_digest"]),
        structure_digest=str(payload["structure_digest"]),
        targets_emitted=SIX_TARGETS,
        target_counts=MappingProxyType(counts),
        counts_are=COUNTS_ARE,
        visual_fidelity_status=VISUAL_FIDELITY_STATUS,
        visual_fidelity_proven=False,
        pixel_comparison=None,
        numeric_fidelity_score=None,
        measured=(),
        unmeasured=UNMEASURED_CLAIMS,
        structure_contract_status=STRUCTURE_CONTRACT_STATUS,
        claim_boundary=CLAIM_BOUNDARY,
    )


def assert_proof_binds(proof: VisualFidelityProof, structure: StructureDocument) -> None:
    """Check that a proof cites this structure. Does not prove visual fidelity."""
    if not isinstance(proof, VisualFidelityProof) or not isinstance(
        structure, StructureDocument
    ):
        raise CodevisionContractError("PROOF_BIND_TYPE_INVALID")
    if (
        proof.visual_fidelity_status != VISUAL_FIDELITY_STATUS
        or proof.visual_fidelity_proven is not False
    ):
        raise CodevisionContractError("FIDELITY_CLAIM_FORBIDDEN")
    if proof.observation_id != structure.observation_id:
        raise CodevisionContractError("OBSERVATION_ID_MISMATCH")
    if (
        proof.observation_digest != structure.observation_digest
        or proof.structure_digest != structure.structure_digest
    ):
        raise CodevisionContractError("DIGEST_MISMATCH")
    if proof.targets_emitted != SIX_TARGETS:
        raise CodevisionContractError("TARGET_SET_MISMATCH")


def _require_digest(value: Any, reason: str) -> None:
    if not isinstance(value, str) or _DIGEST_RE.fullmatch(value) is None:
        raise CodevisionContractError(reason)


def _require_id(value: Any, reason: str) -> None:
    if not isinstance(value, str) or _ID_RE.fullmatch(value) is None:
        raise CodevisionContractError(reason)


def _require_counts(value: Any) -> dict[str, int]:
    if not isinstance(value, Mapping):
        raise CodevisionContractError("TARGET_COUNTS_INVALID")
    if set(value) != set(SIX_TARGETS):
        raise CodevisionContractError("TARGET_COUNTS_INVALID")
    counts: dict[str, int] = {}
    for name in SIX_TARGETS:
        count = value[name]
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise CodevisionContractError("TARGET_COUNTS_INVALID", name)
        counts[name] = count
    return counts
