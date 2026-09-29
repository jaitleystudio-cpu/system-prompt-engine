# Rust results

`portable/spe-core-rs/src/quality.rs` implements the Python oracle. `cargo build --bin spe-core-eval` succeeded. `cargo test --offline` exited 0 (41 tests). Parity against Python passed for the Task 57 vector set.

No additional crate was added. SHA-256 uses the existing `sha256_lite` module. Canonical JSON uses the existing `canonical_dumps`.
