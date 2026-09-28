# WASM provenance

| Artifact | SHA-256 | Bytes |
|---|---|---|
| Legacy public (pre-canonical) | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` | 671614 |
| Previous canonical, semantic source before K3 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` | 671621 |
| New canonical, K3 selector in `spe-core-rs` | `8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f` | 785148 |

`9325f9ec…` proves the previous semantic source. It does not prove this K3 selector. The historical manifest `proofs/wasm_rebaseline_candidate_20260928/candidate-manifest.json` is unchanged and still records `9325f9ec…`. `copy-wasm` refuses promotion if that historical record changes.

Reproduction, same toolchain `1.98.1` commit `48a229ceaefd4985c50990b14116b6d856af0985`, `wasm32-unknown-unknown`, release, canonical script:

- `/tmp/spe-k3-wasm-a` and `/tmp/spe-k3-wasm-b` before the pin update: both `8b49bf3c…`, 785148 bytes (script exited 1 only because the pin was still the previous size).
- After the pin update: default `target-canonical` and `/tmp/spe-k3-wasm-c` both `canonical-wasm: ok`, imports 0, exports `memory,spe_alloc,spe_evaluate,spe_free`.
- Public `apps/web/public/spe_wasm.wasm` was written by `node apps/web/scripts/copy-wasm.mjs` after the candidate matched the new pin.

Parent tree: `98632cfb712d20eb7f7f6962a09f6326d7e942f6`.
Selector implementation commit: `98bc160184afa0cf95f17ff23392645c16ccc516`.
