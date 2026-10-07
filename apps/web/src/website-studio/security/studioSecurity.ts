/**
 * SPE-R9-G — Website Studio surface security hardening.
 *
 * Covers URL/content injection, XSS (SVG/HTML sinks), export package safety,
 * and resource/DoS bounds for new Studio surfaces. Fail-closed.
 */
import { isSsrfSafeUrl } from "../../engine/multimodal/urlSecurity.ts";

/** Align with media MAX_HTML_BYTES for reference HTML ingestion. */
export const MAX_STUDIO_HTML_BYTES = 2 * 1024 * 1024;
/** Hard cap for portable .spe-site JSON packages. */
export const MAX_STUDIO_PACKAGE_BYTES = 8 * 1024 * 1024;
/** Cap for accessibility SVG markup rendered via innerHTML. */
export const MAX_STUDIO_SVG_BYTES = 64 * 1024;
/** Match product-flow scene object DoS gate. */
export const MAX_STUDIO_SCENE_OBJECTS = 256;
/** Bound string-template transform payloads. */
export const MAX_STUDIO_STRING_TEMPLATE_LEN = 4_096;
/** Cap data bindings on a single project. */
export const MAX_STUDIO_DATA_BINDINGS = 256;

const ACTIVE_DOCUMENT =
  /<\s*script\b|javascript\s*:|vbscript\s*:|<\s*iframe\b|<\s*object\b|<\s*embed\b|<\s*foreignObject\b|\son[a-z]+\s*=/i;
const REMOTE_URL = /https?:\/\//i;
const DATA_URL = /data\s*:/i;
const INERT_SVG_NAMESPACE =
  /\bxmlns(?::[a-zA-Z0-9_-]+)?=['"]http:\/\/www\.w3\.org\/2000\/svg['"]/gi;

export const FORBIDDEN_PROTO_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export class StudioSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioSecurityError";
  }
}

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  // Node fallback without importing buffer (keeps browser-safe).
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function assertNoPrototypePollutionKey(key: string | number): void {
  const normalized = String(key);
  if (FORBIDDEN_PROTO_KEYS.has(normalized)) {
    throw new StudioSecurityError("PROTOTYPE_POLLUTION_REFUSED");
  }
}

/**
 * Refuse active document markup / script URLs in Studio-controlled strings.
 * Inert SVG xmlns declarations are stripped before remote-URL checks so
 * legitimate accessibility fallbacks remain allowed.
 */
/**
 * Refuse script/handler injection without banning inert remote URL mentions
 * (e.g. stylesheet hrefs in observed reference HTML that is never executed).
 */
export function assertNoActiveStudioMarkup(
  value: string,
  where = "content",
): string {
  if (typeof value !== "string") {
    throw new StudioSecurityError(`${where}: STUDIO_CONTENT_TYPE_REFUSED`);
  }
  if (ACTIVE_DOCUMENT.test(value)) {
    throw new StudioSecurityError(`MALICIOUS_STUDIO_CONTENT_REFUSED:${where}`);
  }
  return value;
}

export function assertSafeStudioContent(
  value: string,
  where = "content",
): string {
  if (typeof value !== "string") {
    throw new StudioSecurityError(`${where}: STUDIO_CONTENT_TYPE_REFUSED`);
  }
  const stripped = value.replace(INERT_SVG_NAMESPACE, "");
  if (
    ACTIVE_DOCUMENT.test(value) ||
    REMOTE_URL.test(stripped) ||
    DATA_URL.test(stripped)
  ) {
    throw new StudioSecurityError(`MALICIOUS_STUDIO_CONTENT_REFUSED:${where}`);
  }
  return value;
}

/**
 * Sanitize accessibility SVG before dangerouslySetInnerHTML.
 * Allows inert local SVG only; refuses scripts, handlers, remote/data URLs.
 */
