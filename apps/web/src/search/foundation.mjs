/**
 * Search foundation — single registry for indexable and private routes.
 * Browser-safe: string rendering only. No network, no hosting, no engine calls.
 * HOSTING IS NOT AUTHORIZED. These artifacts prepare a future static host.
 */

export const SITE_ORIGIN = "https://systempromptengine.com";
export const SEARCH_REVISION = "2026-09-29";

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;
const APP_ID = `${SITE_ORIGIN}/#software`;

const PUBLIC_SCHEMAS = [
  "Organization",
  "WebSite",
  "SoftwareApplication",
  "WebPage",
  "BreadcrumbList",
];

const ARTICLE_SCHEMAS = [...PUBLIC_SCHEMAS, "Article"];

/** @type {const} */
export const FOOTER_NAV_LABEL = "On this site";
export const NOT_FOUND_VIEW = "not-found";
export const JSONLD_ELEMENT_ID = "spe-jsonld-graph";
export const ROBOTS_META_KEY = "robots";
export const OG_URL_SELECTOR = 'meta[property="og:url"]';

export const NOT_FOUND = {
  title: "Page not found — SPE",
  description: "This address is not a page on System Prompt Engine.",
  h1: "Page not found",
  robotsMeta: "noindex, follow",
  paragraphs: [
    "That address is not part of this site. Use the links below to open a public page.",
  ],
};

