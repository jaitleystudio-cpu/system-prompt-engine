import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineClient } from "./engine/client";
import type { CompilePhase, EngineError, EngineSuccessBody } from "./engine/types";
import {
  buildAbiFixture,
  buildSpeArtifact,
  clearHistory,
  defaultIntentLens,
  downloadJson,
  isHistoryOptIn,
  loadHistory,
  renderPromptArtifact,
  saveHistoryItem,
  setHistoryOptIn,
  type CategoryId,
  type HistoryItem,
  type IntentAtom,
  type SpeArtifactV1,
  type TargetId,
} from "@spe/web-runtime";
import { Nav } from "./layout/Nav";
import { Hero } from "./landing/Hero";
import { ScrollStory } from "./landing/ScrollStory";
import { Workspace } from "./workspace/Workspace";
import { detectVisualQuality, type VisualQuality } from "./scene/quality";
import type { SceneState } from "./scene/SpeIntelligence";
import { registerServiceWorker } from "./pwa";

type View = "home" | "workspace";
type Mode = "simple" | "inspect" | "pro";
type Lens = "prompt" | "intent" | "changes" | "techniques" | "artifact";

function privacyFromEnvelope(env: unknown): {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
} {
  try {
    const obj = env as Record<string, unknown>;
    const privacy = obj.privacy as Record<string, string> | undefined;
    if (!privacy) return { sensitivity: null, trust: null, authority: null };
    return {
      sensitivity: privacy.sensitivity ?? null,
      trust: privacy.trust ?? null,
      authority: privacy.authority ?? null,
    };
  } catch {
    return { sensitivity: null, trust: null, authority: null };
  }
}

function phaseToScene(phase: CompilePhase, busy: boolean, hasResult: boolean): SceneState {
  if (hasResult && !busy) return "READY";
  if (phase === "evaluating" || phase === "instantiating") return "COMPILING";
  if (phase === "verifying_integrity" || phase === "loading_wasm") return "STRUCTURING";
  if (busy) return "UNDERSTANDING";
  if (phase === "ready") return "LISTENING";
  return "IDLE";
}

