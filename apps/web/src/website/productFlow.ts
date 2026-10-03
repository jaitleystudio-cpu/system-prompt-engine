/**
 * R3-D website product flow.
 *
 * Reuses the existing local TypeScript website-spec/1 compiler
 * (apps/web/src/builder/websiteSpecModel.ts). This module does not
 * emit HTML itself and does not start a second generator or a 3D engine.
 *
 * The canonical Python packages stay the library authority:
 * packages/website-generator and spe_runtime.webrecon. The browser
 * cannot import them. This flow does not fetch, and it does not claim
 * AI generation, SceneIR, or live URL reconstruction.
 */
import {
  WebsiteCompileError,
  compileWebsiteSpecToStaticHtml,
  toStandaloneDocument,
  type WebsiteSpec,
} from "../builder/websiteSpecModel.ts";

export const AI_GENERATION = "NOT_AVAILABLE" as const;
export const SCENE_3D = "NOT_AVAILABLE" as const;
export const LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE" as const;
export const HOSTED_PUBLISH = "HOLD" as const;
export const SANDBOX = "UNSUPPORTED" as const;
export const SCENE_IR_WIRED = false as const;
export const WEBGL_CONTEXT_LOSS_DISPOSAL =
  "NOT_APPLICABLE_SCENE_IR_NOT_WIRED" as const;
export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;
export const COMPILER_REUSED = "LOCAL_TS_WEBSITE_SPEC_1" as const;

export type WebsiteInput =
  | { kind: "website_spec"; spec: unknown }
  | { kind: "local_saved_html"; filename: string; html: string }
  | { kind: "live_url"; url: string };

export type WebsiteFlowResult = {
  status: "LOCAL_EXPORT_READY" | "REJECTED" | "REFUSED";
  sourceKind: WebsiteInput["kind"];
  networkPerformed: false;
  fetchedUrl: false;
  localSavedHtmlIsLiveUrl: false;
  aiGeneration: typeof AI_GENERATION;
  scene3d: typeof SCENE_3D;
  liveUrlReconstruction: typeof LIVE_URL_RECONSTRUCTION;
  hostedPublish: typeof HOSTED_PUBLISH;
  sandbox: typeof SANDBOX;
  sceneIrWired: false;
  webglContextLossDisposal: typeof WEBGL_CONTEXT_LOSS_DISPOSAL;
  compiler: typeof COMPILER_REUSED;
  reasons: string[];
  previewHtml: string | null;
  exportHtml: string | null;
  reducedMotion: boolean;
  contentSecurityPolicy: boolean;
};

const ACTIVE_DOCUMENT =
  /<\s*script\b|javascript\s*:|vbscript\s*:|<\s*iframe\b|<\s*object\b|<\s*embed\b|\son[a-z]+\s*=/i;
const REMOTE_URL = /https?:\/\//i;

function base(kind: WebsiteInput["kind"]): WebsiteFlowResult {
  return {
    status: "REFUSED",
    sourceKind: kind,
    networkPerformed: false,
    fetchedUrl: false,
    localSavedHtmlIsLiveUrl: false,
    aiGeneration: AI_GENERATION,
    scene3d: SCENE_3D,
    liveUrlReconstruction: LIVE_URL_RECONSTRUCTION,
    hostedPublish: HOSTED_PUBLISH,
    sandbox: SANDBOX,
    sceneIrWired: false,
    webglContextLossDisposal: WEBGL_CONTEXT_LOSS_DISPOSAL,
    compiler: COMPILER_REUSED,
    reasons: [],
    previewHtml: null,
    exportHtml: null,
    reducedMotion: false,
    contentSecurityPolicy: false,
  };
}

function isWebsiteSpec(value: unknown): value is WebsiteSpec {
  if (!value || typeof value !== "object") return false;
  const spec = value as Partial<WebsiteSpec>;
  return spec.spec_version === "website-spec/1" && Array.isArray(spec.pages);
}

/**
 * input -> spec -> generated site -> preview -> deterministic export.
 * Local saved HTML is not a live URL. Live URLs are not fetched.
 */
export function runWebsiteProduct(input: WebsiteInput): WebsiteFlowResult {
  if (input.kind === "live_url") {
    const result = base("live_url");
    result.status = "REFUSED";
    result.reasons = ["LIVE_URL_NOT_FETCHED", "NO_ACQUISITION_GRANT"];
    return result;
  }

  if (input.kind === "local_saved_html") {
    const result = base("local_saved_html");
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
      result.reasons = ["SPEC_EMPTY"];
      return result;
    }
    if (trimmed.startsWith("<")) {
      result.status = "REJECTED";
      result.reasons = ["HTML_IS_NOT_A_WEBSITE_SPEC"];
      return result;
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      result.status = "REJECTED";
      result.reasons = ["SPEC_JSON_INVALID"];
      return result;
    }
  }
  if (!isWebsiteSpec(parsed)) {
    result.status = "REJECTED";
    result.reasons = ["SPEC_SHAPE_REFUSED"];
    return result;
  }
  const active = parsed.pages[0]?.path;
  if (!active) {
    result.status = "REJECTED";
    result.reasons = ["SPEC_HAS_NO_PAGE"];
    return result;
  }
  try {
    const compiled = compileWebsiteSpecToStaticHtml(parsed, active);
    const repeated = compileWebsiteSpecToStaticHtml(parsed, active);
    if (compiled.html !== repeated.html || compiled.css !== repeated.css) {
      result.status = "REJECTED";
      result.reasons = ["EXPORT_NOT_DETERMINISTIC"];
      return result;
    }
    const standalone = toStandaloneDocument(compiled.html, compiled.css);
    const again = toStandaloneDocument(repeated.html, repeated.css);
    if (standalone !== again) {
      result.status = "REJECTED";
      result.reasons = ["EXPORT_NOT_DETERMINISTIC"];
      return result;
    }
    if (!standalone.includes('http-equiv="Content-Security-Policy"')) {
      result.status = "REJECTED";
      result.reasons = ["CSP_MISSING"];
      return result;
    }
    if (!compiled.css.includes("prefers-reduced-motion")) {
      result.status = "REJECTED";
      result.reasons = ["REDUCED_MOTION_MISSING"];
      return result;
    }
    if (/<\s*script\b/i.test(standalone)) {
      result.status = "REJECTED";
      result.reasons = ["SCRIPT_ELEMENT_REFUSED"];
      return result;
    }
    result.status = "LOCAL_EXPORT_READY";
    result.reasons = ["STATIC_FILES_ONLY"];
    result.previewHtml = standalone;
    result.exportHtml = standalone;
    result.reducedMotion = true;
    result.contentSecurityPolicy = true;
    return result;
  } catch (error) {
    result.status = "REJECTED";
    result.reasons = [
      error instanceof WebsiteCompileError ? error.message : "SPEC_COMPILE_REFUSED",
    ];
    return result;
  }
}
