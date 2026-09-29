"""Local Gilden operations runner.

Evaluates an operations document and returns a receipt. It records local notes,
queues, unsent drafts, report shells, and the controls register. It does not
post, send, host, deploy, emit an analytics beacon, merge, publish, or search
the network. External action dispositions stay NOT_AUTHORIZED. A report or
search review without accepted evidence stays UNKNOWN.
"""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence

from spe_runtime.gilden.contract import (
    ALLOWED_EVIDENCE_SOURCES,
    CONTRACT_ID,
    EVIDENCE_ATTACHED,
    KINDS,
    LINEAGE,
    LOCAL_ACTION,
    LOCAL_RECORD,
    MAX_DOCUMENT_BYTES,
    NETWORK_MODE,
    NOT_A_REPORT,
    NOT_AUTHORIZED,
    REPORT_KINDS,
    REQUESTED_ACTIONS,
    UNKNOWN,
    ReasonCode,
    action_refusal,
    body_digest,
    closed_effect_flags,
    controls_register,
    evidence_digest,
)
from spe_runtime.gilden.validate import schema_errors


def _dedupe(codes: Sequence[str]) -> list[str]:
    ordered: list[str] = []
    for code in codes:
        if code not in ordered:
            ordered.append(code)
    return ordered


def _rejection(reason_codes: Sequence[str], detail: str) -> dict[str, Any]:
    receipt: dict[str, Any] = {
        "contract_id": CONTRACT_ID,
        "lineage": LINEAGE,
        "not_a_release": True,
        "live_agency": False,
        "network_mode": NETWORK_MODE,
        "evaluated": False,
        "disposition": NOT_AUTHORIZED,
        "report_status": UNKNOWN,
        "any_report_unknown": True,
        "external_effects": [],
        "external_actions": controls_register(),
        "reason_codes": _dedupe(reason_codes),
        "detail": detail[:240],
        "items": [],
    }
    receipt.update(closed_effect_flags())
    return receipt


def judge_evidence(
    evidence: Sequence[Mapping[str, Any]],
) -> tuple[tuple[str, ...], tuple[dict[str, str], ...], tuple[str, ...]]:
    """Accept digest-bound local evidence. Forbidden sources stay rejected."""
    accepted: list[str] = []
    rejected: list[dict[str, str]] = []
    reasons: list[str] = []
    seen: set[str] = set()
    for item in evidence:
        evidence_id = str(item.get("evidence_id", ""))
        source = str(item.get("source", ""))
        summary = item.get("summary", "")
        digest = str(item.get("digest", ""))
        if source not in ALLOWED_EVIDENCE_SOURCES:
            rejected.append(
                {
                    "evidence_id": evidence_id,
                    "reason": ReasonCode.EVIDENCE_SOURCE_FORBIDDEN.value,
                }
            )
            reasons.append(ReasonCode.EVIDENCE_SOURCE_FORBIDDEN.value)
            continue
        if (
            not isinstance(summary, str)
            or not summary
            or evidence_digest(summary) != digest
        ):
            rejected.append(
                {
                    "evidence_id": evidence_id,
                    "reason": ReasonCode.EVIDENCE_DIGEST_MISMATCH.value,
                }
            )
            reasons.append(ReasonCode.EVIDENCE_DIGEST_MISMATCH.value)
            continue
        if evidence_id in seen:
            rejected.append(
                {
                    "evidence_id": evidence_id,
                    "reason": ReasonCode.EVIDENCE_DUPLICATE.value,
                }
            )
            reasons.append(ReasonCode.EVIDENCE_DUPLICATE.value)
            continue
        seen.add(evidence_id)
        accepted.append(evidence_id)
    return tuple(accepted), tuple(rejected), tuple(reasons)


def _judge_claims(
    claims: Sequence[Mapping[str, Any]],
    accepted_ids: set[str],
) -> tuple[list[dict[str, str]], list[str]]:
    rows: list[dict[str, str]] = []
    reasons: list[str] = []
    for claim in claims:
        evidence_ids = claim.get("evidence_ids", [])
        bound = (
            isinstance(evidence_ids, list)
            and len(evidence_ids) > 0
            and all(isinstance(item, str) and item in accepted_ids for item in evidence_ids)
        )
        status = EVIDENCE_ATTACHED if bound else UNKNOWN
        rows.append({"claim_id": str(claim.get("claim_id", "")), "status": status})
        if status == UNKNOWN:
            reasons.append(ReasonCode.CLAIM_UNEVIDENCED.value)
    return rows, reasons


def _retention(kind: str, body: str) -> str:
    if kind == "MAINTENANCE":
        return "NOTE"
    if kind == "SEARCH_REVIEW":
        return "REVIEW_NOTE"
    if kind == "RESEARCH_QUEUE":
        return "QUEUE"
    if kind == "SOCIAL_DRAFT":
        return "UNSENT_DRAFT" if body else "NONE"
    if kind == "GROWTH_NOTES":
        return "NOTE"
    if kind == "REPORTING":
        return "REPORT_SHELL"
    if kind == "CONTROLS":
        return "CONTROLS_SNAPSHOT"
    raise RuntimeError(f"unhandled kind: {kind}")


def _report_status(kind: str, accepted_ids: Sequence[str], claims: Sequence[Mapping[str, str]]) -> str:
    if claims:
        if any(row["status"] == UNKNOWN for row in claims):
            return UNKNOWN
        return EVIDENCE_ATTACHED
    if kind in REPORT_KINDS:
        if accepted_ids:
            return EVIDENCE_ATTACHED
        return UNKNOWN
    return NOT_A_REPORT


