# Master audit delta

The 2026-09-28 master audit is commit `b66bc23`. That tree is not this branch. Rows below are the only ones this mission changes. They are not promoted for missing categories, quality-delta, Plan B, VALIDATE_ONLY, Massive Intent, or MCP.

| Audit row | Before | After |
|---|---|---|
| Requirement graph | NOT_FOUND | Runtime owner `build_requirement_graph`, schema `requirement_graph.g1r3` |
| Budget preservation | NOT_FOUND | Explicit budget atom, kind `MUST`, `input_budget` = `graph_budget` = `output_bound_budget` |
| Hard-constraint preservation | PARTIAL | Hard items stay `MUST` or `MUST_NOT`; graph build does not downgrade them |
| Cross-runtime parity for the graph | absent | Python, Rust, WASM, 0 mismatches on 50 vectors |
| K3 graph consumption | compatibility bridge only | `requirement_graph` is a canonical selector input |
| Proof | no graph pack | `proofs/requirement_graph_closure_20260929/` |

`PORTABLE_GRAPH_BINDING = DEFERRED_BY_SCHEMA`
