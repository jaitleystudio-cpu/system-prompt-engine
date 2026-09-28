# Canonical build

## Command

```
node tools/wasm_canonical_build.mjs
```

Also wired as `npm run wasm:build-canonical` from `apps/web`.

## Pinned toolchain

| Component | Value |
| --- | --- |
| rustc | 1.98.1 |
| rustc commit | `48a229ceaefd4985c50990b14116b6d856af0985` |
| cargo | 1.98.1 (`797e8a9bc` 2026-08-05) |
| target | `wasm32-unknown-unknown` |
| toolchain file | `rust-toolchain.toml` channel `1.98.1` |

## Flags / environment

- `CARGO_INCREMENTAL=0`
- `CARGO_TARGET_DIR` = clean `portable/spe-wasm/target-canonical` (or external override)
- `RUSTC_WRAPPER` = `tools/spe_wasm_rustc_wrapper.mjs`
- `RUSTFLAGS` = `--remap-path-prefix=<repo>/=./ --remap-path-prefix=<cargo-home>=./.cargo`
- Pinned crate metadata for `spe_core_rs` / `spe_wasm`: `spe-canonical-v1-<crate>`

## Pre-promotion reconfirmation (Task C §4)

Fresh clean-target build **before** replacing public bytes:

| Field | Observed |
| --- | --- |
| size | 671621 |
| sha256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| imports | 0 |
| exports | memory, spe_alloc, spe_evaluate, spe_free |
| promoted | no |

Exact match to expected canonical candidate → promotion allowed.

## Post-promotion recipe behavior

After public promotion, the canonical build requires the tracked public
module to already equal the reviewed canonical hash, rebuilds a fresh
candidate, verifies size/hash/imports, and refuses to modify public
bytes itself (`promoted=no`).
