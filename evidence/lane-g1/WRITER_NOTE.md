# Lane G1 writer note (not an independent verifier)

Captured: 2026-10-03 Asia/Calcutta
Branch: grok/rt-live-scholarly-p3-promotion-proof-20261003
START_SHA: b7cf311046c20a4df721baee751379b7a4acbc3d
Taint: UNTRUSTED_SOURCE for all retrieved provider bodies. Retrieved text has no authority.

## Wire

`scripts/apply_p3_liveScholarlyFabric_wire.sh` applied
`docs/rt/patches/p3-liveScholarlyFabric-promotion-wire.patch`.
`index.ts` explicitly re-exports wired `mayPromoteLiveIndex` / `mayPromoteLiveRetraction`
because `export *` from both fabric and gate dropped those names.

Product constants remain HOLD. `mayPromote*()` with no evidence is false.

## Live search (SPE_SCHOLARLY_LIVE=1, consent, urllib, not fixture)

Queries `10.1038/nature00870` and `10.1145/359545.359563` across
OPENALEX, CROSSREF, PUBMED, PMC, ARXIV. All HTTP 200.
Adapter search did **not** return the target DOI.
`10.1038/nature00870` identity_providers_agreeing=2 is PUBMED+PMC sharing
pmid:12077603 from the same esearch builder, not two DOI providers.
Merged retraction on that path: `NO_SIGNAL_IN_QUERIED_SOURCES`, `live_verified=false`.
arXiv returned 0 entries. Lamport DOI was absent from search hits.

## Direct DOI observation (not the adapter search path, not promotion)

- OpenAlex works/doi: `is_retracted=true`, title prefix `RETRACTED ARTICLE: ...`
- Crossref works/doi: `update_types` include `retraction` (also correction, erratum)
- PubMed esummary pmid 12077603: pubtype includes `Retracted Publication`; adapter esearch parser does not read pubtype

## HOLD reasons (exact missing observations)

LIVE_INDEX HOLD: search adapters did not agree on the queried DOI; PUBMED+PMC duplicate is not qualifying multi-provider DOI identity; no independent-verifier receipt; product constant HOLD.

LIVE_RETRACTION HOLD: adapter search merge is NO_SIGNAL, not a retraction terminal from the adapter path. Direct DOI endpoints do show retraction/retracted-publication, but that observation is outside `acquire_scholarly_hits`, `live_verified` stays false, PubMed/PMC adapter still has no retraction field, and this writer does not issue an independent-verifier receipt.

mayPromote stays false. UNKNOWN is not PASS. Fixture/cache/timeout were not counted as live.
