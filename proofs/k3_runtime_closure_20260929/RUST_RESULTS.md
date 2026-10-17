# Rust results

`cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked`

| Binary | Passed | Failed |
|---|---|---|
| lib unit | 1 | 0 |
| abi_transport | 8 | 0 |
| capability_contract | 4 | 0 |
| context_protocol | 10 | 0 |
| k3_selection | 2 | 0 |
| negative_mutations | 2 | 0 |
| semantic_equivalence | 13 | 0 |

Total spe-core-rs: 40 passed, 0 failed.

`k3_selection` checks all 40 frozen vectors for disposition and technique ids, and checks that an ambiguous task stays `UNKNOWN` with `claims_pass` false.
