# Website and engine consolidation

This integration starts at main `2f4a29c` and preserves the original histories of:

- `g1/binding-table` through `a224099`: recovery schema, G2 evidence, G3 journal and recovery implementation, G4 provider probe and diagnostics.
- `feat/web-speech-input-delivery` through `6bf64a8`: opt-in browser speech input, transcript review, and browser regression.

The existing website, WASM worker architecture, and Human Perspective layer were already in main. Speech recognition is optional and may use the browser vendor's online service; prompt compilation remains local. No live provider request is needed for the regression suite.

## Intentionally separate

- PR #6 remains excluded.
- PR #37 and #38 contain competing presentation changes. Neither is automatically included.
- G6-H and the research branch chain remain unchanged. Their evidence is not rewritten or promoted by this integration.
- PR #39's title mentions Plan-B, but its merged tree does not contain the proposed defence_mode module. This integration does not claim that module is implemented.
- No source branches are deleted, and the user's research checkout is unchanged.

## Reproduce

Use Python 3.11 or later as required by pyproject.toml. Create an isolated environment and install pytest and jsonschema from the project's dev requirements. Run `python -m pytest -q` at repository root.

Before the web build, compile the Rust WASM release with the installed wasm32-unknown-unknown target. Remap the absolute repository path to `/spe-source` and the developer home directory to `/rust-deps` using rustc `--remap-path-prefix` options in RUSTFLAGS. Then run `npm ci` and `npm run build` in apps/web. The packaging script rejects WASM binaries containing developer home paths and updates the shipped digest.

Run `npm run test:engine` in apps/web, then `node tools/web04-prompt-regression.mjs` and `node tools/web04-worker-client-regression.mjs` at the repository root.

For the speech regression, start the built preview. Set SPE_TEST_URL to its URL and SPE_PLAYWRIGHT_MODULE to an installed Playwright module entry, then run `node tests/browser/speech-input.mjs`. This uses installed Chrome and simulated recognition events; it does not certify live microphone transcription.

The design-token source test now reads the shared stylesheet imported by the app. It no longer depends on an existing build output to find those tokens.

## Validation observed on 2026-09-24

- Python 3.12: 489 passed in 41.34s.
- Web production build: passed; existing large 3D chunk warning remains.
- Real WASM fixture: VALID, no TypeScript fallback, zero imports.
- Prompt regression: 13 cases passed.
- Worker regression: passed.
- Copy checks: 9 adversarial cases, 13 surface fixtures, 7 hero variants passed; rejection gate passed.
- Speech browser checks: consent, transcript review, preserving typed text, denied access and unsupported browser passed with simulated recognition.
- Frozen G6-H paths: no changes in this integration.

The WASM artifact was rebuilt from the unchanged Rust source using the local toolchain with path remapping. Its new SHA-256 is `95cf51ceab7b51ab2a459ec8a32d51e182749f8f3b51cf29c69de675a2fd0a80`; size 237900 bytes. The matching metadata is included. This is not a production qualification or a live speech/provider certification.
