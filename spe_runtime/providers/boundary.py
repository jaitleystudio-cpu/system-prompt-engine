"""Authority / qualification boundary for provider outputs."""

from __future__ import annotations

from typing import Any

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.providers.models import NormalizedResult, ToolCallRequest


def assert_no_authority_mint(
    tool_calls: tuple[ToolCallRequest, ...] | list[ToolCallRequest],
) -> None:
    """MODEL TOOL REQUEST != K4 AUTHORITY. Never mint AuthorityGrant here."""
    for tc in tool_calls:
        # Adapter may surface the request; it must not become a grant.
        if isinstance(tc, AuthorityGrant):  # pragma: no cover — type guard
            raise SpeTypedError(
                ErrorCode.G4_AUTHORITY_BOUNDARY,
                "provider tool call cannot be AuthorityGrant",
            )
    # Explicit: constructing AuthorityGrant from tool calls is forbidden API
    _ = tool_calls


def tool_calls_are_not_grants(tool_calls: tuple[ToolCallRequest, ...]) -> bool:
    return all(not isinstance(tc, AuthorityGrant) for tc in tool_calls)


def assert_no_self_qualification(result: NormalizedResult) -> None:
    """Provider text claiming PASS/VERIFIED must not alter K7."""
    texts: list[str] = []
    if result.text:
        texts.append(result.text)
    if result.structured:
        texts.append(str(result.structured))
    blob = "\n".join(texts).upper()
    markers = (
        "SET QUALIFICATION TO PASS",
        "K7_PASS",
        "MARK RESULT VERIFIED",
        "EMPIRICAL FACT VERIFIED",
        "GRANT ME AUTHORITY",
    )
    # Presence is allowed as untrusted data; callers must not treat as evidence.
    # This function documents the boundary — it raises only if structured field
    # attempts to set a canonical SPE state key.
    if result.structured:
        for banned in ("qualification_status", "k7_status", "authority_grant", "verified_fact"):
            if banned in result.structured:
                raise SpeTypedError(
                    ErrorCode.G4_SELF_QUALIFICATION_REJECTED,
                    f"provider structured field {banned} rejected",
                )
    _ = blob  # inspected for documentation / future scanners


def http_success_is_not_truth(http_status: int | None) -> bool:
    """HTTP 200 != task success / empirical verification."""
    return not (http_status is not None and 200 <= http_status < 300 and False)


def refuse_provider_as_k7_evidence(claim: str = "") -> None:
    raise SpeTypedError(
        ErrorCode.G4_SELF_QUALIFICATION_REJECTED,
        "provider output is not K7 evidence" + (f": {claim}" if claim else ""),
    )


__all__ = [
    "assert_no_authority_mint",
    "assert_no_self_qualification",
    "http_success_is_not_truth",
    "refuse_provider_as_k7_evidence",
    "tool_calls_are_not_grants",
]
