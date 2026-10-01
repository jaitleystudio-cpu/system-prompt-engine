/**
 * Lane A11-S: Static Website Builder Model
 * Strictly maps to G13 WebsiteSpec (website-spec/1).
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
  path: string; // pattern: ^[a-z0-9][a-z0-9-]*\.html$
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

export const AI_GENERATION = "NOT_AVAILABLE" as const;
export const SCENE_3D = "NOT_AVAILABLE" as const;
export const SANDBOX = "UNSUPPORTED" as const;
export const HOSTED_PUBLISH = "HOLD" as const;
export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;
export const PRODUCT_INTEGRATED = false as const;

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
          body: "Deterministic, offline-first prompt compilers and multi-provider adaptation engines.",
          cta_label: "View Specification",
          cta_href: "#specs",
        },
        {
          kind: "prose",
          heading: "System Invariants",
          body: "SPE enforces immutable custody over semantic compiler cores and ensures zero unverified cloud exposure.",
        },
        {
          kind: "list",
          heading: "Supported Static Targets",
          items: [
            "Deterministic static HTML5 & CSS3 layout",
            "Dual-theme WCAG 2.1 AA focus rings",
            "Zero client-side JavaScript execution required",
            "Fluid reflow down to 360px viewport",
          ],
        },
        {
          kind: "cta",
          heading: "Export Static Artifacts",
          body: "Download self-contained offline HTML and CSS bundles directly to your machine.",
          cta_label: "Download Bundle",
          cta_href: "#download",
        },
      ],
    },
  ],
};

/**
 * Deterministic preview compiler emitting standard HTML and CSS from a WebsiteSpec.
 */
export function compileWebsiteSpecToStaticHtml(spec: WebsiteSpec, activePagePath = "index.html"): { html: string; css: string } {
  const page = spec.pages.find((p) => p.path === activePagePath) || spec.pages[0];
  const isDark = spec.theme !== "light";

  const css = `
/* Compiled from website-spec/1 */
:root {
  --site-bg: ${isDark ? "#090d16" : "#ffffff"};
  --site-surface: ${isDark ? "#111827" : "#f9fafb"};
  --site-text: ${isDark ? "#f9fafb" : "#111827"};
  --site-muted: ${isDark ? "#9ca3af" : "#4b5563"};
  --site-accent: #6366f1;
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

@media (max-width: 360px) {
  .site-hero h1 { font-size: 1.75rem; }
  .site-container { padding: 16px 12px; }
}
`.trim();

  const sectionsHtml = page.sections.map((sec) => {
    switch (sec.kind) {
      case "hero":
        return `
    <header class="site-section site-hero">
      <h1>${sec.heading}</h1>
      ${sec.body ? `<p>${sec.body}</p>` : ""}
      ${sec.cta_label ? `<a href="${sec.cta_href || "#"}" class="site-cta-btn">${sec.cta_label}</a>` : ""}
    </header>`;
      case "prose":
        return `
    <article class="site-section site-prose">
      <h2>${sec.heading}</h2>
      ${sec.body ? `<p>${sec.body}</p>` : ""}
    </article>`;
      case "list":
        return `
    <section class="site-section site-list-sec">
      <h2>${sec.heading}</h2>
      ${sec.body ? `<p>${sec.body}</p>` : ""}
      <ul class="site-list">
        ${(sec.items || []).map((it) => `<li>${it}</li>`).join("\n        ")}
      </ul>
    </section>`;
      case "cta":
        return `
    <section class="site-section site-cta">
      <h2>${sec.heading}</h2>
      ${sec.body ? `<p>${sec.body}</p>` : ""}
      ${sec.cta_label ? `<a href="${sec.cta_href || "#"}" class="site-cta-btn">${sec.cta_label}</a>` : ""}
    </section>`;
      default:
        return "";
    }
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="${spec.language || "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${page.title} - ${spec.title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="site-container">
${sectionsHtml}
  </div>
</body>
</html>`.trim();

  return { html, css };
}
