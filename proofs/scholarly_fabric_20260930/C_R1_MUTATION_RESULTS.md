# C-R1 mutation results

Offline command:

```
python3 -m pytest tests/unit/test_scholarly_identity.py tests/unit/test_scholarly_fabric.py tests/unit/test_scholarly_mutations.py -q
```

Result: `33 passed`.

Live command, separate from the unit suite:

```
SPE_SCHOLARLY_LIVE=1 python3 -m pytest tests/integration/test_scholarly_live_qualification.py -q
```

Result: `1 passed` at `2026-09-29T21:17:27Z`.

The same live file without `SPE_SCHOLARLY_LIVE=1` is `1 skipped`. A public outage cannot fail the deterministic unit suite.

## Mutants killed: 15/15

| Mutant | Test | Result |
| --- | --- | --- |
| C-R1-01 network occurs when `allow_network=false` | `test_c_r1_01_network_stays_off_without_allow_network` | killed |
| C-R1-02 whole private prompt sent to a source | `test_c_r1_02_private_prompt_is_not_the_outbound_query` | killed |
| C-R1-03 unknown retraction becomes `NOT_RETRACTED` | `test_c_r1_03_missing_retraction_signal_stays_unknown` | killed |
| C-R1-04 arXiv becomes peer-reviewed | `test_c_r1_04_arxiv_alone_is_not_peer_reviewed` | killed |
| C-R1-05 duplicate DOI stays separate | `test_c_r1_05_and_07_same_doi_collapses_and_keeps_provenance` | killed |
| C-R1-06 different DOI incorrectly merged | `test_c_r1_06_different_dois_do_not_merge` | killed |
| C-R1-07 source provenance lost during dedup | `test_c_r1_05_and_07_same_doi_collapses_and_keeps_provenance` | killed |
| C-R1-08 redirect escapes the allowlist | `test_c_r1_08_redirect_off_allowlist_is_rejected` | killed |
| C-R1-09 ID converter receives the raw research query | `test_c_r1_09_id_converter_does_not_receive_the_research_query` | killed |
| C-R1-10 unsupported claim marked `SUPPORTED` | `test_c_r1_10_and_14_title_does_not_mark_a_claim_supported` | killed |
| C-R1-11 one source failure destroys the package | `test_c_r1_11_one_source_failure_does_not_drop_the_others` | killed |
| C-R1-12 missing full text treated as available | `test_c_r1_12_missing_full_text_is_not_available` | killed |
| C-R1-13 contradiction discarded | `test_c_r1_13_contradiction_keeps_both_sides` | killed |
| C-R1-14 source title alone proves the claim | `test_c_r1_10_and_14_title_does_not_mark_a_claim_supported` | killed |
| C-R1-15 unexpected host allowed | `test_c_r1_15_unexpected_host_schemes_and_identity_shapes` | killed |

`C-R1-01` replaces `socket.create_connection` and still gets `REFUSED` / `NETWORK_NOT_AUTHORIZED` with empty egress.
