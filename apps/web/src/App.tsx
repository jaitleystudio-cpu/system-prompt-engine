import { ui } from "@spe/human-perspective";
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { EngineClient } from "./engine/client";
import {
  requestK3Binding,
  requireBoundEffectPlan,
  K3EffectUnavailableError,
} from "./engine/k3Transport";
import { requestQualityReceipt } from "./engine/qualityTransport";
import {
  deliveryForBrief,
  deliveryForEngineDown,
  deliveryForK3Down,
  deliveryForQualityMiss,
  bindEffectiveSurfaces,
  deliveryForReceipt,
} from "./engine/delivery-policy.mjs";
import {
  synthesizeSystemPrompt,
  DEFAULT_DEPTH_TIER,
  type DepthTier,
} from "./engine/promptSynthesizer";
import { MarkdownExportButton } from "./engine/markdownExport";
import { fromK3QualityRequest } from "./engine/quality-request.mjs";
import { createRawRequestCustody, renderSafeFallbackPrompt } from "./engine/core-b.mjs";
import { QualityReceiptPanel } from "./workspace/QualityReceiptPanel";
import { getServiceWorkerSafe } from "./engine/pwaSafe";
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
import { focusMainAfterNavigation } from "./a11y/focusOnView";
import { Nav } from "./layout/Nav";
import {
  navigateTo,
  resolveRoute,
  type AppView,
} from "./routing";
import { InAppLink } from "./shell/inAppLink";
import { WEBSITE_MOUNT } from "./shell/mountStatus";
import { NotFound } from "./shell/NotFound";
import { SkipLink } from "./shell/SkipLink";
import { EMPTY_IDEA_MESSAGE } from "./shell/shellGuards";
import { FeaturesHub } from "./engine/FeaturesHub";
import { PromptRadarInspector } from "./engine/PromptRadarInspector";
import { SeoHead } from "./ui/SeoHead";
import { DotPattern } from "./ui/DotPattern";
import { SeoContent } from "./landing/SeoContent";
import { Hero } from "./landing/Hero";
import { ValueComparisonMatrix } from "./landing/ValueComparisonMatrix";
import { HomeQuiet } from "./landing/HomeQuiet";
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
import {
  acquisitionSeedFromLabItem,
  type LabAcquisitionSeed,
} from "./lab/labAcquisition";
import { MyWork } from "./pages/MyWork";
import { PrivacyProof } from "./pages/PrivacyProof";
import { Capabilities } from "./pages/Capabilities";
import {
  AgentExportTabs,
  formatForAgent,
  type AgentFormatId,
} from "./components/AgentExportTabs";
import { AgentSimulatorPanel } from "./components/AgentSimulatorPanel";
import { BeforeAfterDiffSlider } from "./landing/BeforeAfterDiffSlider";
import { DeveloperRoiCalculator } from "./components/DeveloperRoiCalculator";
import { SpeUniverseHero } from "./landing/SpeUniverseHero";
import { SpeCapabilityDeck } from "./landing/SpeCapabilityDeck";
import { SpeStorytellingCinema } from "./landing/SpeStorytellingCinema";
import { SubmitWorkflowModal } from "./components/SubmitWorkflowModal";
import { detectVisualQuality, type VisualQuality } from "./scene/quality";
import type { SceneState } from "./scene/SpeIntelligence";
import { registerServiceWorker } from "./pwa";

const WebsiteProduct = lazy(() =>
  import("./website/WebsiteProduct").then((m) => ({ default: m.WebsiteProduct }))
);
const MediaRoute = lazy(() =>
  import("./media/MediaRoute").then((m) => ({ default: m.MediaRoute }))
);
const OcrRoute = lazy(() =>
  import("./media/OcrRoute").then((m) => ({ default: m.OcrRoute }))
);
const ResearchRoute = lazy(() =>
  import("./research/ResearchRoute").then((m) => ({ default: m.ResearchRoute }))
);
const DailyLab = lazy(() =>
  import("./lab/DailyLab").then((m) => ({ default: m.DailyLab }))
);
const WorkflowsCatalog = lazy(() =>
  import("./pages/WorkflowsCatalog").then((m) => ({ default: m.WorkflowsCatalog }))
);
const SkillBuilderStudio = lazy(() =>
  import("./pages/SkillBuilderStudio").then((m) => ({ default: m.SkillBuilderStudio }))
);
const HeadToHeadCompare = lazy(() =>
  import("./pages/HeadToHeadCompare").then((m) => ({ default: m.HeadToHeadCompare }))
);
const Pricing = lazy(() =>
  import("./pages/Pricing").then((m) => ({ default: m.Pricing }))
);

