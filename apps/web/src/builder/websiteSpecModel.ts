/**
 * Lane A11-S / R2-WEB-W: Static Website Builder Model
 *
 * Local TypeScript emitter for website-spec/1 shaped specs.
 * Truth: this is NOT a binding to the G13 Python package
 * `packages/website-generator` (absent from this lineage). Safety
 * mirrors G13 compiler invariants where ported: html escape,
 * SAFE_HREF, PAGE_PATH refuse.
 *
 * Mandatory Truth Boundaries:
 * - AI generation = NOT AVAILABLE
 * - 3D = NOT AVAILABLE
 * - sandbox = UNSUPPORTED
 * - hosted publish = HOLD
 * - ROUTE_MOUNT_STATUS = NOT_INTEGRATED
 */

export interface WebsiteSection {
  kind: "hero" | "prose" | "list" | "cta";
  heading: string;
  body?: string;
  items?: string[];
  cta_label?: string;
  cta_href?: string;
}

export interface WebsitePage {
  /** Runtime-enforced: ^[a-z0-9][a-z0-9-]*\.html$ */
  path: string;
  title: string;
  sections: WebsiteSection[];
}

export interface WebsiteSpec {
  spec_version: "website-spec/1";
  title: string;
  language?: string;
  summary?: string;
  theme?: "dark" | "light";
  emitter?: "static-html-css";
  metadata?: {
    visibility?: "private" | "public";
  };
  pages: WebsitePage[];
}

export class WebsiteCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebsiteCompileError";
  }
}

/** G13-aligned page path pattern. */
export const PAGE_PATH = /^[a-z0-9][a-z0-9-]*\.html$/;

/**
 * G13-aligned same-site href: optional page.html + optional #fragment.
 * Refuses network, script, and path-escape links.
 */
