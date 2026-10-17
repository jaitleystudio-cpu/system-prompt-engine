# Rust results

`cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked --offline`

passed: 40
failed: 0

`cargo test --manifest-path portable/spe-wasm/Cargo.toml --locked --offline`

passed: 4
failed: 0

The effect plan is produced by `effect::bind` and attached inside `k3::envelope`. `op=bind` on the existing `spe_api=k3` entry compares a supplied selection without a new export.
