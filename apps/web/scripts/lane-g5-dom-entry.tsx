import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { focusMainAfterNavigation } from "../src/a11y/focusOnView";
import { DailyLab } from "../src/lab/DailyLab";
import { SeoContent } from "../src/landing/SeoContent";
import { Nav } from "../src/layout/Nav";
import type { AppView } from "../src/routing";
import { InAppLink } from "../src/shell/inAppLink";
import { NotFound } from "../src/shell/NotFound";
import { HumanError } from "../src/ui/HumanError";
import { SeoHead } from "../src/ui/SeoHead";

declare global {
  interface Window {
    __g5Want?: string;
    __g5Case?: string;
    focusStep?: () => boolean;
  }
}

function mark(name: string) {
  window.__g5Case = name;
}

function NavCase() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<AppView | null>("home");
  useEffect(() => mark("nav"), []);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Nav
        scrolled={false}
        view={view}
        onNavigate={setView}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <main id="main" tabIndex={-1}>
        <h1>Home</h1>
        <button type="button" id="after-nav">
          After
        </button>
      </main>
    </>
  );
}

function FocusCase() {
  const ref = useRef(true);
  useEffect(() => {
    window.focusStep = () => {
      focusMainAfterNavigation(ref);
      return document.activeElement?.id === "main";
    };
    mark("focus");
  }, []);
  return (
    <main id="main" tabIndex={-1}>
      Main
    </main>
  );
}

function IdeaCase() {
  const [idea, setIdea] = useState("unsaved idea");
  const [view, setView] = useState<AppView>("home");
  useEffect(() => mark("idea"), []);
  return (
    <div>
      <label>
        idea
        <textarea
          aria-label="idea"
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
        />
      </label>
      <output data-testid="view">{view}</output>
      <SeoContent onNavigate={setView} />
      <InAppLink view="create" onNavigate={setView}>
        Footer Create
      </InAppLink>
    </div>
  );
}

function SeoWorkspace() {
  useEffect(() => mark("seo-workspace"), []);
  return <SeoHead view="workspace" unlisted />;
}

function SeoHome() {
  useEffect(() => mark("seo-home"), []);
  return <SeoHead view="home" />;
}

function Missing() {
  useEffect(() => mark("not-found"), []);
  return (
    <main id="main" tabIndex={-1}>
      <NotFound path="/no-such-route" onNavigate={() => undefined} />
      <SeoHead view="home" unlisted notFound />
    </main>
  );
}

function LabCase() {
  useEffect(() => mark("lab"), []);
  return <DailyLab onOpenInSpe={() => undefined} onCopyIdea={() => undefined} />;
}

function ErrorCase() {
  useEffect(() => mark("error"), []);
  return (
    <>
      <HumanError
        error={{
          code: "EMPTY_BRIEF",
          message: "Enter what you want SPE to build.",
        }}
      />
      <div data-testid="real-invalid">
        <HumanError error={{ code: "INVALID_JSON", message: "bad json" }} />
      </div>
    </>
  );
}

function Harness() {
  const want = window.__g5Want ?? "nav";
  if (want === "focus") return <FocusCase />;
  if (want === "idea") return <IdeaCase />;
  if (want === "seo-workspace") return <SeoWorkspace />;
  if (want === "seo-home") return <SeoHome />;
  if (want === "not-found") return <Missing />;
  if (want === "lab") return <LabCase />;
  if (want === "error") return <ErrorCase />;
  return <NavCase />;
}

createRoot(document.getElementById("root")!).render(<Harness />);
