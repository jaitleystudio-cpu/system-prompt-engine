# WASM provenance

| Generation | sha256 | bytes | Role |
| --- | --- | --- | --- |
| Task 57 canonical | `dd57eb3ee6eb14297da8d49acb9803cf4853dbb89adcc5ef52f408379d643b22` | 1229241 | current `spe_api=quality` plus prior kernel |
| Task 56C XCAT DOMAIN | `077a4a399aaf598fd4ed3365f89cf6e32fcf64918a6c5f13319317823b4e3082` | 1023091 | historical |
| Pre-XCAT effect binding | `48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33` | 937763 | historical |
| Graph closure | `9cda3a8ef0f314dba152fbd442b8b3c8476d6f2be8b6e3221fb8abcdac6eb686` | 870560 | historical |

Build A and build B both produced the Task 57 digest. Imports stayed 0. The public file `apps/web/public/spe_wasm.wasm` matches `apps/web/public/spe_wasm.sha256.json`.

These builds are not a production qualification.

## Task57R-F1

| Generation | sha256 | bytes | Role |
| --- | --- | --- | --- |
| Task57R HOLD | `0537fc879b42524d36cf94b965e1234f02cf557c47cc55c7b1612d5643c70fcb` | 1273629 | historical; `from_k3` did not return reconstruction |
| Task57R-F1 | `dfdad1270bb11e9325c3676c1ae9f00ae1df7f47071feb0b1ccda8ff96b78541` | 1275233 | current canonical |

Two measure-only builds, one in the default canonical target and one in a separate target directory, were byte-identical. Imports 0. Exports `memory`, `spe_alloc`, `spe_evaluate`, `spe_free`. The later official `npm run build` reproduced the same digest. This is not a production qualification.

F2 does not change Rust. Two measure-only rebuilds, the default canonical target and a separate target directory, were byte-identical and matched the F1 pin `dfdad1270bb11e9325c3676c1ae9f00ae1df7f47071feb0b1ccda8ff96b78541`, 1275233 bytes, imports 0. No new pin was required.
