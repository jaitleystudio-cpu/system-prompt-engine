/** History-based public routes — no router dependency (₹0). */

import {
  absoluteUrl as siteAbsoluteUrl,
  matchRoute,
  normalizePath,
  NOT_FOUND_VIEW,
  routes,
} from "./search/foundation.mjs";

export { NOT_FOUND_VIEW };

export type RoutableView =
  | "home"
  | "create"
  | "code"
  | "lab"
  | "my-work"
  | "privacy"
  | "capabilities"
  | "workspace";

export type AppView = RoutableView | typeof NOT_FOUND_VIEW;

export const VIEW_PATH: Record<RoutableView, string> = {
  home: "/",
  create: "/create",
  code: "/code",
  lab: "/daily-lab",
  "my-work": "/my-work",
  privacy: "/privacy",
  capabilities: "/capabilities",
  workspace: "/workspace",
};

export function pathForView(view: RoutableView): string {
  return VIEW_PATH[view];
}

export function viewFromPath(pathname: string): AppView {
  return (matchRoute(pathname)?.id as RoutableView | undefined) ?? NOT_FOUND_VIEW;
}

export function navigateTo(
  view: RoutableView,
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
  robots: string;
};

export function absoluteUrl(path: string): string {
  return siteAbsoluteUrl(path);
}

export const ROUTE_META: Record<RoutableView, RouteMeta> = Object.fromEntries(
  routes.map((route) => [
    route.id,
    {
      path: route.path,
      title: route.title,
      description: route.description,
      robots: route.robotsMeta,
    },
  ]),
) as Record<RoutableView, RouteMeta>;

export function canonicalPath(pathname: string): string {
  return normalizePath(pathname);
}
