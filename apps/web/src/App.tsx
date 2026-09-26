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
  buildLocalExecutionRecord,
  buildSpeArtifact,
  clearHistory,
  defaultIntentLens,
  downloadJson,
  isHistoryOptIn,
  loadHistory,
  openArtifactPrintView,
  parseSpeArtifactText,
  renderPromptArtifact,
  PromptBriefError,
  saveHistoryItem,
  setHistoryOptIn,
  CATEGORIES,
  type CategoryId,
  type HistoryItem,
  type IntentAtom,
  type LocalExecutionRecord,
  type ReconstructionReport,
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
import { DotPattern } from "./ui/DotPattern";
import { SeoContent } from "./landing/SeoContent";
import { Hero } from "./landing/Hero";
import { ScrollStory } from "./landing/ScrollStory";
import { Workspace } from "./workspace/Workspace";
import { ReconstructionSummary } from "./workspace/ReconstructionSummary";
import { ExecutionContractPanel } from "./workspace/ExecutionContractPanel";
import { UnifiedComposer } from "./composer/UnifiedComposer";
import { SourcesDepthDisclosure } from "./composer/SourcesDepthDisclosure";
import {
  ContextProtocolControls,
  mapPublicSourceToWasm,
  suggestStaleContextRefresh,
  type PublicDepthControl,
  type PublicSourceControl,
} from "./composer/ContextProtocolControls";
import { DailyLab } from "./lab/DailyLab";
import {
  acquisitionSeedFromLabItem,
  type LabAcquisitionSeed,
} from "./lab/labAcquisition";
import { MyWork } from "./pages/MyWork";
import { PrivacyProof } from "./pages/PrivacyProof";
import { Capabilities } from "./pages/Capabilities";
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

