# Task57R performance

See `PERFORMANCE.md` for the measured numbers.

The cited path is:

`ProtectedIntent → Requirement Graph → XCAT → K3 → Effect Plan → render → from_k3 VALIDATE_ONLY → one reconstruction check`

N=100, Python 3.14.7, macOS-27.2-arm64: median 0.920 ms, p95 2.071 ms, max 5.030 ms.

WASM warm evaluation is reported separately from the cold integrity check. Core B custody plus fallback render is reported separately and is not a product claim.

The historical 0.464 ms figure is a preconstructed subject loop, not this chain.