/** @type {Array<SearchRoute>} */
export const routes = [
  {
    id: "home",
    path: "/",
    index: true,
    nav: true,
    navLabel: "Home",
    robots: "allow",
    robotsMeta: "index, follow",
    changefreq: "weekly",
    priority: "1.0",
    title: "SPE — System Prompt Engine | Free System Prompt Generator",
    description:
      "Free system prompt generator and AI prompt builder. Turn an idea into meaning, structure, and a precise prompt — privately on this device.",
    h1: "Turn your ideas into clear prompts for any AI.",
    kicker: "System Prompt Engine",
    paragraphs: [
      "Start with a few words. Add what matters. SPE prepares a prompt you can review in this browser.",
    ],
    sections: [
      {
        heading: "The heading on screen",
        paragraphs: [
          "After the page loads, the visible heading may use the day’s featured line. This crawl heading stays the same so the document has one stable title.",
        ],
      },
      {
        heading: "System prompt generator for ideas that need structure",
        paragraphs: [
          "SPE is a free system prompt generator. Start with a rough idea, review the prompt, and choose where to use it. Optional website or media helpers run only when you ask.",
        ],
      },
      {
        heading: "A clear prompt, without another show.",
        paragraphs: [
          "Write what you want to do. SPE keeps your goal, the limits you set, and the questions still open, then shows a prompt you can review before you use it.",
        ],
      },
    ],
    crumbs: [{ name: "Home", path: "/" }],
    schemas: PUBLIC_SCHEMAS,
  },
  {
    id: "create",
    path: "/create",
    index: true,
    nav: true,
    navLabel: "Create",
    robots: "allow",
    robotsMeta: "index, follow",
    changefreq: "weekly",
    priority: "0.9",
    title: "Create a Prompt — SPE Free Prompt Builder",
    description:
      "Shape text, speech, image, video, or a website into a clear system prompt. Your brief stays on this device.",
    h1: "Start with your idea",
    kicker: "Create",
    paragraphs: [
      "Write the task, say what the result should look like, then build. Extra sources stay optional.",
      "You can type, speak, add a picture, a short video, or a web page. Your words stay in the idea while you switch.",
    ],
    sections: [
      {
        heading: "What you can bring",
        paragraphs: [
          "Text, speech, a picture, a short video, or a page reference. SPE does not send the idea to an AI company to prepare the prompt.",
        ],
      },
    ],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Create", path: "/create" },
    ],
    schemas: PUBLIC_SCHEMAS,
  },
  {
    id: "code",
    path: "/code",
    index: true,
    nav: true,
    navLabel: "Code",
    robots: "allow",
    robotsMeta: "index, follow",
    changefreq: "weekly",
    priority: "0.8",
    title: "Screenshot to Code Prompt — SPE Prompt Engineering Tool",
    description:
      "Upload a UI screenshot and get an implementation prompt plus starter scaffolds for HTML, React, SwiftUI, Flutter, and more — for use with a coding AI, not an in-product compiler.",
    h1: "Start from a screenshot",
    kicker: "Code",
    paragraphs: [
      "Targets you can compare as prompt scaffolds: HTML, React, SwiftUI, Jetpack Compose, Flutter, or React Native. SPE does not compile these targets in-product.",
    ],
    sections: [
      {
        heading: "What you upload",
        paragraphs: ["A clear screenshot of the screen you want to start from."],
      },
      {
        heading: "What happens next",
        paragraphs: [
          "SPE notes the layout it can see and offers starter scaffolds you can compare.",
        ],
      },
      {
        heading: "What you receive",
        paragraphs: [
          "An implementation prompt and structured starter scaffolds for a coding AI or tool — starting points, not a finished or compiled app.",
        ],
      },
    ],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Code", path: "/code" },
    ],
    schemas: PUBLIC_SCHEMAS,
  },
  {
    id: "lab",
    path: "/daily-lab",
    index: true,
    nav: true,
    navLabel: "Daily Lab",
    robots: "allow",
    robotsMeta: "index, follow",
    changefreq: "daily",
    priority: "0.7",
    title: "Daily Lab — SPE AI Prompt Generator Ideas",
    description:
      "Browse daily prompt engineering specimens and open them in SPE’s free prompt builder.",
    h1: "Today's prompt",
    kicker: "Daily Lab",
    paragraphs: [
      "A small preview and a prompt seed you can open in Create. The same short list repeats on a schedule. It is not a new random scene each visit.",
    ],
    sections: [
      {
        heading: "Open a specimen in Create",
        paragraphs: [
          "Each specimen is a starting idea. The app adds today’s date to the heading after it loads. This crawl heading stays stable.",
        ],
      },
    ],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Daily Lab", path: "/daily-lab" },
    ],
    schemas: ARTICLE_SCHEMAS,
  },
  {
    id: "capabilities",
    path: "/capabilities",
    index: true,
    nav: true,
    navLabel: "Capabilities",
    robots: "allow",
    robotsMeta: "index, follow",
    changefreq: "weekly",
    priority: "0.8",
    title: "SPE Capabilities — Local Prompt Engine Features",
    description:
      "Honest SPE capabilities: local-first preparation, ProtectedIntent, Execution Contract, provider profiles, and portable .spe files. Research preview — any worldwide top ranking remains unproven.",
    h1: "What SPE can do on this device",
    kicker: "Capabilities",
    paragraphs: [
      "SPE prepares a prompt in your browser, then lets you review it. A worldwide ranking is not proven.",
    ],
    sections: [
      {
        heading: "Local-first preparation",
        paragraphs: [
          "Your brief is shaped in the browser on this device. SPE does not need a cloud AI account to prepare a prompt you can review and reuse.",
        ],
      },
      {
        heading: "ProtectedIntent",
        paragraphs: [
          "Explicit constraints and desired output stay bound to the brief.",
        ],
      },
      {
        heading: "Execution Contract",
        paragraphs: [
          "After compile, SPE can show the contract it produced: goal, protocol depth, hard constraints, planned stages, and authority state.",
        ],
      },
      {
        heading: "Provider profiles",
        paragraphs: [
          "Selection is observational routing only. It does not grant authority, enable network, or release credentials.",
        ],
      },
      {
        heading: "Portable .spe files",
        paragraphs: [
          "Export a portable artifact so you can reopen intent, structure, and the finished prompt later.",
        ],
      },
      {
        heading: "Context Protocol (preview)",
        paragraphs: [
          "Optional public-source depth controls can enrich a brief when you choose them. Failures stay visible.",
        ],
      },
    ],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Capabilities", path: "/capabilities" },
    ],
    schemas: ARTICLE_SCHEMAS,
  },
  {
    id: "privacy",
    path: "/privacy",
    index: true,
    nav: true,
    navLabel: "Privacy",
    robots: "allow",
    robotsMeta: "index, follow",
    changefreq: "monthly",
    priority: "0.6",
    title: "Privacy & Proof — Local System Prompt Engine | SPE",
    description:
      "How SPE prepares prompts on this device, with honest privacy claims for this research preview.",
    h1: "Your thinking stays with you",
    kicker: "Privacy",
    paragraphs: [
      "SPE writes the prompt in this browser. It does not send your idea to an AI company to prepare it.",
    ],
    sections: [
      {
        heading: "Preparation stays local",
        paragraphs: [
          "Your brief is shaped in the browser. SPE does not need a cloud AI account to prepare a prompt you can review and reuse.",
        ],
      },
      {
        heading: "You choose the destination",
        paragraphs: [
          "When a prompt is ready, you decide whether to copy it, download a portable .spe file, or take it to another AI yourself.",
        ],
      },
      {
        heading: "History only if you ask",
        paragraphs: [
          "Optional history stays in this browser’s storage. Turn it off or clear it anytime from My Work.",
        ],
      },
      {
        heading: "No ads, no sale, no silent tracking",
        paragraphs: [
          "This preview does not include analytics, ad tracking, or a sale of your prompts.",
        ],
      },
    ],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Privacy", path: "/privacy" },
    ],
    schemas: ARTICLE_SCHEMAS,
  },
  {
    id: "my-work",
    path: "/my-work",
    index: false,
    nav: true,
    navLabel: "My Work",
    robots: "allow",
    robotsMeta: "noindex, follow",
    changefreq: "monthly",
    priority: "0.1",
    title: "My Work — Saved Prompts on This Device | SPE",
    description:
      "Optional on-device history of ideas and prompts. Nothing is uploaded; SPE keeps your work local.",
    h1: "Ideas on this device",
    kicker: "My Work",
    paragraphs: [
      "Saved work stays on this device unless you export a file. Saving is off until you turn it on.",
    ],
    sections: [
      {
        heading: "Private to this browser",
        paragraphs: [
          "This page is not part of the public index. Search engines may fetch it so they can see the noindex directive.",
        ],
      },
    ],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "My Work", path: "/my-work" },
    ],
    schemas: ["WebPage", "BreadcrumbList"],
  },
  {
    id: "workspace",
    path: "/workspace",
    index: false,
    nav: false,
    navLabel: "Workspace",
    robots: "disallow",
    robotsMeta: "noindex, nofollow",
    changefreq: "monthly",
    priority: "0.0",
    title: "Workspace — Inspect & Refine Prompts | SPE",
    description:
      "Inspect intent, structure, and your finished prompt. Refine and export a portable .spe file.",
    h1: "A space for your next idea",
    kicker: "Workspace",
    paragraphs: [
      "The workspace is a private session for the prompt you are shaping. It is excluded from the public index and from crawlers.",
    ],
    sections: [],
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Workspace", path: "/workspace" },
    ],
    schemas: ["WebPage", "BreadcrumbList"],
  },
];

