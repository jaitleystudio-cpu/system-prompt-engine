# Provenance results

Frozen enum, unchanged: `USER_EXPLICIT`, `USER_CONFIRMED`, `SYSTEM_REQUIRED`, `INFERRED`, `MODEL_PROPOSED`, `SPE_SUGGESTED`, `EXTERNAL_EVIDENCE`, `UNKNOWN`.

| Case | Result |
|---|---|
| Fact linked to a source whose text contains `user` | `USER_EXPLICIT`, kind `SHOULD` |
| Fact linked to `doi:` or another non-user source | `EXTERNAL_EVIDENCE`, kind `SHOULD` |
| Fact with no provenance link | `UNKNOWN` |
| Provenance record for a non-user source | `EXTERNAL_EVIDENCE` on `provenance_record` |
| Uncertainty | provenance `UNKNOWN`, kind not `MUST` |
| Authority grants | not copied into the graph |

Source-derived facts are not retagged as user requirements. Building the graph does not change the caller's provenance list.
