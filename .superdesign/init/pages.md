# Page Dependency Trees

The single-page Vite app has two state-selected key views. Both begin at `apps/web/src/App.tsx` and share engine/runtime dependencies; only the relevant visual branch is expanded under each view.

## `/` — Home / landing story

Entry: `apps/web/src/App.tsx` (`view === "home"` branch, lines 283–304)

Dependencies:

- `apps/web/src/App.tsx`
  - `apps/web/src/layout/Nav.tsx`
    - `apps/web/src/brand/Logo.tsx`
  - `apps/web/src/landing/Hero.tsx`
    - `apps/web/src/brand/Logo.tsx`
    - `apps/web/src/scene/SpeIntelligence.tsx`
      - `apps/web/src/scene/quality.ts`
  - `apps/web/src/landing/ScrollStory.tsx`
    - `packages/web-runtime/src/index.ts`
      - `packages/web-runtime/src/targets.ts`
      - `packages/web-runtime/src/envelope.ts`
      - `packages/web-runtime/src/render.ts`
      - `packages/web-runtime/src/speArtifact.ts`
      - `packages/web-runtime/src/history.ts`
  - `apps/web/src/scene/quality.ts`
  - `apps/web/src/engine/client.ts`
    - `apps/web/src/engine/types.ts`
    - worker URL: `apps/web/src/engine/engine.worker.ts`
      - `apps/web/src/engine/types.ts`
      - `apps/web/src/engine/errors.ts`
      - `apps/web/src/engine/wasm-host.d.ts`
  - `apps/web/src/pwa.ts`
  - `apps/web/src/index.css`
    - `packages/design-system/src/tokens.css`

Design-context focus: `App` home render branch, `Nav`, `Logo`, `Hero`, `SpeIntelligence`, `ScrollStory`, `index.css`, and tokens. Engine/runtime files establish truthful states but are not visual source except for exposed labels and state names.

## `workspace` — Prompt instrument

Entry: `apps/web/src/App.tsx` (`view === "workspace"` branch, lines 306–380)

Dependencies:

- `apps/web/src/App.tsx`
  - `apps/web/src/layout/Nav.tsx`
    - `apps/web/src/brand/Logo.tsx`
  - `apps/web/src/workspace/Workspace.tsx`
    - `apps/web/src/ui/PrivacyIndicator.tsx`
    - `apps/web/src/ui/TrustPanel.tsx`
    - `apps/web/src/engine/types.ts`
    - `packages/web-runtime/src/index.ts`
      - `packages/web-runtime/src/targets.ts`
      - `packages/web-runtime/src/envelope.ts`
      - `packages/web-runtime/src/render.ts`
      - `packages/web-runtime/src/speArtifact.ts`
      - `packages/web-runtime/src/history.ts`
  - `apps/web/src/engine/client.ts`
    - `apps/web/src/engine/types.ts`
    - worker URL: `apps/web/src/engine/engine.worker.ts`
      - `apps/web/src/engine/types.ts`
      - `apps/web/src/engine/errors.ts`
      - `apps/web/src/engine/wasm-host.d.ts`
  - `apps/web/src/pwa.ts`
  - `apps/web/src/index.css`
    - `packages/design-system/src/tokens.css`

Design-context focus: `App` workspace/history render branch, `Nav`, `Logo`, `Workspace`, `PrivacyIndicator`, `TrustPanel`, `index.css`, and tokens. Runtime modules are necessary product context but should not be passed wholesale unless the requested design change depends on their data contracts.

## Shared build/style context

- `apps/web/vite.config.ts` — aliases `@spe/web-runtime` and `@spe/design-system`; configures ES workers and build output.
- `apps/web/tsconfig.json` — React JSX, strict TypeScript, runtime aliases.
- `apps/web/package.json` — React 18, React Three Fiber 8, Three.js 0.170, Vite 5.
- `.superdesign/design-system.md` — WEB-03 Semantic Forge design constraints.
- `.superdesign/init/theme.md` — compact token summary and complete source dumps.