export const PRIVATE_PREFIXES = [
  {
    path: "/workspace",
    robots: "disallow",
    reason: "Private prompt session. noindex, nofollow, omitted from the sitemap.",
  },
  {
    path: "/models/",
    robots: "disallow",
    reason: "Same-origin model packs. Not documents.",
  },
  {
    path: "/ort/",
    robots: "disallow",
    reason: "Runtime binaries. Not documents.",
  },
  {
    path: "/search/public-index.json",
    robots: "disallow",
    reason: "Operator registry. Not a public document.",
  },
  {
    path: "/search/private-noindex.json",
    robots: "disallow",
    reason: "Operator registry. Not a public document.",
  },
];

/**
 * @typedef {object} SearchSection
 * @property {string} heading
 * @property {string[]} paragraphs
 */

/**
 * @typedef {object} SearchRoute
 * @property {string} id
 * @property {string} path
 * @property {boolean} index
 * @property {boolean} nav
 * @property {string} navLabel
 * @property {"allow" | "disallow"} robots
 * @property {string} robotsMeta
 * @property {string} changefreq
 * @property {string} priority
 * @property {string} title
 * @property {string} description
 * @property {string} h1
 * @property {string} kicker
 * @property {string[]} paragraphs
 * @property {SearchSection[]} sections
 * @property {{ name: string, path: string }[]} crumbs
 * @property {string[]} schemas
 */

