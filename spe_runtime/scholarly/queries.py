"""URL builders for enabled scholarly sources.

User text is sent as a quoted phrase so boolean operators in the query cannot
widen the search. Landing-page URLs from records are never requested.
"""

from __future__ import annotations

import re
from urllib.parse import quote, urlencode

from spe_runtime.scholarly.identity import normalize_doi
from spe_runtime.scholarly.registry import SourceSpec


def phrase(text: str) -> str:
    """Quote a query so source-specific operators are not interpreted."""
    cleaned = text.replace('"', " ").strip()
    return f'"{cleaned}"'


def europepmc_query(text: str) -> str:
    """Use a DOI field lookup only when the whole topic is one DOI.

    A quoted prose phrase stays quoted. A DOI buried in a sentence is not
    promoted into a field query.
    """
    doi = normalize_doi(text)
    if doi is None:
        return phrase(text)
    return f'DOI:"{doi}"'


def _q(params: list[tuple[str, str]]) -> str:
    return urlencode(params, quote_via=quote)


def build_search_url(
    source: SourceSpec,
    query_text: str,
    *,
    max_results: int,
    contact_email: str | None,
) -> str:
    """Return the first HTTPS URL for a search source."""
    quoted = phrase(query_text)
    email = contact_email or ""
    if source.source_id in {"pubmed", "pmc"}:
        db = "pmc" if source.source_id == "pmc" else "pubmed"
        params = [
            ("db", db),
            ("retmode", "json"),
            ("retmax", str(max_results)),
            ("term", quoted),
            ("tool", "spe_scholarly"),
        ]
        if email:
            params.append(("email", email))
        return f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?{_q(params)}"
    if source.source_id == "europepmc":
        params = [
            ("query", europepmc_query(query_text)),
            ("format", "json"),
            ("pageSize", str(max_results)),
            ("resultType", "core"),
        ]
        return f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?{_q(params)}"
    if source.source_id == "crossref":
        params = [
            ("query.bibliographic", query_text.strip()),
            ("rows", str(max_results)),
        ]
        return f"https://api.crossref.org/works?{_q(params)}"
    if source.source_id == "doaj":
        return (
            "https://doaj.org/api/search/articles/"
            f"{quote(quoted, safe='')}?pageSize={max_results}"
        )
    if source.source_id == "arxiv":
        params = [
            ("search_query", f"all:{quoted}"),
            ("start", "0"),
            ("max_results", str(max_results)),
        ]
        return f"https://export.arxiv.org/api/query?{_q(params)}"
    if source.source_id == "openalex":
        params = [
            ("search", query_text.strip()),
            ("per-page", str(max_results)),
        ]
        if email:
            params.append(("mailto", email))
        return f"https://api.openalex.org/works?{_q(params)}"
    raise ValueError(f"NO_SEARCH_URL:{source.source_id}")


def build_esummary_url(
    source_id: str,
    ids: tuple[str, ...],
    *,
    contact_email: str | None,
) -> str:
    db = "pmc" if source_id == "pmc" else "pubmed"
    params = [
        ("db", db),
        ("retmode", "json"),
        ("id", ",".join(ids)),
        ("tool", "spe_scholarly"),
    ]
    if contact_email:
        params.append(("email", contact_email))
    return f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?{_q(params)}"


def outbound_field_names(source_id: str) -> tuple[str, ...]:
    """Query-string fields that carry the scholarly topic or identifiers.

    The NCBI ID converter receives normalized identifiers only. It has no
    field for the research query.
    """
    if source_id in {"pubmed", "pmc"}:
        return ("term",)
    if source_id == "europepmc":
        return ("query",)
    if source_id == "crossref":
        return ("query.bibliographic",)
    if source_id == "doaj":
        return ("path",)
    if source_id == "arxiv":
        return ("search_query",)
    if source_id == "openalex":
        return ("search",)
    if source_id == "ncbi_idconv":
        return ("ids", "idtype")
    raise ValueError(f"NO_OUTBOUND_FIELDS:{source_id}")


def build_idconv_url(
    ids: tuple[str, ...], *, id_type: str, contact_email: str | None
) -> str:
    """One identifier family per request.

    The live PMC ID Converter rejects a mixed `ids` list. DOI, PMID, and
    PMCID are sent as separate batches with `idtype`.
    """
    if id_type not in {"doi", "pmid", "pmcid"}:
        raise ValueError("IDCONV_IDTYPE")
    params = [
        ("ids", ",".join(ids)),
        ("idtype", id_type),
        ("format", "json"),
        ("tool", "spe_scholarly"),
    ]
    if contact_email:
        params.append(("email", contact_email))
    return (
        "https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/"
        f"?{_q(params)}"
    )


def build_europepmc_fulltext_url(pmcid: str) -> str:
    """Europe PMC open full text. The URL carries a PMCID and no query text."""
    token = pmcid.strip().upper()
    if not token.startswith("PMC"):
        token = f"PMC{token}"
    if re.fullmatch(r"PMC\d{1,10}", token) is None:
        raise ValueError("BAD_PMCID")
    return f"https://www.ebi.ac.uk/europepmc/webservices/rest/{token}/fullTextXML"
