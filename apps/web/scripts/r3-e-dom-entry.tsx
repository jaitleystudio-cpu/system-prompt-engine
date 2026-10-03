import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Nav } from "../src/layout/Nav";
import type { AppView } from "../src/routing";
import { resolveRoute } from "../src/routing";
import { MediaProductPanel, type MediaRuntime } from "../src/media/MediaProductPanel";
import { NotFound } from "../src/shell/NotFound";
import { SkipLink } from "../src/shell/SkipLink";
import { EMPTY_IDEA_MESSAGE, workspaceBuildDisabled } from "../src/shell/shellGuards";
import { HumanError } from "../src/ui/HumanError";
import { SeoHead } from "../src/ui/SeoHead";
import { WebsiteProduct } from "../src/website/WebsiteProduct";

declare global {
  interface Window {
    __r3Want?: string;
    __r3Case?: string;
    __r3Route?: { kind: string; rewritten: boolean };
    __speWhisper?: (payload: { name: string; b64: string }) => Promise<{
      status: "SPEECH" | "NO_SPEECH" | "CANCELLED" | "ERROR";
      text: string;
      mode: "LOCAL_NEURAL" | "LOCAL_FALLBACK" | "BROWSER_SERVICE" | "UNAVAILABLE";
      errorCode: string | null;
      neuralSessionRan: boolean;
      timestampsProven: boolean;
      segments: Array<{ startMs: number; endMs: number; text: string }>;
      progressPercent: number | null;
      egressAttempts: number;
    }>;
    __speWhisperCancel?: () => Promise<void>;
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let raw = "";
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    raw += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(raw);
}

/** Present only when the Playwright page exposed the pinned whisper-cli bridge. */
function whisperRuntime(): MediaRuntime | null {
  if (typeof window.__speWhisper !== "function") return null;
  return {
    transcribe: async (file, hooks) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      hooks.onProgress({ percent: null, note: "Local neural session running." });
      const finished = window.__speWhisper!({ name: file.name, b64: bytesToB64(bytes) });
      const aborted = new Promise<{ cancelled: true }>((resolve) => {
        if (hooks.signal.aborted) resolve({ cancelled: true });
        hooks.signal.addEventListener("abort", () => {
          void window.__speWhisperCancel?.();
          resolve({ cancelled: true });
        }, { once: true });
      });
      const raced = await Promise.race([
        finished.then((result) => ({ cancelled: false as const, result })),
        aborted,
      ]);
      if (raced.cancelled || hooks.signal.aborted) {
        return {
          status: "CANCELLED",
          text: "",
          mode: "UNAVAILABLE",
          errorCode: "CANCELLED",
          neuralSessionRan: false,
          timestampsProven: false,
          segments: [],
          progressPercent: null,
          egressAttempts: 0,
        };
      }
      return raced.result;
    },
  };
}

function mark(name: string) {
  window.__r3Case = name;
}

function ShellCase({ want }: { want: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<AppView | null>("home");
  useEffect(() => mark(want), [want]);
  return (
    <>
      <SkipLink />
      <Nav
        scrolled={false}
        view={view}
        onNavigate={(next) => {
          setView(next);
          setMenuOpen(false);
        }}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <main id="main" tabIndex={-1}>
        <h1>Home</h1>
        {want === "media" ? <MediaProductPanel runtime={whisperRuntime()} /> : null}
        {want === "website" ? (
          <div data-shell-mount="website">
            <WebsiteProduct />
          </div>
        ) : null}
        <button type="button" id="after-nav">
          After
        </button>
      </main>
    </>
  );
}

function SeoCase({ view, notFound = false }: { view: AppView; notFound?: boolean }) {
  useEffect(() => mark(notFound ? "seo-not-found" : `seo-${view}`), [view, notFound]);
  return (
    <SeoHead
      view={view}
      notFound={notFound}
      unlisted={notFound || view === "workspace" || view === "my-work" || view === "website" || view === "media"}
    />
  );
}

function UnknownCase() {
  const path = "/no-such-route";
  const resolved = resolveRoute(path);
  useEffect(() => {
    window.__r3Route = {
      kind: resolved.kind,
      rewritten: resolved.kind !== "not-found",
    };
    mark("unknown");
  }, [resolved.kind]);
  if (resolved.kind !== "not-found") {
    return <h1>Home</h1>;
  }
  return (
    <main id="main" tabIndex={-1}>
      <NotFound path={path} onNavigate={() => undefined} />
    </main>
  );
}

function EmptyBuildCase() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => mark("empty-build"), []);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const idea = String(new FormData(event.currentTarget).get("idea") ?? "");
        if (workspaceBuildDisabled(false, idea)) {
          setMessage(EMPTY_IDEA_MESSAGE);
          return;
        }
        setMessage(null);
      }}
    >
      <label>
        idea
        <textarea name="idea" aria-label="idea" defaultValue="" />
      </label>
      <button type="submit">Build</button>
      {message ? (
        <HumanError error={{ code: "EMPTY_BRIEF", message }} />
      ) : null}
    </form>
  );
}

function Harness() {
  const want = window.__r3Want ?? "nav";
  if (want === "unknown") return <UnknownCase />;
  if (want === "empty-build") return <EmptyBuildCase />;
  if (want === "seo-home") return <SeoCase view="home" />;
  if (want === "seo-workspace") return <SeoCase view="workspace" />;
  if (want === "seo-my-work") return <SeoCase view="my-work" />;
  if (want === "seo-not-found") return <SeoCase view="home" notFound />;
  if (want === "website") return <ShellCase want="website" />;
  if (want === "media") return <ShellCase want="media" />;
  return <ShellCase want="nav" />;
}

createRoot(document.getElementById("root")!).render(<Harness />);
