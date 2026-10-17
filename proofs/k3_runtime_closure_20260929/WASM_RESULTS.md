# WASM results

Canonical artifact `8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f`, 785148 bytes.

| Check | Result |
|---|---|
| imports | 0 |
| exports | `memory`, `spe_alloc`, `spe_evaluate`, `spe_free` |
| `cargo test --manifest-path portable/spe-wasm/Cargo.toml --locked` | 4 passed, 0 failed |
| K3 vectors through `spe_evaluate` | 0 mismatches vs Python |

`spe-wasm` contains no K3 logic. `evaluate_json` forwards `spe_api=k3` to `spe-core-rs`.
