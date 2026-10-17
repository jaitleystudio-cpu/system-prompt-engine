import {
  ROUTE_ALIASES,
  isPromptSubRoute,
  EXTRA_VIEW_PATH,
  EXTRA_ROUTE_META,
} from "./engine/routeAliases.ts";

export type AppView =
  | "home"
  | "create"
  | "code"
  | "lab"
  | "my-work"
  | "privacy"
  | "capabilities"
  | "workspace"
  | "website"
  | "media"
  | "ocr"
  | "research"
  | "workflows"
  | "skill-builder"
  | "compare"
  | "pricing"
  | "prompts"
  | "incidents"
  | "eval-studio"
  | "uidrop"
  | "possibility"
  | "reality-frontier"
  | "challenge"
  | "revocation"
  | "pro-studio";

export const VIEW_PATH: Record<AppView, string> = {
  home: "/",
  create: "/create",
  code: "/code",
  lab: "/daily-lab",
  "my-work": "/my-work",
  privacy: "/privacy",
  capabilities: "/capabilities",
  workspace: "/workspace",
  website: "/website",
  media: "/media",
  ocr: "/ocr",
  research: "/research",
  workflows: "/workflows",
  "skill-builder": "/build-skill",
  compare: "/compare",
  pricing: "/pricing",
  prompts: "/prompts",
  incidents: "/incidents",
  uidrop: "/uidrop",
  possibility: "/possibility-engine",
  "reality-frontier": "/reality-frontier",
  challenge: "/challenge",
  revocation: "/revocation",
  "pro-studio": "/pro-studio",
  ...EXTRA_VIEW_PATH,
};

/** Device-local and tool surfaces. Not advertised to crawlers. */
export const NOINDEX_VIEWS: ReadonlySet<AppView> = new Set([
  "workspace",
  "my-work",
  "website",
  "media",
  "ocr",
  "research",
  "pro-studio",
]);

const PATH_VIEW: Record<string, AppView> = {
  ...Object.fromEntries(
    Object.entries(VIEW_PATH).map(([view, path]) => [path, view as AppView]),
  ),
  ...Object.fromEntries(
    Object.entries(ROUTE_ALIASES).map(([path, view]) => [path, view as AppView]),
  ),
  "/skill-builder": "skill-builder",
  "/skills": "skill-builder",
  "/pro": "pro-studio",
} as Record<string, AppView>;

/** /pro-studio/<tool> sub-routes stay on the Pro Studio view; the app shell resolves the tool. */
export function isProStudioSubRoute(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean.startsWith("/pro-studio/") && clean.length > "/pro-studio/".length;
}

export function pathForView(view: AppView): string {
  return VIEW_PATH[view] ?? "/";
}

export function resolveRoute(pathname: string):
  | { kind: "view"; view: AppView; canonicalPath: string }
  | { kind: "not-found"; pathname: string } {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (isProStudioSubRoute(clean)) {
    return { kind: "view", view: "pro-studio", canonicalPath: clean };
  }
  if (isPromptSubRoute(clean)) {
    return { kind: "view", view: PATH_VIEW[VIEW_PATH.prompts], canonicalPath: clean };
  }
  const view = PATH_VIEW[clean];
  if (!view) return { kind: "not-found", pathname: clean };
  return { kind: "view", view, canonicalPath: VIEW_PATH[view] };
}

export function viewFromPath(pathname: string): AppView | null {
  const resolved = resolveRoute(pathname);
  return resolved.kind === "view" ? resolved.view : null;
}

export function navigateTo(
  view: AppView,
  opts: { replace?: boolean } = {},
): void {
  const path = pathForView(view);
  const method = opts.replace ? "replaceState" : "pushState";
  if (window.location.pathname !== path) {
    window.history[method]({ view }, "", path);
  } else if (opts.replace) {
    window.history.replaceState({ view }, "", path);
  }
}

export type RouteMeta = {
  title: string;
  description: string;
  path: string;
};

const SITE = "https://systempromptengine.com";

export function absoluteUrl(path: string): string {
  return `${SITE}${path === "/" ? "" : path}`;
}

