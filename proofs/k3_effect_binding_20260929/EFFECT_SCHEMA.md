# Effect schema

`schema_version`: `prompt_effect_plan.v1`

`effect_version`: `k3.effect.g1r7r`

Owner: `bind_prompt_effects` in `spe_runtime/k3/effect.py`. The Rust function `effect::bind` returns the same canonical JSON. WASM exposes it on the existing `spe_api=k3` result as `prompt_effect_plan`, and on `op=bind` for a supplied selection. No new WASM export.

## Object

| Field | Role |
|---|---|
| `selection_id` | Echo of the K3 selection id |
| `disposition` | `BOUND`, `DEFERRED`, or `REFUSED` |
| `operations` | Stable codes in K3 technique order. Empty unless `BOUND` |
| `blocked_operations` | Codes that could not be realized |
| `sections` | `{code, text}` for each operation |
| `protected_binding_digest` | `pbind-` plus SHA-256 of goal, hard constraints, budget, facts, provenance, and authority |
| `requirement_graph_digest` | Echo of the graph digest |
| `protected_fields` | Unchanged echo, including `desired_output` |
| `techniques` | Echo of the selected ids |
| `deferred_techniques` | Echo of ids dropped by the technique budget |
| `compiled_prompt` | Present only when `renderable` is true |
| `renderable` | Success prompt is allowed only when true |
| `claims_pass` | Always false |
| `authority_escalation` | Always false |
| `notes` | Machine reasons, not prose plans |

## Operation codes

`DIRECT`, `USE_USER_EXAMPLES`, `ROLE_CALIBRATION`, `USE_CONTEXT`, `STEP_BACK`, `DECOMPOSE`, `ADD_GROUNDING_CONTRACT`, `CRITIQUE_REVISE_ONCE`, `STRUCTURED_OUTPUT`.

Section heading in the compiled prompt: `## Effect: CODE`.
