# SPE-WEB-03: Prompt Studio rebuild, 21 September 2026

## Outcome and claim boundary

Functional revision ready for review. **REBUILD_REQUIRED against the requested universal 10/10 / award-winning acceptance bar.** No independent visual panel or prompt-quality benchmark has established that rating. Production qualification and World #1 are not claimed.

The previous interface could complete WASM execution yet produce a weak prompt: it repeated the entire goal as a hard constraint and inserted generic unanswered questions. The revision removes that duplication, preserves explicit role/audience/deliverable/boundary details, and composes category-specific working instructions from the returned SPE envelope. It does not add an LLM, automatic semantic understanding, or a TypeScript substitute for the Rust compiler. Template suggestions are identified in the interface. Prompt usefulness still needs human evaluation on the user's real cases.

## Visible experience

New typography, blue-white palette, optical-core WebGL scene, responsive two-column Prompt Studio, explicit brief controls, result focus, copy feedback, and .spe import/export. Existing data remains separate from illustrative geometry. Semantic marks use real returned group data, capped to 24 displayed marks per group for rendering cost; the complete data remains in the inspector. Mobile and reduced-motion paths use original generated artwork with a 49 KB WebP delivery asset. The WebGL lighting still needs further art direction to match the static reference's material quality.

Original art direction: an optical instrument with a dark glass sphere, titanium orbit supports and blue-violet rim lighting on a near-black stage. Generated specifically for SPE; not a copy of the uploaded reference.

## Corrections and resilience

Editing any compilation input invalidates the previous prompt. Late asynchronous results cannot overwrite a newer brief. Worker crashes/message errors reject promptly and allow a fresh worker on retry. Non-VALID outputs cannot present a successful prompt. Imported .spe content is integrity checked before use. Cache versions change with build assets; the update banner allows an explicit reload. Unknown-question counts exclude blank fields.

## Evidence / scorecard

| Area | Verified result | Limit |
|---|---|---|
| Full Python regression | 450 passed | Existing suite, not a prompt preference study |
| WASM prompt regression | 8 category cases + custom support brief passed | Explicit fields and deterministic rendering |
| Worker failure/reply tests | Passed | Unit-level worker event simulation |
| Production web build | Passed | Local build |
| Mobile Lighthouse performance | 99/100; LCP 1.8s; TBT 0ms; CLS 0 | One local lab run, before final count-only display fix |
| Automated accessibility | 100/100 | Not complete WCAG certification |
| Best practices | 100/100 | Lighthouse scope only |
| Browser review | Compile, stale-result clearing, copy feedback and responsive composition checked | User acceptance pending |
| 4K evidence | Browser capture retained | Viewport tooling changed pixel density instead of stable 3840 CSS layout; native 4K acceptance not established |
| New walkthrough video | Not recorded | Historical web03 video is not evidence of this revision |
| Offline | Versioned precache and local WASM architecture retained | New end-to-end offline rerun pending |
| Design / overall prompt quality | Unrated | No fabricated 10/10 score |

See `proofs/web04/audit-summary.json`, prompt-regression.json, python-regression.txt and worker-client-regression.txt. The current compiled prompt and mobile captures are review evidence. Historical `docs/web03` and `proofs/web03` refer to the previous visual iteration, not approval of this one.

## Preservation and provenance

Based on requested upstream commit 0730cfb1f2013490bbd08dcde35193feed684603. No changes to Rust core, WASM Rust source, spe_runtime, studies, benchmarks or evaluations. No G6-H artifact changes, no PR #6 merge, no spe_runtime/omega directory. Zero analytics, zero mandatory provider and local Worker→WASM execution preserved. The checked-in WASM binary was rebuilt from unchanged Rust source with developer home paths remapped to neutral /spe-source and /rust-deps locations; its hash is cff055778cc53606fd2f03879b89e360cf2080b3b1b0df5dfbaffb040f542b10.

GitHub submission uses the genuine upstream commit as parent. The original local checkout used a synthetic snapshot commit. Large historical captures are retained locally rather than duplicated in the GitHub source submission. The private Sites deployment retains owner-only access. Its packaging helper disappeared from the installed plugin cache, so deployment packaging uses the validated static dist output and existing hosting configuration.

Publication privacy check: the new WASM contains zero `/Users/` or `/home/` markers. Packaging now rejects binaries that contain developer home paths. Build with `RUSTFLAGS="--remap-path-prefix=$HOME=/rust-deps --remap-path-prefix=$PWD=/spe-source" cargo build --manifest-path portable/spe-wasm/Cargo.toml --locked --offline --target wasm32-unknown-unknown --release`.

## Reply-engine follow-up, 22 September 2026

A real-WASM regression reproduced selection of the wrong objective when returned facts were reordered. The renderer now identifies the request by its stable fact ID, verifies it against the current input, and retains every additional returned fact. Previously dropped extra brief fields (such as brief-tone) are retained. Explicitly marked unresolved conflicts block a ready prompt and request review; this does not claim automatic contradiction detection. Missing engine results are errors, and an unknown template falls back to the general assistant rather than Writing. Role instructions are preserved without forced "You are ..." wrapping.

Validation: real-WASM category and custom-brief regression passed, including reordered facts, extra preferences, mismatched request rejection, explicit conflict blocking, and artifact tampering. The web suite passed 37 tests. Full 450-test evidence above predates this renderer-only follow-up. No underlying model-generated answers are added; SPE remains a local prompt compiler.

## Detailed prompt generation, 22 September 2026

All 13 categories now include specific execution guidance, handling of missing information, output depth and structure, and acceptance checks. Coding now covers reproducing defects, tracing data flow, complete implementation, integration and meaningful regression validation. Generic concise-answer defaults were removed. User-supplied length and format restrictions remain authoritative, including JSON-only and translation-only responses. No inferred facts, additional providers or model calls were introduced. Real-WASM regression passed for all 13 categories, plus preservation, mismatch, explicit-conflict and artifact-integrity cases. See prompt-expansion-summary.json for measured before/after word counts; longer text is not presented as an independent quality score.
