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
| full compile-evaluate-repair-validate loop | 0.464 | 0.555 | 0.653 |

The full-loop row is the figure to cite for this task: median 0.464 ms, p95 0.555 ms, max 0.653 ms.
