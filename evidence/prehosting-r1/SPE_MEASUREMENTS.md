# Lab measurements (localhost vite preview, Mac mini, headless Chromium; LAB ONLY, not field)
## Lighthouse 12 (perf / a11y / best-practices / SEO; LCP; CLS; TBT)
| Page | Mobile | Desktop |
|---|---|---|
| / | 33/97/96/100; LCP 6.0s; CLS 0; TBT 3150ms | 62/97/100/100; LCP 1.1s; CLS 0; TBT 3290ms |
| /create | 44/95/96/100; LCP 5.2s; CLS 0; TBT 1250ms | 64/95/100/100; LCP 1.1s; TBT 3040ms |
| /privacy | 70/95/100/100; LCP 5.0s; TBT 120ms | 96/95/100/100; LCP 1.1s; TBT 20ms |
| /capabilities | 70/89/100/100; LCP 5.0s; TBT 100ms | 98/89/100/100; LCP 1.0s; TBT 0ms |
INP: NOT_MEASURED (TBT used as lab proxy). Field CWV: NOT_AVAILABLE pre-launch.
## Bundle
index JS 1,120.7 KB (338.5 KB gz); r3f 831.6 KB (224.4 KB gz); CSS 222 KB (43.7 KB gz); spe_wasm.wasm 2.1 MB; ort WASM 11.2 MB (lazy); dist 62 MB; transferred on load ~737 KiB.
## WASM init (fetch+compileStreaming, localhost): 7.0, 10.7, 5.2, 5.7, 5.1 ms
## Load ramp (autocannon, 10 s each, GET /, local vite preview only)
| conns | rps | p50 | p97.5 | p99 | err |
|---|---|---|---|---|---|
| 10 | 9844 | 0 | 1 | 2 | 0% |
| 50 | 10401 | 4 | 6 | 7 | 0% |
| 100 | 9814 | 9 | 15 | 20 | 0% |
| 250 | 8793 | 24 | 52 | 106 | 0% |
| 500 | 7888 | 53 | 1508 | 3666 | 2.07% |
| 1000 | 6406 | 138 | 7773 | 8642 | 71% |
Max safe concurrency on this local preview server: 250 connections. Not the production architecture (static host/CDN undefined) -> 10k users = BLOCKED.
