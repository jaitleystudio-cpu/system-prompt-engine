# SECOND_PATH_BUILD

Proves absolute workspace path independence.

## Second checkout

```
path: /tmp/spe-independent-path-b
git clone https://github.com/jaitleystudio-cpu/system-prompt-engine.git /tmp/spe-independent-path-b
git checkout 96ce1ceb000ff04d8fcd324de1da5dfe0d70c909
HEAD=96ce1ceb000ff04d8fcd324de1da5dfe0d70c909
working tree: CLEAN
target-canonical: absent before build
```

Path A: `/home/ubuntu/spe-independent-repro`  
Path B: `/tmp/spe-independent-path-b`

No copied `target` directory. Fresh clone only.

## Build

Started: `2026-09-28T16:57:30Z`  
Ended: `2026-09-28T16:57:34Z`  
Command: `node tools/wasm_canonical_build.mjs`

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
target=wasm32-unknown-unknown
promoted=no
```

## Verification

```
size=671621
sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6
cmp PathA artifact vs PathB artifact: BYTE_IDENTICAL
public wasm unchanged: 8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830
```

SECOND_PATH = PASS
