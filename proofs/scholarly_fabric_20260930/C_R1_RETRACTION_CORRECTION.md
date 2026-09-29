# C-R1 retraction and correction

Live capture time `2026-09-29T21:17:27Z`. There is no `NOT_RETRACTED` notice kind.

## Explicit retraction

Query topic: `10.1016/s0140-6736(97)11096-0` (Wakefield et al., Lancet 1998).

PubMed HTTP 200 admitted one work:

- DOI `10.1016/s0140-6736(97)11096-0`
- PMID `9500320`
- retraction kind `RETRACTION`
- evidence `PUBMED_PUBTYPE_RETRACTION`
- full text `NOT_RETRIEVED`
- source `pubmed`

OpenAlex on this same package returned HTTP 429. That failure is gap `SOURCE_UNAVAILABLE` / `HTTP_429`. It did not drop the PubMed retraction record. Package status stayed `PARTIAL`.

## Explicit non-retraction

On the CRISPR topic package, OpenAlex `is_retracted: false` produced kind `NONE` for works including:

- `10.1056/nejmoa2031054` (PMID `33283989`)
- `10.1002/hsr2.73308` (PMID `42798792`, PMCID `PMC13613094`)
- `10.3389/fbioe.2023.1143157` (PMID `36970624`)

`NONE` is an explicit boolean from a source that can assert status. It is not the default for a missing field.

## No signal stays UNKNOWN

DOAJ has no retraction field. Live DOAJ hits on the CRISPR package, and Crossref hits that only carry `CROSSREF_NO_EXPLICIT_SIGNAL`, are kind `UNKNOWN`.

The AlphaFold cluster (`10.1038/s41586-021-03819-2`) merged Europe PMC, OpenAlex, and PubMed and remained `UNKNOWN`. A `NONE` witness plus a source that does not assert status does not become `NONE`. Mutant `C-R1-03` locks that merge.

Missing signal is never stored as `NOT_RETRACTED`.
