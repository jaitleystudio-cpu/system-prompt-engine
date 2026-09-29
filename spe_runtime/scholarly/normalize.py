"""Normalize public-API payloads into paper drafts.

Each parser maps only fields that source documents. Missing retraction
signals stay UNKNOWN. Payloads that do not match the expected shape raise
ShapeError so the pipeline can fail that source closed.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Any

from spe_runtime.scholarly.errors import ShapeError
from spe_runtime.scholarly.identity import make_identity
from spe_runtime.scholarly.models import (
    NoticeKind,
    PaperDraft,
    RejectedDraft,
    RetractionState,
    unknown_retraction,
)

_ATOM = "{http://www.w3.org/2005/Atom}"
_ARXIV_NS = "{http://arxiv.org/schemas/atom}"
_TAG_RE = re.compile(r"<[^>]+>")
_YEAR_RE = re.compile(r"(19|20)\d{2}")
_REP_TITLE = re.compile(
    r"^(replication|reproducibility)\b|\breplication study\b|\breplication of\b",
    re.IGNORECASE,
)
_MAX_AUTHORS = 50
_MAX_TITLE = 1000
_MAX_ABSTRACT = 8000

_PUBMED_RETRACTION = frozenset(
    {
        "retracted publication",
        "retraction of publication",
    }
)
_PUBMED_CORRECTION = frozenset(
    {
        "published erratum",
        "corrected and republished article",
    }
)
_PUBMED_NOTICE_TYPES = frozenset(
    {
        "retraction of publication",
        "published erratum",
        "expression of concern",
    }
)


def _clean_text(value: object, *, limit: int) -> str:
    text = _TAG_RE.sub(" ", str(value))
    text = " ".join(text.split())
    return text[:limit].strip()


def _year(value: object) -> int | None:
    if isinstance(value, int) and 1800 <= value <= 2100:
        return value
    match = _YEAR_RE.search(str(value or ""))
    if match is None:
        return None
    return int(match.group(0))


def _types(values: list[str]) -> tuple[str, ...]:
    cleaned = []
    for value in values:
        token = " ".join(str(value).split()).casefold().replace(" ", "-")
        if token and token not in cleaned:
            cleaned.append(token)
    return tuple(sorted(cleaned))


def _authors(values: list[str]) -> tuple[str, ...]:
    authors: list[str] = []
    for value in values:
        name = " ".join(str(value).split())
        if name and name not in authors:
            authors.append(name[:200])
        if len(authors) >= _MAX_AUTHORS:
            break
    return tuple(authors)


def _replication(title: str, types: tuple[str, ...]) -> str:
    if any("replication" in item for item in types):
        return "STRUCTURED"
    if _REP_TITLE.search(title):
        return "TITLE_HEURISTIC"
    return "NONE"


def _draft(
    *,
    source_id: str,
    title: str,
    identity_kwargs: dict[str, object],
    abstract: str | None,
    authors: tuple[str, ...],
    year: int | None,
    venue: str | None,
    publication_types: tuple[str, ...],
    cited_by_count: int | None,
    is_open_access: bool | None,
    license_name: str,
    landing_url: str | None,
    retraction: RetractionState,
    role: str,
) -> PaperDraft | RejectedDraft:
    cleaned_title = _clean_text(title, limit=_MAX_TITLE)
    if not cleaned_title:
        return RejectedDraft(source_id, "RECORD_TITLE_MISSING", source_id)
    identity = make_identity(**identity_kwargs)
    if identity.status.value == "UNKNOWN":
        return RejectedDraft(
            source_id,
            "IDENTITY_UNKNOWN",
            cleaned_title[:120],
        )
    abstract_text = (
        _clean_text(abstract, limit=_MAX_ABSTRACT) if abstract else None
    )
    if abstract_text == "":
        abstract_text = None
    return PaperDraft(
        source_id=source_id,
        identity=identity,
        title=cleaned_title,
        abstract=abstract_text,
        authors=authors,
        year=year,
        venue=_clean_text(venue, limit=300) if venue else None,
        publication_types=publication_types,
        cited_by_count=cited_by_count,
        is_open_access=is_open_access,
        license=license_name or "UNKNOWN",
        landing_url=landing_url,
        retraction=retraction,
        role=role,
        replication_signal=_replication(cleaned_title, publication_types),
    )


def _pubmed_retraction(pubtypes: list[str]) -> tuple[RetractionState, str]:
    folded = [item.casefold() for item in pubtypes]
    if not folded:
        return unknown_retraction(("PUBMED_PUBTYPE_ABSENT",)), "work"
    evidence: list[str] = []
    kind = NoticeKind.NONE
    role = "work"
    if any(item in _PUBMED_RETRACTION for item in folded):
        kind = NoticeKind.RETRACTION
        evidence.append("PUBMED_PUBTYPE_RETRACTION")
    elif any(item == "expression of concern" for item in folded):
        kind = NoticeKind.EXPRESSION_OF_CONCERN
        evidence.append("PUBMED_PUBTYPE_EXPRESSION_OF_CONCERN")
    elif any(item in _PUBMED_CORRECTION for item in folded):
        kind = NoticeKind.CORRECTION
        evidence.append("PUBMED_PUBTYPE_CORRECTION")
    else:
        evidence.append("PUBMED_PUBTYPE_NO_NOTICE")
    if any(item in _PUBMED_NOTICE_TYPES for item in folded):
        role = "notice"
    if "retracted publication" in folded:
        role = "work"
    return RetractionState(kind, (), tuple(evidence)), role


def parse_esearch_ids(payload: object) -> tuple[str, ...]:
    """Return PubMed/PMC ids from an esearch JSON body."""
    if not isinstance(payload, dict):
        raise ShapeError("ESEARCH_SHAPE")
    if payload.get("error"):
        raise ShapeError("ESEARCH_ERROR")
    result = payload.get("esearchresult")
    if not isinstance(result, dict):
        raise ShapeError("ESEARCH_SHAPE")
    if result.get("ERROR"):
        raise ShapeError("ESEARCH_ERROR")
    idlist = result.get("idlist")
    if not isinstance(idlist, list):
        raise ShapeError("ESEARCH_IDLIST")
    ids: list[str] = []
    for item in idlist:
        text = str(item).strip()
        if not text.isdigit():
            raise ShapeError("ESEARCH_ID")
        ids.append(text)
    return tuple(ids)


def parse_pubmed_esummary(
    payload: object, *, source_id: str
) -> tuple[list[PaperDraft], list[RejectedDraft]]:
    """Parse NCBI esummary JSON for PubMed or PMC."""
    if source_id not in {"pubmed", "pmc"}:
        raise ShapeError("PUBMED_SOURCE")
    if not isinstance(payload, dict):
        raise ShapeError("ESUMMARY_SHAPE")
    if payload.get("error"):
        raise ShapeError("ESUMMARY_ERROR")
    result = payload.get("result")
    if not isinstance(result, dict) or not isinstance(result.get("uids"), list):
        raise ShapeError("ESUMMARY_SHAPE")
    drafts: list[PaperDraft] = []
    rejected: list[RejectedDraft] = []
    for uid in result["uids"]:
        item = result.get(str(uid))
        if not isinstance(item, dict):
            rejected.append(RejectedDraft(source_id, "RECORD_SHAPE", str(uid)))
            continue
        article_ids = item.get("articleids")
        doi = None
        pmid = None
        pmcid = None
        if isinstance(article_ids, list):
            for article_id in article_ids:
                if not isinstance(article_id, dict):
                    continue
                id_type = str(article_id.get("idtype", "")).casefold()
                value = article_id.get("value")
                if id_type == "doi":
                    doi = value
                elif id_type == "pubmed":
                    pmid = value
                elif id_type == "pmc":
                    pmcid = value
        if source_id == "pubmed" and pmid is None:
            pmid = uid
        if source_id == "pmc" and pmcid is None:
            pmcid = uid
        pubtypes_raw = item.get("pubtype") or []
        if not isinstance(pubtypes_raw, list):
            rejected.append(RejectedDraft(source_id, "RECORD_SHAPE", str(uid)))
            continue
        pubtypes = [str(entry) for entry in pubtypes_raw]
        retraction, role = _pubmed_retraction(pubtypes)
        authors_raw = item.get("authors") or []
        names: list[str] = []
        if isinstance(authors_raw, list):
            for author in authors_raw:
                if isinstance(author, dict) and author.get("name"):
                    names.append(str(author["name"]))
        built = _draft(
            source_id=source_id,
            title=str(item.get("title") or ""),
            identity_kwargs={"doi": doi, "pmid": pmid, "pmcid": pmcid},
            abstract=None,
            authors=_authors(names),
            year=_year(item.get("pubdate")),
            venue=str(item["source"]) if item.get("source") else None,
            publication_types=_types(pubtypes),
            cited_by_count=None,
            is_open_access=True if source_id == "pmc" else None,
            license_name="UNKNOWN",
            landing_url=None,
            retraction=retraction,
            role=role,
        )
        if isinstance(built, RejectedDraft):
            rejected.append(built)
        else:
            drafts.append(built)
    return drafts, rejected


def _europe_retraction(item: dict[str, Any], pubtypes: list[str]) -> RetractionState:
    if "hasRetracted" in item:
        flag = str(item["hasRetracted"]).upper()
        if flag == "Y":
            return RetractionState(NoticeKind.RETRACTION, (), ("EUROPEPMC_HAS_RETRACTED",))
        if flag == "N":
            return RetractionState(NoticeKind.NONE, (), ("EUROPEPMC_HAS_RETRACTED_N",))
        return unknown_retraction(("EUROPEPMC_HAS_RETRACTED_UNREADABLE",))
    if "isRetracted" in item:
        flag = item["isRetracted"]
        if flag is True:
            return RetractionState(NoticeKind.RETRACTION, (), ("EUROPEPMC_IS_RETRACTED",))
        if flag is False:
            return RetractionState(NoticeKind.NONE, (), ("EUROPEPMC_IS_RETRACTED_FALSE",))
        return unknown_retraction(("EUROPEPMC_IS_RETRACTED_UNREADABLE",))
    folded = [entry.casefold() for entry in pubtypes]
    if any("retract" in entry for entry in folded):
        return RetractionState(NoticeKind.RETRACTION, (), ("EUROPEPMC_PUBTYPE_RETRACTION",))
    if any("erratum" in entry or "correction" in entry for entry in folded):
        return RetractionState(NoticeKind.CORRECTION, (), ("EUROPEPMC_PUBTYPE_CORRECTION",))
    if any("expression of concern" in entry for entry in folded):
        return RetractionState(
            NoticeKind.EXPRESSION_OF_CONCERN,
            (),
            ("EUROPEPMC_PUBTYPE_EXPRESSION_OF_CONCERN",),
        )
    return unknown_retraction(("EUROPEPMC_NO_EXPLICIT_SIGNAL",))


def parse_europepmc(
    payload: object,
) -> tuple[list[PaperDraft], list[RejectedDraft]]:
    if not isinstance(payload, dict):
        raise ShapeError("EUROPEPMC_SHAPE")
    result_list = payload.get("resultList")
    if not isinstance(result_list, dict):
        if payload.get("hitCount") in (0, "0"):
            return [], []
        raise ShapeError("EUROPEPMC_SHAPE")
    results = result_list.get("result", [])
    if results is None:
        results = []
    if not isinstance(results, list):
        raise ShapeError("EUROPEPMC_RESULT")
    drafts: list[PaperDraft] = []
    rejected: list[RejectedDraft] = []
    for item in results:
        if not isinstance(item, dict):
            rejected.append(RejectedDraft("europepmc", "RECORD_SHAPE", "result"))
            continue
        pubtypes: list[str] = []
        if isinstance(item.get("pubType"), str):
            pubtypes.extend(part.strip() for part in str(item["pubType"]).split(";"))
        pub_list = item.get("pubTypeList")
        if isinstance(pub_list, dict) and isinstance(pub_list.get("pubType"), list):
            for entry in pub_list["pubType"]:
                pubtypes.append(str(entry))
        elif isinstance(pub_list, list):
            for entry in pub_list:
                if isinstance(entry, dict) and entry.get("pubType"):
                    pubtypes.append(str(entry["pubType"]))
                elif isinstance(entry, str):
                    pubtypes.append(entry)
        author_string = str(item.get("authorString") or "")
        names = [part.strip() for part in author_string.split(",") if part.strip()]
        oa_raw = item.get("isOpenAccess")
        oa = None
        if oa_raw in ("Y", "N"):
            oa = oa_raw == "Y"
        cited = item.get("citedByCount")
        cited_by = cited if isinstance(cited, int) and cited >= 0 else None
        built = _draft(
            source_id="europepmc",
            title=str(item.get("title") or ""),
            identity_kwargs={
            "doi": item.get("doi"),
            "pmid": item.get("pmid")
            or (item.get("id") if str(item.get("source", "")).upper() == "MED" else None),
            "pmcid": item.get("pmcid"),
            },
            abstract=str(item["abstractText"]) if item.get("abstractText") else None,
            authors=_authors(names),
            year=_year(item.get("pubYear")),
            venue=str(item["journalTitle"]) if item.get("journalTitle") else None,
            publication_types=_types(pubtypes),
            cited_by_count=cited_by,
            is_open_access=oa,
            license_name="UNKNOWN",
            landing_url=None,
            retraction=_europe_retraction(item, pubtypes),
            role="work",
        )
        if isinstance(built, RejectedDraft):
            rejected.append(built)
        else:
            drafts.append(built)
    return drafts, rejected


def _crossref_retraction(item: dict[str, Any]) -> tuple[RetractionState, str]:
    updates = item.get("update-to")
    notices: list[str] = []
    kinds: list[NoticeKind] = []
    evidence: list[str] = []
    role = "work"
    if isinstance(updates, list) and updates:
        role = "notice"
        for update in updates:
            if not isinstance(update, dict):
                continue
            update_type = str(update.get("type", "")).casefold()
            doi = update.get("DOI") or update.get("doi")
            if isinstance(doi, str) and doi.strip():
                notices.append(doi.strip().lower())
            if update_type == "retraction":
                kinds.append(NoticeKind.RETRACTION)
                evidence.append("CROSSREF_UPDATE_TO_RETRACTION")
            elif update_type in {"correction", "erratum"}:
                kinds.append(NoticeKind.CORRECTION)
                evidence.append("CROSSREF_UPDATE_TO_CORRECTION")
            elif "concern" in update_type:
                kinds.append(NoticeKind.EXPRESSION_OF_CONCERN)
                evidence.append("CROSSREF_UPDATE_TO_CONCERN")
    work_type = str(item.get("type", "")).casefold()
    subtype = str(item.get("subtype", "")).casefold()
    if work_type == "retraction" or "retract" in subtype:
        role = "notice"
        kinds.append(NoticeKind.RETRACTION)
        evidence.append("CROSSREF_TYPE_RETRACTION")
    if not kinds:
        return unknown_retraction(("CROSSREF_NO_EXPLICIT_SIGNAL",)), "work"
    best = NoticeKind.RETRACTION if NoticeKind.RETRACTION in kinds else kinds[0]
    if NoticeKind.EXPRESSION_OF_CONCERN in kinds and best is not NoticeKind.RETRACTION:
        best = NoticeKind.EXPRESSION_OF_CONCERN
    if (
        NoticeKind.CORRECTION in kinds
        and best not in {NoticeKind.RETRACTION, NoticeKind.EXPRESSION_OF_CONCERN}
    ):
        best = NoticeKind.CORRECTION
    return RetractionState(best, tuple(dict.fromkeys(notices)), tuple(evidence)), role


def parse_crossref(
    payload: object,
) -> tuple[list[PaperDraft], list[RejectedDraft]]:
    if not isinstance(payload, dict):
        raise ShapeError("CROSSREF_SHAPE")
    if payload.get("status") != "ok":
        raise ShapeError("CROSSREF_STATUS")
    message = payload.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("items"), list):
        raise ShapeError("CROSSREF_ITEMS")
    drafts: list[PaperDraft] = []
    rejected: list[RejectedDraft] = []
    for item in message["items"]:
        if not isinstance(item, dict):
            rejected.append(RejectedDraft("crossref", "RECORD_SHAPE", "item"))
            continue
        titles = item.get("title")
        title = titles[0] if isinstance(titles, list) and titles else ""
        authors_raw = item.get("author") or []
        names: list[str] = []
        if isinstance(authors_raw, list):
            for author in authors_raw:
                if not isinstance(author, dict):
                    continue
                family = str(author.get("family") or "").strip()
                given = str(author.get("given") or "").strip()
                name = " ".join(part for part in (given, family) if part)
                if name:
                    names.append(name)
        issued = item.get("issued")
        year = None
        if isinstance(issued, dict):
            parts = issued.get("date-parts")
            if isinstance(parts, list) and parts and isinstance(parts[0], list) and parts[0]:
                year = _year(parts[0][0])
        container = item.get("container-title")
        venue = container[0] if isinstance(container, list) and container else None
        licenses = item.get("license")
        license_name = "UNKNOWN"
        if isinstance(licenses, list) and licenses and isinstance(licenses[0], dict):
            license_name = str(
                licenses[0].get("URL") or licenses[0].get("content") or "UNKNOWN"
            )
        cited = item.get("is-referenced-by-count")
        cited_by = cited if isinstance(cited, int) and cited >= 0 else None
        retraction, role = _crossref_retraction(item)
        work_type = str(item.get("type") or "unknown")
        built = _draft(
            source_id="crossref",
            title=str(title),
            identity_kwargs={"doi": item.get("DOI")},
            abstract=str(item["abstract"]) if item.get("abstract") else None,
            authors=_authors(names),
            year=year,
            venue=str(venue) if venue else None,
            publication_types=_types([work_type]),
            cited_by_count=cited_by,
            is_open_access=None,
            license_name=license_name,
            landing_url=str(item["URL"]) if item.get("URL") else None,
            retraction=retraction,
            role=role,
        )
        if isinstance(built, RejectedDraft):
            rejected.append(built)
        else:
            drafts.append(built)
    return drafts, rejected


def parse_doaj(payload: object) -> tuple[list[PaperDraft], list[RejectedDraft]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise ShapeError("DOAJ_SHAPE")
    drafts: list[PaperDraft] = []
    rejected: list[RejectedDraft] = []
    for item in payload["results"]:
        if not isinstance(item, dict) or not isinstance(item.get("bibjson"), dict):
            rejected.append(RejectedDraft("doaj", "RECORD_SHAPE", "results"))
            continue
        bib = item["bibjson"]
        identifiers = bib.get("identifier") or []
        doi = None
        if isinstance(identifiers, list):
            for identifier in identifiers:
                if (
                    isinstance(identifier, dict)
                    and str(identifier.get("type", "")).casefold() == "doi"
                ):
                    doi = identifier.get("id")
        authors_raw = bib.get("author") or []
        names = []
        if isinstance(authors_raw, list):
            for author in authors_raw:
                if isinstance(author, dict) and author.get("name"):
                    names.append(str(author["name"]))
        journal = bib.get("journal")
        venue = journal.get("title") if isinstance(journal, dict) else None
        licenses = bib.get("license") or []
        license_name = "UNKNOWN"
        if isinstance(licenses, list) and licenses and isinstance(licenses[0], dict):
            license_name = str(
                licenses[0].get("type") or licenses[0].get("url") or "UNKNOWN"
            )
        links = bib.get("link") or []
        landing = None
        if isinstance(links, list):
            for link in links:
                if isinstance(link, dict) and link.get("url"):
                    landing = str(link["url"])
                    break
        built = _draft(
            source_id="doaj",
            title=str(bib.get("title") or ""),
            identity_kwargs={"doi": doi},
            abstract=str(bib["abstract"]) if bib.get("abstract") else None,
            authors=_authors(names),
            year=_year(bib.get("year")),
            venue=str(venue) if venue else None,
            publication_types=_types(["journal-article"]),
            cited_by_count=None,
            is_open_access=True,
            license_name=license_name,
            landing_url=landing,
            retraction=unknown_retraction(("DOAJ_NO_RETRACTION_FIELD",)),
            role="work",
        )
        if isinstance(built, RejectedDraft):
            rejected.append(built)
        else:
            drafts.append(built)
    return drafts, rejected


def _abstract_from_inverted(index: object) -> str | None:
    if index is None:
        return None
    if not isinstance(index, dict):
        raise ShapeError("OPENALEX_ABSTRACT")
    positions: list[tuple[int, str]] = []
    for word, locs in index.items():
        if not isinstance(locs, list):
            raise ShapeError("OPENALEX_ABSTRACT")
        for loc in locs:
            if not isinstance(loc, int) or isinstance(loc, bool):
                raise ShapeError("OPENALEX_ABSTRACT")
            positions.append((loc, str(word)))
    if not positions:
        return None
    positions.sort(key=lambda item: item[0])
    return " ".join(word for _, word in positions)


def _openalex_ids(item: dict[str, Any]) -> dict[str, object]:
    ids = item.get("ids") if isinstance(item.get("ids"), dict) else {}
    return {
        "doi": item.get("doi") or ids.get("doi"),
        "pmid": ids.get("pmid"),
        "pmcid": ids.get("pmcid"),
    }


def parse_openalex(
    payload: object,
) -> tuple[list[PaperDraft], list[RejectedDraft]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise ShapeError("OPENALEX_SHAPE")
    drafts: list[PaperDraft] = []
    rejected: list[RejectedDraft] = []
    for item in payload["results"]:
        if not isinstance(item, dict):
            rejected.append(RejectedDraft("openalex", "RECORD_SHAPE", "results"))
            continue
        if "is_retracted" not in item or not isinstance(item["is_retracted"], bool):
            retraction = unknown_retraction(("OPENALEX_IS_RETRACTED_ABSENT",))
        elif item["is_retracted"]:
            retraction = RetractionState(
                NoticeKind.RETRACTION, (), ("OPENALEX_IS_RETRACTED_TRUE",)
            )
        else:
            retraction = RetractionState(
                NoticeKind.NONE, (), ("OPENALEX_IS_RETRACTED_FALSE",)
            )
        names: list[str] = []
        authorships = item.get("authorships") or []
        if isinstance(authorships, list):
            for authorship in authorships:
                if not isinstance(authorship, dict):
                    continue
                author = authorship.get("author")
                if isinstance(author, dict) and author.get("display_name"):
                    names.append(str(author["display_name"]))
        location = item.get("primary_location")
        venue = None
        license_name = "UNKNOWN"
        if isinstance(location, dict):
            source = location.get("source")
            if isinstance(source, dict) and source.get("display_name"):
                venue = str(source["display_name"])
            if location.get("license"):
                license_name = str(location["license"])
        oa = item.get("open_access")
        is_oa = None
        if isinstance(oa, dict) and isinstance(oa.get("is_oa"), bool):
            is_oa = oa["is_oa"]
        cited = item.get("cited_by_count")
        cited_by = cited if isinstance(cited, int) and cited >= 0 else None
        try:
            abstract = _abstract_from_inverted(item.get("abstract_inverted_index"))
        except ShapeError:
            rejected.append(RejectedDraft("openalex", "OPENALEX_ABSTRACT", "results"))
            continue
        built = _draft(
            source_id="openalex",
            title=str(item.get("title") or ""),
            identity_kwargs=_openalex_ids(item),
            abstract=abstract,
            authors=_authors(names),
            year=_year(item.get("publication_year")),
            venue=venue,
            publication_types=_types([str(item.get("type") or "unknown")]),
            cited_by_count=cited_by,
            is_open_access=is_oa,
            license_name=license_name,
            landing_url=str(item["id"]) if item.get("id") else None,
            retraction=retraction,
            role="work",
        )
        if isinstance(built, RejectedDraft):
            rejected.append(built)
        else:
            drafts.append(built)
    return drafts, rejected


def _xml_text(element: ET.Element | None) -> str:
    if element is None or element.text is None:
        return ""
    return element.text


def parse_arxiv_atom(body: bytes) -> tuple[list[PaperDraft], list[RejectedDraft]]:
    """Parse an arXiv Atom feed. Refuses DTD declarations."""
    head = body[:400].lstrip().lower()
    if b"<!doctype" in head or b"<!entity" in head:
        raise ShapeError("ARXIV_DTD_REFUSED")
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise ShapeError("ARXIV_XML") from exc
    if root.tag != f"{_ATOM}feed":
        raise ShapeError("ARXIV_FEED")
    drafts: list[PaperDraft] = []
    rejected: list[RejectedDraft] = []
    for entry in root.findall(f"{_ATOM}entry"):
        title = _xml_text(entry.find(f"{_ATOM}title"))
        summary = _xml_text(entry.find(f"{_ATOM}summary"))
        published = _xml_text(entry.find(f"{_ATOM}published"))
        entry_id = _xml_text(entry.find(f"{_ATOM}id"))
        comment = _xml_text(entry.find(f"{_ARXIV_NS}comment"))
        doi = _xml_text(entry.find(f"{_ARXIV_NS}doi")) or None
        journal = _xml_text(entry.find(f"{_ARXIV_NS}journal_ref")) or None
        names = [
            _xml_text(author.find(f"{_ATOM}name"))
            for author in entry.findall(f"{_ATOM}author")
        ]
        folded_title = title.casefold()
        folded_comment = comment.casefold()
        withdrawn = folded_title.startswith("withdrawn") or (
            "withdrawn" in folded_comment and "paper" in folded_comment
        )
        if withdrawn:
            retraction = RetractionState(
                NoticeKind.WITHDRAWAL, (), ("ARXIV_WITHDRAWAL_TEXT",)
            )
        else:
            retraction = unknown_retraction(("ARXIV_NO_JOURNAL_RETRACTION_SIGNAL",))
        built = _draft(
            source_id="arxiv",
            title=title,
            identity_kwargs={"doi": doi, "arxiv": entry_id},
            abstract=summary or None,
            authors=_authors(names),
            year=_year(published),
            venue=journal,
            publication_types=_types(["preprint"]),
            cited_by_count=None,
            is_open_access=True,
            license_name="arxiv-license-unknown",
            landing_url=entry_id or None,
            retraction=retraction,
            role="work",
        )
        if isinstance(built, RejectedDraft):
            rejected.append(built)
        else:
            drafts.append(built)
    return drafts, rejected


def parse_idconv(payload: object) -> tuple[dict[str, str], ...]:
    """Return DOI/PMID/PMCID triples. Error rows are skipped, not invented."""
    if not isinstance(payload, dict):
        raise ShapeError("IDCONV_SHAPE")
    if str(payload.get("status", "ok")).casefold() not in {"ok", "success"}:
        raise ShapeError("IDCONV_STATUS")
    records = payload.get("records")
    if not isinstance(records, list):
        raise ShapeError("IDCONV_RECORDS")
    triples: list[dict[str, str]] = []
    for record in records:
        if not isinstance(record, dict):
            raise ShapeError("IDCONV_RECORD")
        if str(record.get("status", "success")).casefold() == "error":
            continue
        entry: dict[str, str] = {}
        for key in ("doi", "pmid", "pmcid"):
            value = record.get(key)
            if isinstance(value, str) and value.strip():
                entry[key] = value.strip()
        if entry:
            triples.append(entry)
    return tuple(triples)


PARSERS = {
    "europepmc": parse_europepmc,
    "crossref": parse_crossref,
    "doaj": parse_doaj,
    "openalex": parse_openalex,
}
