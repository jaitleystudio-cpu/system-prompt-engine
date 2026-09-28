# Performance baseline

Lab measurements from this machine on 2026-09-28. Not field data. Lighthouse was not run.

## Vite production build

| Asset | Raw | Gzip |
| --- | --- | --- |
| index JS | 375.18 kB | 121.18 kB |
| index CSS | 164.48 kB | 33.56 kB |
| engine.worker | 3.10 kB | not reported |
| LabStage | 5.57 kB | 1.78 kB |
| r3f | 831.35 kB | 224.26 kB |
| ort-wasm JS | 464.10 kB | 110.35 kB |
| ort-wasm-simd-threaded.wasm | 11,246.03 kB | not reported |
| SPE public wasm | 671,614 bytes | 160,032 bytes (gzip -9, measured separately) |

Chunks over 500 kB: r3f and the ONNX wasm helper. Vite also externalized `node:crypto` from `wasm-host.mjs`.

## Hero

Hero suite passed. No LCP/CLS numbers.

## Paste lab memory

Create at 1,000,000 characters: fill 182 ms, rAF lag 95 ms, used JS heap about 16.7 MB, heap limit about 2.2 GB. Home capped pastes stayed near 6–13 MB used. These are Chromium `performance.memory` samples, not a trace.
