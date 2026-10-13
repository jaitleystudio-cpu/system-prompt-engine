"""SPE SEO owner: conservative localization and aggregate international evidence gates.

No live analytics, identity collection, browser instrumentation, network
transport, indexed pages, search-ranking claims or country launch authority.
Existing SPE SEO owner retains all publishing/route authorization.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from urllib.parse import urlsplit

_DOMAIN = "systempromptengine.com"  # verify canonical-owner mismatch separately
_LOCALE = re.compile(r"^[a-z]{2,3}(?:-[A-Z]{2})?$")
_COUNTRY = re.compile(r"^[A-Z]{2}$")


@dataclass(frozen=True)
class LocaleCandidate:
    locale: str
    country: str
    path: str
    protected_requirement_ids: tuple[str, ...]
    source_requirement_ids: tuple[str, ...]
    language_reviewer_receipt_id: str | None = None


@dataclass(frozen=True)
class LocaleReviewResult:
    locale: str
    country: str
    status: str
    reasons: tuple[str, ...]
    noindex: bool = True
    translation_semantics_proven: bool = False
    production_publish_authorized: bool = False


@dataclass(frozen=True)
class MarketAggregate:
    country: str
    locale: str
    period_start: str
    period_end: str
    search_impressions: int
    search_clicks: int
    opt_in_tasks: int
    opt_in_successes: int
    # Intentionally no user IDs, emails, raw search queries or individual logs.


@dataclass(frozen=True)
class MarketReviewResult:
    country: str
    locale: str
    search_ctr: float | None
    task_success_rate: float | None
    task_success_wilson95_low: float | None
    outcome: str
    reasons: tuple[str, ...]
    # Aggregate reports cannot authorize publication, monetization or ranking.
    global_first_claim_verified: bool = False
    production_launch_authorized: bool = False


def _safe_path(path: str) -> bool:
    if not isinstance(path, str) or len(path) > 512 or not path.startswith("/"):
        return False
    if any(c in path for c in ("..", "\\", "%", "?", "#", "<", ">")):
        return False
    return all(ord(ch) >= 33 for ch in path)


def audit_locale_candidate(candidate: LocaleCandidate) -> LocaleReviewResult:
    """Check structural language eligibility without fabricating a native review."""
    reasons = []
    if not isinstance(candidate.locale, str) or not _LOCALE.fullmatch(candidate.locale):
        reasons.append("INVALID_BCP47_LOCALE")
    if not isinstance(candidate.country, str) or not _COUNTRY.fullmatch(candidate.country):
        reasons.append("INVALID_COUNTRY")
    if not _safe_path(candidate.path):
        reasons.append("UNSAFE_LOCALE_PATH")
    elif isinstance(candidate.locale, str) and not candidate.path.startswith("/" + candidate.locale + "/"):
        reasons.append("LOCALE_PATH_MISMATCH")
    if (
        not candidate.protected_requirement_ids
        or any(not isinstance(v, str) or not v for v in candidate.protected_requirement_ids)
        or len(set(candidate.protected_requirement_ids)) != len(candidate.protected_requirement_ids)
        or set(candidate.protected_requirement_ids) != set(candidate.source_requirement_ids)
    ):
        reasons.append("PROTECTED_CONSTRAINT_COVERAGE_NOT_MAPPED")
    # Presence of a receipt ID is NOT evidence that independent language
    # review has actually occurred or that translation is equivalent.
    reasons.append("INDEPENDENT_LANGUAGE_REVIEW_NOT_VERIFIED")
    reasons.append("LOCALIZED_SEMANTIC_PARITY_NOT_PROVEN")
    return LocaleReviewResult(
        locale=candidate.locale, country=candidate.country,
        status="HOLD" if len(reasons) > 2 else "READY_FOR_HUMAN_REVIEW",
        reasons=tuple(sorted(set(reasons))),
    )


def _safe_counts(record: MarketAggregate) -> bool:
    if not isinstance(record.country, str) or not _COUNTRY.fullmatch(record.country):
        return False
    if not isinstance(record.locale, str) or not _LOCALE.fullmatch(record.locale):
        return False
    try:
        start, end = date.fromisoformat(record.period_start), date.fromisoformat(record.period_end)
    except (ValueError, TypeError):
        return False
    if end < start or (end - start).days > 90:
        return False
    counts = (record.search_impressions, record.search_clicks,
              record.opt_in_tasks, record.opt_in_successes)
    return all(type(n) is int and 0 <= n <= 10**12 for n in counts) and (
        record.search_clicks <= record.search_impressions and
        record.opt_in_successes <= record.opt_in_tasks
    )


def wilson_lower_95(successes: int, trials: int) -> float:
    """95% Wilson one-sided lower bound for a binomial proportion.

    Research-grade aggregate uncertainty indicator, not a causal estimate.
    """
    if trials <= 0 or not 0 <= successes <= trials:
        raise ValueError("INVALID_WILSON_COUNTS")
    if successes == 0:
        return 0.0
    z = 1.959963984540054
    p = successes / trials
    denom = 1 + z * z / trials
    center = p + z * z / (2 * trials)
    radius = z * math.sqrt(p * (1-p) / trials + z*z / (4*trials*trials))
    return max(0.0, min(1.0, (center-radius)/denom))


def assess_aggregate_market(
    candidate: MarketAggregate,
    *,
    baseline: MarketAggregate | None = None,
    minimum_opt_in_tasks: int = 100,
) -> MarketReviewResult:
    """Only a descriptive country/locale cohort gate, not SEO rank proof."""
    if not isinstance(minimum_opt_in_tasks, int) or not 100 <= minimum_opt_in_tasks <= 10_000:
        raise ValueError("MIN_SAMPLE_SIZE_INVALID")
    if not isinstance(candidate, MarketAggregate) or not _safe_counts(candidate):
        raise ValueError("AGGREGATE_MALFORMED")
    if baseline is not None:
        if (
            not isinstance(baseline, MarketAggregate) or not _safe_counts(baseline)
            or (baseline.country, baseline.locale) != (candidate.country, candidate.locale)
            or (date.fromisoformat(baseline.period_end) - date.fromisoformat(baseline.period_start)).days
            != (date.fromisoformat(candidate.period_end) - date.fromisoformat(candidate.period_start)).days
            or baseline.period_end >= candidate.period_start
        ):
            raise ValueError("BASELINE_NONCOMPARABLE_OR_OVERLAPPING")
    reasons = ["NO_SEARCH_RANKING_OR_CAUSAL_ATTRIBUTION_ESTABLISHED"]
    if baseline is None:
        reasons.append("BASELINE_NOT_SUPPLIED")
    if candidate.opt_in_tasks < minimum_opt_in_tasks:
        reasons.append("INSUFFICIENT_OPT_IN_SAMPLE")
    if candidate.search_impressions < 100:
        reasons.append("INSUFFICIENT_SEARCH_IMPRESSIONS")
    if baseline is not None and baseline.opt_in_tasks < minimum_opt_in_tasks:
        reasons.append("BASELINE_SAMPLE_INSUFFICIENT")
    ctr = candidate.search_clicks / candidate.search_impressions if candidate.search_impressions else None
    success = candidate.opt_in_successes / candidate.opt_in_tasks if candidate.opt_in_tasks else None
    lower = wilson_lower_95(candidate.opt_in_successes, candidate.opt_in_tasks) if candidate.opt_in_tasks else None
    qualified = (
        baseline is not None and baseline.opt_in_tasks >= minimum_opt_in_tasks
        and candidate.opt_in_tasks >= minimum_opt_in_tasks
        and candidate.search_impressions >= 100
    )
    return MarketReviewResult(
        country=candidate.country, locale=candidate.locale,
        search_ctr=round(ctr, 6) if ctr is not None else None,
        task_success_rate=round(success, 6) if success is not None else None,
        task_success_wilson95_low=round(lower, 6) if lower is not None else None,
        outcome="READY_FOR_INDEPENDENT_MARKET_REVIEW" if qualified else "HOLD",
        reasons=tuple(reasons),
    )



@dataclass(frozen=True)
class CanonicalDomainAudit:
    status: str
    configured_domains: tuple[tuple[str, str], ...]
    reason_codes: tuple[str, ...]
    sitemap_submission_authorized: bool = False
    indexnow_submission_authorized: bool = False


def audit_canonical_domains(owner_domains: dict[str, str]) -> CanonicalDomainAudit:
    """Compare existing approved SEO owners without changing either owner.

    Inconsistent canonical origins can split discovery signals. This is an
    audit only; no new canonical URL, redirect, or search submission occurs.
    """
    if not isinstance(owner_domains, dict) or not owner_domains:
        raise ValueError("CANONICAL_OWNER_INVENTORY_REQUIRED")
    hosts: set[str] = set()
    for owner, origin in owner_domains.items():
        if not isinstance(owner, str) or not owner or not isinstance(origin, str):
            raise ValueError("MALFORMED_CANONICAL_OWNER")
        parsed = urlsplit(origin)
        if (
            parsed.scheme != "https" or not parsed.hostname or parsed.username
            or parsed.password or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment or parsed.port not in (None, 443)
        ):
            raise ValueError("INVALID_CANONICAL_ORIGIN")
        hosts.add(parsed.hostname.lower().rstrip("."))
    distinct = len(hosts) == 1
    if distinct and next(iter(hosts)) != _DOMAIN:
        distinct = False
    return CanonicalDomainAudit(
        status="READY_FOR_OWNER_REVIEW" if distinct else "HOLD",
        configured_domains=tuple(sorted(owner_domains.items())),
        reason_codes=("OWNER_REVIEW_REQUIRED",) if distinct else
        ("CANONICAL_DOMAIN_CONFLICT", "OWNER_REVIEW_REQUIRED"),
    )
