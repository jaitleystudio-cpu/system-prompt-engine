# Task57R performance

See `PERFORMANCE.md` for the measured numbers.

The cited path is:

`ProtectedIntent → Requirement Graph → XCAT → K3 → Effect Plan → render → from_k3 VALIDATE_ONLY → one reconstruction check`

N=100, Python 3.14.7, macOS-27.2-arm64: median 0.920 ms, p95 2.071 ms, max 5.030 ms.

WASM warm evaluation is reported separately from the cold integrity check. Core B custody plus fallback render is reported separately and is not a product claim.

The historical 0.464 ms figure is a preconstructed subject loop, not this chain.

## Task57R-F1

The timed Python path is one `evaluate_from_k3` call, which includes one reconstruction. N=100, Python 3.14.7, macOS-27.2-arm64: median 0.864 ms, p95 2.275 ms, max 3.009 ms.

WASM warm evaluation of the F1 artifact `dfdad1270bb11e9325c3676c1ae9f00ae1df7f47071feb0b1ccda8ff96b78541`, N=100: median 0.076 ms, p95 0.441 ms, max 2.832 ms. Cold integrity check, measured separately: 10.903 ms. Imports 0.

Core B custody plus fallback render, N=100: median 0.065 ms, p95 0.568 ms, max 5.923 ms.

These are measurements, not a product claim.
