# BUILD_A

Clone: `/home/ubuntu/spe-independent-repro`  
Command: `node tools/wasm_canonical_build.mjs`  
Started: `2026-09-28T16:56:34Z`  
Ended: `2026-09-28T16:56:39Z`

## Precondition

- No `portable/spe-wasm/target-canonical` directory
- Public WASM sha256 before build: `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`
- No environment overrides of canonical build variables

## Canonical script stdout

```
canonical-wasm: ok
artifact=portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm
bytes=671621
sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6
imports=0
exports=memory,spe_alloc,spe_evaluate,spe_free
rustc=1.98.1
rustc_commit=48a229ceaefd4985c50990b14116b6d856af0985
cargo=cargo 1.98.1 (797e8a9bc 2026-08-05)
active_toolchain=1.98.1 (overridden by repository rust-toolchain.toml)
target=wasm32-unknown-unknown
promoted=no
```

## Independent verification

```
path: /home/ubuntu/spe-independent-repro/portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm
size=671621
sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6
```

## Public artifact after build

```
sha256=8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830
git diff apps/web/public/spe_wasm.wasm apps/web/public/spe_wasm.sha256.json: EMPTY
promoted=no
```

BUILD_A = PASS (matches Task A expected candidate)
