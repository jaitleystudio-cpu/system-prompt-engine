"""K3 PromptArtifact — sole canonical writer: build_prompt_artifact.

Compiles immutable PromptArtifact from ProtectedIntentContract (+ optional
caller context). Does not mutate sources, mint authority, create proof,
claim qualification, grant privacy/egress permission, or assign .spe identity.

prompt_content_digest != spe_artifact_identity (K6).
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.contract.protected import ContractValidity, ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.portability.canonical import canonicalize, canonical_dumps
from spe_runtime.proof.types import content_digest
from spe_runtime.prompt.models import (
    PromptArtifact,
    PromptSegment,
    PromptSegmentKind,
    PromptSourceBinding,
)
from spe_runtime.provenance.models import Provenance
from spe_runtime.requirements.models import RequirementKind

_SCHEMA_VERSION = "prompt_artifact.v1"

# Structural section sentinels — context/data must not counterfeit these.
_SEC_PROTECTED_OPEN = "===SPE_PROTECTED_CONSTRAINTS_V1==="
_SEC_PROTECTED_CLOSE = "===END_SPE_PROTECTED_CONSTRAINTS_V1==="
_SEC_SHOULD_OPEN = "===SPE_SHOULD_V1==="
_SEC_SHOULD_CLOSE = "===END_SPE_SHOULD_V1==="
_SEC_PREF_OPEN = "===SPE_PREFERENCE_V1==="
_SEC_PREF_CLOSE = "===END_SPE_PREFERENCE_V1==="
_SEC_CONTEXT_OPEN = "===SPE_CONTEXT_DATA_V1==="
_SEC_CONTEXT_CLOSE = "===END_SPE_CONTEXT_DATA_V1==="
_SEC_TARGET_OPEN = "===SPE_TARGET_PROFILE_V1==="
_SEC_TARGET_CLOSE = "===END_SPE_TARGET_PROFILE_V1==="

_ALL_SENTINELS = (
    _SEC_PROTECTED_OPEN,
    _SEC_PROTECTED_CLOSE,
    _SEC_SHOULD_OPEN,
    _SEC_SHOULD_CLOSE,
    _SEC_PREF_OPEN,
    _SEC_PREF_CLOSE,
    _SEC_CONTEXT_OPEN,
    _SEC_CONTEXT_CLOSE,
    _SEC_TARGET_OPEN,
    _SEC_TARGET_CLOSE,
)


def _escape_structural(text: str) -> str:
    """Deterministic structural encoding so caller data cannot forge section boundaries.

    Replaces sentinel substrings with a length-tagged escaped form that cannot
    equal any open/close marker used by the renderer.

    Input strings are NFC-canonicalized first so equivalent Unicode forms cannot
    produce divergent rendered bytes while sharing a content digest.
    Encoding is intentionally one-way for sentinel-bearing inputs; escaped form
    never equals a structural sentinel (hex alphabet + length tag).
    """
    if not isinstance(text, str):
        text = str(text)
    # Reuse K5 canonicalize for NFC (and ISO-8601 string norms if present).
    out = canonicalize(text)
    if not isinstance(out, str):
        out = str(out)
    for sentinel in _ALL_SENTINELS:
        if sentinel in out:
            # Escape each occurrence; escaped form never equals a sentinel.
            replacement = f"«SPE_ESC:{len(sentinel)}:{sentinel.encode('utf-8').hex()}»"
            out = out.replace(sentinel, replacement)
    return out


def _kind_order(kind: RequirementKind) -> int:
    return {
        RequirementKind.MUST: 0,
        RequirementKind.MUST_NOT: 1,
        RequirementKind.SHOULD: 2,
        RequirementKind.PREFERENCE: 3,
    }[kind]


def _segment_kind_for(req_kind: RequirementKind) -> PromptSegmentKind:
    if req_kind is RequirementKind.MUST or req_kind is RequirementKind.MUST_NOT:
        return PromptSegmentKind.PROTECTED_CONSTRAINT
    if req_kind is RequirementKind.SHOULD:
        return PromptSegmentKind.SHOULD_GUIDANCE
    return PromptSegmentKind.PREFERENCE


def _contract_payload(contract: ProtectedIntentContract) -> dict[str, Any]:
    """Deterministic semantic snapshot of contract (no object ids)."""
    nodes = []
    for rid in sorted(contract.graph.nodes.keys()):
        n = contract.graph.nodes[rid]
        nodes.append(
            {
                "requirement_id": n.requirement_id,
                "semantic_key": n.semantic_key,
                "kind": n.kind.value,
                "value": n.value,
                "provenance": n.provenance.value,
                "source_ref": n.source_ref,
                "statement": n.statement,
            }
        )
    conflicts = [c.to_dict() for c in contract.conflicts]
    return {
        "validity": contract.validity.value,
        "requirements": nodes,
        "conflicts": conflicts,
    }


def _format_constraint_line(
    *,
    req_kind: RequirementKind,
    semantic_key: str,
    value: Any,
    provenance: Provenance,
) -> str:
    """Render one constraint line. Kind label is structural — never softened."""
    val_s = _escape_structural(canonical_dumps(value) if not isinstance(value, str) else value)
    key_s = _escape_structural(semantic_key)
    # Preserve categorical kind and provenance without upgrade.
    return (
        f"{req_kind.value} | key={key_s} | value={val_s} | "
        f"provenance={provenance.value}"
    )


def build_prompt_artifact(
    contract: ProtectedIntentContract,
    *,
    context_blocks: Mapping[str, Any] | None = None,
    target_profile: str | None = None,
) -> PromptArtifact:
    """ONE canonical PromptArtifact writer (K3).

    Validates source semantic state, preserves protected K0 requirements and
    provenance, maintains instruction/data separation, fails closed on HARD
    conflict, renders deterministically, and never mutates inputs.
    """
    if not isinstance(contract, ProtectedIntentContract):
        raise SpeTypedError(
            ErrorCode.K3_PROMPT_INVALID_INPUT,
            "contract must be a ProtectedIntentContract",
        )

    validity = contract.validity
    if validity is ContractValidity.CONFLICTED:
        raise SpeTypedError(
            ErrorCode.K3_PROMPT_CONFLICTED_SOURCE,
            "cannot compile PromptArtifact from CONFLICTED ProtectedIntentContract",
        )
    if validity is ContractValidity.INCOMPLETE:
        # Conservative: do not manufacture missing intent.
        raise SpeTypedError(
            ErrorCode.K3_PROMPT_INVALID_INPUT,
            "cannot compile PromptArtifact from INCOMPLETE ProtectedIntentContract",
        )

    if context_blocks is not None and not isinstance(context_blocks, Mapping):
        raise SpeTypedError(
            ErrorCode.K3_PROMPT_INVALID_INPUT,
            "context_blocks must be a mapping or None",
        )

    payload = _contract_payload(contract)
    contract_digest = content_digest(payload, prefix="pic-", length=64)
    values_digest = content_digest(
        [{"id": n["requirement_id"], "value": n["value"], "kind": n["kind"]} for n in payload["requirements"]],
        prefix="rval-",
        length=64,
    )

    # Deterministic requirement order: kind rank, then semantic_key, then requirement_id
    atoms = sorted(
        contract.graph.nodes.values(),
        key=lambda a: (_kind_order(a.kind), a.semantic_key, a.requirement_id),
    )

    segments: list[PromptSegment] = []
    protected_lines: list[str] = []
    should_lines: list[str] = []
    pref_lines: list[str] = []

    for atom in atoms:
        line = _format_constraint_line(
            req_kind=atom.kind,
            semantic_key=atom.semantic_key,
            value=atom.value,
            provenance=atom.provenance,
        )
        seg = PromptSegment(
            kind=_segment_kind_for(atom.kind),
            requirement_kind=atom.kind.value,
            text=line,
            requirement_ids=(atom.requirement_id,),
            provenance=atom.provenance.value,
            semantic_key=atom.semantic_key,
        )
        segments.append(seg)
        if atom.kind in (RequirementKind.MUST, RequirementKind.MUST_NOT):
            protected_lines.append(line)
        elif atom.kind is RequirementKind.SHOULD:
            should_lines.append(line)
        else:
            pref_lines.append(line)

    # Context / data — never promoted to protected instruction or provenance upgrade.
    ctx = dict(context_blocks or {})
    for key in sorted(ctx.keys(), key=str):
        raw = ctx[key]
        # Encode as canonical JSON then structurally escape sentinels.
        if isinstance(raw, str):
            body = _escape_structural(raw)
        else:
            body = _escape_structural(canonical_dumps(raw))
        key_s = _escape_structural(str(key))
        text = f"CONTEXT key={key_s} | data={body}"
        segments.append(
            PromptSegment(
                kind=PromptSegmentKind.CONTEXT_DATA,
                requirement_kind=None,
                text=text,
                requirement_ids=(),
                provenance=Provenance.UNKNOWN.value,
                semantic_key=str(key),
            )
        )

    if target_profile is not None:
        if not isinstance(target_profile, str):
            raise SpeTypedError(
                ErrorCode.K3_PROMPT_INVALID_INPUT,
                "target_profile must be str or None",
            )
        tp = _escape_structural(target_profile)
        segments.append(
            PromptSegment(
                kind=PromptSegmentKind.TARGET_PROFILE,
                requirement_kind=None,
                text=f"TARGET_PROFILE={tp}",
                requirement_ids=(),
                provenance=Provenance.SYSTEM_REQUIRED.value,
                semantic_key=None,
            )
        )

    # Invariant: every MUST / MUST_NOT from source appears as PROTECTED_CONSTRAINT
    must_ids = {
        a.requirement_id
        for a in atoms
        if a.kind in (RequirementKind.MUST, RequirementKind.MUST_NOT)
    }
    preserved = {
        rid
        for s in segments
        if s.kind is PromptSegmentKind.PROTECTED_CONSTRAINT
        for rid in s.requirement_ids
    }
    if must_ids - preserved:
        raise SpeTypedError(
            ErrorCode.K3_PROMPT_INVARIANT_VIOLATION,
            "protected MUST/MUST_NOT constraints were not preserved in PromptArtifact",
        )

    # Context segments must never claim protected kinds or upgraded provenance
    for s in segments:
        if s.kind is PromptSegmentKind.CONTEXT_DATA:
            if s.requirement_kind in ("MUST", "MUST_NOT", "USER_CONFIRMED"):
                raise SpeTypedError(
                    ErrorCode.K3_PROMPT_INVARIANT_VIOLATION,
                    "context/data cannot carry protected requirement kinds",
                )
            if s.provenance in (
                Provenance.USER_CONFIRMED.value,
                Provenance.USER_EXPLICIT.value,
            ):
                raise SpeTypedError(
                    ErrorCode.K3_PROMPT_INVARIANT_VIOLATION,
                    "context/data cannot claim protected provenance",
                )

    # Deterministic rendered prompt with structural sections
    parts: list[str] = [
        _SEC_PROTECTED_OPEN,
        *protected_lines,
        _SEC_PROTECTED_CLOSE,
        _SEC_SHOULD_OPEN,
        *should_lines,
        _SEC_SHOULD_CLOSE,
        _SEC_PREF_OPEN,
        *pref_lines,
        _SEC_PREF_CLOSE,
        _SEC_CONTEXT_OPEN,
    ]
    for s in segments:
        if s.kind is PromptSegmentKind.CONTEXT_DATA:
            parts.append(s.text)
    parts.append(_SEC_CONTEXT_CLOSE)
    if target_profile is not None:
        parts.extend(
            [
                _SEC_TARGET_OPEN,
                _escape_structural(target_profile),
                _SEC_TARGET_CLOSE,
            ]
        )
    rendered = "\n".join(parts)

    req_ids = tuple(a.requirement_id for a in atoms)
    req_kinds = tuple(a.kind.value for a in atoms)
    prov_markers = tuple(sorted({a.provenance.value for a in atoms}))

    binding = PromptSourceBinding(
        contract_content_digest=contract_digest,
        contract_validity=validity.value,
        requirement_ids=req_ids,
        requirement_kinds=req_kinds,
        requirement_values_digest=values_digest,
        provenance_markers=prov_markers,
    )

    artifact_stub = PromptArtifact(
        schema_version=_SCHEMA_VERSION,
        source_binding=binding,
        segments=tuple(segments),
        rendered_prompt=rendered,
        prompt_content_digest="pending",
        target_profile=target_profile,
    )
    digest_payload = artifact_stub.to_canonical_payload()
    # Exclude placeholder digest field — recompute over semantic content
    digest_payload.pop("prompt_content_digest", None)
    digest_payload["rendered_prompt"] = rendered
    prompt_digest = content_digest(digest_payload, prefix="pad-", length=64)

    return PromptArtifact(
        schema_version=_SCHEMA_VERSION,
        source_binding=binding,
        segments=tuple(segments),
        rendered_prompt=rendered,
        prompt_content_digest=prompt_digest,
        target_profile=target_profile,
    )


__all__ = ["build_prompt_artifact"]