type View = AppView;
type Mode = "simple" | "inspect" | "pro";
type Lens = "prompt" | "intent" | "changes" | "techniques" | "artifact";
/** Intent lens provenance — SIMPLE/CREATE rederive; INSPECT/PRO preserve edits. */
type IntentProvenance = "AUTO_DERIVED_INTENT" | "USER_EDITED_INTENT";
type IntentLensState = ReturnType<typeof defaultIntentLens>;

function readInitialRoute(): { view: View; notFound: boolean } {
  if (typeof window === "undefined") return { view: "home", notFound: false };
  const resolved = resolveRoute(window.location.pathname);
  if (resolved.kind === "not-found") return { view: "home", notFound: true };
  return { view: resolved.view, notFound: false };
}

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
  const initialRoute = readInitialRoute();
  const [view, setViewState] = useState<View>(initialRoute.view);
  const [notFound, setNotFound] = useState(initialRoute.notFound);
  const setView = useCallback((next: View, opts: { replace?: boolean } = {}) => {
    setNotFound(false);
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
  const [depthTier, setDepthTier] = useState<DepthTier>(DEFAULT_DEPTH_TIER);
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
  const [rawIrPrompt, setRawIrPrompt] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<SpeArtifactV1 | null>(null);
  const [safeFallback, setSafeFallback] = useState<{ prompt: string } | null>(null);
  const [qualityView, setQualityView] = useState<{
    validation: string | null;
    disposition: string | null;
    proofClass: string | null;
  } | null>(null);
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
  const [agentFormat, setAgentFormat] = useState<AgentFormatId>("standard");
  const [submitWorkflowOpen, setSubmitWorkflowOpen] = useState(false);

  const activePromptView = useMemo(() => {
    if (!rendered?.finalPrompt) return "";
    return formatForAgent(rendered.finalPrompt, agentFormat, category).content;
  }, [rendered?.finalPrompt, agentFormat, category]);

  useEffect(() => {
    // Sync history state without wiping ?specimen= (Batch G deep-link).
    // Unknown paths stay put. They must not be rewritten to Home.
    const applyPath = (pathname: string) => {
      const resolved = resolveRoute(pathname);
      if (resolved.kind === "not-found") {
        setNotFound(true);
        return;
      }
      setNotFound(false);
      setViewState(resolved.view);
      if (window.location.pathname !== resolved.canonicalPath) {
        navigateTo(resolved.view, { replace: true });
      } else {
        window.history.replaceState(
          { view: resolved.view },
          "",
          window.location.pathname + window.location.search,
        );
      }
    };
    applyPath(window.location.pathname);
    const onPop = () => applyPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    registerServiceWorker();
    const sw = getServiceWorkerSafe();
    let hadController = Boolean(sw?.controller);
    const onControllerChange = () => {
      if (hadController) setUpdateAvailable(true);
      hadController = true;
    };
    sw?.addEventListener(
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
      sw?.removeEventListener(
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

  const isInitialMount = useRef(true);
  useEffect(() => {
    focusMainAfterNavigation(isInitialMount);
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
    setRawIrPrompt(null);
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

  const handleSelectDepthTier = useCallback(
    (newTier: DepthTier) => {
      setDepthTier(newTier);
      if (rawIrPrompt) {
        const updated = synthesizeSystemPrompt(rawIrPrompt, {
          target,
          category,
          depthTier: newTier,
        });
        setRendered((prev) => (prev ? { ...prev, finalPrompt: updated } : prev));
      }
    },
    [rawIrPrompt, target, category],
  );

  const handleSelectTarget = useCallback(
    (newTarget: TargetId) => {
      setTarget(newTarget);
      if (rawIrPrompt) {
        const updated = synthesizeSystemPrompt(rawIrPrompt, {
          target: newTarget,
          category,
          depthTier,
        });
        setRendered((prev) => (prev ? { ...prev, finalPrompt: updated } : prev));
      }
    },
    [rawIrPrompt, category, depthTier],
  );

  const compile = useCallback(
    async (requestText?: string) => {
      const rawUser = requestText ?? userRequest;
      const validationView = rawUser.trim();
      if (!validationView) {
        setError({
          code: "EMPTY_BRIEF",
          message: EMPTY_IDEA_MESSAGE,
        });
        return;
      }
      const goal = rawUser;
      const lensState = requestText ? defaultIntentLens(rawUser) : intent;
      if (requestText) {
        setUserRequest(rawUser);
        setIntent(lensState);
      }

      const requestRevision = ++revision.current;
      setBusy(true);
      setError(null);
      setResult(null);
      setRendered(null);
      setRawIrPrompt(null);
      setArtifact(null);
      setSafeFallback(null);
      setQualityView(null);
      setPhases([]);
      setPhase("loading_wasm");
      setLens("prompt");

      let fixture: Record<string, unknown>;
      try {
        fixture = buildAbiFixture({
          userRequest: rawUser,
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

      let custody: Awaited<ReturnType<typeof createRawRequestCustody>> | null = null;
      try {
        custody = await createRawRequestCustody({
          rawRequest: goal,
          target: target === "any" ? null : target,
        });
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
        if (out.error) {
          throw new Error(out.error.message || "ENGINE_UNAVAILABLE");
        }
        if (!out.result)
          throw new Error("The engine returned no result. Please retry.");
        setError(out.error);
        setResult(out.result);
        setPhases(out.phases);
        setSha256(out.sha256);
        setImports(out.imports);
        setPhase(out.error ? "unavailable" : "done");

        if (!out.error && out.result) {
          const k3 = await requestK3Binding(client, fixture, category, rawUser);
          const bound = requireBoundEffectPlan(k3);
          const prompt = renderPromptArtifact({
            userRequest: rawUser,
            target,
            category,
            envelopeOutput: out.result.output,
            techniques: bound.techniques,
            effectPlan: bound.effectPlan,
          });
          let qualityOut: unknown = null;
          try {
            qualityOut = await requestQualityReceipt(
              client,
              fromK3QualityRequest(k3.rawOutput, prompt.finalPrompt),
            );
          } catch {
            qualityOut = null;
          }
          const decision = qualityOut
            ? deliveryForReceipt(qualityOut)
            : deliveryForQualityMiss();
          const surfaces = (bindEffectiveSurfaces(prompt.finalPrompt, qualityOut), bindEffectiveSurfaces(prompt.finalPrompt, qualityOut, {
            target,
            category,
            depthTier,
          }));
          const shown = { ...prompt, finalPrompt: surfaces.display };
          setRendered(shown);
          setRawIrPrompt(prompt.finalPrompt);
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
            rendered_prompt: surfaces.artifactPrompt,
            intent: {
              confirmed: lensState.confirmed,
              assumed: lensState.assumed,
              unknowns: lensState.unknowns,
              conflicts: lensState.conflicts,
            },
          });
          if (requestRevision !== revision.current) return;
          setArtifact(spe);
          const receiptRecord = (qualityOut ?? {}) as {
            receipt?: { verdict?: string; proof_class?: string };
            quality_delta?: { disposition?: string };
          };
          setQualityView({
            validation: decision.validation,
            disposition: receiptRecord.quality_delta?.disposition ?? null,
            proofClass: receiptRecord.receipt?.proof_class ?? null,
          });
          setSafeFallback(null);
          if (isHistoryOptIn()) {
            saveHistoryItem({
              id: spe.integrity.content_sha256.slice(0, 16),
              saved_at_utc: spe.created_at_utc,
              user_request: goal,
              category,
              target,
              prompt_preview: surfaces.historyPreview,
              artifact: spe,
            });
            setHistory(loadHistory());
          }
        }
      } catch (err) {
        if (requestRevision !== revision.current) return;
        const decision =
          err instanceof PromptBriefError
            ? deliveryForBrief()
            : err instanceof K3EffectUnavailableError
              ? deliveryForK3Down()
              : deliveryForEngineDown();
        if (!(err instanceof PromptBriefError)) {
          clientRef.current?.terminate();
          clientRef.current = null;
        }
        setResult(null);
        setRendered(null);
        setArtifact(null);
        setQualityView(null);
        if (decision.fallback && custody) {
          setSafeFallback(renderSafeFallbackPrompt(custody, "ENGINE_UNAVAILABLE"));
        } else {
          setSafeFallback(null);
        }
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
    [userRequest, intent, category, target, depthTier, publicSource, publicDepth],
  );

  const onCopy = async () => {
    const textToCopy = activePromptView || rendered?.finalPrompt;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
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

  const runWorkflowInStudio = (wf: {
    title: string;
    summary: string;
    topSkills: string[];
    inputs?: string[];
    outputs?: string[];
    permissionCeiling?: string;
  }) => {
    invalidate();
    const briefParts = [
      wf.title,
      "",
      wf.summary,
      "",
      `Required skills: ${wf.topSkills.map((s) => `@skill/${s}`).join(", ")}`,
    ];
    if (wf.inputs && wf.inputs.length > 0) {
      briefParts.push(`Input files: ${wf.inputs.join(", ")}`);
    }
    if (wf.outputs && wf.outputs.length > 0) {
      briefParts.push(`Expected outputs: ${wf.outputs.join(", ")}`);
    }
    if (wf.permissionCeiling) {
      briefParts.push(`Safety boundary & constraints: ${wf.permissionCeiling}`);
    }
    setUserRequest(briefParts.join("\n"));
    setCategory("Business");
    setIntent(defaultIntentLens(wf.summary));
    setIntentProvenance("AUTO_DERIVED_INTENT");
    setView("create");
    window.scrollTo(0, 0);
  };

  return (
    <>
      <SkipLink />
      <SeoHead
        view={view}
        unlisted={
          notFound ||
          view === "workspace" ||
          view === "my-work" ||
          view === "website" ||
          view === "media" ||
          view === "ocr" ||
          view === "research"
        }
        notFound={notFound}
      />
      <Nav
        scrolled={scrolled || view !== "home"}
        view={notFound ? null : view}
        onNavigate={setView}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        savedCount={history.length}
        onSubmitWorkflow={() => setSubmitWorkflowOpen(true)}
      />

      <main id="main" tabIndex={-1}>
        {notFound ? (
          <NotFound
            path={
              typeof window === "undefined" ? "" : window.location.pathname
            }
            onNavigate={setView}
          />
        ) : view === "home" && (
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
              onNavigate={setView}
            />
            <SpeCapabilityDeck onNavigate={setView} />
            <SpeUniverseHero onNavigate={setView} />
            <SpeStorytellingCinema onNavigate={setView} />
            {rendered?.finalPrompt && (
              <div style={{ maxWidth: "1200px", margin: "1.5rem auto", padding: "0 1.5rem" }}>
                <PromptRadarInspector
                  promptText={rendered.finalPrompt}
                  rawIrPrompt={rawIrPrompt ?? undefined}
                  activeTarget={target}
                  activeDepthTier={depthTier}
                  onSelectTarget={handleSelectTarget}
                  onSelectDepthTier={handleSelectDepthTier}
                  onNavigate={setView}
                />
              </div>
            )}
            <BeforeAfterDiffSlider onNavigate={setView} />
            <DeveloperRoiCalculator onNavigate={setView} />
            <div style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}>
              <FeaturesHub currentView="home" onNavigate={setView} />
            </div>
            <ValueComparisonMatrix onNavigate={setView} />
            <HomeQuiet
              onCreate={() => {
                setView("create");
                window.scrollTo(0, 0);
              }}
              onCode={() => {
                setView("code");
                window.scrollTo(0, 0);
              }}
            />
            <SeoContent onNavigate={setView} />
          </>
        )}

        {!notFound && (view === "create" || view === "code") && (
          <section className="spe-create" aria-labelledby="create-title">
            <DotPattern surface="create" />
            <FeaturesHub currentView={view} onNavigate={setView} />
            <header className="spe-create-head">
              <p className="spe-kicker">{view === "code" ? "Code" : "Create"}</p>
              <h1 id="create-title">
                {view === "code"
                  ? "Screenshot to code"
                  : "Build a clearer prompt"}
              </h1>
              {view === "create" ? (
                <p className="spe-create-thought">
                  Write the task, say what the result should look like, then
                  build. Extra sources stay optional.
                </p>
              ) : (
                <ol className="spe-code-steps">
                  <li>
                    <strong>What you upload.</strong> A clear screenshot of the
                    screen you want to start from.
                  </li>
                  <li>
                    <strong>What happens next.</strong> SPE notes the layout it
                    can see and offers starter scaffolds you can compare.
                  </li>
                  <li>
                    <strong>What you receive.</strong> An implementation prompt
                    and structured starter scaffolds for a coding AI or tool —
                    starting points, not a finished or compiled app.
                  </li>
                </ol>
              )}
              <p>
                {view === "code"
                  ? "Targets you can compare as prompt scaffolds: HTML, React, SwiftUI, Jetpack Compose, Flutter, or React Native. SPE does not compile these targets in-product."
                  : "You can type, speak, add a picture, a short video, or a web page. Your words stay in the idea while you switch."}
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
            {safeFallback && (
              <section className="spe-create-result" aria-label="Safe fallback">
                <QualityReceiptPanel receipt={null} fallback />
                <pre tabIndex={0}>{safeFallback.prompt}</pre>
                <button
                  type="button"
                  className="spe-build"
                  onClick={() => void navigator.clipboard.writeText(safeFallback.prompt)}
                >
                  Copy
                </button>
              </section>
            )}
            {rendered?.finalPrompt && (
              <section className="spe-create-result" aria-label="Your prompt">
                <h2>Your prompt</h2>
                <AgentExportTabs
                  promptText={rendered.finalPrompt}
                  category={category}
                  activeFormat={agentFormat}
                  onFormatChange={setAgentFormat}
                  onCopyNotice={(msg) => setNotice(msg)}
                />
                <pre tabIndex={0}>{activePromptView}</pre>
                <AgentSimulatorPanel promptText={rendered.finalPrompt} category={category} />
                <div style={{ margin: "1rem 0" }}>
                  <PromptRadarInspector
                    promptText={rendered.finalPrompt}
                    rawIrPrompt={rawIrPrompt ?? undefined}
                    activeTarget={target}
                    activeDepthTier={depthTier}
                    onSelectTarget={handleSelectTarget}
                    onSelectDepthTier={handleSelectDepthTier}
                    onNavigate={setView}
                  />
                </div>
                <QualityReceiptPanel receipt={qualityView} fallback={false} />
                <div className="spe-actions">
                  <button type="button" className="spe-build" onClick={() => void onCopy()}>
                    Copy
                  </button>
                  <button
                    type="button"
                    className="spe-ghost"
                    onClick={onExportSpe}
                    disabled={!artifact}
                  >
                    .spe
                  </button>
                  <button type="button" className="spe-ghost" onClick={onExportJson}>
                    JSON
                  </button>
                  <button type="button" className="spe-ghost" onClick={onExportPdf}>
                    PDF
                  </button>
                  <MarkdownExportButton
                    promptText={rendered?.finalPrompt || ""}
                    rawIrPrompt={rawIrPrompt}
                    category={category}
                    depthTier={depthTier}
                    sha256={sha256}
                    disabled={!rendered?.finalPrompt}
                  />
                  <button
                    type="button"
                    className="spe-ghost"
                    onClick={() => setView("workspace")}
                  >
                    Open workspace
                  </button>
                </div>
                <ul className="spe-export-help">
                  <li>Copy puts the prompt on your clipboard.</li>
                  <li>.spe saves a file you can reopen here later.</li>
                  <li>JSON saves the same work as plain data.</li>
                  <li>
                    Print / Save PDF is for printing. It does not restore the
                    prompt.
                  </li>
                </ul>
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

        {!notFound && view === "lab" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
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
          </Suspense>
        )}

        {!notFound && view === "website" && (
          <div
            data-shell-mount="website"
            data-shell-mount-sha={WEBSITE_MOUNT.sha}
          >
            <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
              <WebsiteProduct />
            </Suspense>
          </div>
        )}

        {!notFound && view === "media" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <MediaRoute />
          </Suspense>
        )}
        {!notFound && view === "ocr" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <OcrRoute />
          </Suspense>
        )}
        {!notFound && view === "research" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <ResearchRoute />
          </Suspense>
        )}

        {!notFound && view === "my-work" && (
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

        {!notFound && view === "capabilities" && <Capabilities onNavigate={setView} />}
        {!notFound && view === "privacy" && <PrivacyProof />}
        {!notFound && view === "workflows" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <WorkflowsCatalog
              onNavigate={setView}
              onRunWorkflow={runWorkflowInStudio}
              onSubmitWorkflow={() => setSubmitWorkflowOpen(true)}
            />
          </Suspense>
        )}
        {!notFound && view === "skill-builder" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <SkillBuilderStudio />
          </Suspense>
        )}
        {!notFound && view === "compare" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <HeadToHeadCompare />
          </Suspense>
        )}
        {!notFound && view === "pricing" && (
          <Suspense fallback={<div className="spe-route-loading" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>}>
            <Pricing onNavigate={setView} />
          </Suspense>
        )}

        {!notFound && view === "workspace" && (
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
              rawIrPrompt={rawIrPrompt}
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
              activeDepthTier={depthTier}
              onSelectDepthTier={handleSelectDepthTier}
              onNavigate={setView}
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
        <div style={{ marginBottom: "1.5rem" }}>
          <strong>SPE</strong> System Prompt Engine · Your intent, carried
          forward.
        </div>
        <div className="spe-footer-grid">
          <div className="spe-footer-col">
            <h3>Products</h3>
            <InAppLink view="create" onNavigate={setView}>Prompt Studio</InAppLink>
            <InAppLink view="workflows" onNavigate={setView}>1-Click Workflows</InAppLink>
            <InAppLink view="skill-builder" onNavigate={setView}>Skill Builder</InAppLink>
            <InAppLink view="compare" onNavigate={setView}>Benchmark Arena</InAppLink>
          </div>
          <div className="spe-footer-col">
            <h3>Tools & Labs</h3>
            <InAppLink view="code" onNavigate={setView}>Design to Code</InAppLink>
            <InAppLink view="website" onNavigate={setView}>Web Architect</InAppLink>
            <InAppLink view="media" onNavigate={setView}>Audio & Video</InAppLink>
            <InAppLink view="ocr" onNavigate={setView}>OCR & Documents</InAppLink>
            <InAppLink view="research" onNavigate={setView}>Deep Research</InAppLink>
            <InAppLink view="lab" onNavigate={setView}>Daily Lab</InAppLink>
          </div>
          <div className="spe-footer-col">
            <h3>Trust & Privacy</h3>
            <InAppLink view="capabilities" onNavigate={setView}>Mathematical Proofs</InAppLink>
            <InAppLink view="privacy" onNavigate={setView}>Zero-Egress Guarantee</InAppLink>
            <InAppLink view="my-work" onNavigate={setView}>Local Workspace</InAppLink>
          </div>
          <div className="spe-footer-col">
            <h3>Plans</h3>
            <InAppLink view="pricing" onNavigate={setView}>Developer Pricing</InAppLink>
            <InAppLink view="home" onNavigate={setView}>Overview</InAppLink>
          </div>
        </div>
        <div className="claim-strip">
          {ui.claim}
        </div>
      </footer>

      <SubmitWorkflowModal
        isOpen={submitWorkflowOpen}
        onClose={() => setSubmitWorkflowOpen(false)}
        onNavigate={setView}
      />
    </>
  );
}
