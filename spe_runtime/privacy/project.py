"""K4 privacy projection — sole canonical writer: project_privacy.

Deterministic projection/read-model from authoritative semantic fields.
Does not mutate source state, mint authority, or upgrade provenance/trust.
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.privacy.models import (
    PrivacyDirective,
    PrivacyProjection,
    PrivacyProjectionEntry,
)
from spe_runtime.privacy.types import PrivacyClass, ProjectionAction, ProjectionScope
from spe_runtime.proof.types import content_digest
from spe_runtime.provenance.models import Provenance

_SCHEMA_VERSION = "privacy_projection.v1"
_REDACT_MARKER = {"redacted": True}

# Deterministic class→action defaults by scope (contract-minimal, fail-closed).
# USER_PRIVATE never INCLUDE outside INTERNAL.
_SCOPE_DEFAULTS: dict[ProjectionScope, dict[PrivacyClass, ProjectionAction]] = {
    ProjectionScope.INTERNAL: {
        PrivacyClass.PUBLIC: ProjectionAction.INCLUDE,
        PrivacyClass.USER_PRIVATE: ProjectionAction.INCLUDE,
        PrivacyClass.UNKNOWN: ProjectionAction.OMIT,
    },
    ProjectionScope.USER_VISIBLE: {
        PrivacyClass.PUBLIC: ProjectionAction.INCLUDE,
        PrivacyClass.USER_PRIVATE: ProjectionAction.REDACT,
        PrivacyClass.UNKNOWN: ProjectionAction.OMIT,
    },
    ProjectionScope.EXPORT: {
        PrivacyClass.PUBLIC: ProjectionAction.INCLUDE,
        PrivacyClass.USER_PRIVATE: ProjectionAction.OMIT,
        PrivacyClass.UNKNOWN: ProjectionAction.OMIT,
    },
    ProjectionScope.MODEL: {
        PrivacyClass.PUBLIC: ProjectionAction.INCLUDE,
        PrivacyClass.USER_PRIVATE: ProjectionAction.REDACT,
        PrivacyClass.UNKNOWN: ProjectionAction.OMIT,
    },
}


def _coerce_class(value: PrivacyClass | str) -> PrivacyClass:
    if isinstance(value, PrivacyClass):
        return value
    try:
        return PrivacyClass(value)
    except ValueError as exc:
        raise SpeTypedError(
            ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE,
            f"invalid privacy class: {value!r}",
        ) from exc


def _coerce_action(value: ProjectionAction | str | None) -> ProjectionAction | None:
    if value is None:
        return None
    if isinstance(value, ProjectionAction):
        return value
    try:
        return ProjectionAction(value)
    except ValueError as exc:
        raise SpeTypedError(
            ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE,
            f"invalid projection action: {value!r}",
        ) from exc


def _coerce_scope(value: ProjectionScope | str) -> ProjectionScope:
    if isinstance(value, ProjectionScope):
        return value
    try:
        return ProjectionScope(value)
    except ValueError as exc:
        raise SpeTypedError(
            ErrorCode.K4_PRIVACY_INVALID_SCOPE,
            f"invalid projection scope: {value!r}",
        ) from exc


def _coerce_provenance(value: Provenance | str | None) -> Provenance | None:
    if value is None:
        return None
    if isinstance(value, Provenance):
        return value
    try:
        return Provenance(value)
    except ValueError as exc:
        raise SpeTypedError(
            ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE,
            f"invalid provenance: {value!r}",
        ) from exc


def _directive_digest(directives: tuple[PrivacyDirective, ...]) -> str:
    payload = [
        {
            "field_key": d.field_key,
            "privacy_class": d.privacy_class.value,
            "action": d.action.value if d.action is not None else None,
            "reason": d.reason,
        }
        for d in sorted(directives, key=lambda x: x.field_key)
    ]
    return content_digest(payload, prefix="pdir-", length=64)


def _resolve_action(
    privacy_class: PrivacyClass,
    scope: ProjectionScope,
    explicit: ProjectionAction | None,
) -> ProjectionAction:
    if explicit is not None:
        # Explicit INCLUDE of USER_PRIVATE outside INTERNAL is privacy escalation.
        if (
            explicit is ProjectionAction.INCLUDE
            and privacy_class is PrivacyClass.USER_PRIVATE
            and scope is not ProjectionScope.INTERNAL
        ):
            raise SpeTypedError(
                ErrorCode.PRIVACY_ESCALATION,
                "cannot INCLUDE USER_PRIVATE outside INTERNAL scope",
            )
        if (
            explicit is ProjectionAction.INCLUDE
            and privacy_class is PrivacyClass.UNKNOWN
        ):
            raise SpeTypedError(
                ErrorCode.K4_PRIVACY_CONFLICT,
                "cannot INCLUDE UNKNOWN privacy classification",
            )
        return explicit
    return _SCOPE_DEFAULTS[scope][privacy_class]


def _index_directives(
    directives: tuple[PrivacyDirective, ...] | list[PrivacyDirective],
) -> dict[str, PrivacyDirective]:
    by_key: dict[str, PrivacyDirective] = {}
    for raw in directives:
        if not isinstance(raw, PrivacyDirective):
            raise SpeTypedError(
                ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE,
                "directive must be a PrivacyDirective",
            )
        if not raw.field_key or not isinstance(raw.field_key, str):
            raise SpeTypedError(
                ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE,
                "directive field_key required",
            )
        cls = _coerce_class(raw.privacy_class)
        act = _coerce_action(raw.action)
        normalized = PrivacyDirective(
            field_key=raw.field_key,
            privacy_class=cls,
            action=act,
            reason=raw.reason or "",
        )
        if normalized.field_key in by_key:
            prev = by_key[normalized.field_key]
            if (
                prev.privacy_class is not normalized.privacy_class
                or prev.action != normalized.action
            ):
                raise SpeTypedError(
                    ErrorCode.K4_PRIVACY_CONFLICT,
                    f"conflicting privacy directives for {normalized.field_key}",
                )
            # identical re-declaration ok
            continue
        by_key[normalized.field_key] = normalized
    return by_key


def project_privacy(
    *,
    source_id: str,
    source_fields: Mapping[str, Any],
    directives: tuple[PrivacyDirective, ...] | list[PrivacyDirective],
    scope: ProjectionScope | str,
    source_provenance: Mapping[str, Provenance | str] | None = None,
) -> PrivacyProjection:
    """ONE canonical privacy projection writer (K4).

    Accepts authoritative field map + directives + disclosure scope.
    Returns immutable PrivacyProjection. Never mutates inputs.
    Never mints authority. Never upgrades provenance.
    """
    if not source_id or not isinstance(source_id, str):
        raise SpeTypedError(
            ErrorCode.K4_PRIVACY_PROJECTION_FAILED,
            "source_id required",
        )
    if not isinstance(source_fields, Mapping):
        raise SpeTypedError(
            ErrorCode.K4_PRIVACY_PROJECTION_FAILED,
            "source_fields must be a mapping",
        )

    scope_e = _coerce_scope(scope)
    dir_index = _index_directives(tuple(directives))
    prov_map = dict(source_provenance or {})

    entries: list[PrivacyProjectionEntry] = []
    # Deterministic iteration: sorted keys of union(fields, directives)
    all_keys = sorted(set(source_fields.keys()) | set(dir_index.keys()))

    for key in all_keys:
        directive = dir_index.get(key)
        if directive is None:
            # Missing classification → UNKNOWN → fail closed via scope defaults
            privacy_class = PrivacyClass.UNKNOWN
            explicit_action = None
            reason = "missing_classification_defaults_to_UNKNOWN"
        else:
            privacy_class = directive.privacy_class
            explicit_action = directive.action
            reason = directive.reason or f"directive:{privacy_class.value}"

        action = _resolve_action(privacy_class, scope_e, explicit_action)
        if not reason:
            reason = f"scope_default:{scope_e.value}:{privacy_class.value}->{action.value}"

        raw_value = source_fields.get(key)
        if action is ProjectionAction.INCLUDE:
            projected: Any = raw_value
        elif action is ProjectionAction.REDACT:
            projected = dict(_REDACT_MARKER)
        else:
            projected = None

        prov = _coerce_provenance(prov_map.get(key))
        entries.append(
            PrivacyProjectionEntry(
                field_key=key,
                semantic_ref=f"{source_id}#{key}",
                privacy_class=privacy_class,
                action=action,
                reason=reason,
                provenance=prov,
                projected_value=projected,
            )
        )

    dir_digest = _directive_digest(tuple(dir_index.values()))
    # Identity payload excludes nothing needed for determinism; uses projected
    # representation (redacted/omitted), not hidden raw values for non-INCLUDE.
    identity_entries = []
    for e in entries:
        identity_entries.append(
            {
                "field_key": e.field_key,
                "semantic_ref": e.semantic_ref,
                "privacy_class": e.privacy_class.value,
                "action": e.action.value,
                "reason": e.reason,
                "provenance": e.provenance.value if e.provenance is not None else None,
                # INCLUDE may carry value; REDACT/OMIT never carry raw secret
                "projected_value": e.projected_value,
            }
        )
    payload = {
        "schema_version": _SCHEMA_VERSION,
        "source_id": source_id,
        "scope": scope_e.value,
        "directive_digest": dir_digest,
        "entries": identity_entries,
    }
    projection_id = content_digest(payload, prefix="priv-", length=64)
    return PrivacyProjection(
        projection_id=projection_id,
        source_id=source_id,
        scope=scope_e,
        entries=tuple(entries),
        directive_digest=dir_digest,
        schema_version=_SCHEMA_VERSION,
    )


__all__ = ["project_privacy"]
