"""Authority grant compatibility validation for C07."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.xcat.reasons import ReasonCode


def _parse_ts(value: str) -> datetime:
    # Accept trailing Z
    text = value.replace("Z", "+00:00")
    return datetime.fromisoformat(text)


def _check_args_against_constraints(
    arguments: Mapping[str, Any], constraints: Mapping[str, Any]
) -> bool:
    allowed = constraints.get("allowed_keys")
    if allowed is not None:
        if not set(arguments.keys()) <= set(allowed):
            return False
    suffix = constraints.get("filename_suffix")
    if suffix is not None and "filename" in arguments:
        if not str(arguments["filename"]).endswith(str(suffix)):
            return False
    max_len = constraints.get("content_b64_len_max")
    if max_len is not None and "content_b64_len_max" in arguments:
        try:
            if int(arguments["content_b64_len_max"]) > int(max_len):
                return False
        except (TypeError, ValueError):
            return False
    return True


def validate_grant_compatibility(
    grant: AuthorityGrant | None,
    *,
    capability: str,
    target: str,
    arguments: Mapping[str, Any],
    now: str,
) -> tuple[bool, tuple[str, ...]]:
    """Return (ok, reason_code_values). Never mints authority."""
    if grant is None:
        return False, (ReasonCode.EXECUTION_MISSING_AUTHORITY.value,)

    reasons: list[str] = []

    if str(grant.revocation_state).upper() == "REVOKED":
        reasons.append(ReasonCode.AUTHORITY_REVOKED.value)

    try:
        now_dt = _parse_ts(now)
        exp_dt = _parse_ts(grant.expires_at)
        if now_dt > exp_dt:
            reasons.append(ReasonCode.AUTHORITY_EXPIRED.value)
    except ValueError:
        reasons.append(ReasonCode.AUTHORITY_EXPIRED.value)

    if int(grant.uses_consumed) >= int(grant.use_limit):
        reasons.append(ReasonCode.AUTHORITY_CONSUMED.value)

    if grant.capability != capability:
        reasons.append(ReasonCode.SCOPE_MISMATCH.value)

    if grant.target != target:
        reasons.append(ReasonCode.TARGET_DRIFT.value)

    if not _check_args_against_constraints(arguments, grant.argument_constraints):
        reasons.append(ReasonCode.ARGUMENT_DRIFT.value)

    if reasons:
        return False, tuple(reasons)
    return True, ()
