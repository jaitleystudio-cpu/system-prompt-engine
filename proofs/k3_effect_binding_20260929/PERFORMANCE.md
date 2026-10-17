# Performance

Local microbenchmark of the effect binder. Not a product latency claim.

| Stage | median | p95 | max |
|---|---|---|---|
| effect plan creation | 0.041 ms | 0.050 ms | 0.069 ms |
| final render | included in plan creation | included in plan creation | included in plan creation |
| K3 select plus effect plus render | 0.309 ms | 0.344 ms | 0.364 ms |

samples: bind/render 80, combined 40

