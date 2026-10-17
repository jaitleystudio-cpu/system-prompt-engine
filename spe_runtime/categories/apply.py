"""Apply category payloads onto CrossCategoryEnvelope (payload specialization only).

Laws:
- Category modules specialize category_payload only (plus active_category, proposals, trace).
- MUST NOT mutate facts/provenance/uncertainties/authority/hard_constraints/goal_identity/execution_grants.
- Category-specific anti-laundering rules for mastery, certification, build status, rights, credentials, canon.
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories._common import FORBIDDEN_PAYLOAD_KEYS, replace_envelope
from spe_runtime.categories.payloads import allowed_fields_for
from spe_runtime.xcat.migration import reject_legacy_payload_reinterpretation
from spe_runtime.xcat.models import CATEGORY_IDS, CrossCategoryEnvelope

# Meta key for C12 canon overwrite; never stored in category_payload.
_CANON_CONFIRM_KEY = "confirm_canon_overwrite"

# Status keys that must not appear in C09 payloads (code generation ≠ verification).
_C09_FORBIDDEN_STATUS_KEYS: frozenset[str] = frozenset(
    {
        "BUILD_PASS",
        "TEST_PASS",
        "VERIFIED",
        "build_pass",
        "test_pass",
        "verified",
    }
)

_C10_RIGHTS_ORACLE_KEYS: frozenset[str] = frozenset(
    {
        "LICENSED",
        "licensed",
        "rights_oracle",
        "license_verified",
        "copyright_cleared",
    }
)

_C11_CREDENTIAL_LAUNDER_KEYS: frozenset[str] = frozenset(
    {
        "VERIFIED_CREDENTIAL",
        "verified_credential",
        "credential_verified",
        "USER_CLAIM_AS_VERIFIED",
    }
)


def _reject_unknown_fields(category_id: str, payload: Mapping[str, Any]) -> None:
    allowed = allowed_fields_for(category_id)
    unknown = sorted(set(payload.keys()) - allowed)
    if unknown:
        raise ValueError(
            f"{category_id} payload contains unknown fields: {unknown}"
        )


def _reject_forbidden_payload_keys(
    category_id: str, payload: Mapping[str, Any]
) -> None:
    """Reject kernel-commit keys unless the name is a ratified payload field.

    C07 WorkExecutionProjectIR includes ``authority`` and ``receipt`` as payload
    data. Those names stay inside category_payload and never write
    envelope.authority_state or execution receipts.
    """
    allowed = allowed_fields_for(category_id)
    bad = (FORBIDDEN_PAYLOAD_KEYS & set(payload.keys())) - allowed
    if bad:
        raise ValueError(f"category_payload contains forbidden keys: {sorted(bad)}")


def _status_claims_mastered(value: Any) -> bool:
    if isinstance(value, str):
        return value.upper() == "MASTERED"
    if isinstance(value, Mapping):
        status = value.get("status")
        if isinstance(status, str) and status.upper() == "MASTERED":
            return True
        level = value.get("level")
        if isinstance(level, str) and level.upper() == "MASTERED":
            return True
    return False


def _enforce_c04(payload: Mapping[str, Any]) -> None:
    # Human-certified translation requires explicit evidence field content.
    policy = payload.get("localization_policy")
    certified = False
    if isinstance(policy, Mapping):
        cert = policy.get("certification") or policy.get("status")
        if isinstance(cert, str) and "HUMAN_CERTIFIED" in cert.upper().replace("-", "_"):
            certified = True
        if policy.get("human_certified") is True:
            certified = True
    if certified and not payload.get("alignment_map"):
        raise ValueError(
            "C04: cannot claim translation human-certified without evidence"
        )


def _enforce_c05(payload: Mapping[str, Any]) -> None:
    mastered = any(
        _status_claims_mastered(payload.get(field))
        for field in ("learner_state", "progression")
    )
    if mastered and not payload.get("mastery_evidence"):
        raise ValueError("C05: MUST NOT claim MASTERED without mastery_evidence")


def _enforce_c08(payload: Mapping[str, Any]) -> None:
    # Reject elevating hypothesis→fact or experiment plan→completed.
    experiments = payload.get("experiments")
    if isinstance(experiments, Mapping):
        status = str(experiments.get("status", "")).upper()
        kind = str(experiments.get("kind", "")).lower()
        if status in {"COMPLETED", "DONE", "FACT", "PROVEN"} and kind in {
            "hypothesis",
            "plan",
            "experiment_plan",
        }:
            raise ValueError(
                "C08: MUST NOT elevate hypothesis/experiment plan to completed/fact"
            )
        if experiments.get("promote_to_fact") is True:
            raise ValueError("C08: MUST NOT elevate hypothesis→fact")
    for key in ("hypothesis_as_fact", "experiment_completed", "promote_to_fact"):
        if key in payload:
            raise ValueError(f"C08: forbidden status laundering key: {key}")
    metrics = payload.get("metrics")
    if isinstance(metrics, Mapping) and metrics.get("hypothesis_as_fact") is True:
        raise ValueError("C08: MUST NOT elevate hypothesis→fact")


def _collect_keys(value: Any, *, depth: int = 0) -> set[str]:
    keys: set[str] = set()
    if depth > 8:
        return keys
    if isinstance(value, Mapping):
        for k, v in value.items():
            keys.add(str(k))
            keys |= _collect_keys(v, depth=depth + 1)
    elif isinstance(value, (list, tuple)):
        for item in value:
            keys |= _collect_keys(item, depth=depth + 1)
    return keys


def _enforce_c09(payload: Mapping[str, Any]) -> None:
    keys = _collect_keys(payload)
    if keys & _C09_FORBIDDEN_STATUS_KEYS:
        raise ValueError(
            "C09: MUST NOT claim BUILD_PASS/TEST_PASS/VERIFIED from mere code generation"
        )


def _enforce_c10(payload: Mapping[str, Any]) -> None:
    if _C10_RIGHTS_ORACLE_KEYS & set(payload.keys()):
        raise ValueError(
            "C10: PUBLICLY_VIEWABLE != LICENSED; no rights oracle claims"
        )
    rights = payload.get("rights_provenance")
    if isinstance(rights, Mapping):
        status = str(rights.get("status", "")).upper()
        if status in {"LICENSED", "LICENSE_VERIFIED", "COPYRIGHT_CLEARED"}:
            raise ValueError(
                "C10: PUBLICLY_VIEWABLE != LICENSED; no rights oracle claims"
            )
        if rights.get("PUBLICLY_VIEWABLE") is True and rights.get("LICENSED") is True:
            raise ValueError(
                "C10: PUBLICLY_VIEWABLE != LICENSED; no rights oracle claims"
            )


def _enforce_c11(payload: Mapping[str, Any]) -> None:
    if _C11_CREDENTIAL_LAUNDER_KEYS & set(payload.keys()):
        raise ValueError(
            "C11: USER_CLAIM != VERIFIED_CREDENTIAL; forbidden status laundering"
        )
    evidence = payload.get("evidence_of_skills")
    if isinstance(evidence, Mapping):
        if evidence.get("USER_CLAIM") is True and evidence.get("VERIFIED_CREDENTIAL") is True:
            raise ValueError(
                "C11: USER_CLAIM != VERIFIED_CREDENTIAL; forbidden status laundering"
            )
        if str(evidence.get("status", "")).upper() == "VERIFIED_CREDENTIAL" and not evidence.get(
            "verification_artifact"
        ):
            raise ValueError(
                "C11: USER_CLAIM != VERIFIED_CREDENTIAL; forbidden status laundering"
            )


def _enforce_c12(
    envelope: CrossCategoryEnvelope,
    payload: Mapping[str, Any],
    confirm_canon_overwrite: bool,
) -> None:
    existing = envelope.category_payload
    if existing is None:
        return
    if "canon" not in existing:
        return
    # Existing canon present — require confirmation for any new apply that
    # would replace/overwrite the payload (silent overwrite forbidden).
    if not confirm_canon_overwrite:
        raise ValueError(
            "C12: cannot silently overwrite canon without confirm_canon_overwrite"
        )


def _category_law(
    category_id: str,
    envelope: CrossCategoryEnvelope,
    payload: Mapping[str, Any],
    confirm_canon_overwrite: bool,
) -> None:
    if category_id == "CAT:C04":
        _enforce_c04(payload)
    elif category_id == "CAT:C05":
        _enforce_c05(payload)
    elif category_id == "CAT:C08":
        _enforce_c08(payload)
    elif category_id == "CAT:C09":
        _enforce_c09(payload)
    elif category_id == "CAT:C10":
        _enforce_c10(payload)
    elif category_id == "CAT:C11":
        _enforce_c11(payload)
    elif category_id == "CAT:C12":
        _enforce_c12(envelope, payload, confirm_canon_overwrite)


def apply_category_payload(
    envelope: CrossCategoryEnvelope,
    category_id: str,
    payload: Mapping[str, Any],
    proof_obligation_proposals: tuple[Mapping[str, Any], ...] | list[Mapping[str, Any]] = (),
) -> CrossCategoryEnvelope:
    """Write category_payload / active_category / proposals / trace only."""
    if category_id not in CATEGORY_IDS:
        raise ValueError(f"invalid category_id: {category_id!r}")
    if not isinstance(payload, Mapping):
        raise ValueError("payload must be a mapping")

    reject_legacy_payload_reinterpretation(
        envelope.taxonomy_version, category_id, payload
    )

    working = dict(payload)
    confirm = working.pop(_CANON_CONFIRM_KEY, False) is True

    _reject_forbidden_payload_keys(category_id, working)
    _reject_unknown_fields(category_id, working)
    _category_law(category_id, envelope, working, confirm)

    proposals = tuple(dict(p) for p in proof_obligation_proposals)

    after = replace_envelope(
        envelope,
        category_payload=working,
        active_category=category_id,
        proof_obligation_proposals=proposals,
        category_trace=envelope.category_trace + (category_id,),
    )

    # Ownership: kernel fields must remain content-equal.
    if after.facts != envelope.facts:
        raise ValueError("ownership violation: facts mutated")
    if after.provenance != envelope.provenance:
        raise ValueError("ownership violation: provenance mutated")
    if after.uncertainties != envelope.uncertainties:
        raise ValueError("ownership violation: uncertainties mutated")
    if after.hard_constraints != envelope.hard_constraints:
        raise ValueError("ownership violation: hard_constraints mutated")
    if after.goal_identity != envelope.goal_identity:
        raise ValueError("ownership violation: goal_identity mutated")
    if after.execution_grants != envelope.execution_grants:
        raise ValueError("ownership violation: execution_grants mutated")
    if (
        after.authority_state.level != envelope.authority_state.level
        or after.authority_state.status != envelope.authority_state.status
        or tuple(after.authority_state.grants) != tuple(envelope.authority_state.grants)
    ):
        raise ValueError("ownership violation: authority_state mutated")

    return after
