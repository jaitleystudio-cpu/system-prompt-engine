/**
 * R3-D website product flow.
 *
 * Reuses the existing local TypeScript website-spec/1 compiler
 * (apps/web/src/builder/websiteSpecModel.ts). This module does not
 * emit HTML itself and does not start a second generator or a 3D engine.
 *
 * Optional 3D uses the canonical MM-5 SceneCompiler owner
 * (apps/web/src/engine/multimodal/sceneCompiler.ts) sourced from
 * c08c6929ad57885a3d16eb10f1cd07b2a5ed4949. Decorative SpeIntelligence
 * orbs are not SceneIR.
 *
 * The canonical Python packages stay the library authority:
 * packages/website-generator and spe_runtime.webrecon. The browser
 * cannot import them. This flow does not fetch. Live URL reconstruction
 * stays unavailable unless a real allowed network path executes.
 */
import {
  WebsiteCompileError,
  compileWebsiteSpecToStaticHtml,
  toStandaloneDocument,
  type WebsiteSpec,
} from "../builder/websiteSpecModel.ts";
import {
  SceneCompiler,
  type Scene3DCompilationResult,
  type SceneIR,
} from "../engine/multimodal/sceneOwner.ts";

export const AI_GENERATION = "NOT_AVAILABLE" as const;
/** Module-level label: SceneIR owner is wired; per-run status is on the result. */
export const SCENE_3D = "OWNER_WIRED" as const;
export const LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE" as const;
export const HOSTED_PUBLISH = "HOLD" as const;
export const SANDBOX = "UNSUPPORTED" as const;
export const SCENE_IR_WIRED = true as const;
export const SCENE_IR_OWNER_PATH =
  "apps/web/src/engine/multimodal/sceneCompiler.ts" as const;
export const SCENE_IR_SOURCE_SHA =
  "c08c6929ad57885a3d16eb10f1cd07b2a5ed4949" as const;
export const WEBGL_CONTEXT_LOSS_DISPOSAL = "NOT_IMPLEMENTED" as const;
export const WEBGL_EXECUTION = "NOT_RUN" as const;
export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;
export const COMPILER_REUSED = "LOCAL_TS_WEBSITE_SPEC_1" as const;
export const SHELL_MOUNT = "NOT_DONE" as const;

export type WebsiteInput =
  | { kind: "website_spec"; spec: unknown; sceneDefinition?: unknown }
  | { kind: "local_saved_html"; filename: string; html: string }
  | { kind: "live_url"; url: string };

export type WebsiteFlowResult = {
  status: "LOCAL_EXPORT_READY" | "REJECTED" | "REFUSED";
  sourceKind: WebsiteInput["kind"];
  networkPerformed: false;
  fetchedUrl: false;
  localSavedHtmlIsLiveUrl: false;
  aiGeneration: typeof AI_GENERATION;
  scene3d: "AVAILABLE" | "NOT_AVAILABLE" | "OWNER_WIRED" | "REJECTED";
  liveUrlReconstruction: typeof LIVE_URL_RECONSTRUCTION;
  hostedPublish: typeof HOSTED_PUBLISH;
  sandbox: typeof SANDBOX;
  sceneIrWired: true;
  sceneIrOwnerPath: typeof SCENE_IR_OWNER_PATH;
  sceneIrSourceSha: typeof SCENE_IR_SOURCE_SHA;
  webglContextLossDisposal: typeof WEBGL_CONTEXT_LOSS_DISPOSAL;
  shellMount: typeof SHELL_MOUNT;
  compiler: typeof COMPILER_REUSED;
  reasons: string[];
  previewHtml: string | null;
  exportHtml: string | null;
  sceneHtml: string | null;
  sceneId: string | null;
  sceneTriangles: number | null;
  reducedMotion: boolean;
  contentSecurityPolicy: boolean;
  scrollTracksSupported: boolean;
  contextLossRecoverySupported: boolean;
  contextRestoredSupported: boolean;
  disposeSupported: boolean;
  webglExecution: typeof WEBGL_EXECUTION;
};

const ACTIVE_DOCUMENT =
  /<\s*script\b|javascript\s*:|vbscript\s*:|<\s*iframe\b|<\s*object\b|<\s*embed\b|\son[a-z]+\s*=/i;
const REMOTE_URL = /https?:\/\//i;
const ALLOWED_GEOMETRY = new Set([
  "box",
  "sphere",
  "cylinder",
  "plane",
  "torus",
  "wave-mesh",
]);
const sceneCompiler = new SceneCompiler();

