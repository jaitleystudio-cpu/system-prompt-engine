# Master audit delta

Only the rows this binding changes. Missing XCAT categories, quality-delta, Plan B, VALIDATE_ONLY, Massive Intent, MCP, human ratings, and an independent full-product replication are not promoted.

| Topic | Previous | Now | Evidence |
|---|---|---|---|
| K3 compiler integration | Selection attached beside an unchanged editorial prompt | `prompt_effect_plan` is part of the K3 result and the compiled prompt | `spe_runtime/k3/effect.py`, `portable/spe-core-rs/src/effect.rs` |
| Technique effects | Nine ids selected, no body effect | Each id has one operation and a visible `## Effect:` section, or a closed refusal | `PROMPT_DELTA_MATRIX.md` |
| Cross-runtime parity | K3 vectors matched without an effect plan | Python, Rust, and WASM match on K3 vectors and on 50 effect vectors | `PARITY_RESULTS.md` |
| Protected-intent preservation | Selector echoed a binding | Effect plan digest and prompt block keep goal, constraints, budget, facts, provenance, and authority | `PROTECTED_INVARIANTS.md` |
| Prompt generation ownership | TypeScript recipes chose approach steps | Renderer prints `compiled_prompt` or refuses | `packages/web-runtime/src/render.ts` |
| TypeScript second brain | Category guidance and recipes authored the approach | `promptGuidance.ts` removed from the render path. TypeScript does not choose techniques | `apps/web/scripts/test-k3-effect-prompt.mjs` |
| Proof rows | K3 selector proofs | This directory | `proofs/k3_effect_binding_20260929/` |

Implemented XCAT remains C01, C02, C03, C06, and C07. C04, C05, and C08–C12 still return `NO_SELECTION` and no success prompt.
