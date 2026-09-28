# Fail-closed web path

The production compile path is `App.tsx`. It asks WASM for a K3 binding, then requires a plan object before calling `renderPromptArtifact`.

`renderPromptArtifact` returns a final prompt only when all of these hold:

- `effectPlan` is a non-null object
- `disposition` is `BOUND`
- `renderable` is true
- `compiled_prompt` is a string that still contains the goal and every hard-constraint statement

Any other plan throws `PromptBriefError`. The caller clears the rendered prompt.

`requestK3Binding` no longer turns a transport exception into an empty technique list that the renderer can treat as success.

| Transport result | Binding status | Prompt |
|---|---|---|
| `compile` throws | `UNAVAILABLE` | none; `K3EffectUnavailableError` |
| WASM output has no `prompt_effect_plan` | `MISSING_EFFECT_PLAN` | none; `K3EffectUnavailableError` |
| Plan present but not `BOUND`, not renderable, or missing `compiled_prompt` | plan reaches the renderer | `PromptBriefError`; no final prompt |

`renderNonProductionEnvelopePreview` prints envelope fields for tests. `App.tsx` does not call it.