function base(kind: WebsiteInput["kind"]): WebsiteFlowResult {
  return {
    status: "REFUSED",
    sourceKind: kind,
    networkPerformed: false,
    fetchedUrl: false,
    localSavedHtmlIsLiveUrl: false,
    aiGeneration: AI_GENERATION,
    scene3d: "OWNER_WIRED",
    liveUrlReconstruction: LIVE_URL_RECONSTRUCTION,
    hostedPublish: HOSTED_PUBLISH,
    sandbox: SANDBOX,
    sceneIrWired: true,
    sceneIrOwnerPath: SCENE_IR_OWNER_PATH,
    sceneIrSourceSha: SCENE_IR_SOURCE_SHA,
    webglContextLossDisposal: WEBGL_CONTEXT_LOSS_DISPOSAL,
    shellMount: SHELL_MOUNT,
    compiler: COMPILER_REUSED,
    reasons: [],
    previewHtml: null,
    exportHtml: null,
    sceneHtml: null,
    sceneId: null,
    sceneTriangles: null,
    reducedMotion: false,
    contentSecurityPolicy: false,
    scrollTracksSupported: false,
    contextLossRecoverySupported: false,
    contextRestoredSupported: false,
    disposeSupported: false,
    webglExecution: WEBGL_EXECUTION,
  };
}

function isWebsiteSpec(value: unknown): value is WebsiteSpec {
  if (!value || typeof value !== "object") return false;
  const spec = value as Partial<WebsiteSpec>;
  return spec.spec_version === "website-spec/1" && Array.isArray(spec.pages);
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out);
    }
  }
}

function gateSceneDefinition(
  raw: unknown,
): { ok: true; ir: SceneIR } | { ok: false; reasons: string[] } {
  if (raw == null) {
    return { ok: false, reasons: ["SCENE_DEFINITION_MISSING"] };
  }
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, reasons: ["SCENE_JSON_INVALID"] };
    }
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, reasons: ["SCENE_SHAPE_REFUSED"] };
  }
  const strings: string[] = [];
  collectStrings(raw, strings);
  for (const s of strings) {
    if (ACTIVE_DOCUMENT.test(s) || REMOTE_URL.test(s)) {
      return { ok: false, reasons: ["MALICIOUS_SCENEIR_REFUSED"] };
    }
  }
  const ir = raw as SceneIR;
  const validation = sceneCompiler.validateSceneIR(ir);
  if (!validation.valid) {
    const zeroObjects =
      !ir.objects || (Array.isArray(ir.objects) && ir.objects.length === 0);
    return {
      ok: false,
      reasons: zeroObjects
        ? ["SCENE_ZERO_OBJECTS", ...validation.errors]
        : ["SCENEIR_VALIDATION_FAILED", ...validation.errors],
    };
  }
  for (const obj of ir.objects) {
    if (!ALLOWED_GEOMETRY.has(obj.geometry?.type)) {
      return { ok: false, reasons: ["SCENE_INVALID_GEOMETRY"] };
    }
  }
  if (ir.objects.length > 256) {
    return { ok: false, reasons: ["SCENE_TOO_LARGE"] };
  }
  return { ok: true, ir };
}

function attachScene(result: WebsiteFlowResult, compiled: Scene3DCompilationResult): void {
  result.scene3d = compiled.status === "AVAILABLE" ? "AVAILABLE" : "NOT_AVAILABLE";
  result.sceneHtml = compiled.standaloneHtml;
  result.sceneId = compiled.sceneId;
  result.sceneTriangles = compiled.totalTriangles;
  result.scrollTracksSupported = compiled.standaloneHtml.includes("scrollRatio");
  result.contextLossRecoverySupported = compiled.contextLossRecoverySupported;
  result.contextRestoredSupported = compiled.contextLossRecoverySupported;
  result.webglExecution = compiled.webglExecution;
  result.disposeSupported =
    compiled.standaloneHtml.includes("beforeunload") &&
    compiled.standaloneHtml.includes(".dispose()");
  if (!compiled.reducedMotionSupported) {
    result.status = "REJECTED";
    result.reasons = ["SCENE_REDUCED_MOTION_MISSING"];
    result.sceneHtml = null;
    result.scene3d = "REJECTED";
  }
}

/**
 * input -> spec -> generated site -> preview -> optional SceneIR 3D -> export.
 * Local saved HTML is not a live URL. Live URLs are not fetched.
 */
