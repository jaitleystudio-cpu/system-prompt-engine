"""Offline portable compile path: one structured request → PromptArtifact → optional .spe.

This does NOT claim NLP understanding of free text. Callers supply the user
request string as the goal atom; optional MUST/MUST_NOT/PREFERENCE lists are
encoded explicitly. Deterministic. Network-free. Provider-free.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt import (
    PlanningHints,
    PromptArtifact,
    build_prompt_artifact,
)
from spe_runtime.provenance import Provenance
from spe_runtime.proof.snapshot import make_snapshot
from spe_runtime.requirements import RequirementKind
from spe_runtime.storage import SpeArtifact, build_spe_artifact, save_spe


@dataclass(frozen=True)
class CompileResult:
    """Offline compile outputs — not qualification, authority, or proof of world truth."""

    contract: ProtectedIntentContract
    prompt_artifact: PromptArtifact
    spe_artifact: SpeArtifact | None = None
    spe_path: str | None = None


def _add(
    c: ProtectedIntentContract,
    *,
    key: str,
    kind: RequirementKind,
    value: str,
    source_ref: str,
    provenance: Provenance = Provenance.USER_EXPLICIT,
) -> ProtectedIntentContract:
    return propose_requirement(
        c,
        semantic_key=key,
        kind=kind,
        value=value,
        provenance=provenance,
        source_ref=source_ref,
    )


def compile_portable_request(
    user_request: str,
    *,
    must: Sequence[str] = (),
    must_not: Sequence[str] = (),
    should: Sequence[str] = (),
    preferences: Sequence[str] = (),
    planning_hints: PlanningHints | None = None,
    target_profile: str = "ANY_AI",
    context_blocks: Mapping[str, str] | None = None,
) -> CompileResult:
    """Compile a portable PromptArtifact with zero network / zero provider dependency.

    Raises SpeTypedError on conflicted/incomplete contracts (fail closed).
    """
    if not isinstance(user_request, str) or not user_request.strip():
        raise SpeTypedError(
            ErrorCode.K3_PROMPT_INVALID_INPUT,
            "user_request must be a non-empty string",
        )
    c = ProtectedIntentContract()
    c = _add(
        c,
        key="goal",
        kind=RequirementKind.MUST,
        value=user_request.strip(),
        source_ref="user.request",
    )
    for i, item in enumerate(must):
        c = _add(
            c,
            key=f"must.{i}",
            kind=RequirementKind.MUST,
            value=str(item),
            source_ref=f"user.must.{i}",
        )
    for i, item in enumerate(must_not):
        c = _add(
            c,
            key=f"must_not.{i}",
            kind=RequirementKind.MUST_NOT,
            value=str(item),
            source_ref=f"user.must_not.{i}",
        )
    for i, item in enumerate(should):
        c = _add(
            c,
            key=f"should.{i}",
            kind=RequirementKind.SHOULD,
            value=str(item),
            source_ref=f"user.should.{i}",
        )
    for i, item in enumerate(preferences):
        c = _add(
            c,
            key=f"pref.{i}",
            kind=RequirementKind.PREFERENCE,
            value=str(item),
            source_ref=f"user.pref.{i}",
            provenance=Provenance.USER_EXPLICIT,
        )

    art = build_prompt_artifact(
        c,
        planning_hints=planning_hints,
        target_profile=target_profile,
        context_blocks=context_blocks,
    )
    return CompileResult(contract=c, prompt_artifact=art)


def compile_and_persist_spe(
    user_request: str,
    path: str | Path,
    *,
    must: Sequence[str] = (),
    must_not: Sequence[str] = (),
    should: Sequence[str] = (),
    preferences: Sequence[str] = (),
    planning_hints: PlanningHints | None = None,
    target_profile: str = "ANY_AI",
    context_blocks: Mapping[str, str] | None = None,
    snapshot_version: int = 1,
) -> CompileResult:
    """Compile portable prompt and write a local .spe artifact (offline)."""
    result = compile_portable_request(
        user_request,
        must=must,
        must_not=must_not,
        should=should,
        preferences=preferences,
        planning_hints=planning_hints,
        target_profile=target_profile,
        context_blocks=context_blocks,
    )
    snap = make_snapshot(result.contract, version=int(snapshot_version))
    spe = build_spe_artifact(snap, prompt_artifact=result.prompt_artifact)
    out = Path(path)
    save_spe(spe, out)
    return CompileResult(
        contract=result.contract,
        prompt_artifact=result.prompt_artifact,
        spe_artifact=spe,
        spe_path=str(out),
    )


__all__ = [
    "CompileResult",
    "compile_portable_request",
    "compile_and_persist_spe",
]
