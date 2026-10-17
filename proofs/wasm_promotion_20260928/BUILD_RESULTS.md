# Official build results

## Architecture (Task C)

```
npm run build
  → spe:copy-check
  → wasm:build-canonical   (node tools/wasm_canonical_build.mjs)
  → copy-wasm              (hash-verified candidate only)
  → tsc --noEmit
  → vite build
  → cache-shell
```

## Clean-target proof

Before `npm run build`:

- `portable/spe-wasm/target/` absent
- `portable/spe-wasm/target-canonical/` absent

Build created the canonical artifact itself.

## Result

| Gate | Result |
| --- | --- |
| `npm run build` exit | **0** |
| copy-check | PASS (0 unreviewed) |
| canonical WASM build | PASS (`9325f9ec…`) |
| hash verify + copy-wasm | PASS |
| tsc | PASS |
| Vite | PASS |
| cache-shell | PASS |
| Build tracked drift | **NONE** |

Pre/post hashes of tracked public files were identical:

- wasm `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6`
- meta sha256 of `spe_wasm.sha256.json` unchanged across the build

Log: `/opt/cursor/artifacts/npm_run_build.log`
