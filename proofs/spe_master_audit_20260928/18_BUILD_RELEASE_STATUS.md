# Build and release

| Check | Result |
| --- | --- |
| tsc --noEmit rerun | EXIT 0 |
| vite build | EXIT 0 |
| npm run build | EXIT 1 at copy-wasm |
| wasm32 target | not installed (host target only) |
| tracked public wasm | present, 671614 bytes, fixture hash matched |
| deployment safety gate | EXIT 2, HOSTING FORBIDDEN |
| DNS | not touched |
| deploy | not done |

FULL_BUILD_GREEN: NO
HOSTING_READY: NO

`copy-wasm.mjs` reads `portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm`, copies it onto the tracked public file, and writes `spe_wasm.sha256.json`. The target file is missing. The public file is committed. Rebuilding would be a source reproducibility experiment. Copying the result would modify tracked wasm, so that experiment was not run.

Cache shell and service worker were not re-proven offline. `sw.js` precache list includes `/`, `index.html`, the manifest, icon, `spe_wasm.wasm`, and the sha256 json.