export default function App() {
  const clientRef = useRef<EngineClient | null>(null);
  const [view, setView] = useState<View>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [quality, setQuality] = useState<VisualQuality>("LITE");
  const [userRequest, setUserRequest] = useState("");
  const [category, setCategory] = useState<CategoryId>("Writing");
  const [target, setTarget] = useState<TargetId>("any");
  const [intent, setIntent] = useState(() => defaultIntentLens(""));
  const [phase, setPhase] = useState<CompilePhase>("idle");
  const [phases, setPhases] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  const [result, setResult] = useState<EngineSuccessBody | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [imports, setImports] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<unknown>(null);
  const [rendered, setRendered] = useState<ReturnType<typeof renderPromptArtifact> | null>(null);
  const [artifact, setArtifact] = useState<SpeArtifactV1 | null>(null);
  const [historyOptIn, setHistoryOptInState] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mode, setMode] = useState<Mode>("simple");
  const [lens, setLens] = useState<Lens>("prompt");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    registerServiceWorker();
    setQuality(detectVisualQuality());
    setHistoryOptInState(isHistoryOptIn());
    setHistory(loadHistory());
    const onScroll = () => setScrolled(window.scrollY > 24);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clientRef.current?.terminate();
      clientRef.current = null;
    };
  }, []);

  const privacy = useMemo(() => privacyFromEnvelope(envelope), [envelope]);
  const sceneState = phaseToScene(phase, busy, Boolean(result && !error));

  const ensureClient = () => {
    if (!clientRef.current) clientRef.current = new EngineClient();
    return clientRef.current;
  };

  const updateIntentField = (
    bucket: keyof typeof intent,
    id: string,
    text: string,
  ) => {
    setIntent((prev) => ({
      ...prev,
      [bucket]: prev[bucket].map((a: IntentAtom) => (a.id === id ? { ...a, text } : a)),
    }));
  };

  const compile = useCallback(async (requestText?: string) => {
    const goal = (requestText ?? userRequest).trim();
    if (!goal) {
      setError({ code: "INVALID_JSON", message: "Enter what you want SPE to build." });
      return;
    }
    const lensState = requestText ? defaultIntentLens(goal) : intent;
    if (requestText) {
      setUserRequest(goal);
      setIntent(lensState);
    }

    setBusy(true);
    setError(null);
    setResult(null);
    setRendered(null);
    setArtifact(null);
    setPhases([]);
    setPhase("loading_wasm");
    setView("workspace");
    setLens("prompt");

    let fixture: Record<string, unknown>;
    try {
      fixture = buildAbiFixture({
        userRequest: goal,
        category,
        target,
        confirmed: lensState.confirmed,
        assumed: lensState.assumed,
        unknowns: lensState.unknowns,
        conflicts: lensState.conflicts,
      });
      setEnvelope(fixture);
    } catch (err) {
      setError({
        code: "INVALID_JSON",
        message: String(err instanceof Error ? err.message : err),
      });
      setBusy(false);
      setPhase("unavailable");
      return;
    }

    try {
      const client = ensureClient();
      const out = await client.compile(JSON.stringify(fixture), (p) => {
        setPhase(p);
        setPhases((prev) => (prev.includes(p) ? prev : [...prev, p]));
      });
      setError(out.error);
      setResult(out.result);
      setPhases(out.phases);
      setSha256(out.sha256);
      setImports(out.imports);
      setPhase(out.error ? "unavailable" : "done");

      if (!out.error && out.result) {
        const prompt = renderPromptArtifact({
          userRequest: goal,
          target,
          envelopeOutput: out.result.output,
        });
        setRendered(prompt);
        const spe = await buildSpeArtifact({
          user_request: goal,
          category,
          target,
          envelope: fixture,
          wasm: {
            status: out.result.status,
            disposition: out.result.disposition,
            reason_code: out.result.reason_code,
            sha256: out.sha256,
            imports: out.imports,
            network_mode: "NONE",
            used_ts_fallback: false,
          },
          rendered_prompt: prompt.finalPrompt,
          intent: {
            confirmed: lensState.confirmed,
            assumed: lensState.assumed,
            unknowns: lensState.unknowns,
            conflicts: lensState.conflicts,
          },
        });
        setArtifact(spe);
        if (isHistoryOptIn()) {
          saveHistoryItem({
            id: spe.integrity.content_sha256.slice(0, 16),
            saved_at_utc: spe.created_at_utc,
            user_request: goal,
            category,
            target,
            prompt_preview: prompt.finalPrompt.slice(0, 240),
          });
          setHistory(loadHistory());
        }
      }
    } catch (err) {
      setError({
        code: "ENGINE_UNAVAILABLE",
        message: String(err instanceof Error ? err.message : err),
      });
      setPhase("unavailable");
    } finally {
      setBusy(false);
    }
  }, [userRequest, intent, category, target]);

  const onCopy = async () => {
    if (!rendered?.finalPrompt) return;
    await navigator.clipboard.writeText(rendered.finalPrompt);
  };

  const onExportSpe = () => {
    if (!artifact) return;
    downloadJson(`artifact-${Date.now()}.spe.json`, artifact);
  };

  const onExportJson = () => {
    if (!artifact) return;
    downloadJson(`spe-export-${Date.now()}.json`, artifact);
  };

  const onImportSpe = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as SpeArtifactV1;
    setArtifact(parsed);
    setUserRequest(parsed.user_request);
    setCategory((parsed.category as CategoryId) || "Writing");
    setTarget((parsed.target as TargetId) || "any");
    setRendered({
      userRequest: parsed.user_request,
      speAdded: [],
      finalPrompt: parsed.rendered_prompt,
      techniques: [],
    });
    setEnvelope(parsed.envelope);
    setView("workspace");
    setLens("artifact");
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
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
            <Hero
              value={userRequest}
              onChange={(v) => {
                setUserRequest(v);
                setIntent(defaultIntentLens(v));
                if (v.trim()) setPhase("ready");
                else setPhase("idle");
              }}
              onBuild={() => void compile()}
              busy={busy}
              sceneState={sceneState}
              quality={quality}
            />
            <ScrollStory
              onOpenWorkspace={() => setView("workspace")}
              demoRequest={userRequest || "write leave email"}
              demoPrompt={rendered?.finalPrompt ?? null}
            />
          </>
        )}

        {view === "workspace" && (
          <>
            <Workspace
              userRequest={userRequest}
              setUserRequest={setUserRequest}
              category={category}
              setCategory={setCategory}
              target={target}
              setTarget={setTarget}
              intent={intent}
              updateIntentField={updateIntentField}
              rendered={rendered}
              artifact={artifact}
              error={error}
              result={result}
              phase={phase}
              phases={phases}
              sha256={sha256}
              imports={imports}
              busy={busy}
              onCompile={() => void compile()}
              onCopy={() => void onCopy()}
              onExportSpe={onExportSpe}
              onExportJson={onExportJson}
              onImportSpe={(f) => void onImportSpe(f)}
              privacy={privacy}
              online={online}
              mode={mode}
              setMode={setMode}
              lens={lens}
              setLens={setLens}
            />

            <section className="spe-workspace" aria-labelledby="hist-mini">
              <h2 id="hist-mini" className="spe-kicker">Local history</h2>
              <label className="spe-field">
                <span>
                  <input
                    type="checkbox"
                    checked={historyOptIn}
                    onChange={(e) => {
                      setHistoryOptIn(e.target.checked);
                      setHistoryOptInState(e.target.checked);
                      setHistory(e.target.checked ? loadHistory() : []);
                    }}
                  />{" "}
                  Enable local history on this device
                </span>
              </label>
              <div className="spe-actions">
                <button type="button" className="spe-ghost" disabled={!historyOptIn} onClick={() => { clearHistory(); setHistory([]); }}>
                  Clear history
                </button>
              </div>
              <div className="spe-moon-grid" style={{ marginTop: "0.75rem" }}>
                {history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="spe-moon-card"
                    onClick={() => {
                      setUserRequest(h.user_request);
                      setCategory((h.category as CategoryId) || "Writing");
                      setTarget((h.target as TargetId) || "any");
                      setIntent(defaultIntentLens(h.user_request));
                    }}
                  >
                    <h3>{h.user_request}</h3>
                    <span>{h.category}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="spe-footer">
        <div>System Prompt Engine — free core · portable .spe · offline deterministic compile</div>
        <div className="claim-strip">
          IMPLEMENTATION_PRESENT / REVIEW_PENDING · production NOT QUALIFIED · World #1 NOT PROVEN · not_a_release=true
        </div>
      </footer>
    </>
  );
}
