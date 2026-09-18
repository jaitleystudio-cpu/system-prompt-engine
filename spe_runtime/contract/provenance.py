"""Thin re-export of K0 provenance — not a second vocabulary owner."""

from spe_runtime.provenance import (
    CONFIRMABLE_PROVENANCES,
    LOWER_PROVENANCES,
    PROTECTED_PROVENANCES,
    Provenance,
    coerce_provenance,
    is_lower,
    is_protected,
    may_confirm,
    may_overwrite,
)

__all__ = [
    "Provenance",
    "PROTECTED_PROVENANCES",
    "LOWER_PROVENANCES",
    "CONFIRMABLE_PROVENANCES",
    "coerce_provenance",
    "is_protected",
    "is_lower",
    "may_overwrite",
    "may_confirm",
]
