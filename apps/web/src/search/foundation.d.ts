export const SITE_ORIGIN: string;
export const SEARCH_REVISION: string;
export const FOOTER_NAV_LABEL: string;
export const NOT_FOUND_VIEW: "not-found";
export const JSONLD_ELEMENT_ID: "spe-jsonld-graph";
export const ROBOTS_META_KEY: "robots";
export const OG_URL_SELECTOR: string;

export type SearchSection = {
  heading: string;
  paragraphs: string[];
};

export type SearchRoute = {
  id: string;
  path: string;
  index: boolean;
  nav: boolean;
  navLabel: string;
  robots: "allow" | "disallow";
  robotsMeta: string;
  changefreq: string;
  priority: string;
  title: string;
  description: string;
  h1: string;
  kicker: string;
  paragraphs: string[];
  sections: SearchSection[];
  crumbs: { name: string; path: string }[];
  schemas: string[];
};

export const NOT_FOUND: {
  title: string;
  description: string;
  h1: string;
  robotsMeta: string;
  paragraphs: string[];
};

export const routes: SearchRoute[];

export const PRIVATE_PREFIXES: {
  path: string;
  robots: string;
  reason: string;
}[];

export function absoluteUrl(path: string): string;
export function normalizePath(pathname: string): string;
export function routeById(id: string): SearchRoute | undefined;
export function matchRoute(pathname: string): SearchRoute | undefined;
export function publicIndexRoutes(): SearchRoute[];
export function privateNoindexRoutes(): SearchRoute[];
export function footerLinks(): { id: string; path: string; label: string }[];
export function classifyRequestPath(raw: string): {
  kind: "file" | "route" | "not-found";
  path: string;
  route?: SearchRoute;
};
export function escapeHtml(value: string): string;
export function jsonLdGraph(id: string): Record<string, unknown>;
export function renderHead(id: string): string;
export function renderCrawl(id: string): string;
export function renderStandaloneDocument(id: string): string;
export function renderRobotsTxt(): string;
export function renderSitemapXml(): string;
export function renderRedirects(): string;
export function publicIndexRegistry(): Record<string, unknown>;
export function privateNoindexRegistry(): Record<string, unknown>;
export function coverageExpectations(): Record<string, unknown>;
export function injectDocument(html: string, id: string): string;
export function renderDevNotFoundDocument(): string;
