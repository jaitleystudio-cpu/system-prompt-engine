# Scholarly fabric egress

Lane C calls only the public HTTPS APIs listed in `data/scholarly/source_registry.json`. The pipeline does not read the clock, does not fetch landing-page URLs, and does not send a user profile, credential, or private document.

Network is off unless `compile_evidence_package(..., allow_network=True)`. Tests use an injected transport. A host outside the enabled-source allowlist raises `EgressDenied` and the package is `REFUSED`.

Cost of every enabled source is **INR 0**. No API key is sent. Disabled rows (`semantic_scholar`, `core`) are not contacted; requesting them returns `SOURCE_DISABLED`.

## Enabled hosts

| Source | Host | Method | What is sent | Retraction rule |
| --- | --- | --- | --- | --- |
| PubMed | `eutils.ncbi.nlm.nih.gov` | GET | Quoted query, `db=pubmed`, `retmax`, `tool`, optional `email` | PubMed publication types. A non-empty type list with no notice type is `NONE`. An empty list is `UNKNOWN`. |
| PMC | `eutils.ncbi.nlm.nih.gov` | GET | Quoted query, `db=pmc`, `retmax`, `tool`, optional `email` | Same publication-type rule as PubMed. |
| Europe PMC | `www.ebi.ac.uk` | GET | Quoted query, `pageSize`, `format=json`, `resultType=core` | Only `hasRetracted`, `isRetracted`, or an explicit notice publication type. Omission is `UNKNOWN`. |
| Crossref | `api.crossref.org` | GET | Query text in `query.bibliographic`, `rows`, User-Agent | Only `update-to` or a retraction work type. Omission is `UNKNOWN`. |
| DOAJ | `doaj.org` | GET | Quoted query as one path segment, `pageSize` | No retraction field. Always `UNKNOWN`. |
| arXiv | `export.arxiv.org` | GET | Quoted query in `search_query=all:`, `max_results` | Withdrawal only from explicit arXiv withdrawal text. Otherwise `UNKNOWN`. |
| OpenAlex | `api.openalex.org` | GET | Query text in `search`, `per-page`, optional `mailto` | `is_retracted` boolean. Missing boolean is `UNKNOWN`. |
| NCBI ID Converter | `pmc.ncbi.nlm.nih.gov` | GET | Already-normalized DOI, PMID, or PMCID values, one `idtype` per request (`doi`, `pmid`, or `pmcid`). The query text is not sent again. | Not a retraction source. Live 2026-09-29: the previous `www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/` endpoint answered HTTPS 301 to `/tools/idconv/api/v1/articles/`. A mixed `ids` list returns HTTP 400 `invalid_dois`. |

`email` / `mailto` are included only when the caller passes a syntactically valid `contact_email`. No placeholder address is invented.

PubMed, Europe PMC, DOAJ, and arXiv receive the query as one quoted phrase so source boolean operators inside the text cannot widen the search.

## Not contacted

- Publisher landing pages and DOI resolver URLs stored on a record
- Semantic Scholar (`api.semanticscholar.org`) — key and unauthenticated terms are `UNKNOWN`
- CORE (`api.core.ac.uk`) — API key required
- Paid indexes (Scopus, Web of Science, Dimensions)

## Fail closed

`UNKNOWN` retraction is not stored as `NONE`. A package cannot be `VALID` while any admitted record has `RETRACTION_STATE_UNKNOWN`, while a requested source failed, or while a work has no structured claim polarity. An empty contradiction map has status `UNKNOWN` and reason `NONE_OBSERVED_IN_FETCHED_SET`. That disclosed gap does not by itself block `VALID`, and it is never reported as "no contradictions exist."

Before a request leaves SPE, `minimize_scholarly_query` keeps only the topic. Labeled `PRIVATE`, `PROFILE`, `DOCUMENT`, `CONTEXT`, `CONSTRAINT`, and `UPLOAD` sections, plus `private_context`, stay inside SPE. Abstract and full-text requests use that same minimized topic. The package stores the labels, not the withheld text. `semantic_authority` is `NONE`.

Open metadata is not open full text. Full text is fetched only for an Europe PMC or PMC record that is open access and has a PMCID, and only from `www.ebi.ac.uk` `fullTextXML`. At most two such documents are requested, and a 429 stops further full-text fetches. There is no retry loop: every egress `attempt` is 1, and `Retry-After` is recorded. arXiv PDF links are `PDF_METADATA_ONLY` and are not downloaded. A record with `is_open_access` false is `NOT_PERMITTED`. OpenAlex or Crossref open-access flags do not authorize a download. Publisher landing URLs are stored and not fetched. A DOI-only Europe PMC topic is sent as `DOI:"…"`. Any other Europe PMC topic stays one quoted phrase.

Redirects are rechecked against the enabled allowlist. HTTP, `javascript`, `data`, `file`, and `ftp` schemes, userinfo, localhost, and IP literals are refused.

Live qualification sets `allow_network=True` only inside `tests/integration/test_scholarly_live_qualification.py`, which is skipped unless `SPE_SCHOLARLY_LIVE=1`. The default unit path performs no network requests.
