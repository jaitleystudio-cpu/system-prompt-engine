"""URL builders for enabled scholarly sources.

User text is sent as a quoted phrase so boolean operators in the query cannot
widen the search. Landing-page URLs from records are never requested.
"""

from __future__ import annotations

from urllib.parse import quote, urlencode

from spe_runtime.scholarly.registry import SourceSpec


def phrase(text: str) -> str:
    """Quote a query so source-specific operators are not interpreted."""
    cleaned = text.replace('"', " ").strip()
    return f'"{cleaned}"'


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
            ("query", quoted),
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


def build_idconv_url(ids: tuple[str, ...], *, contact_email: str | None) -> str:
    params = [
        ("ids", ",".join(ids)),
        ("format", "json"),
        ("tool", "spe_scholarly"),
    ]
    if contact_email:
        params.append(("email", contact_email))
    return f"https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?{_q(params)}"
