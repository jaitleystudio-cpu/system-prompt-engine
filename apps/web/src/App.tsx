import { ui } from "@spe/human-perspective";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineClient } from "./engine/client";
import type {
  CompilePhase,
  ContextProtocolCompileOutput,
  EngineError,
  EngineSuccessBody,
} from "./engine/types";
import {
  buildAbiFixture,
  buildSpeArtifact,
  clearHistory,
  defaultIntentLens,
  downloadJson,
  isHistoryOptIn,
  loadHistory,
  renderPromptArtifact,
  PromptBriefError,
  saveHistoryItem,
  setHistoryOptIn,
  verifySpeArtifact,
  CATEGORIES,
  type CategoryId,
  type HistoryItem,
  type IntentAtom,
  type SpeArtifactV1,
  type TargetId,
} from "@spe/web-runtime";
import { Nav } from "./layout/Nav";
import {
  navigateTo,
  pathForView,
  viewFromPath,
  type AppView,
} from "./routing";
import { SeoHead } from "./ui/SeoHead";
import { SeoContent } from "./landing/SeoContent";
import { Hero } from "./landing/Hero";
import { ScrollStory } from "./landing/ScrollStory";
import { Workspace } from "./workspace/Workspace";
import { UnifiedComposer } from "./composer/UnifiedComposer";
import {
  ContextProtocolControls,
  mapPublicSourceToWasm,
  suggestStaleContextRefresh,
  type PublicDepthControl,
  type PublicSourceControl,
} from "./composer/ContextProtocolControls";
import { DailyLab } from "./lab/DailyLab";
import { MyWork } from "./pages/MyWork";
import { PrivacyProof } from "./pages/PrivacyProof";
import { detectVisualQuality, type VisualQuality } from "./scene/quality";
import type { SceneState } from "./scene/SpeIntelligence";
import { registerServiceWorker } from "./pwa";

type View = AppView;
type Mode = "simple" | "inspect" | "pro";
type Lens = "prompt" | "intent" | "changes" | "techniques" | "artifact";
/** Intent lens provenance — SIMPLE/CREATE rederive; INSPECT/PRO preserve edits. */
type IntentProvenance = "AUTO_DERIVED_INTENT" | "USER_EDITED_INTENT";
type IntentLensState = ReturnType<typeof defaultIntentLens>;

const CREATE_INTENT_FIELD_IDS = new Set(["desired-output", "desired-example"]);

function preserveCreateIntentFields(
  current: IntentLensState,
  next: IntentLensState,
): IntentLensState {
  const preserved = new Map(
    [...current.confirmed, ...current.assumed]
      .filter((atom) => CREATE_INTENT_FIELD_IDS.has(atom.id))
      .map((atom) => [atom.id, atom.text]),
  );
  const merge = (atoms: IntentAtom[]) =>
    atoms.map((atom) =>
      preserved.has(atom.id)
        ? { ...atom, text: preserved.get(atom.id) ?? "" }
        : atom,
    );
  return {
    ...next,
    confirmed: merge(next.confirmed),
    assumed: merge(next.assumed),
  };
}

function hasCreateIntentFields(intent: IntentLensState): boolean {
  return [...intent.confirmed, ...intent.assumed].some(
    (atom) =>
      CREATE_INTENT_FIELD_IDS.has(atom.id) && Boolean(atom.text.trim()),
  );
}

function mapLabCategory(raw: string): CategoryId {
  return (CATEGORIES as readonly string[]).includes(raw)
    ? (raw as CategoryId)
    : "AI Assistant";
}

function shouldPreserveEditedIntent(
  mode: Mode,
  provenance: IntentProvenance,
): boolean {
  return (
    (mode === "inspect" || mode === "pro") &&
    provenance === "USER_EDITED_INTENT"
  );
}

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

