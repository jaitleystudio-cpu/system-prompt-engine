# Task57R-F3 contract recovery

Inspected before the proof-binding change. Owners below already exist. F3 does not add a second taxonomy authority or a second digest scheme.

| Fact | Owner | What Quality was doing |
| --- | --- | --- |
| Taxonomy version `2`, taxonomy `DOMAIN` | `data/category_registry_v1.json` | Hardcoded the string `"2"` and also expected K3 to send `taxonomy_version` |
| In-process version constant | `spe_runtime/xcat/migration.py` `CURRENT_TAXONOMY_VERSION`, mirrored by `portable/spe-core-rs/src/xcat.rs` | Not consulted by Quality |
| Active category | K3 `category_context.xcat_id`, normalized inside `subject_from_k3` | Compared with ProtectedIntent category only when the version string was `"2"` |
| ProtectedIntent | K3 `protected_binding`, completed with the normalized category | Digested only for mismatch checks |
| Requirement Graph digest | `requirement_graph.graph_digest` from `spe_runtime/requirements/project.py` | Digested for mismatch checks |
| K3 selection | `selection_id` plus `techniques` from `select_prompt_techniques` | Digested for mismatch checks |
| PromptEffectPlan identity | `spe_runtime/k3/effect.py` `bind_prompt_effects` | Digested for mismatch checks |
| Canonical digest | `canonical_dumps` plus SHA-256, already used by Quality | Not used as proof refs |
| `proof_refs` | Not a field on the real K3 envelope | Copied from the caller when present; any non-empty string list counted as satisfied |

K3 technique choice, effect operations, and the compiled prompt stay on their existing owners. F3 does not add `proof_refs` or `taxonomy_version` to the K3 envelope. Quality derives both while building the subject: taxonomy from `CURRENT_TAXONOMY_VERSION`, proof refs from the digests above. Caller-supplied `proof_refs` are ignored.
