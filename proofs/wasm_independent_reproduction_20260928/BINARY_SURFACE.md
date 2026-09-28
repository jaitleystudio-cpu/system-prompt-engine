# BINARY_SURFACE

Subject artifact (independently built, clone A after BUILD B):

```
/home/ubuntu/spe-independent-repro/portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm
size=671621
sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6
```

Not the tracked public module (`8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`).

## Observed module surface (Node WebAssembly.Module)

```json
{
  "imports": [],
  "exports": [
    "memory",
    "spe_alloc",
    "spe_evaluate",
    "spe_free"
  ],
  "export_details": [
    { "name": "memory", "kind": "memory" },
    { "name": "spe_alloc", "kind": "function" },
    { "name": "spe_evaluate", "kind": "function" },
    { "name": "spe_free", "kind": "function" }
  ]
}
```

## Required gates

| Gate | Expected | Observed |
| --- | --- | --- |
| imports | 0 | 0 |
| exports | memory, spe_alloc, spe_evaluate, spe_free | memory, spe_alloc, spe_evaluate, spe_free |

BINARY_SURFACE = PASS