export function runWebsiteProduct(input: WebsiteInput): WebsiteFlowResult {
  if (input.kind === "live_url") {
    const result = base("live_url");
    result.status = "REFUSED";
    result.scene3d = "NOT_AVAILABLE";
    result.reasons = ["LIVE_URL_NOT_FETCHED", "NO_ACQUISITION_GRANT"];
    return result;
  }

  if (input.kind === "local_saved_html") {
    const result = base("local_saved_html");
    result.scene3d = "NOT_AVAILABLE";
    const html = String(input.html ?? "");
    if (!input.filename.trim() || !html.trim()) {
      result.status = "REJECTED";
      result.reasons = ["LOCAL_DOCUMENT_EMPTY"];
      return result;
    }
    if (ACTIVE_DOCUMENT.test(html) || REMOTE_URL.test(html)) {
      result.status = "REJECTED";
      result.reasons = ["MALICIOUS_OR_REMOTE_MARKUP_REFUSED"];
      return result;
    }
    result.status = "REFUSED";
    result.reasons = ["LOCAL_SAVED_HTML_IS_NOT_A_SPEC", "RAW_DOCUMENT_NOT_REPLAYED"];
    return result;
  }

  const result = base("website_spec");
  let parsed: unknown = input.spec;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) {
      result.status = "REJECTED";
      result.scene3d = "NOT_AVAILABLE";
      result.reasons = ["SPEC_EMPTY"];
      return result;
    }
    if (trimmed.startsWith("<")) {
      result.status = "REJECTED";
      result.scene3d = "NOT_AVAILABLE";
      result.reasons = ["HTML_IS_NOT_A_WEBSITE_SPEC"];
      return result;
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      result.status = "REJECTED";
      result.scene3d = "NOT_AVAILABLE";
      result.reasons = ["SPEC_JSON_INVALID"];
      return result;
    }
  }
  if (!isWebsiteSpec(parsed)) {
    result.status = "REJECTED";
    result.scene3d = "NOT_AVAILABLE";
    result.reasons = ["SPEC_SHAPE_REFUSED"];
    return result;
  }
  const active = parsed.pages[0]?.path;
  if (!active) {
    result.status = "REJECTED";
    result.scene3d = "NOT_AVAILABLE";
    result.reasons = ["SPEC_HAS_NO_PAGE"];
    return result;
  }

  let sceneCompiled: Scene3DCompilationResult | null = null;
  if (input.sceneDefinition !== undefined) {
    const gated = gateSceneDefinition(input.sceneDefinition);
    if (!gated.ok) {
      result.status = "REJECTED";
      result.scene3d = "REJECTED";
      result.reasons = gated.reasons;
      return result;
    }
    try {
      sceneCompiled = sceneCompiler.compile(gated.ir);
    } catch (error) {
      result.status = "REJECTED";
      result.scene3d = "REJECTED";
      result.reasons = [
        error instanceof Error ? error.message : "SCENE_COMPILE_REFUSED",
      ];
      return result;
    }
  }

  try {
    const compiled = compileWebsiteSpecToStaticHtml(parsed, active);
    const repeated = compileWebsiteSpecToStaticHtml(parsed, active);
    if (compiled.html !== repeated.html || compiled.css !== repeated.css) {
      result.status = "REJECTED";
      result.scene3d = sceneCompiled ? "AVAILABLE" : "NOT_AVAILABLE";
      result.reasons = ["EXPORT_NOT_DETERMINISTIC"];
      return result;
    }
    const standalone = toStandaloneDocument(compiled.html, compiled.css);
    const again = toStandaloneDocument(repeated.html, repeated.css);
    if (standalone !== again) {
      result.status = "REJECTED";
      result.scene3d = sceneCompiled ? "AVAILABLE" : "NOT_AVAILABLE";
      result.reasons = ["EXPORT_NOT_DETERMINISTIC"];
      return result;
    }
    if (!standalone.includes('http-equiv="Content-Security-Policy"')) {
      result.status = "REJECTED";
      result.scene3d = sceneCompiled ? "AVAILABLE" : "NOT_AVAILABLE";
      result.reasons = ["CSP_MISSING"];
      return result;
    }
    if (!compiled.css.includes("prefers-reduced-motion")) {
      result.status = "REJECTED";
      result.scene3d = sceneCompiled ? "AVAILABLE" : "NOT_AVAILABLE";
      result.reasons = ["REDUCED_MOTION_MISSING"];
      return result;
    }
    if (/<\s*script\b/i.test(standalone)) {
      result.status = "REJECTED";
      result.scene3d = sceneCompiled ? "AVAILABLE" : "NOT_AVAILABLE";
      result.reasons = ["SCRIPT_ELEMENT_REFUSED"];
      return result;
    }
    result.status = "LOCAL_EXPORT_READY";
    result.reasons = sceneCompiled
      ? ["STATIC_FILES_ONLY", "SCENEIR_OPTIONAL_ATTACHED"]
      : ["STATIC_FILES_ONLY"];
    result.previewHtml = standalone;
    result.exportHtml = standalone;
    result.reducedMotion = true;
    result.contentSecurityPolicy = true;
    result.scene3d = "NOT_AVAILABLE";
    if (sceneCompiled) {
      attachScene(result, sceneCompiled);
      if (result.status === "REJECTED") return result;
      // Website one-file export stays the CSP static document.
      // Optional SceneIR one-file export is sceneHtml from the owner.
    }
    return result;
  } catch (error) {
    result.status = "REJECTED";
    result.scene3d = sceneCompiled ? "AVAILABLE" : "NOT_AVAILABLE";
    result.reasons = [
      error instanceof WebsiteCompileError ? error.message : "SPEC_COMPILE_REFUSED",
    ];
    return result;
  }
}
