"""Deep evidence qualification for abstracts, full text, type, and replication.

Open metadata is not open full text. Title keywords do not set polarity,
paper type, or replication. Parser failure is not recorded as absence.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import replace
from urllib.parse import urlsplit

from spe_runtime.scholarly.egress import assert_allowed
from spe_runtime.scholarly.errors import EgressDenied, ShapeError
from spe_runtime.scholarly.identity import normalize_doi
from spe_runtime.scholarly.models import (
    ContentCue,
    EgressEvent,
    PaperRecord,
    ReplicationHint,
    ReplicationLink,
    ReplicationMap,
    UnknownItem,
)
from spe_runtime.scholarly.queries import build_europepmc_fulltext_url
from spe_runtime.scholarly.registry import SourceRegistry
from spe_runtime.scholarly.transport import HttpResponse, TransportError

_TAG_RE = re.compile(r"<[^>]+>")
_EXPLICIT_REP = re.compile(
    r"\b(we replicated|attempts to exactly replicate|conducted replications|"
    r"this replication|registered replication)\b",
    re.IGNORECASE,
)
_MIN_PHRASE = 24
_MAX_FULLTEXT = 2
_MAX_FULLTEXT_BYTES = 400_000
_EXCERPT = 400
_OPEN_FULLTEXT_SOURCES = frozenset({"europepmc", "pmc"})
_TYPE_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("META_ANALYSIS", ("meta-analysis",)),
    ("SYSTEMATIC_REVIEW", ("systematic-review",)),
    ("RANDOMIZED_TRIAL", ("randomized-controlled-trial", "randomized-trial")),
    ("REPLICATION", ("validation-study", "replication-study")),
    ("BENCHMARK", ("benchmark", "benchmarking")),
    ("OBSERVATIONAL", ("observational-study", "cohort-study", "case-control-study")),
    ("REVIEW", ("review",)),
    ("PREPRINT", ("preprint",)),
)


def plain_text(value: str | None) -> str:
    """Drop markup and collapse whitespace. Empty stays empty."""
    if not value:
        return ""
    return " ".join(_TAG_RE.sub(" ", value).split())


def classify_paper(
    source_ids: tuple[str, ...], publication_types: tuple[str, ...]
) -> tuple[str, tuple[str, ...], str]:
    """Return paper type, basis, and peer-review status from structured fields."""
    sources = set(source_ids)
    if sources == {"arxiv"}:
        return "PREPRINT", ("ARXIV_SOURCE",), "NOT_PEER_REVIEWED"
    tokens = set(publication_types)
    for label, keys in _TYPE_RULES:
        if tokens & set(keys):
            return label, ("PUBLICATION_TYPE",), "UNKNOWN"
    if tokens:
        return "OTHER", ("PUBLICATION_TYPE_UNMAPPED",), "UNKNOWN"
    return "UNKNOWN", ("NO_STRUCTURED_TYPE",), "UNKNOWN"


def license_status_for(license_name: str, *, is_open_access: bool | None) -> str:
    """Unknown reuse terms stay UNKNOWN. An OA flag is not a license name."""
    if license_name and license_name != "UNKNOWN":
        return "STATED"
    if is_open_access is False:
        return "NOT_OPEN"
    return "UNKNOWN"


def abstract_replication(abstract: str | None) -> bool:
    """True only when the abstract explicitly reports a replication."""
    return _EXPLICIT_REP.search(plain_text(abstract)) is not None


def phrase_hit(text: str | None, phrases: tuple[str, ...]) -> str | None:
    """Return the first explicit phrase contained in text, never a short cue."""
    haystack = plain_text(text).casefold()
    if not haystack:
        return None
    for phrase in phrases:
        needle = " ".join(phrase.casefold().split())
        if len(needle) < _MIN_PHRASE:
            continue
        if needle in haystack:
            return needle
    return None


def title_phrase(record: PaperRecord, cues: ContentCue) -> str | None:
    """A title match is reported so it can be refused as polarity evidence."""
    return phrase_hit(record.title, cues.support_phrases + cues.refute_phrases)


def content_polarity(
    record: PaperRecord, cues: ContentCue
) -> tuple[str, str, str] | None:
    """Upgrade polarity only from full text or an available abstract.

    The title is ignored. Conflicting phrases stay unresolved.
    """
    support_full = phrase_hit(record.full_text_excerpt, cues.support_phrases)
    refute_full = phrase_hit(record.full_text_excerpt, cues.refute_phrases)
    if record.full_text_status == "OPEN_FULL_TEXT" and (support_full or refute_full):
        if support_full and refute_full:
            return None
        if support_full:
            return "SUPPORT", "FULL_TEXT", "EXPLICIT_FULL_TEXT_PHRASE"
        return "REFUTE", "FULL_TEXT", "EXPLICIT_FULL_TEXT_PHRASE"
    if record.abstract_access != "ABSTRACT_AVAILABLE":
        return None
    support = phrase_hit(record.abstract, cues.support_phrases)
    refute = phrase_hit(record.abstract, cues.refute_phrases)
    if support and refute:
        return None
    if support:
        return "SUPPORT", "ABSTRACT", "EXPLICIT_ABSTRACT_PHRASE"
    if refute:
        return "REFUTE", "ABSTRACT", "EXPLICIT_ABSTRACT_PHRASE"
    return None


def build_replication_map(
    records: tuple[PaperRecord, ...],
    hints: tuple[ReplicationHint, ...],
) -> tuple[ReplicationMap, tuple[UnknownItem, ...]]:
    """Link replications from structured type or explicit abstract evidence."""
    works = tuple(record for record in records if record.role == "work")
    by_doi = {
        record.identity.doi: record
        for record in works
        if record.identity.doi is not None
    }
    gaps: list[UnknownItem] = []
    links: list[ReplicationLink] = []
    for record in works:
        if record.replication_signal == "TITLE_HEURISTIC":
            continue
        if record.replication_signal == "STRUCTURED":
            relationship = "STRUCTURED_PUBLICATION_TYPE"
        elif record.replication_signal == "EXPLICIT_ABSTRACT":
            relationship = "EXPLICIT_ABSTRACT"
        else:
            continue
        original_id: str | None = None
        result_relation = "UNKNOWN"
        evidence = [relationship]
        matched_hint = False
        for hint in hints:
            replication_doi = normalize_doi(hint.replication_doi)
            if replication_doi is None or replication_doi != record.identity.doi:
                continue
            matched_hint = True
            body = plain_text(record.abstract) + " " + plain_text(record.full_text_excerpt)
            if hint.confirm_phrases and phrase_hit(body, hint.confirm_phrases) is None:
                gaps.append(
                    UnknownItem(
                        "REPLICATION_HINT_UNCONFIRMED",
                        record.record_id,
                        "confirmation phrase absent from abstract and full text",
                        False,
                    )
                )
                continue
            original_doi = normalize_doi(hint.original_doi)
            original = by_doi.get(original_doi) if original_doi else None
            if original is None:
                gaps.append(
                    UnknownItem(
                        "REPLICATION_ORIGINAL_ABSENT",
                        record.record_id,
                        hint.original_doi,
                        False,
                    )
                )
            else:
                original_id = original.record_id
                evidence.append("ORIGINAL_DOI_IN_FETCHED_SET")
            if hint.result_phrase and phrase_hit(body, (hint.result_phrase,)):
                result_relation = "EXPLICIT_ABSTRACT_RESULT"
                evidence.append("RESULT_PHRASE")
        if hints and not matched_hint:
            original_id = None
        links.append(
            ReplicationLink(
                replication_record_id=record.record_id,
                original_record_id=original_id,
                relationship=relationship,
                result_relation=result_relation,
                evidence=tuple(evidence),
            )
        )
    if not links:
        gaps.append(
            UnknownItem(
                "REPLICATION_ABSENT",
                "package",
                "no structured or explicit-abstract replication in the fetched set",
                False,
            )
        )
        return ReplicationMap("UNKNOWN", "REPLICATION_ABSENT", ()), tuple(gaps)
    return ReplicationMap("PRESENT", "EVIDENCE_BACKED", tuple(links)), tuple(gaps)


def qualify_full_text(
    records: tuple[PaperRecord, ...],
    *,
    transport: object,
    registry: SourceRegistry,
    as_of: str,
    headers: dict[str, str],
) -> tuple[tuple[PaperRecord, ...], tuple[UnknownItem, ...], tuple[EgressEvent, ...]]:
    """Fetch Europe PMC or PMC open full text only, and only for OA records.

    arXiv PDF links are recorded as metadata and are not downloaded.
    Publisher landing pages are never requested.
    """
    updated: list[PaperRecord] = []
    gaps: list[UnknownItem] = []
    egress: list[EgressEvent] = []
    fetched = 0
    stopped = False
    for record in records:
        if record.role != "work":
            updated.append(record)
            continue
        sources = set(record.source_ids)
        if sources == {"arxiv"}:
            updated.append(
                replace(
                    record,
                    full_text_status="PDF_METADATA_ONLY",
                    full_text_source="arxiv",
                    retrieval_method="ARXIV_PDF_METADATA_NOT_FETCHED",
                    license_status=license_status_for(
                        record.license, is_open_access=record.is_open_access
                    ),
                    access_limitation="ARXIV_PDF_METADATA_IS_NOT_FULL_TEXT",
                )
            )
            continue
        if record.is_open_access is False:
            updated.append(
                replace(
                    record,
                    full_text_status="NOT_PERMITTED",
                    retrieval_method="NOT_FETCHED",
                    license_status=license_status_for(
                        record.license, is_open_access=False
                    ),
                    access_limitation="OPEN_METADATA_IS_NOT_OPEN_FULL_TEXT",
                )
            )
            continue
        lawful = (
            record.is_open_access is True
            and record.identity.pmcid is not None
            and bool(sources & _OPEN_FULLTEXT_SOURCES)
            and not stopped
            and fetched < _MAX_FULLTEXT
        )
        if not lawful:
            updated.append(
                replace(
                    record,
                    full_text_status="NOT_RETRIEVED",
                    retrieval_method="NOT_FETCHED",
                    license_status=license_status_for(
                        record.license, is_open_access=record.is_open_access
                    ),
                    access_limitation="OPEN_METADATA_IS_NOT_OPEN_FULL_TEXT",
                )
            )
            continue
        pmcid = record.identity.pmcid or ""
        try:
            url = build_europepmc_fulltext_url(pmcid)
            assert_allowed(url, registry)
        except (EgressDenied, ValueError) as exc:
            gaps.append(
                UnknownItem(
                    "FULL_TEXT_NOT_PERMITTED",
                    record.record_id,
                    str(exc),
                    False,
                )
            )
            updated.append(
                replace(
                    record,
                    full_text_status="NOT_PERMITTED",
                    retrieval_method="ALLOWLIST_REFUSED",
                    license_status=license_status_for(
                        record.license, is_open_access=record.is_open_access
                    ),
                )
            )
            continue
        try:
            response = transport.get(url, headers)  # type: ignore[attr-defined]
        except (TransportError, EgressDenied) as exc:
            gaps.append(UnknownItem("SOURCE_UNAVAILABLE", record.record_id, exc.code, False))
            updated.append(
                replace(
                    record,
                    full_text_status="SOURCE_UNAVAILABLE",
                    full_text_source="europepmc",
                    retrieval_method="EUROPEPMC_FULLTEXT_XML",
                    license_status=license_status_for(
                        record.license, is_open_access=True
                    ),
                )
            )
            continue
        if not isinstance(response, HttpResponse):
            raise ShapeError("FULLTEXT_TRANSPORT")
        egress.append(_fulltext_event(url, response))
        fetched += 1
        if response.status == 429:
            stopped = True
            retry = _retry_after(response)
            gaps.append(
                UnknownItem(
                    "RATE_LIMITED",
                    "europepmc",
                    retry or "HTTP_429",
                    False,
                )
            )
            updated.append(
                replace(
                    record,
                    full_text_status="SOURCE_UNAVAILABLE",
                    full_text_source="europepmc",
                    retrieval_method="EUROPEPMC_FULLTEXT_XML",
                    license_status=license_status_for(
                        record.license, is_open_access=True
                    ),
                )
            )
            continue
        if response.status != 200 or b"<article" not in response.body[:12000]:
            gaps.append(
                UnknownItem(
                    "SOURCE_UNAVAILABLE",
                    record.record_id,
                    f"FULLTEXT_HTTP_{response.status}",
                    False,
                )
            )
            updated.append(
                replace(
                    record,
                    full_text_status="SOURCE_UNAVAILABLE",
                    full_text_source="europepmc",
                    retrieval_method="EUROPEPMC_FULLTEXT_XML",
                    license_status=license_status_for(
                        record.license, is_open_access=True
                    ),
                )
            )
            continue
        body = response.body[:_MAX_FULLTEXT_BYTES]
        digest = "sha256:" + hashlib.sha256(body).hexdigest()
        excerpt = plain_text(body.decode("utf-8", errors="replace"))[:_EXCERPT]
        updated.append(
            replace(
                record,
                full_text_status="OPEN_FULL_TEXT",
                full_text_source="europepmc",
                retrieval_method="EUROPEPMC_FULLTEXT_XML",
                content_digest=digest,
                full_text_retrieved_at=as_of,
                full_text_excerpt=excerpt,
                license_status=license_status_for(record.license, is_open_access=True),
                access_limitation="LAWFUL_OPEN_FULL_TEXT",
            )
        )
    return tuple(updated), tuple(gaps), tuple(egress)


def _retry_after(response: HttpResponse) -> str | None:
    for name, value in response.header_notes:
        if name.lower() == "retry-after":
            return value
    return None


def _fulltext_event(url: str, response: HttpResponse) -> EgressEvent:
    parts = urlsplit(url)
    return EgressEvent(
        source_id="europepmc",
        host=parts.hostname or "",
        method="GET",
        path=parts.path,
        query_keys=(),
        status=response.status,
        retry_after=_retry_after(response),
        attempt=1,
    )
