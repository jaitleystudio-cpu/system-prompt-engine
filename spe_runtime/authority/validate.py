"""Authority grant compatibility validation for C07."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.xcat.reasons import ReasonCode


def _parse_ts(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("timestamp must be a string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp requires an offset")
    return parsed


def _amount_value(raw: Any) -> Decimal | None:
    """Compare finite decimal values without truncating fractional amounts."""
    if isinstance(raw, Mapping):
        for key in ("value", "amount"):
            if key in raw:
                return _amount_value(raw[key])
        return None
    if isinstance(raw, bool) or not isinstance(raw, (int, float, str, Decimal)):
        return None
    try:
        value = Decimal(str(raw))
        return value if value.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def _nested_amounts_within(obj: Any, amount_max: Decimal) -> bool:
    """Walk nested args; any amount / *_amount field must be <= amount_max."""
    if isinstance(obj, Mapping):
        for key, val in obj.items():
            key_s = str(key)
            if key_s == "amount" or key_s.endswith("_amount"):
                parsed = _amount_value(val)
                if parsed is None or parsed > amount_max:
                    return False
            elif isinstance(val, Mapping):
                if not _nested_amounts_within(val, amount_max):
                    return False
            elif isinstance(val, (list, tuple)):
                for item in val:
                    if not _nested_amounts_within(item, amount_max):
                        return False
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            if not _nested_amounts_within(item, amount_max):
                return False
    return True


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
    if max_len is not None:
        limit = _amount_value(max_len)
        if limit is None or limit < 0 or limit != limit.to_integral_value():
            return False
        if "content_b64" in arguments:
            content = arguments["content_b64"]
            if not isinstance(content, str) or len(content) > limit:
                return False
        # Preserve the legacy declared bound, but never use it to override actual content.
        if "content_b64_len_max" in arguments:
            declared = _amount_value(arguments["content_b64_len_max"])
            if declared is None or declared < 0 or declared != declared.to_integral_value() or declared > limit:
                return False

    # Gate 5: amount <= amount_max (fail closed on unparsable / nested over-limit)
    amount_max = constraints.get("amount_max", constraints.get("max_amount"))
    if amount_max is not None:
        limit = _amount_value(amount_max)
        if limit is None:
            return False
        # nested tricks under other allowed keys
        if not _nested_amounts_within(arguments, limit):
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
        # Fail-closed: exact expiry instant is expired (now >= expires_at)
        if now_dt >= exp_dt:
            reasons.append(ReasonCode.AUTHORITY_EXPIRED.value)
    except ValueError:
        reasons.append(ReasonCode.AUTHORITY_EXPIRED.value)

    if int(grant.uses_consumed) >= int(grant.use_limit):
        reasons.append(ReasonCode.AUTHORITY_CONSUMED.value)

    if grant.capability != capability:
        reasons.append(ReasonCode.SCOPE_MISMATCH.value)

    # Exact canonical target — case/whitespace/aliases refuse (no normalization bypass)
    if grant.target != target:
        reasons.append(ReasonCode.TARGET_DRIFT.value)

    if not _check_args_against_constraints(arguments, grant.argument_constraints):
        reasons.append(ReasonCode.ARGUMENT_DRIFT.value)

    if reasons:
        return False, tuple(reasons)
    return True, ()
