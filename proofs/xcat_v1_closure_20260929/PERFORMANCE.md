# Performance — XCAT DOMAIN microbench

**Date:** 2026-09-29  
**Host:** local Mac executor (this proof run)  
**Method:** `time.perf_counter`, warmup=5, iters=**80**, report median / p95 / max in **ms**  
**Harness:** short Python script calling `apply_category_payload`, `validate_handoff`, `reject_legacy_payload_reinterpretation`, `route_mission_stage`

## Results (honest single-run microbench)

| Scenario | median_ms | p95_ms | max_ms |
|----------|----------:|-------:|-------:|
| single-category dispatch (C01 payload) | 0.0162 | 0.0210 | 0.0225 |
| multi-handoff (C02→C06→C01 + validate_handoff×2) | 0.0537 | 0.0685 | 0.0945 |
| C04 translate | 0.0151 | 0.0170 | 0.0205 |
| C09 code | 0.0168 | 0.0212 | 0.0230 |
| C10 multimedia | 0.0149 | 0.0159 | 0.0205 |
| constraint-heavy (20 constraints + 20 facts, C08) | 0.1162 | 0.1415 | 0.2855 |
| legacy reject | 0.0005 | 0.0006 | 0.0006 |
| XCAT→K3 route (`category_ref=C09` ∈ IMPLEMENTED_XCAT) | 0.0046 | 0.0059 | 0.0066 |

## Limits

- Microbench only — not a production SLI, not load-test, not WASM timing.
- Numbers will vary by machine load; relative order is more informative than absolute μs.
- No hosting / remote call included (offline).
