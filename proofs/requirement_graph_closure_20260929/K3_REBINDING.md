# K3 rebinding

`select_prompt_techniques` calls `build_requirement_graph` and attaches the result as `requirement_graph`.

`compile_with_k3` copies that object beside `execution_contract`. The execution contract object is unchanged.

K3 still owns technique selection. The registry, authority flags, and prompt prose are unchanged.

Graph consumption:

- `CONFLICTED` graphs return disposition `UNKNOWN`. K3 does not resolve them.
- Strength elevation still uses structured `semantic_key` atoms. Graph atoms are included only when the key matches the existing `KEY_HINTS` table. Role keys do not. Prose is not scanned.
- `selection_id` remains the technique-payload digest. The graph has `graph_digest`.

Existing K3 vectors: 25 normal, 15 adversarial, 0 mismatches.
Existing K3 mutants: 7/7 killed.
`K3_USES_CANONICAL_GRAPH = YES`
`TS_GRAPH_SECOND_BRAIN = NO`