export function absoluteUrl(path) {
  if (path === "/" || path === "") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path}`;
}

export function normalizePath(pathname) {
  let path = pathname || "/";
  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(0, hash);
  const query = path.indexOf("?");
  if (query >= 0) path = path.slice(0, query);
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw path */
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export function routeById(id) {
  return routes.find((route) => route.id === id);
}

export function matchRoute(pathname) {
  const path = normalizePath(pathname);
  return routes.find((route) => route.path === path);
}

export function publicIndexRoutes() {
  return routes.filter((route) => route.index);
}

export function privateNoindexRoutes() {
  return routes.filter((route) => !route.index);
}

export function footerLinks() {
  return routes
    .filter((route) => route.nav)
    .map((route) => ({
      id: route.id,
      path: route.path,
      label: route.navLabel,
    }));
}

export function classifyRequestPath(raw) {
  const path = normalizePath(String(raw || "/"));
  if (
    path.startsWith("/@") ||
    path.startsWith("/src/") ||
    path.startsWith("/node_modules/") ||
    path.startsWith("/__")
  ) {
    return { kind: "file", path };
  }
  if (
    path.startsWith("/assets/") ||
    path.startsWith("/models/") ||
    path.startsWith("/ort/") ||
    path.startsWith("/art/") ||
    path.startsWith("/vendor/")
  ) {
    return { kind: "file", path };
  }
  if (/\.[a-z0-9]+$/i.test(path)) return { kind: "file", path };
  const route = routes.find((item) => item.path === path);
  if (route) return { kind: "route", path, route };
  return { kind: "not-found", path };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function jsonScript(data) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json" id="${JSONLD_ELEMENT_ID}">${json}</script>`;
}

function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "System Prompt Engine",
    url: `${SITE_ORIGIN}/`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_ORIGIN}/icon.svg`,
    },
  };
}

function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: "SPE — System Prompt Engine",
    url: `${SITE_ORIGIN}/`,
    description: routeById("home").description,
    publisher: { "@id": ORG_ID },
    inLanguage: "en",
  };
}

function softwareNode() {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: "SPE — System Prompt Engine",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: `${SITE_ORIGIN}/`,
    description: routeById("home").description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    isAccessibleForFree: true,
    publisher: { "@id": ORG_ID },
  };
}

function websiteReference(route) {
  if (route.schemas.includes("WebSite")) return { "@id": SITE_ID };
  return {
    "@type": "WebSite",
    name: "SPE — System Prompt Engine",
    url: `${SITE_ORIGIN}/`,
  };
}

function webPageNode(route) {
  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(route.path)}#webpage`,
    url: absoluteUrl(route.path),
    name: route.title,
    description: route.description,
    isPartOf: websiteReference(route),
    about: route.schemas.includes("SoftwareApplication") ? { "@id": APP_ID } : undefined,
    inLanguage: "en",
    breadcrumb: route.schemas.includes("BreadcrumbList")
      ? { "@id": `${absoluteUrl(route.path)}#breadcrumb` }
      : undefined,
    primaryImageOfPage: route.index
      ? `${SITE_ORIGIN}/icon.svg`
      : undefined,
  };
}

function breadcrumbNode(route) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(route.path)}#breadcrumb`,
    itemListElement: route.crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

function articleNode(route) {
  return {
    "@type": "Article",
    "@id": `${absoluteUrl(route.path)}#article`,
    headline: route.h1,
    description: route.description,
    datePublished: SEARCH_REVISION,
    dateModified: SEARCH_REVISION,
    inLanguage: "en",
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@id": `${absoluteUrl(route.path)}#webpage` },
  };
}

function omitEmpty(node) {
  return Object.fromEntries(
    Object.entries(node).filter(([, value]) => value !== undefined),
  );
}

export function jsonLdGraph(id) {
  if (id === NOT_FOUND_VIEW) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        organizationNode(),
        websiteNode(),
        {
          "@type": "WebPage",
          name: NOT_FOUND.title,
          description: NOT_FOUND.description,
          isPartOf: { "@id": SITE_ID },
          inLanguage: "en",
        },
      ],
    };
  }
  const route = routeById(id);
  if (!route) throw new Error(`unknown search route: ${id}`);
  const graph = [];
  if (route.schemas.includes("Organization")) graph.push(organizationNode());
  if (route.schemas.includes("WebSite")) graph.push(websiteNode());
  if (route.schemas.includes("SoftwareApplication")) graph.push(softwareNode());
  if (route.schemas.includes("WebPage")) graph.push(omitEmpty(webPageNode(route)));
  if (route.schemas.includes("BreadcrumbList")) graph.push(breadcrumbNode(route));
  if (route.schemas.includes("Article")) graph.push(articleNode(route));
  return { "@context": "https://schema.org", "@graph": graph };
}

function metaContent(name, content, attr = "name") {
  return `<meta ${attr}="${escapeHtml(name)}" content="${escapeHtml(content)}" />`;
}

