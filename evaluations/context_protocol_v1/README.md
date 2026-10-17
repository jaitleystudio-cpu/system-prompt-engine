# Context Protocol Benchmark v1

Independent evaluation namespace for SPE context grounding + category protocol
compiler work. **Separate from frozen G6-H evidence** — do not reuse or modify
G6-H files from this harness.

## Arms

| Arm ID | Description |
|--------|-------------|
| `RAW` | Unaugmented model prompt (no SPE compilation). |
| `SPE_BASE` | SPE baseline compile without grounding or category protocols. |
| `SPE_GROUNDING_ONLY` | SPE + grounding layer; no category protocol graph. |
| `SPE_PROTOCOL_ONLY` | SPE + category protocol graph; no grounding capsules. |
| `SPE_FULL` | SPE + grounding + category protocol (full stack). |

## Stress classes

Every class below has ≥1 frozen task in `tasks.jsonl`:

- trivial
- ambiguous
- contradictory
- multilingual
- typo/noisy
- missing-context
- overconstrained
- high-stakes informational
- multi-domain
- adversarial
- long input
- media-assisted
- URL-assisted

## Ablation matrix

Declared in `arms.json` → `ablation_matrix`:

- `full` — all required stages retained
- `compact` — depth-projected compact graph
- `no_contradiction` — contradiction stage nodes removed
- `no_verification` — verification stage nodes removed
- `no_hypothesis` — hypothesis stage nodes removed

Ablation proves whether a stage materially helps; more stages are not assumed better.

## Routing-efficiency measurements

Capability-routing tasks declare `measures_routing_efficiency: true` and
`routing_measurement_slots`. Recorded when a live run is later enabled:

- base-model tokens
- total tokens
- tool calls
- latency
- correctness
- unsupported claims

**Do not claim load reduction until measured.**

## Human ratings

All human rating fields default to `NO_RATINGS_YET`. They must never be
auto-filled or fabricated. Real blinded ratings may be attached later.

## Harness

```bash
# Deterministic offline validation (no network / provider calls)
python tools/run_context_protocol_benchmark.py --fixture-only

# Machine-readable JSON summary of fixture-only records
python tools/run_context_protocol_benchmark.py --fixture-only --format json
```

Fixture-only mode validates fixtures, builds per-task × arm records with
unmeasured metric slots, applies the ablation matrix locally against the
protocol registry, and exits 0 when the fixture set is well-formed.
