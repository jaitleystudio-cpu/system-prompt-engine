# Official build

Directory: `apps/web`

Command:

```text
npm run build
```

which is:

```text
npm run spe:copy-check && npm run copy-wasm && tsc --noEmit && vite build && node scripts/cache-shell.mjs
```

## Result

Exit: **1**

`spe:copy-check` passed (2361 candidates, 0 unreviewed, 0 violations).

`copy-wasm` then exited because the release artifact was absent:

```text
copy-wasm: missing release artifact at portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm
Build first: cargo build --manifest-path portable/spe-wasm/Cargo.toml --locked --offline --target wasm32-unknown-unknown --release
```

The tracked public WASM was copied aside before this command and compared afterward.

- Public bytes unchanged: yes
- Size: 671614
- SHA-256: `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`

The gitignored 1.83.0 artifact was moved aside before `npm run build` so `copy-wasm` could not replace the tracked file with `27c73e90…`. Pytest later rebuilt that gitignored artifact via `ensure_wasm_artifact()`. The public file was still unchanged (`git diff` empty for `apps/web/public/spe_wasm.wasm` and `spe_wasm.sha256.json`).

## Diagnosis

The official script never invokes cargo. On a clean tree the wasm32 release file is gitignored and missing, so the build stops. Producing that file with rustc 1.83.0, or with rustc 1.98.1 plus the path remap that matches the tracked string shape, still does not reproduce `8d482a17…`. Wiring `npm run build` to copy either of those outputs would publish a different binary. That promotion was not done. No package script was edited.

OFFICIAL_BUILD = **FAIL** (exit 1, canonical bytes preserved)
