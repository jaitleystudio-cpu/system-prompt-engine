# M11 result

Mutant: a K3 request fails, and the renderer still emits `TypeScript fallback prompt`.

Production `renderPromptArtifact(effectPlan: null)` throws `PromptBriefError` and returns no `finalPrompt`.

`effect_plan_is_lawful` rejects the mutant object because it is not the canonical effect plan.

KILLED.

Effect mutants: 11 defined, 11 killed, 0 survived. This is the effect-plan suite only, not repository-wide mutation coverage.
