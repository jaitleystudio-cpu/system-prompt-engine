# Compiler integration

`compile_execution_contract` is unchanged. It still owns category-protocol graphs.

`compile_with_k3` calls that function and attaches `technique_selection` from `select_prompt_techniques`. A unit test asserts the execution-contract dict is identical to a direct `compile_execution_contract("research", "STANDARD")` call.

`.spe` was not redesigned. G1R-7 keeps prompt content identity distinct from `.spe` package identity, and the current artifact schema has no technique-selection slot. The selection is a sidecar of compilation, not a new `.spe` field.

Web prompt body (`renderPromptArtifact` `finalPrompt`) does not embed technique ids. `packages/web-runtime/src/render.ts` no longer invents the editorial technique list (`Original request preserved`, and so on). It renders only ids passed in. `App.tsx` asks WASM `spe_api=k3` and passes `SELECTED` or `SAFE_DEFAULT` ids through. Any other outcome, including engine failure, passes an empty list. TypeScript does not choose ids.

`apps/web/src/workspace/Workspace.tsx` maps known ids to short display names. Unknown ids are shown as returned. That map is not a selector.

Golden prompt text is unchanged because technique ids are not written into `finalPrompt`. The techniques lens copy changes from the old editorial strings to K3 display names, or "No strategy selected." when the selector returns no lawful selection.
