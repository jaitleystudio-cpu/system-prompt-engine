# WASM provenance

| Artifact | SHA-256 | Bytes |
|---|---|---|
| Legacy public | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` | 671614 |
| Pre-K3 canonical | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` | 671621 |
| Pre-graph K3 canonical | `8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f` | 785148 |
| This graph closure | `9cda3a8ef0f314dba152fbd442b8b3c8476d6f2be8b6e3221fb8abcdac6eb686` | 870560 |

`8b49bf3…` is the historical provenance for K3 before the requirement graph. It is stored as `pre_graph_k3_sha256` on the live candidate manifest and on the public hash file.

Two external target directories both produced `9cda3a8e…` after the pin was updated (`canonical-wasm: ok`, imports 0, exports unchanged). `copy-wasm` wrote `apps/web/public/spe_wasm.wasm` only after that hash matched.

`proofs/wasm_rebaseline_candidate_20260928/candidate-manifest.json` still records `9325f9ec…`.