export const SAFE_HREF =
  /^(?:[a-z0-9][a-z0-9-]*\.html)?(?:#[a-z0-9][a-z0-9-]*)?$/;

export const AI_GENERATION = "NOT_AVAILABLE" as const;
export const SCENE_3D = "NOT_AVAILABLE" as const;
export const SANDBOX = "UNSUPPORTED" as const;
export const HOSTED_PUBLISH = "HOLD" as const;
export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;
export const PRODUCT_INTEGRATED = false as const;

/** Truth label: local TS compiler, not G13 Python package binding. */
export const COMPILER_BINDING = "LOCAL_TS_WEBSITE_SPEC_1" as const;
export const G13_PACKAGE_BOUND = false as const;

/**
 * HTML escape equivalent to Python html.escape(..., quote=True).
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function assertPagePath(path: string, where = "path"): string {
  if (!path || !PAGE_PATH.test(path)) {
    throw new WebsiteCompileError(
      `${where} must match ^[a-z0-9][a-z0-9-]*\\.html$ (got ${JSON.stringify(path)})`,
    );
  }
  if (path.includes("..") || path.includes("/") || path.includes("\\") || path.includes(":")) {
    throw new WebsiteCompileError(`${where} refuses path-escape or separator: ${path}`);
  }
  return path;
}

/**
 * Fail-closed SAFE_HREF check (G13 _safe_href port).
 * Optional knownPages: if provided, page portion must be in the set.
 */
export function assertSafeHref(
  value: string,
  where = "cta_href",
  knownPages?: ReadonlySet<string>,
): string {
  if (!value || value === "#" || !SAFE_HREF.test(value)) {
    throw new WebsiteCompileError(
      `${where} must be a same-site page or fragment. Network, script, and path-escape links are refused (got ${JSON.stringify(value)})`,
    );
  }
  if (value.includes("://") || value.startsWith("//") || value.includes("..") || value.includes("\\")) {
    throw new WebsiteCompileError(`${where} is refused as a network or escape path`);
  }
  const page = value.split("#", 1)[0];
  if (knownPages && page && !knownPages.has(page)) {
    throw new WebsiteCompileError(`${where} points at unknown page ${page}`);
  }
  return value;
}

export const DEFAULT_WEBSITE_SPEC: WebsiteSpec = {
  spec_version: "website-spec/1",
  title: "SPE Architecture Documentation",
  language: "en",
  summary: "Static site overview and technical specifications.",
  theme: "dark",
  emitter: "static-html-css",
  metadata: {
    visibility: "private",
  },
  pages: [
    {
      path: "index.html",
      title: "Overview",
      sections: [
        {
          kind: "hero",
          heading: "System Prompt Engine Architecture",
          body: "Local prompt compiler and provider-format adaptation concepts.",
          cta_label: "View Specification",
          cta_href: "#specs",
        },
        {
          kind: "prose",
          heading: "System Invariants",
          body: "This example documents local compiler boundaries; network and privacy claims require separate evidence.",
        },
        {
          kind: "list",
          heading: "Supported Static Targets",
          items: [
            "Deterministic static HTML5 & CSS3 layout",
            "Visible focus styles for both themes",
            "Zero client-side JavaScript execution required",
            "Responsive styles include a 360px breakpoint",
          ],
        },
        {
          kind: "cta",
          heading: "Example Call to Action",
          body: "Sample link only. Use Export Spec JSON in the builder to download the editable specification.",
          cta_label: "Example Link",
          cta_href: "#download",
        },
      ],
    },
  ],
};

function renderCtaAnchor(label: string | undefined, href: string | undefined, knownPages: ReadonlySet<string>): string {
  if (!label) return "";
  if (!href) {
    throw new WebsiteCompileError("cta_label present without cta_href");
  }
  const safe = assertSafeHref(href, "cta_href", knownPages);
  return `<a href="${escapeHtml(safe)}" class="site-cta-btn">${escapeHtml(label)}</a>`;
}

/**
 * Deterministic preview compiler emitting standard HTML and CSS from a WebsiteSpec.
 * Fail-closed on PAGE_PATH / SAFE_HREF; all text nodes escaped.
 */
export function compileWebsiteSpecToStaticHtml(
  spec: WebsiteSpec,
  activePagePath = "index.html",
): { html: string; css: string } {
  if (!spec.pages?.length) {
    throw new WebsiteCompileError("pages must contain at least one page");
  }

  const knownPages = new Set<string>();
  for (const p of spec.pages) {
    const pagePath = assertPagePath(p.path, `page.path`);
    if (knownPages.has(pagePath)) {
      throw new WebsiteCompileError(`duplicate page path refused: ${pagePath}`);
    }
    knownPages.add(pagePath);
  }
  assertPagePath(activePagePath, "activePagePath");
  if (!knownPages.has(activePagePath)) {
    throw new WebsiteCompileError(
      `activePagePath is not a page in this spec: ${JSON.stringify(activePagePath)}`,
    );
  }

  const page = spec.pages.find((p) => p.path === activePagePath);
  if (!page) {
    throw new WebsiteCompileError(
      `activePagePath is not a page in this spec: ${JSON.stringify(activePagePath)}`,
    );
  }
  const isDark = spec.theme !== "light";

  const css = `
/* Compiled from website-spec/1 (local TS emitter; not G13 Python package) */
:root {
  --site-bg: ${isDark ? "#090d16" : "#ffffff"};
  --site-surface: ${isDark ? "#111827" : "#f9fafb"};
  --site-text: ${isDark ? "#f9fafb" : "#111827"};
  --site-muted: ${isDark ? "#9ca3af" : "#4b5563"};
  --site-accent: #4338ca;
  --site-focus: ${isDark ? "#bbceff" : "#1e3a8a"};
  --site-border: ${isDark ? "#374151" : "#e5e7eb"};
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--site-bg);
  color: var(--site-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
}

.site-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 20px;
}

.site-section {
  margin-bottom: 48px;
}

.site-hero {
  padding: 48px 0;
  border-bottom: 1px solid var(--site-border);
}

.site-hero h1 {
  font-size: 2.25rem;
  margin: 0 0 16px 0;
  letter-spacing: -0.02em;
}

.site-cta-btn {
  display: inline-block;
  padding: 12px 24px;
  background-color: var(--site-accent);
  color: #ffffff;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  margin-top: 16px;
}

.site-list {
  padding-left: 20px;
}

.site-list li {
  margin-bottom: 8px;
}

.site-cta-btn:focus-visible,
.skip-link:focus-visible {
  outline: 3px solid var(--site-focus);
  outline-offset: 2px;
}

.skip-link {
  position: absolute;
  left: -999px;
  top: 0;
}

.skip-link:focus {
  left: 8px;
  top: 8px;
  background: var(--site-accent);
  color: #ffffff;
  padding: 8px 12px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

@media (max-width: 360px) {
  .site-hero h1 { font-size: 1.75rem; }
  .site-container { padding: 16px 12px; }
}
`.trim();

  const sectionsHtml = page.sections
    .map((sec) => {
      if (sec.kind !== "hero" && sec.kind !== "prose" && sec.kind !== "list" && sec.kind !== "cta") {
        throw new WebsiteCompileError(`unknown section kind ${JSON.stringify(sec.kind)}`);
      }
      if (typeof sec.heading !== "string" || sec.heading.trim() === "") {
        throw new WebsiteCompileError("section heading must be a non-empty string");
      }
      if (sec.body != null && typeof sec.body !== "string") {
        throw new WebsiteCompileError("section body must be a string");
      }
      if (
        sec.items != null &&
        (!Array.isArray(sec.items) || sec.items.some((it) => typeof it !== "string"))
      ) {
        throw new WebsiteCompileError("section items must be an array of strings");
      }
      const heading = escapeHtml(sec.heading);
      const body = sec.body ? `<p>${escapeHtml(sec.body)}</p>` : "";
      switch (sec.kind) {
        case "hero":
          return `
    <header class="site-section site-hero">
      <h1>${heading}</h1>
      ${body}
      ${renderCtaAnchor(sec.cta_label, sec.cta_href, knownPages)}
    </header>`;
        case "prose":
          return `
    <article class="site-section site-prose">
      <h2>${heading}</h2>
      ${body}
    </article>`;
        case "list":
          return `
    <section class="site-section site-list-sec">
      <h2>${heading}</h2>
      ${body}
      <ul class="site-list">
        ${(sec.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join("\n        ")}
      </ul>
    </section>`;
        case "cta":
          return `
    <section class="site-section site-cta">
      <h2>${heading}</h2>
      ${body}
      ${renderCtaAnchor(sec.cta_label, sec.cta_href, knownPages)}
    </section>`;
        default:
          throw new WebsiteCompileError(`unknown section kind ${JSON.stringify(sec.kind)}`);
      }
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(spec.language || "en")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" />
  <title>${escapeHtml(page.title)} - ${escapeHtml(spec.title)}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  <main id="content" class="site-container">
${sectionsHtml}
  </main>
</body>
</html>`.trim();

  return { html, css };
}

/**
 * Single-document export: exactly one doctype/html, CSS inlined.
 * Fixes nested double-document Export HTML / srcDoc malformation.
 */
export function toStandaloneDocument(html: string, css: string): string {
  if (/<\s*\/\s*style/i.test(css) || /<\s*script/i.test(css)) {
    throw new WebsiteCompileError("css refuses style-tag breakout or script");
  }
  if ((html.match(/<!DOCTYPE html>/gi) || []).length !== 1) {
    throw new WebsiteCompileError("expected exactly one doctype in compiled html");
  }
  if (!html.includes('<link rel="stylesheet" href="styles.css"')) {
    throw new WebsiteCompileError("compiled html missing styles.css link for standalone conversion");
  }
  const standalone = html.replace(
    /<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/>/,
    `<style>\n${css}\n</style>`,
  );
  const doctypeCount = (standalone.match(/<!DOCTYPE html>/gi) || []).length;
  const htmlOpen = (standalone.match(/<html\b/gi) || []).length;
  if (doctypeCount !== 1 || htmlOpen !== 1) {
    throw new WebsiteCompileError(
      `standalone must be a single document (doctype=${doctypeCount}, htmlOpen=${htmlOpen})`,
    );
  }
  return standalone;
}

export function downloadFileNameForPagePath(path: string): string {
  return assertPagePath(path, "download.path");
}
