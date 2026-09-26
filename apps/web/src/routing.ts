/** History-based public routes — no router dependency (₹0). */

export type AppView =
  | "home"
  | "create"
  | "code"
  | "lab"
  | "my-work"
  | "privacy"
  | "capabilities"
  | "workspace";

export const VIEW_PATH: Record<AppView, string> = {
  home: "/",
  create: "/create",
  code: "/code",
  lab: "/daily-lab",
  "my-work": "/my-work",
  privacy: "/privacy",
  capabilities: "/capabilities",
  workspace: "/workspace",
};

const PATH_VIEW: Record<string, AppView> = Object.fromEntries(
  Object.entries(VIEW_PATH).map(([view, path]) => [path, view as AppView]),
) as Record<string, AppView>;

export function pathForView(view: AppView): string {
  return VIEW_PATH[view] ?? "/";
}

export function viewFromPath(pathname: string): AppView {
  const clean = (pathname.replace(/\/+$/, "") || "/") as string;
  return PATH_VIEW[clean] ?? PATH_VIEW[pathname] ?? "home";
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
      "Upload a UI screenshot and get starter scaffolds and a structured prompt for HTML, React, SwiftUI, Flutter, and more.",
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
      "How SPE prepares prompts on this device, with honest privacy claims for this research preview.",
  },
  capabilities: {
    path: "/capabilities",
    title: "SPE Capabilities — Local Prompt Engine Features",
    description:
      "Honest SPE capabilities: local-first preparation, ProtectedIntent, Execution Contract, provider profiles, and portable .spe files. Research preview — any worldwide top ranking remains unproven.",
  },
  workspace: {
    path: "/workspace",
    title: "Workspace — Inspect & Refine Prompts | SPE",
    description:
      "Inspect intent, structure, and your finished prompt. Refine and export a portable .spe file.",
  },
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
          text: "No. That ranking claim is not proven. SPE is a research preview with honest local preparation, contracts, and portability — not an independently replicated top ranking.",
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
