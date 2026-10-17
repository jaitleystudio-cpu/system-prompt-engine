# Task57R Core B

Implemented in `apps/web/src/engine/core-b.mjs`.

- Semantic authority: none.
- Artifact type: `SAFE_FALLBACK_PROMPT`.
- Status: `DEGRADED_DELIVERY`.
- `canonical`, `verified`, `quality_verified`, `semantic_engine_used`, `execution_authorized`, and `external_effect` are false.
- The raw request is copied into the prompt without rewriting.
- Target and explicit constraints appear only when supplied.
- No network, no EngineClient, no K3 import, no quality import, no self-import, no recursion.
- `apps/web/scripts/test-core-b-fallback.mjs` passed.
