# C-R1 identity normalization and cross-source dedup

Live capture time `2026-09-29T21:17:27Z`.

## Normalization

Offline tests in `tests/unit/test_scholarly_identity.py` and mutant `C-R1-15` cover:

- DOI case and resolver prefixes (`HTTPS://DOI.ORG/10.1000/ABC` → `10.1000/abc`)
- PMID prefixes (`PMID: 000123` → `123`)
- PMCID prefixes (`pmc7654321` → `PMC7654321`)
- arXiv version suffixes (`1706.03762v5` → id `1706.03762`, version `5`)

Different normalized DOIs keep different canonical keys. Live ID-converter JSON returns `pmid` as a number; `parse_idconv` stores `34265844` as a string and skips error rows.

## One work, three sources

Query sent as the topic: `10.1038/s41586-021-03819-2`.
Sources attempted: PubMed, Europe PMC, Crossref, OpenAlex. All four search calls returned HTTP 200. ID converter then returned HTTP 200 for separate `doi`, `pmid`, and `pmcid` batches.

Canonical record after dedup:

- canonical key `doi:10.1038/s41586-021-03819-2`
- PMID `34265844`
- PMCID `PMC8371605`
- `source_ids`: `europepmc`, `openalex`, `pubmed`
- duplicate source rows before collapse: 3
- canonical rows after collapse: 1
- contributing sources retained: Europe PMC, OpenAlex, PubMed

Crossref's bibliographic search of that DOI string returned different DOIs (`10.3726/978-3-653-03819-4/10` and siblings, plus `10.3929/ethz-b-000667478`). Those stayed separate records. They were not merged into the AlphaFold identity.

The DOI package admitted 8 works. Only the AlphaFold cluster had more than one source.

## arXiv preprint law

The arXiv probe (`quantum error correction`) parsed two records whose only identity field was `arxiv_id`. Capsule `source_class` for that probe is `preprint`. An arXiv-only record whose publication type says `journal-article` still stays `preprint` (mutant `C-R1-04`). A later DOI relationship is stored as `related_preprint` and, when a publisher source is also present, taint `PREPRINT_PROVENANCE_RETAINED`. The arXiv row is not labeled peer review by itself.

## Redirects

Every redirect is rechecked against the enabled allowlist. HTTP downgrade, userinfo, `javascript` / `data` / `file` schemes, localhost, and IP literals are refused (`C-R1-08`, `C-R1-15`). Landing URLs on records are stored and not fetched. Full text status on every live record is `NOT_RETRIEVED`.
