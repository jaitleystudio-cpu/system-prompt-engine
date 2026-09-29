# C-R1.5 deep evidence

Recorded `2026-09-29T22:20:06Z` in `C_R1_5_deep_evidence.json`.

Live command:

```
SPE_SCHOLARLY_LIVE=1 python3 -m pytest tests/integration/test_scholarly_deep_evidence.py -q
```

Result: `1 passed`. Host contacted: `www.ebi.ac.uk` only. Every egress `attempt` is 1. `backoff_state` is `NO_RETRY`. `semantic_authority` is `NONE`. `wired_to_k3` is false. The private sentinel did not appear in any request.

## Contradiction

Question topic, sent as two DOI field lookups: postmenopausal hormone therapy and coronary heart disease.

| Side | DOI | Paper type | Peer review | Abstract | Full text | Polarity |
| --- | --- | --- | --- | --- | --- | --- |
| Women's Health Initiative combined-hormone trial | `10.1001/jama.288.3.321` | `RANDOMIZED_TRIAL` | `UNKNOWN` | `ABSTRACT_AVAILABLE` | `NOT_PERMITTED` | `REFUTE` / `TENTATIVE` / `ABSTRACT` |
| Nurses' Health Study estrogen report | `10.1056/nejm199109123251102` | `OTHER` | `UNKNOWN` | `ABSTRACT_AVAILABLE` | `NOT_PERMITTED` | `SUPPORT` / `TENTATIVE` / `ABSTRACT` |

The Nurses' Health Study record is `Journal Article` only, so it stays `OTHER`. It is not labeled observational from the title. The map `resolution` is `NONE`. Uncertainty is `UNRESOLVED`. The graph is `PARTIAL`, not `VALID`. Capsule `support_status` is `UNVERIFIED`.

## Replication and lawful full text

| Role | DOI | Full text | License |
| --- | --- | --- | --- |
| Original, Bem 2011 | `10.1037/a0021524` | `NOT_PERMITTED` | `NOT_OPEN` |
| Replication, Ritchie, Wiseman, French 2012 | `10.1371/journal.pone.0033423` | `OPEN_FULL_TEXT` | `STATED` (`cc by`) |

The link relationship is `EXPLICIT_ABSTRACT` because the abstract says "three pre-registered independent attempts to exactly replicate". `result_relation` is `EXPLICIT_ABSTRACT_RESULT` because the abstract says the attempts "do not support the existence of psychic ability". Full text was `GET /europepmc/webservices/rest/PMC3303812/fullTextXML`, HTTP 200, digest `sha256:697c25feb7852c35194f51ea9c2257c4eaca80c8053379d5eebe552c8e2900d7`, `retrieved_at` `2026-09-29`. The publisher PDF URL was not requested.

## Gaps kept

Both packages keep `RETRACTION_STATE_UNKNOWN` (`EUROPEPMC_NO_EXPLICIT_SIGNAL`) and `PEER_REVIEW_STATUS_UNKNOWN`. The contradiction package keeps `REPLICATION_ABSENT` and `FULL_TEXT_NOT_RETRIEVED`. The replication package keeps `NONE_OBSERVED_IN_FETCHED_SET` and `CLAIM_POLARITY_UNKNOWN`. No gap was closed by silence.

## Metadata re-qualification

`SPE_SCHOLARLY_LIVE=1 python3 -m pytest tests/integration/test_scholarly_live_qualification.py -q` passed at `2026-09-29T22:21:10Z`. All seven search sources stayed `QUALIFIED`. Unexpected hosts: none. That file still compiles with `fetch_open_full_text=False`, so those topic records stay `NOT_RETRIEVED`.
