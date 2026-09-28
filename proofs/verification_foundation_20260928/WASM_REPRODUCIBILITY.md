# WASM reproducibility

Tracked public artifact was not modified.

| Artifact | Compiler embedded in the binary | Bytes | SHA-256 |
|---|---|---:|---|
| `apps/web/public/spe_wasm.wasm` (tracked) | rustc 1.98.1 (`48a229cea` 2026-09-01) | 671614 | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` |
| Default locked release on this machine | rustc 1.83.0 (`90b35a623` 2024-11-26) | 677268 | `27c73e9024b5fbf1933c5c7a37d4655ad2be623b8e75d9791c50ffef4f92bc91` |
| rustc 1.98.1, no path remap | rustc 1.98.1 | 671711 | `86fc0dc78fe5fa33bbfdc028fc0caef236e6eb5e8f2987d7cf89dff7e02eafe2` |
| rustc 1.98.1, path remap, build A | rustc 1.98.1 | 671613 | `55d611717a7d42771ad1d524c45fb4b5966ac520c4febf75f3152fb50b28e0a6` |
| rustc 1.98.1, path remap, build B | rustc 1.98.1 | 671613 | `55d611717a7d42771ad1d524c45fb4b5966ac520c4febf75f3152fb50b28e0a6` |

HASH MATCH against the tracked public file: **NO**

Promotion: **STOPPED**. `apps/web/scripts/copy-wasm.mjs` was not allowed to replace the tracked file.

## What was built

Canonical command used for the default toolchain:

```text
cargo build --manifest-path portable/spe-wasm/Cargo.toml --locked --offline --target wasm32-unknown-unknown --release
```

- Target: `wasm32-unknown-unknown`
- Profile: release (`lto = true`, `opt-level = "s"`, `panic = "abort"` from `portable/spe-wasm/Cargo.toml`)
- Output path: `portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm` (gitignored)
- Source build: **PASS** (artifact produced)
- Forbidden markers `/Users/`, `/home/`, `.codex/`, `.chatgpt-projects/`: absent from the 1.83.0 artifact and from the tracked file

The 1.98.1 investigation used the same locked manifest. Crates.io was contacted once so that toolchain could populate its registry. No `Cargo.toml` or `Cargo.lock` change.

## Why the bytes differ

`git diff 04bc493656aa03d648c7cd9ff220d3716cae7683 HEAD -- portable/spe-core-rs portable/spe-wasm` is empty. That commit is the one that last wrote `apps/web/public/spe_wasm.wasm`. Current Rust sources and both lockfiles match the sources that shipped the public file.

The tracked binary's producer section is rustc 1.98.1. This environment's default compiler is rustc 1.83.0. Building with 1.98.1 is necessary and not sufficient.

Panic/location strings in the tracked file are relative (`./portable/spe-core-rs/...`, `./.cargo/registry/...`). An unmapped 1.98.1 build embeds `/workspace/portable/...` and `/usr/local/cargo/registry/...`. Remap flags:

```text
--remap-path-prefix=/workspace/=./
--remap-path-prefix=/usr/local/cargo=./.cargo
```

remove those absolute paths. Two clean remapped builds were byte-identical to each other (deterministic on this machine) and still **1 byte** away from the tracked file (671613 vs 671614). Section comparison shows the type, function, element, data, and name sections differ, not only a path string. `codegen-units=1` produced a different 641285-byte binary and was not the shipped shape.

`docs/web04/REVIEW.md` documents a different remap (`$HOME=/rust-deps`, `$PWD=/spe-source`). The tracked file does not contain `/spe-source` or `/rust-deps`. CI (`.github/workflows/sdd-validation.yml`) uses `dtolnay/rust-toolchain@stable` plus `--remap-path-prefix=/home/runner=/rustc` and `--remap-path-prefix=/home=/rustc`. That workflow is not pinned to 1.98.1 and is not what `npm run build` runs.

## Copy script

`apps/web/scripts/copy-wasm.mjs` does not compile. It copies the gitignored release artifact onto `apps/web/public/spe_wasm.wasm` and rewrites `spe_wasm.sha256.json`. If the artifact is missing it exits 1. If a non-matching artifact is present it would overwrite the tracked file. That overwrite was not run.

No build script was changed. A toolchain pin or remap wrapper would not reproduce `8d482a17…` on this machine, so it would not make the official build consume the canonical bytes.