function phaseToScene(
  phase: CompilePhase,
  busy: boolean,
  hasResult: boolean,
): SceneState {
  if (hasResult && !busy) return "READY";
  if (phase === "evaluating" || phase === "instantiating") return "COMPILING";
  if (phase === "verifying_integrity" || phase === "loading_wasm")
    return "STRUCTURING";
  if (busy) return "UNDERSTANDING";
  if (phase === "ready") return "LISTENING";
  return "IDLE";
}

export default function App() {
  const clientRef = useRef<EngineClient | null>(null);
  const revision = useRef(0);
  const [view, setViewState] = useState<View>(() =>
    typeof window === "undefined" ? "home" : viewFromPath(window.location.pathname),
  );
  const setView = useCallback((next: View, opts: { replace?: boolean } = {}) => {
    setViewState(next);
    navigateTo(next, opts);
  }, []);
  const [notice, setNotice] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [quality, setQuality] = useState<VisualQuality>("LITE");
  const [userRequest, setUserRequest] = useState("");
  const [category, setCategory] = useState<CategoryId>("AI Assistant");
  const [target, setTarget] = useState<TargetId>("any");
  const [intent, setIntent] = useState(() => defaultIntentLens(""));
  const [intentProvenance, setIntentProvenance] =
    useState<IntentProvenance>("AUTO_DERIVED_INTENT");
  const [phase, setPhase] = useState<CompilePhase>("idle");
  const [phases, setPhases] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  const [result, setResult] = useState<EngineSuccessBody | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [imports, setImports] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<unknown>(null);
  const [rendered, setRendered] = useState<ReturnType<
    typeof renderPromptArtifact
  > | null>(null);
  const [artifact, setArtifact] = useState<SpeArtifactV1 | null>(null);
  const [historyOptIn, setHistoryOptInState] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mode, setMode] = useState<Mode>("simple");
  const [lens, setLens] = useState<Lens>("prompt");
  const [publicSource, setPublicSource] =
    useState<PublicSourceControl>("AUTO");
  const [publicDepth, setPublicDepth] =
    useState<PublicDepthControl>("AUTO");
  const [contextProtocol, setContextProtocol] =
    useState<ContextProtocolCompileOutput | null>(null);
  const [contextRefreshNotice, setContextRefreshNotice] = useState<string | null>(
    null,
  );
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    navigateTo(viewFromPath(window.location.pathname), { replace: true });
    const onPop = () => setViewState(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    registerServiceWorker();
    let hadController = Boolean(navigator.serviceWorker?.controller);
    const onControllerChange = () => {
      if (hadController) setUpdateAvailable(true);
      hadController = true;
    };
    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    setQuality(detectVisualQuality());
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateQuality = () => setQuality(detectVisualQuality());
    motion.addEventListener("change", updateQuality);
    const narrow = window.matchMedia("(max-width: 720px)");
    narrow.addEventListener("change", updateQuality);
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
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      motion.removeEventListener("change", updateQuality);
      narrow.removeEventListener("change", updateQuality);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clientRef.current?.terminate();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [view]);

  const privacy = useMemo(() => privacyFromEnvelope(envelope), [envelope]);
  const sceneState = phaseToScene(phase, busy, Boolean(result && !error));

  const ensureClient = () => {
    if (!clientRef.current) clientRef.current = new EngineClient();
    return clientRef.current;
  };

  const invalidate = () => {
    revision.current += 1;
    setResult(null);
    setRendered(null);
    setArtifact(null);
    setError(null);
    setEnvelope(null);
    setPhases([]);
    setBusy(false);
    setPhase("idle");
    setContextProtocol(null);
    setContextRefreshNotice(null);
  };

  const updateIntentField = (
    bucket: keyof typeof intent,
    id: string,
    text: string,
  ) => {
    invalidate();
    setIntentProvenance("USER_EDITED_INTENT");
    setIntent((prev) => ({
      ...prev,
      [bucket]: prev[bucket].map((a: IntentAtom) =>
        a.id === id ? { ...a, text } : a,
      ),
    }));
  };

  /** Create/simple/home: rederive intent from request. Inspect/pro: keep human edits. */
  const applyUserRequestChange = (v: string) => {
    invalidate();
    setUserRequest(v);
    if (!shouldPreserveEditedIntent(mode, intentProvenance)) {
      const keepsCreateFields = hasCreateIntentFields(intent);
      setIntent(
        preserveCreateIntentFields(intent, defaultIntentLens(v)),
      );
      setIntentProvenance(
        keepsCreateFields ? "USER_EDITED_INTENT" : "AUTO_DERIVED_INTENT",
      );
    }
  };

  const compile = useCallback(
    async (requestText?: string) => {
      const goal = (requestText ?? userRequest).trim();
      if (!goal) {
        setError({
          code: "INVALID_JSON",
          message: "Enter what you want SPE to build.",
        });
        return;
      }
      const lensState = requestText ? defaultIntentLens(goal) : intent;
      if (requestText) {
        setUserRequest(goal);
        setIntent(lensState);
      }

      const requestRevision = ++revision.current;
      setBusy(true);
      setError(null);
      setResult(null);
      setRendered(null);
      setArtifact(null);
      setPhases([]);
      setPhase("loading_wasm");
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
          if (requestRevision !== revision.current) return;
          setPhase(p);
          setPhases((prev) => (prev.includes(p) ? prev : [...prev, p]));
        });
        if (requestRevision !== revision.current) return;

        // Context / grounding protocol — WASM only (fail closed; no TS synthesis).
        try {
          const proto = await client.compileContextProtocol(
            {
              spe_api: "context_protocol",
              op: "compile",
              request_text: goal,
              source_mode: mapPublicSourceToWasm(publicSource),
              requested_depth: publicDepth,
              adapter_id: "ANY_AI",
            },
            () => {},
          );
          if (requestRevision !== revision.current) return;
          if (!proto.error && proto.result?.output) {
            setContextProtocol(
              proto.result.output as ContextProtocolCompileOutput,
            );
          } else {
            setContextProtocol(null);
          }
        } catch {
          if (requestRevision === revision.current) setContextProtocol(null);
        }
        if (
          !out.error &&
          out.result &&
          (out.result.status !== "VALID" || out.result.disposition !== "VALID")
        ) {
          throw new Error(
            `Engine rejected the brief: ${out.result.reason_code ?? out.result.status}`,
          );
        }
        if (!out.error && !out.result)
          throw new Error("The engine returned no result. Please retry.");
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
            category,
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
          if (requestRevision !== revision.current) return;
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
        if (requestRevision !== revision.current) return;
        if (!(err instanceof PromptBriefError)) {
          clientRef.current?.terminate();
          clientRef.current = null;
        }
        setResult(null);
        setRendered(null);
        setArtifact(null);
        setError({
          code:
            err instanceof PromptBriefError
              ? "BRIEF_NEEDS_REVIEW"
              : "ENGINE_UNAVAILABLE",
          message: String(err instanceof Error ? err.message : err),
        });
        setPhase("unavailable");
      } finally {
        if (requestRevision === revision.current) setBusy(false);
      }
    },
    [userRequest, intent, category, target, publicSource, publicDepth],
  );

  const onCopy = async () => {
    if (!rendered?.finalPrompt) return;
    try {
      await navigator.clipboard.writeText(rendered.finalPrompt);
      setNotice("Prompt copied.");
    } catch {
      setNotice("Copy unavailable. Select the prompt text to copy it.");
    }
  };

  const onExportSpe = () => {
    if (!artifact) return;
    downloadJson(`artifact-${Date.now()}.spe`, artifact);
  };

  const onExportJson = () => {
    if (!artifact) return;
    downloadJson(`spe-export-${Date.now()}.json`, artifact);
  };

  const onImportSpe = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as SpeArtifactV1;
      if (
        parsed.spe_format !== "spe.artifact.v1" ||
        typeof parsed.user_request !== "string" ||
        typeof parsed.rendered_prompt !== "string" ||
        !parsed.integrity?.content_sha256 ||
        !parsed.intent ||
        !["confirmed", "assumed", "unknowns", "conflicts"].every((k) =>
          Array.isArray(parsed.intent[k as keyof typeof parsed.intent]),
        )
      )
        throw new Error("This file is not in a supported SPE format.");
      const verified = await verifySpeArtifact(parsed);
      if (verified.integrity.state === "MISMATCH")
        throw new Error(
          "This SPE file has changed since export. Its integrity check failed.",
        );
      invalidate();
      setArtifact(verified);
      // Stale context may suggest refresh; never mutate ProtectedIntent here.
      const ext = parsed as SpeArtifactV1 & {
        context_protocol?: { freshness_state?: string };
        quality_record?: { freshness_state?: string };
      };
      const freshness =
        ext.context_protocol?.freshness_state ??
        ext.quality_record?.freshness_state ??
        null;
      const refresh = suggestStaleContextRefresh({
        freshness_state: freshness,
        user_request: parsed.user_request,
        protected_intent: parsed.intent,
      });
      setContextRefreshNotice(refresh?.message ?? null);
      setUserRequest(parsed.user_request);
      setCategory((parsed.category as CategoryId) || "Writing");
      setTarget((parsed.target as TargetId) || "any");
      setIntent(
        Object.fromEntries(
          Object.entries(parsed.intent).map(([k, values]) => [
            k,
            values.map((a) => ({
              ...a,
              kind:
                k === "unknowns"
                  ? "unknown"
                  : k === "conflicts"
                    ? "conflict"
                    : k === "assumed"
                      ? "assumed"
                      : "confirmed",
            })),
          ]),
        ) as typeof intent,
      );
      setIntentProvenance("USER_EDITED_INTENT");
      setRendered({
        userRequest: parsed.user_request,
        speAdded: [],
        finalPrompt: parsed.rendered_prompt,
        review: null,
        techniques: [],
      });
      setEnvelope(parsed.envelope);
      setView("workspace");
      setMode("inspect");
      setLens("artifact");
      setNotice(
        "Your SPE file passed its integrity check. Shape the prompt again to review its current details.",
      );
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "We could not open this SPE file.",
      );
    }
  };

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main");
          main?.focus({ preventScroll: false });
          main?.scrollIntoView();
        }}
      >
        Skip to main content
      </a>
      <SeoHead view={view} />
      <Nav
        scrolled={scrolled || view !== "home"}
        view={view}
        onNavigate={setView}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <main id="main" tabIndex={-1}>
        {view === "home" && (
          <>
            <Hero
              onReset={() => {
                invalidate();
                setUserRequest("");
                setIntent(defaultIntentLens(""));
                setIntentProvenance("AUTO_DERIVED_INTENT");
              }}
              value={userRequest}
              onChange={(v) => {
                applyUserRequestChange(v);
              }}
              category={category}
              onCategory={(v) => {
                invalidate();
                setCategory(v);
              }}
              target={target}
              onTarget={(v) => {
                invalidate();
                setTarget(v);
              }}
              intent={intent}
              onIntent={updateIntentField}
              onBuild={() => void compile()}
              busy={busy}
              sceneState={sceneState}
              quality={quality}
              result={result}
              error={error}
              phase={phase}
              prompt={rendered?.finalPrompt ?? null}
              review={rendered?.review ?? null}
              onOpen={() => {
                setView("workspace");
                window.scrollTo(0, 0);
              }}
              onCopy={() => void onCopy()}
              onExport={onExportSpe}
            />
            <ScrollStory
              onOpenWorkspace={() => setView("workspace")}
              demoRequest={userRequest || "write leave email"}
              demoPrompt={rendered?.finalPrompt ?? null}
            />
            <SeoContent />
          </>
        )}

        {(view === "create" || view === "code") && (
          <section className="spe-create" aria-labelledby="create-title">
            <header className="spe-create-head">
              <p className="spe-kicker">{view === "code" ? "Code" : "Create"}</p>
              <h1 id="create-title">
                {view === "code"
                  ? "Turn a screenshot into a starting point"
                  : "Shape a prompt you can trust"}
              </h1>
              {view === "create" ? (
                <p className="spe-create-thought">There&apos;s more in your idea than fits in one sentence.</p>
              ) : null}
              <p>
                {view === "code"
                  ? "Upload a screenshot. SPE notes the layout it can see, then offers starter scaffolds you can compare — HTML, React, SwiftUI, Jetpack Compose, Flutter, or React Native."
                  : "Create is the instrument — text, speech, image, video, or a website. Shape meaning, review structure, take a clear prompt with you."}
              </p>
            </header>
            <div className="spe-create-rail">
            <UnifiedComposer
              key={view === "code" ? "code" : "create"}
              value={userRequest}
              onChange={(v) => {
                applyUserRequestChange(v);
              }}
              disabled={busy}
              initialMode={view === "code" ? "screenshot" : "text"}
              showOutputControls={view === "create"}
              desiredOutput={
                intent.confirmed.find((atom) => atom.id === "desired-output")
                  ?.text ?? ""
              }
              onDesiredOutputChange={(value) =>
                updateIntentField("confirmed", "desired-output", value)
              }
              desiredExample={
                intent.assumed.find((atom) => atom.id === "desired-example")
                  ?.text ?? ""
              }
              onDesiredExampleChange={(value) =>
                updateIntentField("assumed", "desired-example", value)
              }
              onScaffoldPrompt={(prompt) => {
                applyUserRequestChange(prompt);
              }}
            />
            <ContextProtocolControls
              source={publicSource}
              depth={publicDepth}
              onSourceChange={(v) => {
                invalidate();
                setPublicSource(v);
              }}
              onDepthChange={(v) => {
                invalidate();
                setPublicDepth(v);
              }}
              uiMode={mode}
              disabled={busy}
              inspectOutput={contextProtocol}
              refreshNotice={contextRefreshNotice}
            />
            <div className="compile-row">
              <button
                type="button"
                className="spe-build"
                data-ready={Boolean(userRequest.trim()) && !busy ? "true" : "false"}
                disabled={busy || !userRequest.trim()}
                aria-busy={busy}
                onClick={() => void compile()}
              >
                {busy ? ui.working : ui.build}
                <span>↗</span>
              </button>
            </div>
            </div>
            {error && <p role="alert">{error.message}</p>}
            {rendered?.finalPrompt && (
              <section className="spe-create-result" aria-label="Your prompt">
                <h2>Your prompt</h2>
                <pre tabIndex={0}>{rendered.finalPrompt}</pre>
                <div className="spe-actions">
                  <button type="button" className="spe-build" onClick={() => void onCopy()}>
                    Copy prompt
                  </button>
                  <button type="button" className="spe-ghost" onClick={onExportSpe}>
                    Download .spe
                  </button>
                  <button
                    type="button"
                    className="spe-ghost"
                    onClick={() => setView("workspace")}
                  >
                    Open workspace
                  </button>
                </div>
              </section>
            )}
          </section>
        )}

        {view === "lab" && (
          <DailyLab
            onOpenInSpe={(s) => {
              invalidate();
              const idea =
                ("buildPrompt" in s && s.buildPrompt) ||
                ("seedIdea" in s && s.seedIdea) ||
                "";
              setUserRequest(String(idea));
              setCategory(mapLabCategory(s.category));
              setIntent(defaultIntentLens(String(idea)));
              setIntentProvenance("AUTO_DERIVED_INTENT");
              setMode("simple");
              setView("create");
              window.scrollTo(0, 0);
            }}
            onCopyIdea={async (s) => {
              try {
                const idea =
                  ("buildPrompt" in s && s.buildPrompt) ||
                  ("seedIdea" in s && s.seedIdea) ||
                  "";
                await navigator.clipboard.writeText(String(idea));
                setNotice("Idea copied.");
              } catch {
                setNotice("Copy unavailable. Select the idea text to copy it.");
              }
            }}
          />
        )}

        {view === "my-work" && (
          <MyWork
            historyOptIn={historyOptIn}
            setHistoryOptIn={(v) => {
              setHistoryOptIn(v);
              setHistoryOptInState(v);
              setHistory(v ? loadHistory() : []);
            }}
            history={history}
            onClear={() => {
              clearHistory();
              setHistory([]);
            }}
            onStartCreate={() => {
              invalidate();
              setView("create");
            }}
            onOpen={(h) => {
              invalidate();
              setUserRequest(h.user_request);
              setCategory((h.category as CategoryId) || "Writing");
              setTarget((h.target as TargetId) || "any");
              setIntent(defaultIntentLens(h.user_request));
              setIntentProvenance("AUTO_DERIVED_INTENT");
              setMode("simple");
              setView("create");
            }}
          />
        )}

        {view === "privacy" && <PrivacyProof />}

        {view === "workspace" && (
          <>
            <ContextProtocolControls
              source={publicSource}
              depth={publicDepth}
              onSourceChange={(v) => {
                invalidate();
                setPublicSource(v);
              }}
              onDepthChange={(v) => {
                invalidate();
                setPublicDepth(v);
              }}
              uiMode={mode}
              disabled={busy}
              inspectOutput={contextProtocol}
              refreshNotice={contextRefreshNotice}
            />
            <Workspace
              userRequest={userRequest}
              setUserRequest={(v) => {
                applyUserRequestChange(v);
              }}
              category={category}
              setCategory={(v) => {
                invalidate();
                setCategory(v);
              }}
              target={target}
              setTarget={(v) => {
                invalidate();
                setTarget(v);
              }}
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
              <h2 id="hist-mini" className="spe-kicker">
                Saved ideas
              </h2>
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
                  Save a history of ideas on this device
                </span>
              </label>
              <div className="spe-actions">
                <button
                  type="button"
                  className="spe-ghost"
                  disabled={!historyOptIn}
                  onClick={() => {
                    clearHistory();
                    setHistory([]);
                  }}
                >
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
                      invalidate();
                      setUserRequest(h.user_request);
                      setCategory((h.category as CategoryId) || "Writing");
                      setTarget((h.target as TargetId) || "any");
                      setIntent(defaultIntentLens(h.user_request));
                      setIntentProvenance("AUTO_DERIVED_INTENT");
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

      {updateAvailable && (
        <div className="update-notice" role="status">
          A newer version is ready. Export your brief before reloading.
          <button onClick={() => window.location.reload()}>
            Reload update
          </button>
          <button
            aria-label="Dismiss update notice"
            onClick={() => setUpdateAvailable(false)}
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      <footer className="spe-footer">
        <div>
          <strong>SPE</strong> System Prompt Engine · Your intent, carried
          forward.
        </div>
        <nav className="spe-footer-links" aria-label="Footer">
          <a href={pathForView("home")}>Home</a>
          <a href={pathForView("create")}>Create</a>
          <a href={pathForView("code")}>Code</a>
          <a href={pathForView("lab")}>Daily Lab</a>
          <a href={pathForView("my-work")}>My Work</a>
          <a href={pathForView("privacy")}>Privacy</a>
        </nav>
        <div className="claim-strip">
          {ui.claim}
          <details data-copy-depth="PROOF">
            <summary>About this preview</summary>
            <p>{ui.claimDetail}</p>
          </details>
        </div>
      </footer>
    </>
  );
}
