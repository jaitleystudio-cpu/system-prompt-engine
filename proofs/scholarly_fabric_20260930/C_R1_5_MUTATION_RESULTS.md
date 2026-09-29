# C-R1.5 mutation results

Offline command:

```
python3 -m pytest tests/unit/test_scholarly_identity.py tests/unit/test_scholarly_fabric.py tests/unit/test_scholarly_mutations.py -q
```

Result: `51 passed`.

The same command does not open the public network. Live files without `SPE_SCHOLARLY_LIVE=1`:

```
python3 -m pytest tests/integration/test_scholarly_deep_evidence.py tests/integration/test_scholarly_live_qualification.py -q
```

Result: `2 skipped`.

## Historical C-R1 mutants

C-R1-01 through C-R1-15 remain killed by the tests named in `C_R1_MUTATION_RESULTS.md`.

## C-R1.5 mutants killed: 15/15

| Mutant | Test | Result |
| --- | --- | --- |
| C-R1.5-01 abstract absence becomes present | `test_c_r15_01_absent_abstract_stays_absent` | killed |
| C-R1.5-02 metadata treated as full text | `test_c_r15_02_metadata_is_not_full_text` | killed |
| C-R1.5-03 unknown license treated as open | `test_c_r15_03_unknown_license_is_not_open` | killed |
| C-R1.5-04 arXiv treated as peer reviewed | `test_c_r15_04_arxiv_alone_is_preprint` | killed |
| C-R1.5-05 oldest paper forced foundational | `test_c_r15_05_oldest_paper_is_not_foundational` | killed |
| C-R1.5-06 newest paper forced best | `test_c_r15_06_newest_paper_is_not_best` | killed |
| C-R1.5-07 title alone sets support polarity | `test_c_r15_07_title_alone_does_not_set_polarity` | killed |
| C-R1.5-08 paper-count resolves contradiction | `test_c_r15_08_paper_count_does_not_resolve_contradiction` | killed |
| C-R1.5-09 replication inferred from a keyword only | `test_c_r15_09_title_keyword_is_not_a_replication_link` | killed |
| C-R1.5-10 source 429 erased | `test_c_r15_10_and_11_rate_limit_is_kept_and_not_retried` | killed |
| C-R1.5-11 retry storm allowed | `test_c_r15_10_and_11_rate_limit_is_kept_and_not_retried` | killed |
| C-R1.5-12 full text fetched from a non-allowlisted publisher | `test_c_r15_12_publisher_full_text_is_not_fetched` | killed |
| C-R1.5-13 private context appended to an abstract request | `test_c_r15_13_private_context_stays_out_of_retrieval_urls` | killed |
| C-R1.5-14 retracted paper silently treated as normal | `test_c_r15_14_retracted_support_is_not_silently_normal` | killed |
| C-R1.5-15 gap removed when evidence is unavailable | `test_c_r15_15_missing_evidence_keeps_the_gap` | killed |

Failure isolation, still offline: `test_source_failures_do_not_drop_a_healthy_source` keeps an OpenAlex record when PubMed returns malformed JSON, DOAJ times out, Crossref returns zero items, and arXiv returns malformed XML. Redirects off the allowlist stay killed by `test_c_r1_08_redirect_off_allowlist_is_rejected`.
