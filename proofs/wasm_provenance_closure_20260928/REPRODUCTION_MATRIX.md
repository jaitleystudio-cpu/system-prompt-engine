# Reproduction matrix

Source SHA for every row: `e0497f79898689a00a30abeab67652d5f6a9193c`

Cargo.lock blob: `f26fd3d70b52645034b33b27bf5b95664d3a6103`

Profile: `lto=true`, `opt-level=s`, `panic=abort` from `portable/spe-wasm/Cargo.toml`

Postprocessing: none. No wasm-opt.

Command shape:

```
cargo <toolchain> build --manifest-path <tree>/portable/spe-wasm/Cargo.toml \
  --locked --offline --target wasm32-unknown-unknown --release
```

`CARGO_TARGET_DIR` was outside the repo. The tracked public file was not overwritten.

Semantic column: Node host stdout versus the tracked public WASM, 110 cases, imports 0.

Target hash: `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` (671614).

| ID | rustc | cargo | Flags | Size | SHA-256 | Exact | Semantic |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| B1 | 1.83.0 (90b35a623 2024-11-26) | 1.83.0 | none | 677268 | `27c73e9024b5fbf1933c5c7a37d4655ad2be623b8e75d9791c50ffef4f92bc91` | NO | 110/110 |
| B2 | 1.98.1 (48a229cea 2026-09-01) | 1.98.1 (797e8a9bc 2026-08-05) | none | 671711 | `86fc0dc78fe5fa33bbfdc028fc0caef236e6eb5e8f2987d7cf89dff7e02eafe2` | NO | 110/110 |
| B3 | 1.98.1 | 1.98.1 | `--remap-path-prefix=/workspace/=./ --remap-path-prefix=/usr/local/cargo=./.cargo` twice, two clean dirs | 671613 | `55d611717a7d42771ad1d524c45fb4b5966ac520c4febf75f3152fb50b28e0a6` | NO | 110/110 |
| B4 | 1.98.1 | 1.98.1 | web04: `--remap-path-prefix=/home/ubuntu=/rust-deps --remap-path-prefix=/workspace=/spe-source` | 671717 | `b22e2e22b1c07a3856c81bc7ed6ae33f241fa310c0a933e5c31d868f31cb5b50` | NO | 110/110 |
| B5 | 1.98.1 | 1.98.1 | CI workflow flags `--remap-path-prefix=/home/runner=/rustc --remap-path-prefix=/home=/rustc` | 671711 | `86fc0dc78fe5fa33bbfdc028fc0caef236e6eb5e8f2987d7cf89dff7e02eafe2` | NO | 110/110 |
| B6 | 1.98.1 | 1.98.1 | full worktree `/tmp/spe-wt` at `e0497f7`, remap `/tmp/spe-wt/=./` and `/usr/local/cargo=./.cargo` | 671620 | `8a06dc3586022e9ed0fdf06f80212bf68818229ebf23c233261f9c59144b29e9` | NO | 110/110 |

B3 is deterministic on this machine: two clean directories produced the same hash. B6’s code and data sections match B3. The 7-byte gap is the name section. Neither matches the shipped code section.

B5 equals B2 because this checkout is `/workspace`, not under `/home`. The CI prefixes do not apply here. The shipped file does not contain `/rustc/` as a *remapped source* root in the `./portable` slots; its `/rustc/48a229cea…` strings are rustc’s own library paths.

B4 embeds `/spe-source/portable`. The shipped file embeds `./portable`. The documented web04 recipe is not this artifact.

## Discarded, not counted

- An earlier web04 invocation expanded `RUSTFLAGS` before the assignment, so the flags were empty and the hash duplicated B2.
- A partial tree at `/tmp/spe-src-alt` (portable only) failed to compile: `include_str!` could not read `data/grounding` and `data/protocols`. No binary.
- A mis-aimed remap (flags for `/tmp/spe-src-alt/` while compiling `/workspace`) produced `ebeb624c…` (671669) and still contained `/workspace/portable`. Invalid control. Not a recipe.

## Prior-session disproof, not re-run

`codegen-units=1` on rustc 1.98.1 produced 641285 bytes, sha256 `b415ae3e37032d19ded646aa85f80ffe82f08c9dacb6fbb844b83cdb27f459af`. Code size does not match 337534. Not the shipped profile.

## Stop

Six evidence-backed combinations were executed. No further flag is supported by the producers section, the embedded paths, Cargo.toml, CI, or the web04 note. The matrix stops. Exact byte match: NO.
