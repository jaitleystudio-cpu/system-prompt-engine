# R4 Task 6 — live identity evidence (writer receipt)

Captured: 2026-10-04 Asia/Calcutta
Base: `1dea0037df72c832d831282036a5a8f70071f780` (PR #100). This branch does not rewrite #100.
Killed fixture bugs were not reopened. Product `LIVE_INDEX` / `LIVE_RETRACTION` constants stay **HOLD**.
`may_promote` stays false. A writer receipt is not promotion proof. `live_verified` stays false.

## Tested works

| Canonical DOI | OpenAlex returned id | Crossref returned id | PubMed quoted esearch |
|---|---|---|---|
| `10.1038/nature00870` | `https://openalex.org/W2158048826` | `10.1038/nature00870` | count 1, PMID `12077603`, no DOI in esearch |
| `10.1145/359545.359563` | `https://openalex.org/W3137220996` | `10.1145/359545.359563` | count **0** |
| `10.1016/j.ijantimicag.2020.105949` | `https://openalex.org/W3010930696` | `10.1016/j.ijantimicag.2020.105949` | count 1, PMID `32205204`, no DOI in esearch |

Each OpenAlex and Crossref row binds canonical DOI, provider, IST timestamp, exact query URL, returned id, `response_sha256`, and status `DOI_MATCH`. Bodies are not stored.

PubMed and PMC are one NCBI family. The PMC adapter URL is the PubMed quoted esearch URL. Sharing PMID `12077603` or `32205204` is not two confirmations. PMC `db=pmc` for the Gautret DOI returned 34 hits and is `IDENTIFIER_AMBIGUOUS`.

Supplemental PubMed esummary states the DOI and `Retracted Publication` for the two retracted PMIDs. That is the same NCBI record, not an extra independent provider, and it does not set `live_verified`.

## Gates

| Gate | Value |
|---|---|
| scoped LIVE_INDEX | `PASS_WITHIN_TESTED_SCOPE` (these three DOIs only) |
| scoped LIVE_RETRACTION | `HOLD` |
| product LIVE_INDEX | `HOLD` |
| product LIVE_RETRACTION | `HOLD` |
| may_promote | false |

Retraction flags were observed (`is_retracted`, Crossref `retraction`, PubMed pubtype) and are not a retraction-gate pass. `NO_SIGNAL` on the Lamport DOI is not `NOT_RETRACTED`.

FINAL: `R4_T6_LIVE_INDEX_PASS_WITHIN_TESTED_SCOPE_RETRACTION_HOLD`
