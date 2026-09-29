# C-R1 evidence graph, contradiction map, and gaps

Live capture time `2026-09-29T21:17:27Z`.
Non-sensitive query: `CRISPR Cas9 gene editing`.
`as_of`: `2026-09-29`.
`semantic_authority`: `NONE`.
`wired_to_k3`, `wired_to_xcat`, `wired_to_quality`: false.

This package is evidence input. Retrieval does not make the query sentence true. No capsule `support_status` is `SUPPORTED`.

## Topic package

| Item | Value |
| --- | --- |
| Disposition | `PARTIAL` |
| Sources attempted | pubmed, pmc, europepmc, crossref, doaj, arxiv, openalex, ncbi_idconv |
| Search HTTP | 200 on all seven |
| ID converter HTTP | 200 on three typed batches (`doi`, `pmid`, `pmcid`) |
| Sources failed | none on this package |
| Normalized works | 19 |
| Deduped multi-source clusters | 0 (each hit kept its own canonical key) |
| Foundational | 2 |
| Frontier | 13 |
| Contradictory | 0 |
| Replication | 0 |
| Graph | 1 claim node, 19 edges |
| Edge polarity | `UNKNOWN` / strength `ABSENT` |
| Contradiction map | `UNKNOWN` / `NONE_OBSERVED_IN_FETCHED_SET` / 0 pairs |
| Full text | `NOT_RETRIEVED` on all 19 |

Each edge carries `source_id`, `canonical_key`, and `metadata_ref`. Example: source `arxiv`, canonical key `arxiv:2607.02622`, metadata ref `paper:2d7d93620a6a91f0`. Polarity is unknown because no structured assertion was supplied. The title is not treated as support.

Empty contradictory and replication groups were left empty. The contradiction map does not say that no contradiction exists.

## Gap / unknown map on the topic package

| Code | Count | Blocks a `VALID` close |
| --- | --- | --- |
| `CLAIM_POLARITY_UNKNOWN` | 19 | yes |
| `RETRACTION_STATE_UNKNOWN` | 13 | yes |
| `SOURCE_CLASS_UNKNOWN` | 6 | yes |
| `YEAR_UNKNOWN` | 2 | yes |
| `FULL_TEXT_NOT_RETRIEVED` | 19 | no |
| `ABSTRACT_ABSENT` | 11 | no |
| `LICENSE_UNKNOWN` | 17 | no |
| `CITATION_COUNT_UNKNOWN` | 10 | no |
| `PEER_REVIEW_STATUS_UNKNOWN` | 1 | no (arXiv preprint) |
| `NONE_OBSERVED_IN_FETCHED_SET` | 1 | no |

`UNKNOWN` stayed `UNKNOWN`. Open metadata was not treated as open full text. Landing URLs were not fetched.

## Contradiction fixture

`tests/unit/test_scholarly_mutations.py` mutant `C-R1-13` and `test_opposing_assertions_fill_contradiction_map` place `SUPPORT` and `REFUTE` on two different DOIs. Both record ids stay in the pair. Paper count does not delete either side. The live topic package has no such pair, so its map stays `UNKNOWN`.

## Source failure isolation

Mutant `C-R1-11` feeds a malformed Europe PMC body, Crossref 429, PMC 503, an OpenAlex transport error, arXiv 500, and one valid DOAJ record. The DOAJ work is admitted, the package is `PARTIAL`, and `NO_ADMITTED_RECORDS` is absent.

The live retracted package shows the same law: OpenAlex HTTP 429 is recorded, and the PubMed `RETRACTION` record remains.
