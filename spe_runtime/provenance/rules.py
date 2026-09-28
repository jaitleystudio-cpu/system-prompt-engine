"""K0 provenance transition rules — human-sovereignty precedence."""

from __future__ import annotations

from spe_runtime.provenance.models import Provenance

PROTECTED_PROVENANCES: frozenset[Provenance] = frozenset(
    {
        Provenance.USER_EXPLICIT,
        Provenance.USER_CONFIRMED,
        Provenance.SYSTEM_REQUIRED,
    }
)

LOWER_PROVENANCES: frozenset[Provenance] = frozenset(
    {
        Provenance.INFERRED,
        Provenance.MODEL_PROPOSED,
        Provenance.SPE_SUGGESTED,
        Provenance.EXTERNAL_EVIDENCE,
        Provenance.UNKNOWN,
    }
)

_ENUM_VALUES = frozenset(item.value for item in Provenance)


def coerce_provenance(value: Provenance | str) -> Provenance:
    if isinstance(value, Provenance):
        return value
    return Provenance(value)


def is_known_provenance(value: object) -> bool:
    if isinstance(value, Provenance):
        return True
    return isinstance(value, str) and value in _ENUM_VALUES


def is_protected(provenance: Provenance | str) -> bool:
    return coerce_provenance(provenance) in PROTECTED_PROVENANCES


def is_lower(provenance: Provenance | str) -> bool:
    return coerce_provenance(provenance) in LOWER_PROVENANCES


__all__ = [
    "PROTECTED_PROVENANCES",
    "LOWER_PROVENANCES",
    "coerce_provenance",
    "is_known_provenance",
    "is_protected",
    "is_lower",
]
