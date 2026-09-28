# Official build contract

Inspected:

- `apps/web/package.json` script `build`
- `apps/web/scripts/copy-wasm.mjs`

## Current behavior

`npm run build` runs `spe:copy-check`, then `copy-wasm`, then `tsc --noEmit`, then `vite build`, then `cache-shell`.

`copy-wasm.mjs` does not invoke cargo. It reads the gitignored file:

`portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm`

If that file is missing it exits 1 and prints the cargo hint. If the bytes contain `/Users/`, `/home/`, `.codex/`, or `.chatgpt-projects/` it throws. Otherwise it copies the file onto `apps/web/public/spe_wasm.wasm` and rewrites `spe_wasm.sha256.json`.

A clean machine therefore depends on an undocumented prebuilt target directory. The script will also replace the reviewed public bytes with whatever release artifact happens to be in `target/`.

## This mission’s run

The gitignored 1.83.0 artifact (677268 bytes, `27c73e90…`) was moved aside before `npm run build`, then restored afterward. It was not copied.

```
copy-wasm: missing release artifact at
  /workspace/portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm
BUILD_EXIT:1
```

Public file after the run still:

- 671614 bytes
- `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`

`spe:copy-check` itself passed (0 unreviewed, 0 violations) before copy-wasm stopped the script.

## Why no script change

Exact reproduction of `8d482a17…` failed. Section 9 of the mission allows a pinned toolchain only when a clean build matches the tracked bytes. Section 10 forbids weakening the hash test and forbids replacing the public WASM without a founder rebaseline.

Changing `copy-wasm` to compile-and-copy the deterministic local hash `55d61171…` would overwrite the tracked artifact or fail the hash gate. Neither is allowed.

OFFICIAL_BUILD = BLOCKED

## Smallest correction, not implemented

When a founder rebaseline is approved, the build should:

1. Pin rustc (the producers section says 1.98.1 / `48a229cea`) in the repo, not in a developer toolchain.
2. Build `portable/spe-wasm` with `--locked` and an explicit remap recorded in the repo.
3. Require two clean directories to emit the same sha256.
4. Compare that sha256 to the tracked manifest.
5. Copy only after the compare succeeds.
6. Then run `tsc`, Vite, and cache-shell.

Until step 3 reproduces a hash the founder accepts, `copy-wasm` stays a copy of a pre-existing artifact and `npm run build` stays red on a clean tree.
