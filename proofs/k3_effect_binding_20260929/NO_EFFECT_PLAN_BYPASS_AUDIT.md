# No-effect-plan bypass audit

Searched `renderPromptArtifact`, `requestK3Binding`, `requestTechniqueIds`, and `renderNonProductionEnvelopePreview`.

| Call site | Role | Disposition without a BOUND plan |
|---|---|---|
| `apps/web/src/App.tsx` compile handler | Production Create/Home path | `requireBoundEffectPlan` throws `K3EffectUnavailableError` when the binding is `UNAVAILABLE` or `MISSING_EFFECT_PLAN`. `renderPromptArtifact` then requires `BOUND` and `renderable`. The catch clears `rendered`. |
| `apps/web/src/App.tsx` artifact restore | Displays a previously stored `rendered_prompt` | Does not call the renderer and does not compile a new prompt. |
| `apps/web/src/App.tsx` local dry run | Reuses `artifact.rendered_prompt` | Does not compile a new prompt. |
| `apps/web/src/engine/k3Transport.ts` `requestK3Binding` | WASM transport | Catch returns `UNAVAILABLE`. Missing `prompt_effect_plan` returns `MISSING_EFFECT_PLAN`. Neither value is a prompt. |
| `apps/web/src/engine/k3Transport.ts` `requestTechniqueIds` | Unused by the UI | Calls `requireBoundEffectPlan` and throws when no plan is present. No production caller. |
| `packages/web-runtime/src/render.ts` `renderPromptArtifact` | Production serializer | Null, missing, `UNKNOWN`, `REFUSED`, `DEFERRED`, `renderable: false`, null `compiled_prompt`, and a non-object plan throw `PromptBriefError`. |
| `packages/web-runtime/src/render.ts` `renderNonProductionEnvelopePreview` | Test helper | Not imported by `App.tsx`. |
| `apps/web/scripts/test-create-intent.mjs` | Test | Uses the non-production helper. |
| `apps/web/scripts/test-execution-contract.mjs` | Test | Uses the non-production helper. |
| `apps/web/scripts/test-artifact-reconstruction.mjs` | Test | Uses the non-production helper. |
| `apps/web/scripts/test-k3-effect-prompt.mjs` | Test | Calls `renderPromptArtifact` with plans, and asserts null and unbound plans throw. |
| `tools/web04-prompt-regression.mjs` | Offline tool, not Create/Home | Still calls `renderPromptArtifact` without a plan. That call now throws and does not return a final prompt. |

No production route returns a final prompt when the effect plan is absent.
