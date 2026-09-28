# Public artifact

## Promoted files

| File | Role |
| --- | --- |
| `apps/web/public/spe_wasm.wasm` | Canonical V1 public module |
| `apps/web/public/spe_wasm.sha256.json` | Integrity manifest |

## Observed after promotion

| Field | Value |
| --- | --- |
| size | 671621 |
| sha256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| manifest.sha256 | same |
| manifest.bytes | 671621 |
| manifest.qualification | `canonical-v1-promoted` |
| manifest.legacy_sha256 | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` |
| manifest.semantic_source_sha | `e0497f79898689a00a30abeab67652d5f6a9193c` |
| manifest.source | `portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm` |

## Runtime integrity

Worker / `wasm-host` still verifies SHA-256 against the public manifest
before instantiate. Tamper (`SPE_TAMPER_SHA=1`) yields
`WASM_INTEGRITY_MISMATCH` with `used_ts_fallback=false`.