function intentFromArtifact(
  artifactIntent: SpeArtifactV1["intent"],
): IntentLensState {
  return Object.fromEntries(
    Object.entries(artifactIntent).map(([bucket, values]) => [
      bucket,
      values.map((atom) => ({
        ...atom,
        kind:
          bucket === "unknowns"
            ? "unknown"
            : bucket === "conflicts"
              ? "conflict"
              : bucket === "assumed"
                ? "assumed"
                : "confirmed",
      })),
    ]),
  ) as IntentLensState;
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
  const [executionRecord, setExecutionRecord] =
    useState<LocalExecutionRecord | null>(null);
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [contextRefreshNotice, setContextRefreshNotice] = useState<string | null>(
    null,
  );
  const [reconstruction, setReconstruction] =
    useState<ReconstructionReport | null>(null);
  const [labAcquisition, setLabAcquisition] =
    useState<LabAcquisitionSeed | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    // Sync history state without wiping ?specimen= (Batch G deep-link).
    const pathView = viewFromPath(window.location.pathname);
    if (window.location.pathname !== pathForView(pathView)) {
      navigateTo(pathView, { replace: true });
    } else {
      window.history.replaceState(
        { view: pathView },
        "",
        window.location.pathname + window.location.search,
      );
    }
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
    setExecutionRecord(null);
    setDryRunBusy(false);
    setContextRefreshNotice(null);
  };

  /** Daily Lab / Prompt Gallery → Create: single acquisition apply path. */
  const applyLabAcquisition = (item: Parameters<typeof acquisitionSeedFromLabItem>[0]) => {
    const seed = acquisitionSeedFromLabItem(item);
    invalidate();
    setUserRequest(seed.userRequest);
    setCategory(mapLabCategory(seed.categoryRaw));
    let lens = defaultIntentLens(seed.userRequest);
    if (seed.desiredOutputSeed) {
      const existing = lens.confirmed.find((a) => a.id === "desired-output")?.text?.trim();
      if (!existing) {
        lens = {
          ...lens,
          confirmed: lens.confirmed.map((a) =>
            a.id === "desired-output"
              ? { ...a, text: seed.desiredOutputSeed as string }
              : a,
          ),
        };
      }
    }
    setIntent(lens);
    setIntentProvenance(seed.intentProvenance);
    setMode(seed.mode);
    setLabAcquisition(seed);
    setView("create");
    window.scrollTo(0, 0);
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
              artifact: spe,
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

  const onExportPdf = () => {
    if (!artifact) return;
    const opened = openArtifactPrintView(artifact);
    setNotice(
      opened
        ? "Print view opened. Choose Save as PDF in your browser."
        : "The print view was blocked. Allow pop-ups, then try again.",
    );
  };

  const restorePortableArtifact = (
    restoredArtifact: SpeArtifactV1,
    report: ReconstructionReport,
    destination: "workspace" | "create",
  ) => {
    invalidate();
    setArtifact(restoredArtifact);
    setExecutionRecord(restoredArtifact.execution_record ?? null);
    const ext = restoredArtifact as SpeArtifactV1 & {
      context_protocol?: { freshness_state?: string };
      quality_record?: { freshness_state?: string };
    };
    const freshness =
      ext.context_protocol?.freshness_state ??
      ext.quality_record?.freshness_state ??
      null;
    const refresh = suggestStaleContextRefresh({
      freshness_state: freshness,
      user_request: restoredArtifact.user_request,
      protected_intent: restoredArtifact.intent,
    });
    setContextRefreshNotice(refresh?.message ?? null);
    setUserRequest(restoredArtifact.user_request);
    setCategory((restoredArtifact.category as CategoryId) || "Writing");
    setTarget((restoredArtifact.target as TargetId) || "any");
    setIntent(intentFromArtifact(restoredArtifact.intent));
    setIntentProvenance("USER_EDITED_INTENT");
    setRendered({
      userRequest: restoredArtifact.user_request,
      speAdded: [],
      finalPrompt: restoredArtifact.rendered_prompt,
      review: null,
      techniques: [],
    });
    setEnvelope(restoredArtifact.envelope);
    setReconstruction(report);
    setView(destination);
    setMode(destination === "workspace" ? "inspect" : "simple");
    setLens(destination === "workspace" ? "artifact" : "prompt");
    setNotice(
      "Portable details restored. Review the summary before rebuilding.",
    );
  };

  const onImportSpe = async (file: File) => {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const message =
        "PDF import is not supported. Use a .spe file or SPE JSON export to restore protected details.";
      setReconstruction({
        status: "error",
        title: "PDF import not supported",
        message,
        restored: [],
        notRestored: ["Request, protected details, prompt, and provenance"],
        warnings: ["Nothing from the PDF was treated as structured SPE data."],
      });
      setNotice(message);
      return;
    }
    try {
      const restored = await parseSpeArtifactText(await file.text());
      restorePortableArtifact(
        restored.artifact,
        restored.report,
        "workspace",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "This file could not be restored. Nothing was changed.";
      setReconstruction({
        status: "error",
        title: "Nothing was restored",
        message,
        restored: [],
        notRestored: ["Request, protected details, prompt, and provenance"],
        warnings: ["The current work remains unchanged."],
      });
      setNotice(message);
    }
  };

  const onOpenHistoryItem = async (item: HistoryItem) => {
    if (item.artifact) {
      try {
        const restored = await parseSpeArtifactText(
          JSON.stringify(item.artifact),
        );
        restorePortableArtifact(
          restored.artifact,
          restored.report,
          "create",
        );
        return;
      } catch {
        // Fall through to the bounded legacy restore below.
      }
    }
    invalidate();
    setUserRequest(item.user_request);
    setCategory((item.category as CategoryId) || "Writing");
    setTarget((item.target as TargetId) || "any");
    setIntent(defaultIntentLens(item.user_request));
    setIntentProvenance("AUTO_DERIVED_INTENT");
    setReconstruction({
      status: "partial",
      title: "Idea reopened with limits",
      message:
        "This older local history item contains the request, category, and target only. Review and rebuild before using it.",
      restored: ["Original request", "Category", "Target"],
      notRestored: [
        "Protected details, including Desired Output and Example",
        "Rendered prompt",
        "Envelope, provenance, lineage, and integrity",
        "Media previews or uploaded files",
      ],
      warnings: [
        "Missing fields were left empty. SPE did not infer them from the saved preview.",
      ],
    });
    setMode("simple");
    setView("create");
    setNotice("Older history item reopened with limited details.");
  };

  const onRunLocalDry = async () => {
    if (!artifact || !contextProtocol || dryRunBusy) return;
    setDryRunBusy(true);
    try {
      const record = await buildLocalExecutionRecord({
        artifact,
        protocolOutput: contextProtocol,
        buildSha: __SPE_BUILD_SHA__,
      });
      const updatedArtifact = await buildSpeArtifact({
        user_request: artifact.user_request,
        category: artifact.category,
        target: artifact.target,
        envelope: artifact.envelope,
        wasm: artifact.wasm,
        rendered_prompt: artifact.rendered_prompt,
        intent: artifact.intent,
        execution_record: record,
        created_at_utc: artifact.created_at_utc,
      });
      setExecutionRecord(record);
      setArtifact(updatedArtifact);
      if (isHistoryOptIn()) {
        saveHistoryItem({
          id: updatedArtifact.integrity.content_sha256.slice(0, 16),
          saved_at_utc: updatedArtifact.created_at_utc,
          user_request: updatedArtifact.user_request,
          category: updatedArtifact.category,
          target: updatedArtifact.target,
          prompt_preview: updatedArtifact.rendered_prompt.slice(0, 240),
          artifact: updatedArtifact,
        });
        setHistory(loadHistory());
      }
      setNotice(
        record.conformance.overall === "FAIL"
          ? "Local checks found a blocked contract. Nothing was executed."
          : "Local dry-run recorded. No target task or side effect was executed.",
      );
    } catch (runError) {
      setNotice(
        runError instanceof Error
          ? runError.message
          : "The local dry-run could not be recorded.",
      );
    } finally {
      setDryRunBusy(false);
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
            <DotPattern surface="create" />
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
            {view === "create" && labAcquisition && (
              <div
                className="spe-acquisition-chip"
                role="status"
                data-acquisition-source={labAcquisition.source}
                data-acquisition-id={labAcquisition.id}
              >
                <span>{labAcquisition.provenanceLabel}</span>
                <button
                  type="button"
                  className="spe-acquisition-dismiss"
                  aria-label="Dismiss acquisition note"
                  onClick={() => setLabAcquisition(null)}
                >
                  Dismiss
                </button>
              </div>
            )}
            {reconstruction && (
              <ReconstructionSummary
                report={reconstruction}
                onDismiss={() => setReconstruction(null)}
              />
            )}
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
            <SourcesDepthDisclosure progressive={view === "create"}>
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
            </SourcesDepthDisclosure>
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
                  <button type="button" className="spe-ghost" onClick={onExportJson}>
                    Download JSON
                  </button>
                  <button type="button" className="spe-ghost" onClick={onExportPdf}>
                    Print / Save PDF
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
            {view === "create" && (contextProtocol || executionRecord) && (
              <ExecutionContractPanel
                protocolOutput={contextProtocol}
                artifact={artifact}
                record={executionRecord}
                busy={dryRunBusy}
                onRunDry={() => void onRunLocalDry()}
                initialPresentation={mode === "simple" ? "simple" : "inspect"}
              />
            )}
          </section>
        )}

        {view === "lab" && (
          <DailyLab
            onOpenInSpe={(s) => {
              applyLabAcquisition(s);
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
              setLabAcquisition(null);
              setView("create");
            }}
            onOpen={(item) => void onOpenHistoryItem(item)}
          />
        )}

        {view === "capabilities" && <Capabilities />}
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
            {(contextProtocol || executionRecord) && (
              <section className="spe-workspace">
                <ExecutionContractPanel
                  protocolOutput={contextProtocol}
                  artifact={artifact}
                  record={executionRecord}
                  busy={dryRunBusy}
                  onRunDry={() => void onRunLocalDry()}
                  initialPresentation={mode === "simple" ? "simple" : "inspect"}
                />
              </section>
            )}
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
              onExportPdf={onExportPdf}
              onImportSpe={(f) => void onImportSpe(f)}
              reconstruction={reconstruction}
              onDismissReconstruction={() => setReconstruction(null)}
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
                    onClick={() => void onOpenHistoryItem(h)}
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
          <a href={pathForView("capabilities")}>Capabilities</a>
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
