/** History-based public routes — no router dependency (₹0). */

export type AppView =
  | "home"
  | "create"
  | "code"
  | "lab"
  | "my-work"
  | "privacy"
  | "workspace";

export const VIEW_PATH: Record<AppView, string> = {
  home: "/",
  create: "/create",
  code: "/code",
  lab: "/daily-lab",
  "my-work": "/my-work",
  privacy: "/privacy",
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
