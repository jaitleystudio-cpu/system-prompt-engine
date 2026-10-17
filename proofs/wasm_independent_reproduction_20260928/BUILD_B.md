# BUILD_B

Clone: `/home/ubuntu/spe-independent-repro`  
Action: delete ONLY generated candidate output, then rebuild from clean target state.

```
rm -rf portable/spe-wasm/target-canonical
# TARGET_DESTROYED
# source tree unmodified
node tools/wasm_canonical_build.mjs
```

Started: `2026-09-28T16:57:00Z`  
Ended: `2026-09-28T16:57:04Z`

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
size=671621
sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6
```

## Equality

BUILD_A sha256 == BUILD_B sha256 == Task A expected  
`9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6`

Public WASM remained `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`.

BUILD_B = PASS
