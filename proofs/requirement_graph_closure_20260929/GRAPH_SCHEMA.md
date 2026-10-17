# Graph schema

Recovered from G1R-3 `spe_runtime/requirements/{models,graph,conflicts}.py` (`3f0847d`, unchanged through `a6b7e57`).

Schema version: `requirement_graph.g1r3`

## Node

`RequirementAtom`

| Field | Role |
|---|---|
| `requirement_id` | `req-` + sha256(canonical `{semantic_key, kind, value, source_ref}`)[:32] |
| `semantic_key` | Role or caller slot |
| `kind` | `MUST` \| `MUST_NOT` \| `SHOULD` \| `PREFERENCE` |
| `value` | Exact projected value |
| `provenance` | Frozen K0 enum |
| `source_ref` | Stable ref. Not part of a random id. |
| `statement` | Optional text. Not part of identity. |

## Edge

`CONFLICTS_WITH` only.

`edge_id` = `edge-CONFLICTS_WITH-` + the two requirement ids in sorted order.

## Conflict record

`conflict_id` = `cnf-` + sha256(canonical `{conflict_type, left, right}`)[:32] with ids sorted.

`resolution_state` is `UNRESOLVED`.

Types: `MUST_MUST_NOT`, `MUTUALLY_EXCLUSIVE`, `EXPLICIT_CONFIRMED`, `INFERENCE_CONFLICT`.

## Digest

`graph_digest` = `rg-` + sha256 of the canonical `{nodes, edges}` object.

## Projection result

`input_budget`, `graph_budget`, and `output_bound_budget` carry the explicit budget field unchanged, or null when that field is absent or null.

`PORTABLE_GRAPH_BINDING = DEFERRED_BY_SCHEMA`

`schemas/spe_artifact.schema.json` has no requirement-graph field. This mission does not add one.
