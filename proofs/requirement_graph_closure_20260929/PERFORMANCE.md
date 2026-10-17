# Performance

Local CPython microbenchmark, 200 iterations, `time.perf_counter` around `build_requirement_graph`. This is not a product latency claim.

| Input | median ms | p95 ms | max ms |
|---|---|---|---|
| small (goal only) | 0.0261 | 0.0320 | 0.0620 |
| medium (budget, 12 constraints, 8 facts) | 0.5358 | 0.5812 | 0.6377 |
| constraint-heavy (80 constraints, 40 facts, 20 unknowns) | 3.6706 | 4.0325 | 7.2911 |

Conflict detection is pairwise on equal semantic keys. Distinct hard-constraint keys do not create an n-squared clash.