def _local_record(item: Mapping[str, Any], retention: str) -> dict[str, Any] | None:
    if retention == "NONE":
        return None
    body = str(item["body"])
    record: dict[str, Any] = {
        "work_id": item["work_id"],
        "kind": item["kind"],
        "title": item["title"],
        "body_sha256": body_digest(body),
        "body": body,
        "retention": retention,
        "queued": retention == "QUEUE",
        "fetched": False,
        "unsent_draft": body if retention == "UNSENT_DRAFT" else None,
        "posted": False,
        "sent": False,
    }
    if item["kind"] == "CONTROLS":
        record["controls"] = controls_register()
    return record


def _evaluate_item(item: Mapping[str, Any]) -> dict[str, Any]:
    kind = str(item.get("kind", ""))
    action = str(item.get("requested_action", ""))
    reasons: list[str] = []
    if kind not in KINDS or action not in REQUESTED_ACTIONS:
        receipt: dict[str, Any] = {
            "work_id": str(item.get("work_id", "")),
            "kind": kind,
            "requested_action": action,
            "live_agency": False,
            "network_mode": NETWORK_MODE,
            "not_a_release": True,
            "disposition": NOT_AUTHORIZED,
            "report_status": UNKNOWN,
            "reason_codes": [ReasonCode.KIND_REJECTED.value, ReasonCode.EXTERNAL_NOT_AUTHORIZED.value],
            "external_effects": [],
            "external_actions": controls_register(),
            "evidence_accepted": [],
            "evidence_rejected": [],
            "claims": [],
            "local_record": None,
        }
        receipt.update(closed_effect_flags())
        return receipt

    accepted, rejected, evidence_reasons = judge_evidence(item.get("evidence", []))
    reasons.extend(evidence_reasons)
    claim_rows, claim_reasons = _judge_claims(item.get("claims", []), set(accepted))
    reasons.extend(claim_reasons)
    report_status = _report_status(kind, accepted, claim_rows)
    if report_status == UNKNOWN and kind in REPORT_KINDS and not claim_rows:
        reasons.append(ReasonCode.REPORT_UNEVIDENCED.value)
    if report_status == UNKNOWN and claim_rows and ReasonCode.CLAIM_UNEVIDENCED.value not in reasons:
        reasons.append(ReasonCode.CLAIM_UNEVIDENCED.value)

    body = str(item.get("body", ""))
    retention = _retention(kind, body)
    if kind == "SOCIAL_DRAFT" and retention == "NONE":
        reasons.append(ReasonCode.DRAFT_EMPTY.value)

    if action == LOCAL_ACTION:
        disposition = LOCAL_RECORD
        reasons.append(ReasonCode.LOCAL_RECORD_ONLY.value)
    else:
        disposition = NOT_AUTHORIZED
        reasons.append(ReasonCode.EXTERNAL_NOT_AUTHORIZED.value)
        reasons.append(action_refusal(action).value)

    receipt = {
        "work_id": item["work_id"],
        "kind": kind,
        "requested_action": action,
        "live_agency": False,
        "network_mode": NETWORK_MODE,
        "not_a_release": True,
        "disposition": disposition,
        "report_status": report_status,
        "reason_codes": _dedupe(reasons),
        "external_effects": [],
        "external_actions": controls_register(),
        "evidence_accepted": list(accepted),
        "evidence_rejected": [dict(row) for row in rejected],
        "claims": claim_rows,
        "local_record": _local_record(item, retention),
    }
    receipt.update(closed_effect_flags())
    return receipt


def evaluate(document: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and evaluate one operations document.

    The receipt never reports an external effect. Caller-supplied authorization
    fields fail schema validation and stay NOT_AUTHORIZED.
    """
    if not isinstance(document, Mapping):
        return _rejection(
            (ReasonCode.DOCUMENT_REJECTED.value,),
            "document must be an object",
        )
    errors = schema_errors(dict(document))
    if errors:
        return _rejection((ReasonCode.DOCUMENT_REJECTED.value,), "; ".join(errors))

    items = document["items"]
    work_ids = [item["work_id"] for item in items]
    if len(work_ids) != len(set(work_ids)):
        return _rejection(
            (ReasonCode.DUPLICATE_WORK_ID.value,),
            "work_id values must be unique",
        )

    evaluated_items = [_evaluate_item(item) for item in items]
    aggregated: list[str] = []
    for item in evaluated_items:
        aggregated.extend(item["reason_codes"])
    receipt: dict[str, Any] = {
        "contract_id": CONTRACT_ID,
        "lineage": LINEAGE,
        "not_a_release": True,
        "live_agency": False,
        "network_mode": NETWORK_MODE,
        "evaluated": True,
        "external_effects": [],
        "external_actions": controls_register(),
        "any_report_unknown": any(
            item["report_status"] == UNKNOWN for item in evaluated_items
        ),
        "reason_codes": _dedupe(aggregated),
        "items": evaluated_items,
    }
    receipt.update(closed_effect_flags())
    return receipt


def run_text(raw: str) -> tuple[int, dict[str, Any]]:
    """Parse one JSON document and evaluate it. Oversized input is rejected."""
    if len(raw.encode("utf-8")) > MAX_DOCUMENT_BYTES:
        return 2, _rejection(
            (ReasonCode.DOCUMENT_REJECTED.value,),
            "document exceeds local size boundary",
        )
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return 2, _rejection(
            (ReasonCode.DOCUMENT_REJECTED.value,),
            "document is not JSON",
        )
    if not isinstance(parsed, dict):
        return 2, _rejection(
            (ReasonCode.DOCUMENT_REJECTED.value,),
            "document must be an object",
        )
    receipt = evaluate(parsed)
    if receipt["evaluated"] is False:
        return 2, receipt
    return 0, receipt
