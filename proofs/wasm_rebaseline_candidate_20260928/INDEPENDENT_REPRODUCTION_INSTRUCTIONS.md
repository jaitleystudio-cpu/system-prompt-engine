# Independent reproduction

A second machine needs a git checkout, a normal rustup install, and the Node and Python dependencies already declared by this repository. It does not need a copied `target/` directory, the legacy public wasm as a build input, a developer shell profile, a particular absolute path, private files, or hand-tuned compiler flags.

## Expected result

| Check | Expected |
| --- | --- |
| Candidate size | 671621 |
| Candidate SHA-256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| Imports | 0 |
| Semantic vectors | 55 positive, 55 negative, 0 mismatches, 0 runtime errors |
| Public wasm | unchanged, sha256 `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` |

`FORENSIC_CANDIDATE_CONFIRMED` is NO. Do not try to obtain `55d611717a7d42771ad1d524c45fb4b5966ac520c4febf75f3152fb50b28e0a6`. That historical hash still embeds checkout-dependent Cargo metadata. The canonical candidate replaces that metadata with a repository constant so two checkouts match each other.

## Commands

From a clean clone, check out the commit that contains this file (the head of `cursor/spe-canonical-wasm-candidate-20260928`).

```bash
rustup show active-toolchain
node tools/wasm_canonical_build.mjs
```

`rust-toolchain.toml` pins channel `1.98.1` and target `wasm32-unknown-unknown`. The first `node`/`cargo` invocation in the checkout selects that toolchain. `rustc -Vv` must report release `1.98.1` and commit-hash `48a229ceaefd4985c50990b14116b6d856af0985`.

The canonical script prints `sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6`, `bytes=671621`, `imports=0`, and `promoted=no`. It does not copy the artifact into `apps/web/public`.

Optional second path check: run the same script in a second clone or worktree, with `SPE_WASM_CANDIDATE_TARGET_DIR` pointed at a fresh empty directory. The sha256 must match.

Semantic vectors, after `pip install -e ".[dev]"` (Python 3.11+) and a built `spe-core-eval` (the vector tool builds it if needed):

```bash
python tools/wasm_candidate_vectors.py portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm
```

Expect `"pass": true`, `"positive_count": 55`, `"negative_count": 55`, `"runtime_errors": 0`.

Do not run `npm run copy-wasm` or `npm run build` as part of reproduction. Those paths are promotion, and promotion is not approved. `npm run build` remains blocked while the gitignored default target artifact is absent.
