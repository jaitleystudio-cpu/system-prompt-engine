# WASM provenance

| Artifact | SHA-256 | Bytes |
|---|---|---|
| Legacy public | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` | 671614 |
| Pre-K3 canonical | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` | 671621 |
| Pre-graph K3 | `8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f` | 785148 |
| Requirement-graph closure (previous canonical) | `9cda3a8ef0f314dba152fbd442b8b3c8476d6f2be8b6e3221fb8abcdac6eb686` | 870560 |
| This effect binding | `48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33` | 937763 |

The graph-closure hash is historical. It remains on `proofs/k3_runtime_closure_20260929/candidate-manifest.json` and as `graph_closure_sha256` on the new manifest and the public hash file.

Two target paths both produced `48ad95f5…`:

- `portable/spe-wasm/target-canonical`
- external `SPE_WASM_CANDIDATE_TARGET_DIR`

imports: 0
exports: `memory`, `spe_alloc`, `spe_evaluate`, `spe_free`
reproducible: yes
