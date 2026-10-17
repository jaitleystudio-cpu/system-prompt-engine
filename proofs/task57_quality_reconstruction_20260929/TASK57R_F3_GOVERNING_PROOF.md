# Task57R-F3 governing proof

Taxonomy version comes from `CURRENT_TAXONOMY_VERSION` in `spe_runtime/xcat/migration.py`, which matches `data/category_registry_v1.json` version `2`. Rust uses the same constant in `portable/spe-core-rs/src/xcat.rs`. Quality does not read a caller-supplied taxonomy string, and K3's technique envelope is unchanged.

`subject_from_k3` ignores `k3_output.proof_refs`. It derives five internal refs from the subject it just built:

- `semantic:protected:<digest>` of the protected intent
- `semantic:graph:<graph_digest>`
- `semantic:xcat:<registry version>:<active category or UNRESOLVED>`
- `semantic:k3:<selection_id>`
- `semantic:effect:<digest>` of the effect-plan identity

Digests use the existing canonical JSON plus SHA-256. A proof is satisfied only when those refs match the subject exactly, the taxonomy version is the registry version, and none of the refs claim browsing, fetched sources, citations, or authorized internet access. A non-empty list such as `["fake"]` is not satisfied. Both the before and after candidates must have a satisfied proof before a delta can be `IMPROVED`.

This proof does not mean a paper was read, a model obeyed, or an action ran.
