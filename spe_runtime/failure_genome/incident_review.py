"""Evidence preflight for public AI-failure investigations.

This module belongs to the existing Failure Genome owner. It is deliberately
read-only: URL presence, a local mock replay, and caller-provided prose are
not authority to publish confirmed failure, cause, or repair claims.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from ipaddress import ip_address
from typing import TYPE_CHECKING, Iterable
from urllib.parse import urlsplit

if TYPE_CHECKING:
    from .models import FailureGenomeEntry


class ReviewState(str, Enum):
    HOLD = "HOLD"
    READY_FOR_INDEPENDENT_REVIEW = "READY_FOR_INDEPENDENT_REVIEW"


@dataclass(frozen=True)
class IncidentPreflight:
    failure_id: str
    state: ReviewState
    issue_codes: tuple[str, ...]
    source_urls: tuple[str, ...]
    claim_confirmed: bool = False
    root_cause_verified: bool = False
    repair_verified: bool = False
    publication_authorized: bool = False


def _public_https_source(url: str) -> bool:
    """Validate displayable evidence URLs; this never fetches or trusts them."""
    if not isinstance(url, str) or not url or len(url) > 2048 or any(ord(c) < 33 for c in url):
        return False
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        if parsed.scheme != "https" or not host or parsed.username or parsed.password or parsed.fragment:
            return False
        if parsed.port not in (None, 443) or host.lower() == "localhost" or host.lower().endswith(".localhost"):
            return False
        try:
            ip_address(host)
            return False
        except ValueError:
            pass
        return "." in host and all(part and part.isascii() for part in host.split("."))
    except (ValueError, TypeError):
        return False


def _aware_timestamp(value: str | None) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def review_failure_for_publication(
    entry: FailureGenomeEntry,
    *,
    source_urls: Iterable[str] = (),
    source_published_at: str | None = None,
    source_observed_at: str | None = None,
) -> IncidentPreflight:
    """Screen an existing Failure Genome case for independent verification.

    No branch authorizes a public claim. The separately governed source and
    replay/causal/repair evidence owners must verify it first. Caller-provided
    fields are treated as untrusted claims, never signed proof receipts.
    """
    issues: list[str] = []
    if entry.scope != "GLOBAL" or entry.consent is not True:
        issues.append("PRIVATE_OR_UNCONSENTED")
    if not entry.failure_id.startswith("SPE-FG-"):
        issues.append("INVALID_FAILURE_ID")
    if not isinstance(entry.model, str) or not entry.model.strip() or not isinstance(entry.model_version, str) or entry.model_version.casefold() in ("", "unknown", "unbound"):
        issues.append("MODEL_REVISION_UNBOUND")
    if not isinstance(entry.minimal_reproducer, str) or len(entry.minimal_reproducer.strip()) < 3:
        issues.append("REPRODUCER_MISSING")
    if not entry.observations:
        issues.append("OBSERVATION_MISSING")

    try:
        urls = tuple(dict.fromkeys(source_urls)) if source_urls is not None else ()
    except (TypeError, ValueError):
        urls = ()
    if not urls or not all(_public_https_source(u) for u in urls):
        issues.append("PRIMARY_SOURCE_UNVERIFIED")

    published = _aware_timestamp(source_published_at)
    observed = _aware_timestamp(source_observed_at)
    if published is None or observed is None:
        issues.append("SOURCE_TIMESTAMPS_MISSING_OR_INVALID")
    elif observed < published:
        issues.append("OBSERVATION_BEFORE_PUBLICATION")

    # Synthetic/mock runners can set this legacy bool. It cannot become an
    # independent proof receipt or an external model failure claim.
    if entry.is_verified_by_reproduction:
        issues.append("LEGACY_REPRODUCTION_FLAG_NOT_INDEPENDENT_PROOF")
    if entry.root_cause and entry.root_cause != "Pending causal analysis":
        issues.append("CAUSAL_EXPLANATION_UNVERIFIED")
    if entry.candidate_repairs:
        issues.append("REPAIR_EFFECT_UNVERIFIED")

    blocking = {
        "PRIVATE_OR_UNCONSENTED", "INVALID_FAILURE_ID", "MODEL_REVISION_UNBOUND",
        "REPRODUCER_MISSING", "OBSERVATION_MISSING", "PRIMARY_SOURCE_UNVERIFIED",
        "SOURCE_TIMESTAMPS_MISSING_OR_INVALID", "OBSERVATION_BEFORE_PUBLICATION",
    }
    status = ReviewState.HOLD if blocking.intersection(issues) else ReviewState.READY_FOR_INDEPENDENT_REVIEW
    return IncidentPreflight(
        failure_id=entry.failure_id,
        state=status,
        issue_codes=tuple(sorted(set(issues))),
        source_urls=urls if "PRIVATE_OR_UNCONSENTED" not in issues else (),
    )
