"""K0 provenance transition rules — human-sovereignty precedence."""

from __future__ import annotations

from spe_runtime.provenance.models import Provenance

# Higher-authority / protected provenances — cannot be overwritten by lower.
PROTECTED_PROVENANCES: frozenset[Provenance] = frozenset(
    {
        Provenance.USER_EXPLICIT,
        Provenance.USER_CONFIRMED,
        Provenance.SYSTEM_REQUIRED,
    }
)

# Lower-authority provenances — cannot replace protected intent.
LOWER_PROVENANCES: frozenset[Provenance] = frozenset(
    {
        Provenance.INFERRED,
        Provenance.MODEL_PROPOSED,
        Provenance.SPE_SUGGESTED,
        Provenance.EXTERNAL_EVIDENCE,
        Provenance.UNKNOWN,
    }
)

# Provenances that may be promoted via confirm_requirement only.
CONFIRMABLE_PROVENANCES: frozenset[Provenance] = frozenset(
    {
        Provenance.INFERRED,
        Provenance.MODEL_PROPOSED,
        Provenance.SPE_SUGGESTED,
        Provenance.EXTERNAL_EVIDENCE,
        Provenance.SYSTEM_REQUIRED,
        Provenance.USER_EXPLICIT,
    }
)


def coerce_provenance(value: Provenance | str) -> Provenance:
    if isinstance(value, Provenance):
        return value
    return Provenance(value)


def is_protected(provenance: Provenance | str) -> bool:
    return coerce_provenance(provenance) in PROTECTED_PROVENANCES


def is_lower(provenance: Provenance | str) -> bool:
    return coerce_provenance(provenance) in LOWER_PROVENANCES


def may_overwrite(
    existing: Provenance | str,
    incoming: Provenance | str,
) -> bool:
    """Return True iff incoming provenance may replace existing for same key.

    USER_EXPLICIT / USER_CONFIRMED / SYSTEM_REQUIRED cannot be replaced by
    INFERRED / MODEL_PROPOSED / SPE_SUGGESTED / EXTERNAL_EVIDENCE / UNKNOWN.
    """
    ex = coerce_provenance(existing)
    inc = coerce_provenance(incoming)
    if is_protected(ex) and is_lower(inc):
        return False
    # propose cannot mint or re-assert USER_CONFIRMED
    if inc is Provenance.USER_CONFIRMED:
        return False
    return True


def may_confirm(provenance: Provenance | str) -> bool:
    """True iff confirm_requirement may promote this provenance to USER_CONFIRMED."""
    p = coerce_provenance(provenance)
    if p is Provenance.USER_CONFIRMED:
        return False
    if p is Provenance.UNKNOWN:
        return False
    return p in CONFIRMABLE_PROVENANCES


__all__ = [
    "PROTECTED_PROVENANCES",
    "LOWER_PROVENANCES",
    "CONFIRMABLE_PROVENANCES",
    "coerce_provenance",
    "is_protected",
    "is_lower",
    "may_overwrite",
    "may_confirm",
]
