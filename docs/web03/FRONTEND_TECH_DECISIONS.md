# SPE-WEB-03 Frontend Technical Decisions

Status: design-stage decisions only. No frontend implementation is authorized until a Superdesign direction is selected.

## Existing system that must remain intact

- React 18 + Vite 5 + TypeScript.
- Real `UI → Web Worker → spe_wasm.wasm → spe-core-rs` compile path.
- No TypeScript semantic fallback.
- Local/offline PWA behavior and service-worker registration.
- `.spe` construction, import, export, integrity, and lineage data.
- Intent Lens and Prompt Lens behavior.
- Opt-in local history and explicit clear control.
- Privacy fields sourced from the real envelope, never inferred.
- Compile phases and errors sourced from the worker/engine.

The WEB-03 visual layer may reorganize these capabilities but may not replace, simulate, or relabel them.

## Scene stack

Decision: keep React Three Fiber and Three.js as the spatial renderer. They already exist in the repository and are sufficient for the Semantic Forge. Do not add a second 3D engine.

Planned scene architecture after approval:

1. `ForgeScene` owns renderer/camera/light/material orchestration.
2. `SemanticWorkpiece` renders a data-driven normalized view of the user's raw text and semantic categories.
3. `ForgeActController` maps scroll progress, viewport mode, reduced motion, and compile phase to explicit camera/scene states.
4. DOM overlays consume the same scene-state model but never read Three.js object state.
5. Workspace visuals subscribe to existing application data; they do not own engine or artifact logic.

The scene must be deterministic for equal inputs and states. Decorative variation may use a seeded value, never `Math.random()` during render.

## Data-to-visual contract

Create a narrow presentation model after approval:

```ts
type SemanticCategory =
  | "goal"
  | "constraint"
  | "context"
  | "unknown"
  | "preference"
  | "output";

type ForgePresentation = {
  rawThought: string;
  categories: Array<{
    kind: SemanticCategory;
    label: string;
    text: string;
    provenance: "confirmed" | "assumed" | "unknown" | "conflict";
  }>;
  stage: "receive" | "separate" | "structure" | "strategy" | "artifact";
  promptText: string | null;
  artifactAvailable: boolean;
};
```

The adapter may map existing Intent Lens fields into this presentation. It must not invent missing semantic analysis. Empty or unavailable categories remain visibly unresolved.

## DOM/3D division

Use 3D for:

- forge rails/gates/planes,
- semantic filament geometry,
- material transformations,
- camera depth and environmental light,
- explanatory non-interactive spatial annotation anchors.

Use DOM for:

- wordmark and navigation,
- all copy and labels,
- textarea, selects, buttons, tabs, file input,
- prompt and artifact text,
- status/error announcements,
- privacy and history controls.

Do not render functional text into a canvas texture. This preserves selection, zoom, accessibility, localization readiness, and crisp reduced-motion plates.

## Scroll and camera

Use one normalized story timeline with named act boundaries. Avoid independent intersection observers that trigger unrelated animations.

- Desktop: scroll progress drives a constrained camera rail with authored key poses.
- Mobile: discrete vertical cutaway states; no desktop camera-path scaling.
- Reduced motion: snap to named camera plates based on section visibility; no interpolated camera movement.
- Product state overrides decorative scroll when compiling so progress and scene never contradict one another.

No scroll-jacking: native document scroll remains authoritative. Pinning, if used after approval, must preserve keyboard/Page Down behavior and have a direct skip target.

## Motion

Prefer state interpolation inside the existing render loop for camera/material updates. Add an animation dependency only if implementation proves that authored timelines cannot remain clear and testable otherwise.

- Clamp delta time after background-tab resume.
- Pause rendering when the page is hidden.
- Demand-render or lower frame rate for static/reduced states.
- Pointer motion is an optional, low-amplitude enhancement; it never controls access.
- No continuous auto-rotation.

## Materials and assets

- Use procedural primitives and compact texture maps before large hero models.
- If a modeled forge workpiece is needed, use one optimized GLB with mesh compression and documented license/provenance.
- Bake roughness/normal detail where it materially improves the titanium/ceramic read.
- Avoid environment maps whose licensing or origin is unclear.
- Reference images remain design inputs and must not ship as product assets.
- No binary/generated Superdesign output enters the repository during this design stage.

## Performance budgets

Budgets are implementation constraints, not current performance claims:

- Preserve route usability without 3D completion.
- Lazy-load the spatial scene after critical DOM.
- Mobile initial 3D payload target: under 1.5 MB compressed.
- Desktop initial 3D payload target: under 3 MB compressed.
- Cap device pixel ratio by measured quality tier.
- Avoid dynamic shadow maps; use contact/decal/baked alternatives.
- Keep draw calls and transparent layers bounded and inspect them on target hardware.
- Retain the current quality-tier concept, but redefine tiers around verified capability rather than viewport width alone.

Actual achieved sizes and frame behavior must be measured before being presented as facts.

## Progressive resilience

The premium experience has four valid render modes:

1. High: complete materials and authored motion.
2. Balanced: reduced samples/details, same composition.
3. Lite: CSS/DOM still plates with semantic filament SVG.
4. Reduced motion: authored static camera plates with no ambient movement.

All four expose the same composer, semantic explanation, workspace, and runtime truth. WebGL failure must not block compilation.

## Accessibility

- Canvas is decorative/explanatory and omitted from the accessibility tree.
- Every act has an ordered DOM section with a heading and concise equivalent explanation.
- Keyboard focus never enters the canvas.
- Compile progress uses an `aria-live="polite"` region backed by real phases.
- Error states preserve existing engine error text and fail-closed wording.
- Color category differences have label/shape companions.
- Motion opt-out is evaluated before scene startup.

## Responsive decision

Do not use one responsive scene with only camera/FOV changes. Maintain shared semantic data and materials, but author separate desktop and mobile composition maps. Breakpoints select composition; they do not merely shrink geometry.

## Workspace integration

The visual redesign should split the current large `App` presentation from engine orchestration without changing engine behavior:

- Keep `EngineClient`, artifact assembly, history, and privacy logic at the application boundary.
- Pass typed state/actions into the new visual shell.
- Preserve `simple / inspect / pro` semantics.
- Preserve Prompt, Intent, Changes, Techniques, and Artifact lenses.
- Represent absent data as unavailable; remove decorative counts such as “0 techniques” if they can be misread as proof.

## Testing plan after design approval

- Existing engine fixture and build checks remain mandatory.
- Add component tests for composer keyboard flow, modes/lenses, history opt-in, import/export affordances, and fail-closed errors.
- Add deterministic presentation-model tests.
- Add reduced-motion and no-WebGL render tests.
- Add responsive visual checks for authored desktop/mobile states.
- Add accessibility checks for headings, landmarks, focus order, names, live regions, contrast, and canvas exclusion.
- Re-run PWA/offline, asset-budget, and network-egress proofs.

## Dependency decision

No dependency changes during design. After approval, prefer the existing stack. Any proposed font, timeline, compression, or accessibility package must be justified against payload, licensing, offline behavior, and maintenance before installation.
