"""Deduplicate drafts on the canonical scholarly identity.

Title collisions on one DOI fail closed: the cluster is quarantined.
Citation counts may differ across sources and do not block admission.
"""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict

from spe_runtime.scholarly.identity import merge_identities
from spe_runtime.scholarly.models import (
    PaperDraft,
    PaperRecord,
    QuarantineEntry,
    UnknownItem,
)
from spe_runtime.scholarly.retraction import merge_retraction

_SOURCE_RANK = {
    "pubmed": 0,
    "pmc": 1,
    "europepmc": 2,
    "crossref": 3,
    "openalex": 4,
    "doaj": 5,
    "arxiv": 6,
}
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def _rank(source_id: str) -> int:
    return _SOURCE_RANK.get(source_id, 100)


def _norm_title(title: str) -> str:
    return " ".join(_NON_ALNUM.sub(" ", title.casefold()).split())


def _titles_compatible(left: str, right: str) -> bool:
    if left == right:
        return True
    if len(left) >= 24 and len(right) >= 24 and (left in right or right in left):
        return True
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    if not left_tokens or not right_tokens:
        return False
    overlap = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)
    return overlap >= 0.8


def _record_id(canonical_key: str) -> str:
    digest = hashlib.sha256(canonical_key.encode("utf-8")).hexdigest()[:16]
    return f"paper:{digest}"


def deduplicate(
    drafts: tuple[PaperDraft, ...],
) -> tuple[tuple[PaperRecord, ...], tuple[QuarantineEntry, ...], tuple[UnknownItem, ...]]:
    """Merge witnesses that share a canonical key."""
    clusters: dict[str, list[PaperDraft]] = defaultdict(list)
    records: list[PaperRecord] = []
    quarantine: list[QuarantineEntry] = []
    gaps: list[UnknownItem] = []
    for draft in drafts:
        if draft.identity.status.value != "RESOLVED" or not draft.identity.canonical_key:
            quarantine.append(
                QuarantineEntry(
                    reason="IDENTITY_UNKNOWN",
                    source_id=draft.source_id,
                    detail=draft.title[:120],
                )
            )
            continue
        clusters[draft.identity.canonical_key].append(draft)
    for key in sorted(clusters):
        group = clusters[key]
        titles = {_norm_title(item.title) for item in group}
        primary_title = _norm_title(min(group, key=lambda item: _rank(item.source_id)).title)
        if any(not _titles_compatible(primary_title, title) for title in titles):
            quarantine.append(
                QuarantineEntry(
                    reason="IDENTITY_TITLE_CONFLICT",
                    source_id=",".join(sorted({item.source_id for item in group})),
                    detail=key,
                )
            )
            continue
        roles = {item.role for item in group}
        if len(roles) > 1:
            quarantine.append(
                QuarantineEntry(
                    reason="ROLE_CONFLICT",
                    source_id=",".join(sorted({item.source_id for item in group})),
                    detail=key,
                )
            )
            continue
        ordered = sorted(group, key=lambda item: (_rank(item.source_id), item.source_id))
        primary = ordered[0]
        years = {item.year for item in group if item.year is not None}
        year: int | None
        if len(years) > 1:
            year = None
            gaps.append(
                UnknownItem(
                    code="YEAR_CONFLICT",
                    subject=key,
                    detail=",".join(str(item) for item in sorted(years)),
                    blocks_valid=True,
                )
            )
        else:
            year = next(iter(years), None)
        citations = [
            item.cited_by_count for item in group if item.cited_by_count is not None
        ]
        oa_values = {item.is_open_access for item in group if item.is_open_access is not None}
        is_oa: bool | None
        if True in oa_values and False in oa_values:
            is_oa = None
            gaps.append(
                UnknownItem(
                    code="OA_WITNESS_CONFLICT",
                    subject=key,
                    detail="open-access witnesses disagree",
                    blocks_valid=False,
                )
            )
        elif True in oa_values:
            is_oa = True
        elif False in oa_values:
            is_oa = False
        else:
            is_oa = None
        license_name = "UNKNOWN"
        for item in ordered:
            if item.license and item.license != "UNKNOWN":
                license_name = item.license
                break
        abstract = next((item.abstract for item in ordered if item.abstract), None)
        venue = next((item.venue for item in ordered if item.venue), None)
        landing = next((item.landing_url for item in ordered if item.landing_url), None)
        types: list[str] = []
        for item in ordered:
            for publication_type in item.publication_types:
                if publication_type not in types:
                    types.append(publication_type)
        signals = {item.replication_signal for item in group}
        if "STRUCTURED" in signals:
            replication = "STRUCTURED"
        elif "TITLE_HEURISTIC" in signals:
            replication = "TITLE_HEURISTIC"
        else:
            replication = "NONE"
        versions = {
            item.identity.arxiv_version
            for item in group
            if item.identity.arxiv_version is not None
        }
        if len(versions) > 1:
            gaps.append(
                UnknownItem(
                    code="ARXIV_VERSION_DIVERGENCE",
                    subject=key,
                    detail=",".join(sorted(versions, key=int)),
                    blocks_valid=False,
                )
            )
        identity = primary.identity
        for item in ordered[1:]:
            identity = merge_identities((identity, item.identity))
        records.append(
            PaperRecord(
                record_id=_record_id(identity.canonical_key),
                identity=identity,
                title=primary.title,
                abstract=abstract,
                authors=primary.authors,
                year=year,
                venue=venue,
                publication_types=tuple(sorted(types)),
                cited_by_count=max(citations) if citations else None,
                is_open_access=is_oa,
                license=license_name,
                landing_url=landing,
                retraction=merge_retraction(tuple(item.retraction for item in group)),
                source_ids=tuple(sorted({item.source_id for item in group})),
                primary_source_id=primary.source_id,
                role=primary.role,
                replication_signal=replication,
                full_text_status="NOT_RETRIEVED",
                abstract_access="SOURCE_API_ABSTRACT" if abstract else "ABSENT",
                access_limitation=(
                    "ABSTRACT_FROM_SOURCE_API_FULL_TEXT_NOT_FETCHED"
                    if abstract
                    else "METADATA_ONLY_FULL_TEXT_NOT_FETCHED"
                ),
                related_preprint=identity.arxiv_id,
            )
        )
    records.sort(key=lambda item: item.identity.canonical_key)
    return tuple(records), tuple(quarantine), tuple(gaps)
