# Known retracted DOI fixtures (public, INR 0)

Used by Phase 3 optional `SPE_SCHOLARLY_LIVE=1` probes and injectable-transport mutants.
These are well-known public retracted papers -- not fabricated identifiers.

| DOI | Notes | Expected signals |
|---|---|---|
| `10.1038/nature00870` | Jiang et al., Nature 418:41-49 (2002). Title prefixed RETRACTED ARTICLE. | OpenAlex `is_retracted=true`; Crossref `updated-by` includes `type: retraction` |
| `10.1016/j.ijantimicag.2020.105949` | Gautret et al. 2020 HCQ/azithromycin COVID trial (retracted). | OpenAlex `is_retracted=true` |

## Epistemic law

- Spotting a retracted DOI live != product `LIVE_RETRACTION=YES`.
- Product constants stay **HOLD** until `evaluate_live_promotion_gate` is green AND founder flips.
- `NO_SIGNAL_IN_QUERIED_SOURCES` must never collapse to `NOT_RETRACTED`.
