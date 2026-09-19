# Route and View Map

## Framework routing

There is no React Router or file-based route framework. Vite serves a single `index.html`; `apps/web/src/main.tsx` mounts `App`. `App` stores a local `View = "home" | "workspace"` and conditionally renders the active view.

## Entry

```tsx
// apps/web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## `/` — Home / continuous landing story

- Entry: `apps/web/src/App.tsx` with `view === "home"`.
- Layout: persistent `Nav`, `main`, global footer.
- Page components:
  - `apps/web/src/landing/Hero.tsx`
  - `apps/web/src/scene/SpeIntelligence.tsx`
  - `apps/web/src/landing/ScrollStory.tsx`
- Anchor sections: `#top`, `#problem`, `#intent`, `#strategy`, `#reveal`, `#any-ai`, `#artifact-story`, `#moonshot`, `#daily`, `#privacy`, `#final-cta`.
- Summary: animated Intent Core hero with a real composer, followed by semantic, strategy, artifact, roadmap, and privacy sections.

## `workspace` view — Prompt instrument

- Entry: `apps/web/src/App.tsx` with `view === "workspace"`; this is application state, not a URL route.
- Layout: persistent `Nav`, `main`, global footer.
- Page component: `apps/web/src/workspace/Workspace.tsx`.
- Supporting components:
  - `apps/web/src/ui/PrivacyIndicator.tsx`
  - `apps/web/src/ui/TrustPanel.tsx`
- Summary: category/target controls, semantic pipeline, Prompt/Intent/Changes/Techniques/Artifact lenses, `.spe` import/export, privacy, engine truth, and opt-in local history.

## View transitions

The relevant source configuration in `App` is:

```tsx
type View = "home" | "workspace";

const [view, setView] = useState<View>("home");

<Nav
  scrolled={scrolled || view === "workspace"}
  view={view}
  onNavigate={setView}
  onOpenSpe={() => setView("workspace")}
  menuOpen={menuOpen}
  setMenuOpen={setMenuOpen}
/>

<main id="main" tabIndex={-1}>
  {view === "home" && (
    <>
      <Hero ... />
      <ScrollStory onOpenWorkspace={() => setView("workspace")} ... />
    </>
  )}
  {view === "workspace" && (
    <>
      <Workspace ... />
      {/* local history section */}
    </>
  )}
</main>
```

`compile()` also calls `setView("workspace")`, and importing a `.spe` artifact opens the workspace with the Artifact lens selected.