export function renderHead(id) {
  const notFound = id === NOT_FOUND_VIEW;
  const route = notFound ? null : routeById(id);
  if (!notFound && !route) throw new Error(`unknown search route: ${id}`);
  const title = notFound ? NOT_FOUND.title : route.title;
  const description = notFound ? NOT_FOUND.description : route.description;
  const robots = notFound ? NOT_FOUND.robotsMeta : route.robotsMeta;
  const url = notFound ? "" : absoluteUrl(route.path);
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    metaContent("description", description),
    metaContent("robots", robots),
  ];
  if (!notFound) {
    lines.push(`<link rel="canonical" href="${escapeHtml(url)}" />`);
  }
  lines.push(
    metaContent("og:type", "website", "property"),
    metaContent("og:site_name", "SPE — System Prompt Engine", "property"),
    metaContent("og:title", title, "property"),
    metaContent("og:description", description, "property"),
  );
  if (!notFound) {
    lines.push(
      metaContent("og:url", url, "property"),
      metaContent("og:image", `${SITE_ORIGIN}/art/intent-core.webp`, "property"),
    );
  }
  lines.push(
    metaContent("twitter:card", "summary_large_image"),
    metaContent("twitter:title", title),
    metaContent("twitter:description", description),
  );
  if (!notFound) {
    lines.push(
      metaContent("twitter:image", `${SITE_ORIGIN}/art/intent-core.webp`),
    );
  }
  lines.push(jsonScript(jsonLdGraph(id)));
  return lines.join("\n");
}

function renderCrumbNav(crumbs) {
  const items = crumbs
    .map((crumb, index) => {
      const last = index === crumbs.length - 1;
      const inner = last
        ? escapeHtml(crumb.name)
        : `<a href="${escapeHtml(crumb.path)}">${escapeHtml(crumb.name)}</a>`;
      return `<li>${inner}</li>`;
    })
    .join("");
  return `<nav aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

function renderSiteNav() {
  const items = footerLinks()
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link.path)}">${escapeHtml(link.label)}</a></li>`,
    )
    .join("");
  return `<nav aria-label="On this site"><ul>${items}</ul></nav>`;
}

export function renderCrawl(id) {
  if (id === NOT_FOUND_VIEW) {
    return `<main id="spe-crawl" data-search-route="${NOT_FOUND_VIEW}">
<header>
<p>${escapeHtml("Missing page")}</p>
<h1>${escapeHtml(NOT_FOUND.h1)}</h1>
</header>
${NOT_FOUND.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
${renderSiteNav()}
</main>`;
  }
  const route = routeById(id);
  if (!route) throw new Error(`unknown search route: ${id}`);
  const sections = route.sections
    .map(
      (section) => `<section>
<h2>${escapeHtml(section.heading)}</h2>
${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
</section>`,
    )
    .join("\n");
  return `<main id="spe-crawl" data-search-route="${escapeHtml(route.id)}">
<header>
<p>${escapeHtml(route.kicker)}</p>
<h1>${escapeHtml(route.h1)}</h1>
</header>
${route.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
${sections}
${renderCrumbNav(route.crumbs)}
${renderSiteNav()}
</main>`;
}

