# Build A

Clean canonical build from the repository checkout that contains `rust-toolchain.toml`.

| Field | Value |
| --- | --- |
| Path class | repository-relative `portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm` |
| Source git SHA | `e0497f79898689a00a30abeab67652d5f6a9193c` |
| Cargo.lock git blob | `f26fd3d70b52645034b33b27bf5b95664d3a6103` |
| Cargo.lock SHA-256 | `f7d262321e41b5b9b2b495040663d92f98e03e2894b95238891bfe39ab3a56e3` |
| rustc | 1.98.1 |
| rustc commit | `48a229ceaefd4985c50990b14116b6d856af0985` |
| rustc date | 2026-09-01 |
| cargo | cargo 1.98.1 (797e8a9bc 2026-08-05) |
| active toolchain | 1.98.1, overridden by repository `rust-toolchain.toml` |
| target | `wasm32-unknown-unknown` |
| profile declared | `lto = true`, `opt-level = "s"`, `panic = "abort"` |
| RUSTFLAGS shape | `--remap-path-prefix=<repository-root>/=./ --remap-path-prefix=<cargo-home>=./.cargo` |
| CARGO_INCREMENTAL | 0 |
| CARGO_TARGET_DIR | clean directory created by deleting the target root first |
| RUSTC_WRAPPER | `tools/spe_wasm_rustc_wrapper.mjs` |
| pinned metadata | `spe-canonical-v1-spe_core_rs`, `spe-canonical-v1-spe_wasm` |
| command | `node tools/wasm_canonical_build.mjs` |
| size | 671621 |
| sha256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| imports | 0 |
| exports | memory, spe_alloc, spe_evaluate, spe_free |
| promoted | no |

The target directory was removed before cargo ran. No pre-existing wasm was reused.
