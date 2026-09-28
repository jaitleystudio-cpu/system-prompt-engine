# Rust results

Base SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

## Toolchain on this machine

- rustup 1.29.0
- Default rustc 1.83.0 (`90b35a623` 2024-11-26)
- Default cargo 1.83.0
- Installed targets before this mission: `x86_64-unknown-linux-gnu`
- `wasm32-unknown-unknown` was added as toolchain setup, not as a crate dependency
- rustc 1.98.1 (`48a229cea` 2026-09-01) was installed later only to test whether the tracked WASM bytes could be reproduced. It was not pinned in the repository.

## spe-core-rs

Command:

```text
cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked --offline
```

Exit: **0**

Offline succeeded. Lockfile crates were already in the local cargo registry. No dependency was added. `Cargo.lock` was not modified.

| Crate target | Passed | Failed | Ignored |
|---|---:|---:|---:|
| library unit tests | 1 | 0 | 0 |
| `spe_core_eval` binary | 0 | 0 | 0 |
| `abi_transport` | 8 | 0 | 0 |
| `capability_contract` | 4 | 0 | 0 |
| `context_protocol` | 10 | 0 | 0 |
| `negative_mutations` | 2 | 0 | 0 |
| `semantic_equivalence` | 13 | 0 | 0 |
| doc-tests | 0 | 0 | 0 |
| **Total** | **38** | **0** | **0** |

## spe-wasm

Command:

```text
cargo test --manifest-path portable/spe-wasm/Cargo.toml --locked --offline
```

Exit: **0**

Passed **4**, failed **0**, ignored **0** (wrapper conformance 2, context-protocol web 2, plus empty lib/doc targets).

## Mutation truth

`tools/run_mutations.py` raises `SystemExit("stub: run_mutations.py not implemented yet")`.

REAL MUTATION ENGINE = **NO**

NEGATIVE MUTATION TESTS = **2** (`portable/spe-core-rs/tests/negative_mutations.rs`: `constructed_mutations_do_not_escape`, `all_frozen_negatives_report_exact_reason`)

Python files `tests/portability/test_mutation_controls.py` and `tests/portability/test_cross_language_negative_mutations.py` passed inside the oracle suite. They are tests, not a mutation engine. No mutation framework was added.