export function sanitizeStudioSvg(svg: string): string {
  if (typeof svg !== "string" || !svg.trim()) {
    throw new StudioSecurityError("STUDIO_SVG_EMPTY");
  }
  if (utf8ByteLength(svg) > MAX_STUDIO_SVG_BYTES) {
    throw new StudioSecurityError("STUDIO_SVG_TOO_LARGE");
  }
  const trimmed = svg.trim();
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) {
    throw new StudioSecurityError("STUDIO_SVG_SHAPE_REFUSED");
  }
  assertSafeStudioContent(trimmed, "hero2dSvg");
  return trimmed;
}

/**
 * PUBLIC_FETCH / reference URL gate — reuses canonical SSRF validator.
 */
export function assertSafeStudioFetchUrl(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new StudioSecurityError("STUDIO_URL_REQUIRED");
  }
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new StudioSecurityError("STUDIO_URL_UNPARSEABLE");
  }
  const check = isSsrfSafeUrl(parsed);
  if (!check.safe) {
    throw new StudioSecurityError(
      `STUDIO_URL_SSRF_REFUSED:${check.reason || "UNSAFE"}`,
    );
  }
  return trimmed;
}

export function assertStudioHtmlBounds(html: string): void {
  if (typeof html !== "string") {
    throw new StudioSecurityError("STUDIO_HTML_TYPE_REFUSED");
  }
  if (utf8ByteLength(html) > MAX_STUDIO_HTML_BYTES) {
    throw new StudioSecurityError("STUDIO_HTML_TOO_LARGE");
  }
}

export function assertStudioPackageBounds(raw: string): void {
  if (typeof raw !== "string") {
    throw new StudioSecurityError("STUDIO_PACKAGE_TYPE_REFUSED");
  }
  if (raw.length === 0) {
    throw new StudioSecurityError("STUDIO_PACKAGE_EMPTY");
  }
  if (utf8ByteLength(raw) > MAX_STUDIO_PACKAGE_BYTES) {
    throw new StudioSecurityError("STUDIO_PACKAGE_TOO_LARGE");
  }
}

export function assertStudioSceneObjectBounds(count: number): void {
  if (!Number.isFinite(count) || count < 0) {
    throw new StudioSecurityError("STUDIO_SCENE_COUNT_INVALID");
  }
  if (count > MAX_STUDIO_SCENE_OBJECTS) {
    throw new StudioSecurityError("STUDIO_SCENE_TOO_LARGE");
  }
}

export function assertStudioDataBindingBounds(count: number): void {
  if (!Number.isFinite(count) || count < 0) {
    throw new StudioSecurityError("STUDIO_BINDING_COUNT_INVALID");
  }
  if (count > MAX_STUDIO_DATA_BINDINGS) {
    throw new StudioSecurityError("STUDIO_BINDINGS_TOO_MANY");
  }
}

export function assertStudioStringTemplateBounds(template: string): void {
  if (typeof template !== "string") {
    throw new StudioSecurityError("STUDIO_TEMPLATE_TYPE_REFUSED");
  }
  if (template.length > MAX_STUDIO_STRING_TEMPLATE_LEN) {
    throw new StudioSecurityError("STUDIO_TEMPLATE_TOO_LARGE");
  }
  assertSafeStudioContent(template, "string-template");
}

/**
 * JSON.parse with prototype-pollution key refusal (export import path).
 */
export function safeStudioJsonParse(raw: string): unknown {
  assertStudioPackageBounds(raw);
  return JSON.parse(raw, (key, value) => {
    if (key !== "" && FORBIDDEN_PROTO_KEYS.has(key)) {
      throw new StudioSecurityError("PROTOTYPE_POLLUTION_REFUSED");
    }
    return value;
  });
}

/** Default inert SVG used when a fallback is missing or refused at render time. */
export const INERT_STUDIO_FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0b0d12"/></svg>';

/**
 * Render-time SVG resolver: sanitize when present; otherwise inert default.
 * Never throws into React render — returns inert fallback on refusal.
 */
export function resolveStudioHeroSvg(raw: string | undefined | null): string {
  if (!raw) return INERT_STUDIO_FALLBACK_SVG;
  try {
    return sanitizeStudioSvg(raw);
  } catch {
    return INERT_STUDIO_FALLBACK_SVG;
  }
}
