# R4 Task 6 — live retraction evidence (writer receipt)

Captured: 2026-10-04 Asia/Calcutta, responses at 10:47 IST.
Base: `a20099a92e08b7d558cfadb442565df1cb85fa6d`. This branch does not rewrite PR #100.
Product `LIVE_INDEX` and `LIVE_RETRACTION` stay **HOLD**. `may_promote` stays false.
This file does not rescore the three-DOI index. Bodies are not stored. `response_sha256` is the raw HTTP body.

PMC was not queried. PubMed esearch is PMID resolution and has no retraction field. Esarch plus esummary are one NCBI family, not two providers.

A missing retraction field is not PASS. `is_retracted=false` and an empty Crossref relation are not `NOT_RETRACTED`.

## What the providers returned

| DOI | OpenAlex `is_retracted` | Crossref | PubMed |
|---|---|---|---|
| `10.1038/nature00870` | true (`W2158048826`) | `update-to` absent. `updated-by` types correction, retraction, erratum, retraction. `relation` is `has-review` only | esearch count 1, PMID `12077603`, no retraction field. esummary pubtype includes `Retracted Publication` |
| `10.1145/359545.359563` | false (`W3137220996`) | `update-to` absent, `updated-by` absent, `relation` `{}` | esearch count 0, no PMID, no pubtype |
| `10.1016/j.ijantimicag.2020.105949` | true (`W3010930696`) | `update-to` type retraction. `updated-by` types retraction, erratum, retraction. `relation` `has-review`, `has-preprint` | esearch count 1, PMID `32205204`, no retraction field. esummary pubtype includes `Retracted Publication` |

Lamport evidence: no retraction asserted by these providers on this date. That is HOLD, not PASS.

Nature and Gautret each have OpenAlex, Crossref, and NCBI asserting retraction, so those two DOIs are `RETRACTION_BOUND`. That binding is not a product pass. The lane value stays HOLD because Lamport does not assert a retraction and because a writer receipt does not flip the product constant.

FINAL: `LIVE_RETRACTION=HOLD`
