# C-R1 live source qualification

Recorded at `2026-09-29T21:17:27Z` by `tests/integration/test_scholarly_live_qualification.py` with `SPE_SCHOLARLY_LIVE=1`.
Machine-readable capture: `proofs/scholarly_fabric_20260930/live_qualification.json`.

Default `allow_network` stays false. This run is the explicit opt-in. Unexpected hosts: `[]`.
No telemetry, analytics, ad, or credential request was sent. `semantic_authority` is `NONE`.

Search probes use `qualify_source(..., allow_network=True)`, which builds the registry allowlist client and passes it in as the compiler transport. Success label is `QUALIFIED` only for HTTP 200 plus a parse with no source-shape gap.

## Enabled search sources

| Source | Status | HTTP | Host | Method | Query fields | Response | Records | Latency | Parse | Identity fields | Rate-limit notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PubMed | QUALIFIED | 200 | `eutils.ncbi.nlm.nih.gov` | GET | `term` | `application/json` | 2 | 180 ms | PARSED | doi, pmcid, pmid | `X-RateLimit-Limit=3`, `X-RateLimit-Remaining=2` |
| PMC | QUALIFIED | 200 | `eutils.ncbi.nlm.nih.gov` | GET | `term` | `application/json` | 2 | 214 ms | PARSED | doi, pmcid | same NCBI limit headers |
| Europe PMC | QUALIFIED | 200 | `www.ebi.ac.uk` | GET | `query` | `application/json` | 2 | 525 ms | PARSED | doi, pmcid, pmid | none exposed |
| Crossref | QUALIFIED | 200 | `api.crossref.org` | GET | `query.bibliographic` | `application/json` | 2 | 361 ms | PARSED | doi | none exposed |
| DOAJ | QUALIFIED | 200 | `doaj.org` | GET | `path` | `application/json` | 1 | 267 ms | PARSED | doi | none exposed |
| arXiv | QUALIFIED | 200 | `export.arxiv.org` | GET | `search_query` | `application/atom+xml` | 2 | 166 ms | PARSED | arxiv_id | none exposed |
| OpenAlex | QUALIFIED | 200 | `api.openalex.org` | GET | `search` | `application/json` | 2 | 619 ms | PARSED | doi, pmid | `X-RateLimit-Limit=1000`, `X-RateLimit-Remaining=770` |

Probe topics: `CRISPR Cas9 gene editing` for PubMed, PMC, Europe PMC, Crossref, and OpenAlex. DOAJ used `open access scholarly publishing`. arXiv used `quantum error correction`.

## NCBI ID Converter — contract change, then re-qualified

The checked-in host `www.ncbi.nlm.nih.gov` path `/pmc/utils/idconv/v1.0/` answered HTTPS **301** to `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/`.

A mixed `ids` list (DOI + PMID + PMCID) against that new path answered HTTP **400** `invalid_dois` (`All values of query param ids must be DOIs`). That is `CONTRACT_CHANGED`, not a temporary failure.

The registry host is now `pmc.ncbi.nlm.nih.gov`. The client sends one `idtype` per request: `doi`, `pmid`, or `pmcid`. A direct DOI request returns PMID `34265844` and PMCID `PMC8371605` for `10.1038/s41586-021-03819-2`. A PMID-only request and a PMCID-only request return the same DOI. Numeric JSON `pmid` values are accepted by the parser.

After that correction, the live DOI package recorded three ID-converter calls, each HTTP 200, query keys `format`, `ids`, `idtype`, `tool`. The research query is not among those keys. `IDCONV_UNAVAILABLE` is absent on that package.

## Later rate limit, isolated

On the retracted-DOI package, OpenAlex answered HTTP **429**. Class `RATE_LIMIT` / gap `SOURCE_UNAVAILABLE`. PubMed, Crossref, and the ID converter still completed. The package stayed `PARTIAL` with the PubMed retraction record admitted. The registry was not edited for that 429.

Disabled sources `semantic_scholar` and `core` were not contacted.
