# SPE canonical WASM candidate report

Status: `REBASELINE_CANDIDATE_READY_FOR_INDEPENDENT_REPRODUCTION`.

The candidate is not promoted. `apps/web/public/spe_wasm.wasm` and `apps/web/public/spe_wasm.sha256.json` are unchanged.

| Gate | Result |
| --- | --- |
| PINNED_RUST | PASS (`1.98.1`, commit `48a229ceaefd4985c50990b14116b6d856af0985`) |
| CANONICAL_BUILD_RECIPE | PASS (`node tools/wasm_canonical_build.mjs`) |
| CLEAN_BUILD_A | PASS |
| CLEAN_BUILD_B | PASS |
| A_EQUALS_B | YES |
| ABSOLUTE_PATH_INDEPENDENCE | PASS |
| IMPORTS | 0 |
| 110_CONFORMANCE | PASS |
| PYTHON_RUST_PARITY | PASS |
| RUST_WASM_PARITY | PASS |
| PYTHON_WASM_PARITY | PASS |
| PYTHON_NON_HASH_FAILURES | 0 |
| PUBLIC_WASM_CHANGED | NO |
| PUBLIC_HASH_MANIFEST_CHANGED | NO |
| SEMANTIC_SOURCE_CHANGED | NO |
| OFFICIAL_BUILD | EXPECTED_BLOCKED_PENDING_PROMOTION |
| HOSTING | FORBIDDEN |

## Hashes

| Artifact | Size | SHA-256 |
| --- | --- | --- |
| Build A and build B | 671621 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| Legacy public wasm | 671614 | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` |
| Forensic remap-only candidate | 671613 | `55d611717a7d42771ad1d524c45fb4b5966ac520c4febf75f3152fb50b28e0a6` |

`BYTE_EQUALITY = NO`.

`FORENSIC_CANDIDATE_CONFIRMED = NO`.

The forensic hash remapped source paths and still let Cargo put the absolute path of sibling `spe-core-rs` into `-C metadata`. Two checkouts therefore differed by that metadata alone. The canonical wrapper replaces metadata for `spe_core_rs` and `spe_wasm` with `spe-canonical-v1-<crate>`. Registry crates are unchanged. Flags were not searched to recover `8d482a17` or to force `55d61171`.

## Recipe

`rust-toolchain.toml` channel is exactly `1.98.1` with target `wasm32-unknown-unknown`.

```text
node tools/wasm_canonical_build.mjs
```

That command checks the pinned toolchain, deletes the target directory, sets `CARGO_INCREMENTAL=0`, sets the two path remaps, builds `--locked --target wasm32-unknown-unknown --release`, hashes the wasm, requires zero imports, and refuses to copy into `apps/web/public`.

Declared release profile remains `lto = true`, `opt-level = "s"`, `panic = "abort"`. Observed rustc codegen on the wasm crates was `-C opt-level=s -C panic=abort -C strip=debuginfo`. The captured `spe_wasm` rustc line did not include `-C lto`. The profile was not edited.

`npm run build` does not call this script. There is no promotion command.