export const ROUTE_META: Record<AppView, RouteMeta> = {
  home: {
    path: "/",
    title: "SPE — System Prompt Engine | Free System Prompt Generator",
    description:
      "Free system prompt generator and AI prompt builder. Turn an idea into meaning, structure, and a precise prompt — privately on this device.",
  },
  create: {
    path: "/create",
    title: "Create a Prompt — SPE Free Prompt Builder",
    description:
      "Shape text, speech, image, video, or a website into a clear system prompt. Your brief stays on this device.",
  },
  code: {
    path: "/code",
    title: "Screenshot to Code Prompt — SPE Prompt Engineering Tool",
    description:
      "Upload a UI screenshot and get an implementation prompt plus starter scaffolds for HTML, React, SwiftUI, Flutter, and more — for use with a coding AI, not an in-product compiler.",
  },
  lab: {
    path: "/daily-lab",
    title: "Daily Lab — SPE AI Prompt Generator Ideas",
    description:
      "Browse daily prompt engineering specimens and open them in SPE’s free prompt builder.",
  },
  "my-work": {
    path: "/my-work",
    title: "My Work — Saved Prompts on This Device | SPE",
    description:
      "Optional on-device history of ideas and prompts. Nothing is uploaded; SPE keeps your work local.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy & Proof — Local System Prompt Engine | SPE",
    description:
      "How SPE prepares prompts on this device, with honest privacy claims for this release.",
  },
  capabilities: {
    path: "/capabilities",
    title: "SPE Capabilities — Local Prompt Engine Features",
    description:
      "Honest SPE capabilities: local-first preparation, ProtectedIntent, Execution Contract, provider profiles, and portable .spe files. Independent comparative ranking has not been established; human preference ratings have not yet been collected.",
  },
  workspace: {
    path: "/workspace",
    title: "Workspace — Inspect & Refine Prompts | SPE",
    description:
      "Inspect intent, structure, and your finished prompt. Refine and export a portable .spe file.",
  },
  website: {
    path: "/website",
    title: "Website — Local spec preview | SPE",
    description:
      "Turn a local website spec into a preview and a saved file. This does not open a web address or publish a site.",
  },
  media: {
    path: "/media",
    title: "Media — Host transcription request | SPE",
    description:
      "Select audio or video and request transcription from the configured app host. Availability depends on its runtime; on-device execution requires a local host.",
  },
  ocr: {
    path: "/ocr",
    title: "OCR — Local text from an image | SPE",
    description:
      "Request image text from the configured app host. Image bytes are sent to that host; on-device OCR requires a local host. Missing runtime stays unavailable.",
  },
  research: {
    path: "/research",
    title: "Research — Stored receipt only | SPE",
    description:
      "View a stored research receipt after opting in. This route does not search or send the question; live index and retraction remain HOLD.",
  },
  workflows: {
    path: "/workflows",
    title: "Verified AI Workflows Exchange | SPE Ω",
    description:
      "Tested, reproducible business operations and document automation AI workflows for Claude Code, Cursor, and Codex.",
  },
  "skill-builder": {
    path: "/build-skill",
    title: "Free In-Browser AI Skill Builder & Auditor | SPE Ω",
    description:
      "Build, security-audit, and export portable AI skills (SKILL.md) locally on your device with $0 server inference.",
  },
  compare: {
    path: "/compare",
    title: "Skill Effectiveness Challenge — Head-to-Head Benchmarks | SPE Ω",
    description:
      "Empirical head-to-head AI agent task performance benchmarks with Wilson 95% confidence intervals and token deltas.",
  },
  pricing: {
    path: "/pricing",
    title: "Plans & Pricing — System Prompt Engine | SPE",
    description:
      "Simple, honest pricing. The core deterministic compiler will always be 100% free and on-device. Upgrade to Developer Pro or Team for advanced workflow automation and team gates.",
  },
  prompts: {
    path: "/prompts",
    title: "Universal Prompt Arsenal (10,000+ Free Production Prompts) | SPE",
    description:
      "Explore 10,000+ production-tested AI prompts across 13 domains. Optimized for Claude 4.5 Sonnet, OpenAI GPT-5/o4-mini, Gemini 3 Pro, Grok 4, DeepSeek-R2, and Midjourney v7. 100% free online.",
  },
  incidents: {
    path: "/incidents",
    title: "AI Incident Radar & Failure Post-Mortem Wire | SPE Ω",
    description:
      "Independent, mathematically verified post-mortems of breaking AI model failures, prompt leaks, and agent catastrophes. The truth behind AI model bugs — backed by reproducible test receipts.",
  },
  uidrop: {
    path: "/uidrop",
    title: "UIDrop Web Design System Extractor & AI Prompt Compiler | SPE Ω",
    description:
      "Extract design tokens, WCAG 2.1 contrast scores, and anti-cloning prompts from any live URL or uploaded screenshot — 100% in-browser with zero cloud compute.",
  },
  possibility: {
    path: "/possibility-engine",
    title: "Possibility Engine & Living Outcome Contract | SPE Ω",
    description:
      "Explore three orthogonal execution topologies from a single brief. Lock hard boundaries with mathematical proof and repair regressions via Pearl causal minimal-cut surgery.",
  },
  "reality-frontier": {
    path: "/reality-frontier",
    title: "Reality Frontier · Counterfactual Feasibility Compiler | SPE Ω",
    description:
      "Discover what realities your intention can actually produce. Ante-hoc contradiction detection, EVOI decision gates, Pareto worldlines, and metamorphic evidence escrow.",
  },
  challenge: {
    path: "/challenge",
    title: "Challenge This Result · Anti-Lucky-Pass Active Verification Engine | SPE Ω",
    description:
      "Active counterfactual specification closure. Detect lucky passes, synthesize minimal perturbations, and verify resilience under real-world stress.",
  },
  revocation: {
    path: "/revocation",
    title: "Semantic Revocation & Epistemic Non-Interference | SPE Ω",
    description:
      "Weiser semantic slicing and Goguen-Meseguer non-interference. Purge contaminated downstream dependencies and prevent latent model attention leaks.",
  },
  "pro-studio": {
    path: "/pro-studio",
    title: "Pro Studio — SPE workspace for Pro and Team plans",
    description:
      "SPE Pro Studio: prompt sessions, versions, regression tests, signed releases, agent blueprints, batch CSV, code export and governance tools in one workspace. Runs in your browser.",
  },
  ...EXTRA_ROUTE_META,
};

