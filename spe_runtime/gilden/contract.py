"""Gilden operations contract constants.

External actions stay NOT_AUTHORIZED. This module has no network, send, post,
host, deploy, beacon, or merge path.
"""

from __future__ import annotations

import hashlib
from enum import Enum

CONTRACT_ID = "spe.gilden.operations.v1"
LINEAGE = "NEW_IMPLEMENTATION"
NETWORK_MODE = "NONE"
NOT_AUTHORIZED = "NOT_AUTHORIZED"
LOCAL_RECORD = "LOCAL_RECORD"
LOCAL_ACTION = "RECORD"
UNKNOWN = "UNKNOWN"
EVIDENCE_ATTACHED = "EVIDENCE_ATTACHED"
NOT_A_REPORT = "NOT_A_REPORT"
MAX_DOCUMENT_BYTES = 512 * 1024

KINDS: tuple[str, ...] = (
    "MAINTENANCE",
    "SEARCH_REVIEW",
    "RESEARCH_QUEUE",
    "SOCIAL_DRAFT",
    "GROWTH_NOTES",
    "REPORTING",
    "CONTROLS",
)

# Alphabetical so receipts and the frozen register stay comparable.
EXTERNAL_ACTIONS: tuple[str, ...] = (
    "ANALYTICS_BEACON",
    "AUTOMATIC_MERGE",
    "DEPLOY",
    "HOST",
    "LIVE_SEARCH",
    "POST",
    "PUBLISH",
    "SEND",
)

REQUESTED_ACTIONS: tuple[str, ...] = (LOCAL_ACTION,) + EXTERNAL_ACTIONS

REPORT_KINDS: frozenset[str] = frozenset({"REPORTING", "SEARCH_REVIEW"})

ALLOWED_EVIDENCE_SOURCES: frozenset[str] = frozenset(
    {"LOCAL_FIXTURE", "OPERATOR_NOTE", "PRIOR_LOCAL_RECORD"}
)

EFFECT_FLAG_NAMES: tuple[str, ...] = (
    "network_used",
    "posted",
    "sent",
    "hosted",
    "deployed",
    "beacon_emitted",
    "merged",
    "fetched",
)


class ReasonCode(str, Enum):
    EXTERNAL_NOT_AUTHORIZED = "GILDEN_EXTERNAL_NOT_AUTHORIZED"
    POST_REFUSED = "GILDEN_POST_REFUSED"
    SEND_REFUSED = "GILDEN_SEND_REFUSED"
    HOST_REFUSED = "GILDEN_HOST_REFUSED"
    DEPLOY_REFUSED = "GILDEN_DEPLOY_REFUSED"
    BEACON_REFUSED = "GILDEN_BEACON_REFUSED"
    AUTO_MERGE_REFUSED = "GILDEN_AUTO_MERGE_REFUSED"
    LIVE_SEARCH_REFUSED = "GILDEN_LIVE_SEARCH_REFUSED"
    PUBLISH_REFUSED = "GILDEN_PUBLISH_REFUSED"
    REPORT_UNEVIDENCED = "GILDEN_REPORT_UNEVIDENCED"
    CLAIM_UNEVIDENCED = "GILDEN_CLAIM_UNEVIDENCED"
    EVIDENCE_DIGEST_MISMATCH = "GILDEN_EVIDENCE_DIGEST_MISMATCH"
    EVIDENCE_SOURCE_FORBIDDEN = "GILDEN_EVIDENCE_SOURCE_FORBIDDEN"
    EVIDENCE_DUPLICATE = "GILDEN_EVIDENCE_DUPLICATE"
    DOCUMENT_REJECTED = "GILDEN_DOCUMENT_REJECTED"
    DUPLICATE_WORK_ID = "GILDEN_DUPLICATE_WORK_ID"
    DRAFT_EMPTY = "GILDEN_DRAFT_EMPTY"
    LOCAL_RECORD_ONLY = "GILDEN_LOCAL_RECORD_ONLY"
    KIND_REJECTED = "GILDEN_KIND_REJECTED"


_ACTION_REASONS: dict[str, ReasonCode] = {
    "POST": ReasonCode.POST_REFUSED,
    "SEND": ReasonCode.SEND_REFUSED,
    "HOST": ReasonCode.HOST_REFUSED,
    "DEPLOY": ReasonCode.DEPLOY_REFUSED,
    "ANALYTICS_BEACON": ReasonCode.BEACON_REFUSED,
    "AUTOMATIC_MERGE": ReasonCode.AUTO_MERGE_REFUSED,
    "LIVE_SEARCH": ReasonCode.LIVE_SEARCH_REFUSED,
    "PUBLISH": ReasonCode.PUBLISH_REFUSED,
}


def action_refusal(action: str) -> ReasonCode:
    """Reason for refusing one named external action."""
    reason = _ACTION_REASONS.get(action)
    if reason is None:
        return ReasonCode.EXTERNAL_NOT_AUTHORIZED
    return reason


def external_disposition(action: str) -> str:
    """Standing disposition for an action that would leave the machine.

    RECORD is local, so it has no external disposition. Every other name,
    including unknown names, stays NOT_AUTHORIZED.
    """
    if action == LOCAL_ACTION:
        raise ValueError("RECORD is a local action and has no external disposition")
    return NOT_AUTHORIZED


def controls_register() -> dict[str, str]:
    """Copy of the standing register. Mutations do not authorize anything."""
    return {action: external_disposition(action) for action in EXTERNAL_ACTIONS}


def closed_effect_flags() -> dict[str, bool]:
    """Effect flags for a receipt. Each flag is the literal False."""
    return {
        "network_used": False,
        "posted": False,
        "sent": False,
        "hosted": False,
        "deployed": False,
        "beacon_emitted": False,
        "merged": False,
        "fetched": False,
    }


def evidence_digest(summary: str) -> str:
    """SHA-256 hex of a local evidence summary. The runner does not fetch it."""
    return hashlib.sha256(summary.encode("utf-8")).hexdigest()


def body_digest(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()
