# Screenshot IR golden notes

Behavioral goldens live in `apps/web/scripts/test-media-observe.mjs`:

- `observeScreenshotIRLite` yields ≥3 regions with evidence + confidence
- Six framework scaffolds differ by target and include absolute/positional layout from IR bounds
- Structural comparison: scaffold[0].code !== scaffold[1].code; prompts carry evidence strings
