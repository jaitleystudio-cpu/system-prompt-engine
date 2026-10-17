# Performance

Local Python timings, 50 iterations, milliseconds. These are engineering measurements, not a public performance claim.

| Path | median | p95 | max |
| --- | --- | --- | --- |
| quality evaluation | 0.395 | 0.603 | 0.673 |
| delta comparison | 0.317 | 0.390 | 0.476 |
| no-op Plan B | 0.529 | 0.592 | 0.744 |
| single repair | 0.409 | 0.533 | 0.678 |
| re-evaluation | 0.278 | 0.395 | 0.417 |
| VALIDATE_ONLY | 0.053 | 0.072 | 0.182 |
| historical preconstructed subject loop (not an end-to-end semantic chain) | 0.464 | 0.555 | 0.653 |

The 0.464 ms row measured a subject that was already largely constructed. It is not a ProtectedIntent → graph → XCAT → K3 → effect → quality chain.

Task57R measured path, N=100, Python 3.14.7, macOS-27.2-arm64:

`ProtectedIntent → Requirement Graph → XCAT → K3 → Effect Plan → render → from_k3 VALIDATE_ONLY → one reconstruction check`

| median | p95 | max |
| --- | --- | --- |
| 0.920 ms | 2.071 ms | 5.030 ms |

WASM warm evaluation of `spe_api=quality op=mode mode=DRY_RUN`, after a separate cold integrity check of 3.963 ms, N=100: median 0.026 ms, p95 0.281 ms, max 1.669 ms. SHA `0537fc879b42524d36cf94b965e1234f02cf557c47cc55c7b1612d5643c70fcb`, imports 0.

Core B raw custody plus fallback render, N=100: median 0.015 ms, p95 0.101 ms, max 15.620 ms. These numbers are not a product claim.
