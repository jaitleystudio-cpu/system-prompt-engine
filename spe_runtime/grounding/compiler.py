"""Grounding compiler — immutable context bundles feeding C02 ownership."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from spe_runtime.categories._common import FORBIDDEN_PAYLOAD_KEYS
from spe_runtime.grounding.firewall import sanitize_external_payload
from spe_runtime.grounding.models import ContextCapsule, ContextType, SupportStatus

# Capsules are DATA/OBSERVATION/REFERENCE only — never authority or grants.
_ALLOWED_AUTHORITY_CLASSES = frozenset(
    {
        "REFERENCE",
        "DATA",
        "OBSERVATION",
        "NONE",
    }
)

_UNCERTAIN_SUPPORT = frozenset(
    {
        SupportStatus.PARTIALLY_SUPPORTED,
        SupportStatus.CONTRADICTED,
        SupportStatus.MIXED,
        SupportStatus.INSUFFICIENT,
        SupportStatus.PREPRINT_ONLY,
        SupportStatus.UNVERIFIED,
    }
)


@dataclass(frozen=True)
class GroundingBundle:
    """Immutable accepted context set ready for category ownership bridges."""

    request_text: str
    capsules: tuple[ContextCapsule, ...]
    reason_codes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "request_text", str(self.request_text))
        object.__setattr__(self, "capsules", tuple(self.capsules))
        object.__setattr__(
            self,
            "reason_codes",
            tuple(str(c) for c in self.reason_codes),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_text": self.request_text,
            "capsules": [c.to_dict() for c in self.capsules],
            "reason_codes": list(self.reason_codes),
        }


def _validate_capsule(capsule: ContextCapsule) -> None:
    """Reject capsules that violate provenance, source, firewall, or taint law."""
    if not isinstance(capsule, ContextCapsule):
        raise TypeError("capsule must be a ContextCapsule")

    source_id = str(capsule.source_id).strip()
    provenance_digest = str(capsule.provenance_digest).strip()
    if not source_id:
        raise ValueError("capsule missing source_id (source)")
    if not provenance_digest:
        raise ValueError("capsule missing provenance_digest (provenance)")

    authority = str(capsule.authority_class).strip().upper()
    if authority not in _ALLOWED_AUTHORITY_CLASSES:
        raise ValueError(
            f"capsule authority_class {capsule.authority_class!r} violates "
            "firewall DATA-only law (allowed: REFERENCE/DATA/OBSERVATION/NONE)"
        )

    # External / non-user capsules must already carry UNTRUSTED_SOURCE taint
    # before firewall sanitize (sanitize would otherwise auto-add it).
    if capsule.context_type != ContextType.USER_DATA:
        if "UNTRUSTED_SOURCE" not in set(capsule.taint_labels):
            raise ValueError(
                "capsule missing UNTRUSTED_SOURCE taint label (firewall/taint)"
            )

    # Reuse source firewall: forbidden structural keys + nested sanitize walk.
    payload = capsule.to_dict()
    bad = FORBIDDEN_PAYLOAD_KEYS & set(payload.keys())
    if bad:
        raise ValueError(f"capsule contains forbidden keys (firewall): {sorted(bad)}")
    sanitize_external_payload(payload)


def compile_context(
    request_text: str,
    capsules: tuple[ContextCapsule, ...],
) -> GroundingBundle:
    """Validate and freeze capsules into an immutable grounding bundle.

    Rejects capsules whose source/provenance identifiers are missing or whose
    taint/authority metadata violates the source firewall. Does not own
    authority, K3, or category write-sets.
    """
    if not isinstance(capsules, tuple):
        capsules = tuple(capsules)

    accepted: list[ContextCapsule] = []
    for capsule in capsules:
        _validate_capsule(capsule)
        accepted.append(capsule)

    reason_codes: list[str] = []
    if not accepted:
        reason_codes.append("NO_CAPSULES_ACCEPTED")
    else:
        reason_codes.append("CAPSULES_VALIDATED")

    return GroundingBundle(
        request_text=str(request_text),
        capsules=tuple(accepted),
        reason_codes=tuple(reason_codes),
    )


def research_capsules_to_c02_inputs(
    bundle: GroundingBundle,
) -> tuple[
    tuple[Mapping[str, Any], ...],
    tuple[Mapping[str, Any], ...],
    tuple[Mapping[str, Any], ...],
]:
    """Map a grounding bundle to C02-compatible facts/provenance/uncertainties.

    Output is DATA only and must be applied through ``research(...)`` so C02
    ownership and provenance invariants remain intact.
    """
    if not isinstance(bundle, GroundingBundle):
        raise TypeError("bundle must be a GroundingBundle")

    facts: list[dict[str, Any]] = []
    provenance: list[dict[str, Any]] = []
    uncertainties: list[dict[str, Any]] = []

    for capsule in bundle.capsules:
        # Prefer provenance_digest as stable provenance_id; keep source_id linked.
        prov_id = str(capsule.provenance_digest).strip()
        provenance.append(
            {
                "provenance_id": prov_id,
                "source": str(capsule.source_id),
                "source_class": str(capsule.source_class),
                "authority_class": str(capsule.authority_class),
                "retrieved_at": str(capsule.retrieved_at),
                "capsule_id": str(capsule.capsule_id),
                "digest": prov_id,
            }
        )

        statement = str(capsule.claim_or_observation).strip() or str(capsule.value)
        facts.append(
            {
                "fact_id": f"fact:{capsule.capsule_id}",
                "statement": statement,
                "value": str(capsule.value),
                "provenance_ids": [prov_id],
                "support_status": (
                    capsule.support_status.value
                    if hasattr(capsule.support_status, "value")
                    else str(capsule.support_status)
                ),
                "confidence": float(capsule.confidence),
                "capsule_id": str(capsule.capsule_id),
                "context_type": (
                    capsule.context_type.value
                    if hasattr(capsule.context_type, "value")
                    else str(capsule.context_type)
                ),
            }
        )

        if capsule.support_status in _UNCERTAIN_SUPPORT:
            uncertainties.append(
                {
                    "uncertainty_id": f"u:{capsule.capsule_id}",
                    "description": (
                        f"support_status={capsule.support_status.value} "
                        f"for capsule {capsule.capsule_id}"
                    ),
                    "capsule_id": str(capsule.capsule_id),
                    "support_status": capsule.support_status.value,
                }
            )

    return tuple(facts), tuple(provenance), tuple(uncertainties)