export function renderStandaloneDocument(id) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${renderHead(id)}
<style>
  body { margin: 0; font: 16px/1.5 Georgia, "Times New Roman", serif; color: #161616; background: #f7f4ee; }
  main { max-width: 40rem; margin: 0 auto; padding: 1.5rem; }
  a { color: inherit; }
  nav ul, nav ol { padding-left: 1.2rem; }
</style>
</head>
<body>
${renderCrawl(id)}
</body>
</html>
`;
}

export function renderRobotsTxt() {
  const allows = routes
    .filter((route) => route.robots === "allow")
    .map((route) => `Allow: ${route.path}`);
  const disallows = [
    ...routes
      .filter((route) => route.robots === "disallow")
      .map((route) => `Disallow: ${route.path}`),
    ...PRIVATE_PREFIXES.filter((prefix) => prefix.path !== "/workspace").map(
      (prefix) => `Disallow: ${prefix.path}`,
    ),
  ];
  return [
    "# SPE search foundation. HOSTING IS NOT AUTHORIZED.",
    "# Public index routes may be crawled. Private sessions and binary packs may not.",
    "# Disallow lines come first so first-match crawlers still skip private paths.",
    "User-agent: *",
    ...disallows,
    ...allows,
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
}

export function renderSitemapXml() {
  const urls = publicIndexRoutes()
    .map(
      (route) => `  <url>
    <loc>${escapeHtml(absoluteUrl(route.path))}</loc>
    <lastmod>${SEARCH_REVISION}</lastmod>
    <changefreq>${escapeHtml(route.changefreq)}</changefreq>
    <priority>${escapeHtml(route.priority)}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderRedirects() {
  const lines = [
    "# Future static host map. HOSTING IS NOT AUTHORIZED.",
    "# Known routes are files emitted at vite build. Unknown URLs return 404.",
    "# Do not rewrite unknown URLs onto /index.html with status 200.",
    "/models/*  /models/:splat  200",
    "/ort/*     /ort/:splat     200",
    "/assets/*  /assets/:splat  200",
  ];
  for (const route of routes) {
    if (route.path === "/") continue;
    lines.push(`${route.path}    ${route.path}/index.html   200`);
    lines.push(`${route.path}/   ${route.path}/index.html   200`);
  }
  lines.push("/*    /404.html   404");
  return `${lines.join("\n")}\n`;
}

export function publicIndexRegistry() {
  return {
    revision: SEARCH_REVISION,
    canonicalHost: SITE_ORIGIN,
    hosting: "NOT_AUTHORIZED",
    sitemap: absoluteUrl("/sitemap.xml"),
    robots: absoluteUrl("/robots.txt"),
    routes: publicIndexRoutes().map((route) => ({
      id: route.id,
      path: route.path,
      canonical: absoluteUrl(route.path),
      title: route.title,
      description: route.description,
      h1: route.h1,
      robots: route.robotsMeta,
      schemas: route.schemas,
      changefreq: route.changefreq,
      priority: route.priority,
    })),
  };
}

export function privateNoindexRegistry() {
  return {
    revision: SEARCH_REVISION,
    canonicalHost: SITE_ORIGIN,
    hosting: "NOT_AUTHORIZED",
    policy: "noindex and omitted from the sitemap",
    routes: privateNoindexRoutes().map((route) => ({
      id: route.id,
      path: route.path,
      canonical: absoluteUrl(route.path),
      title: route.title,
      robots: route.robotsMeta,
      crawl: route.robots,
      reason:
        route.id === "workspace"
          ? "Private prompt session."
          : "On-device history. Crawlable so the noindex directive can be seen.",
    })),
    prefixes: PRIVATE_PREFIXES,
  };
}

export function coverageExpectations() {
  return {
    revision: SEARCH_REVISION,
    hosting: "NOT_AUTHORIZED",
    doNotSubmit: true,
    index: publicIndexRoutes().map((route) => absoluteUrl(route.path)),
    noindex: privateNoindexRoutes().map((route) => absoluteUrl(route.path)),
    excludedPrefixes: PRIVATE_PREFIXES.map((prefix) => prefix.path),
    notFound: {
      status: 404,
      robots: NOT_FOUND.robotsMeta,
      canonical: null,
    },
    removedStructuredData: ["FAQPage"],
    requiredStructuredData: [
      "WebSite",
      "Organization",
      "SoftwareApplication",
      "WebPage",
      "BreadcrumbList",
      "Article",
    ],
  };
}

const HEAD_START = "<!--spe-search-head-->";
const HEAD_END = "<!--/spe-search-head-->";
const CRAWL_START = "<!--spe-search-crawl-->";
const CRAWL_END = "<!--/spe-search-crawl-->";

function replaceMarked(html, start, end, inner) {
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < i) throw new Error(`missing search markers ${start}`);
  return `${html.slice(0, i + start.length)}\n${inner}\n${html.slice(j)}`;
}

export function injectDocument(html, id) {
  const withHead = replaceMarked(html, HEAD_START, HEAD_END, renderHead(id));
  return replaceMarked(withHead, CRAWL_START, CRAWL_END, renderCrawl(id));
}

export function renderDevNotFoundDocument() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${renderHead(NOT_FOUND_VIEW)}
</head>
<body>
${renderCrawl(NOT_FOUND_VIEW)}
<script src="/collapse-crawl.js"></script>
<div id="root"></div>
<script type="module">
import RefreshRuntime from "/@react-refresh"
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
</script>
<script type="module" src="/@vite/client"></script>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;
}