export function jsonLdSoftwareApplication(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SPE — System Prompt Engine",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Free system prompt generator and prompt engineering tool. Turns ideas into structured prompts in your browser.",
    url: SITE,
    isAccessibleForFree: true,
  };
}

/** AEO-friendly FAQ for /capabilities — honest answers, no unproven ranking hype. */
export function jsonLdCapabilitiesFaq(): Record<string, unknown> {
  const pageUrl = absoluteUrl("/capabilities");
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is SPE?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SPE (System Prompt Engine) is a free, browser-based system prompt generator. You start with a rough idea; SPE helps you shape meaning, structure, and a prompt you can take to any model you choose.",
        },
      },
      {
        "@type": "Question",
        name: "Does SPE send my idea to an AI provider to prepare it?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Prompt preparation runs locally in your browser. You decide whether to copy, download, or take the finished prompt elsewhere.",
        },
      },
      {
        "@type": "Question",
        name: "What is an Execution Contract in SPE?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It is the structured contract SPE compiles with your brief — goal, constraints, planned stages, and authority state. A local dry-run can check it without executing side effects.",
        },
      },
      {
        "@type": "Question",
        name: "Do provider profiles grant SPE permission to call external AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Selecting a provider profile is not an authority grant. External routes stay off unless you explicitly allow them; the default is local-first.",
        },
      },
      {
        "@type": "Question",
        name: "Does SPE claim a worldwide ranking as the top prompt tool?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. That ranking claim is not proven. Independent comparative ranking has not been established. Human preference ratings have not yet been collected. SPE provides honest local preparation, contracts, and portability — not an independently replicated top ranking.",
        },
      },
    ],
    url: pageUrl,
  };
}

export function jsonLdCapabilitiesWebPage(): Record<string, unknown> {
  const meta = ROUTE_META.capabilities;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: meta.title,
    description: meta.description,
    url: absoluteUrl(meta.path),
    isPartOf: {
      "@type": "WebSite",
      name: "SPE — System Prompt Engine",
      url: SITE,
    },
  };
}
