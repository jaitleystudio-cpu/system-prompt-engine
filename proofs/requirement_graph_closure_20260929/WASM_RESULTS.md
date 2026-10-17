# WASM results

| Field | Value |
|---|---|
| sha256 | `9cda3a8ef0f314dba152fbd442b8b3c8476d6f2be8b6e3221fb8abcdac6eb686` |
| bytes | 870560 |
| imports | 0 |
| exports | `memory`, `spe_alloc`, `spe_evaluate`, `spe_free` |
| reproducible | yes, two external target directories, same SHA |
| API | existing `spe_evaluate` JSON envelope, `spe_api=requirement_graph` and `spe_api=k3` |
| TypeScript graph owner | no |

`node tools/wasm_canonical_build.mjs` printed `canonical-wasm: ok` and `promoted=no` on both paths after the pin matched. `node apps/web/scripts/copy-wasm.mjs` then wrote the public artifact.
