# Rust results

## spe-core-rs

```
cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked
```

Aggregate: **38 passed, 0 failed**

Breakdown observed:

| Suite | Passed |
| --- | ---: |
| sha256_lite unit | 1 |
| abi_transport | 8 |
| capability_contract | 4 |
| context_protocol | 10 |
| negative_mutations | 2 |
| semantic_equivalence | 13 |
| **Total** | **38** |

## spe-wasm

```
cargo test --manifest-path portable/spe-wasm/Cargo.toml --locked
```

Aggregate: **4 passed, 0 failed**

| Suite | Passed |
| --- | ---: |
| context_protocol_web | 2 |
| wrapper_conformance | 2 |
| **Total** | **4** |

## Mutation truth

`REAL_MUTATION_ENGINE = NO`

Rust negative mutation tests: **2** (baseline). This is not a full
mutation framework.
