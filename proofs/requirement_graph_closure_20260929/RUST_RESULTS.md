# Rust results

Owner: `portable/spe-core-rs/src/requirements.rs`

`cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked --offline`

40 tests passed, 0 failed, across the kernel test binaries (including `k3_selection` 2/2).

`cargo test --manifest-path portable/spe-wasm/Cargo.toml --locked --offline`

4 tests passed, 0 failed. The WASM crate stays a transport wrapper.
