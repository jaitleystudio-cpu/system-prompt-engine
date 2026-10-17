# Task57R-F1 artifact consistency

`bindEffectiveSurfaces` selects one string: the kernel kept prompt when the acceptance law passes, otherwise the canonical prompt. It does not write a new prompt.

Create uses that string for:

- `rendered.finalPrompt`
- `buildSpeArtifact({ rendered_prompt })` on the existing `spe.artifact.v1` schema
- history `prompt_preview` (first 240 characters, which is what the history schema stores) and `history.artifact`
- copy, JSON export, and `.spe` export, which read that same rendered prompt or artifact

The product test builds an artifact with the selected repaired prompt and checks:

- display equals artifact `rendered_prompt`
- display equals JSON export `rendered_prompt`
- display equals the `.spe` body `rendered_prompt`
- copy text equals display
- history artifact prompt equals display
- history preview equals the display prefix

Core B still has no artifact, so `.spe` stays disabled on that path.

A live Create click with a normal checklist request kept the canonical prompt. Copy, JSON, `.spe`, and saved history matched that visible prompt. No accepted repair was present to rebind.
