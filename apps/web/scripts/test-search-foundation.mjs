#!/usr/bin/env node
/** Search foundation: registry, prerender, 404, robots, sitemap. No browser, no host. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assessLabVitals } from "./measure-cwv.mjs";
import {
  SEARCH_REVISION,
  absoluteUrl,
  classifyRequestPath,
  footerLinks,
  injectDocument,
  jsonLdGraph,
  privateNoindexRoutes,
  publicIndexRoutes,
  renderCrawl,
  renderHead,
  renderRedirects,
  renderRobotsTxt,
  renderSitemapXml,
  renderStandaloneDocument,
  routes,
} from "../src/search/foundation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const redirects = read("public/_redirects");
const indexHtml = read("index.html");
const notFoundHtml = read("public/404.html");
const publicIndex = JSON.parse(read("public/search/public-index.json"));
const privateIndex = JSON.parse(read("public/search/private-noindex.json"));
const coverage = JSON.parse(read("search-console/coverage.json"));
const property = JSON.parse(read("search-console/property.json"));
const measureSource = read("scripts/measure-cwv.mjs");

assert.equal(robots, renderRobotsTxt());
assert.equal(sitemap, renderSitemapXml());
assert.equal(redirects, renderRedirects());
assert.equal(publicIndex.revision, SEARCH_REVISION);
assert.equal(publicIndex.hosting, "NOT_AUTHORIZED");
assert.equal(privateIndex.hosting, "NOT_AUTHORIZED");
assert.equal(coverage.hosting, "NOT_AUTHORIZED");
assert.equal(coverage.doNotSubmit, true);
assert.equal(property.hosting, "NOT_AUTHORIZED");
assert.equal(property.doNotSubmit, true);
assert.equal(property.verification, null);
assert.equal(property.status, "NOT_SUBMITTED");

const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert.deepEqual(
  sitemapLocs,
  publicIndexRoutes().map((route) => absoluteUrl(route.path)),
);
for (const route of privateNoindexRoutes()) {
  assert.equal(sitemap.includes(absoluteUrl(route.path)), false);
  assert.match(route.robotsMeta, /noindex/);
}
assert.match(robots, /Allow:\s*\/my-work/);
assert.match(robots, /Disallow:\s*\/workspace/);
assert.match(robots, /Disallow:\s*\/search\/public-index\.json/);
assert.match(robots, /Disallow:\s*\/search\/private-noindex\.json/);
assert.doesNotMatch(redirects, /\/\*\s+\/index\.html\s+200/);
assert.match(redirects, /\/\*\s+\/404\.html\s+404/);
assert.match(redirects, /HOSTING IS NOT AUTHORIZED/);

assert.doesNotMatch(indexHtml, /FAQPage/);
assert.match(indexHtml, /<!--spe-search-head-->/);
assert.match(indexHtml, /<!--spe-search-crawl-->/);
assert.match(indexHtml, /src="\/collapse-crawl\.js"/);
assert.match(indexHtml, /src="\/src\/main\.tsx"/);
assert.match(indexHtml, /rel="canonical" href="https:\/\/systempromptengine\.com\/"/);
assert.match(indexHtml, /connect-src 'self'/);
assert.match(indexHtml, /name="viewport"/);
assert.equal((indexHtml.match(/<h1>/g) || []).length, 1);

assert.doesNotMatch(notFoundHtml, /collapse-crawl\.js/);
assert.doesNotMatch(notFoundHtml, /rel="canonical"/);
assert.match(notFoundHtml, /noindex, follow/);
assert.equal((notFoundHtml.match(/<h1>/g) || []).length, 1);

const shell = `<!doctype html><html><head><!--spe-search-head--><!--/spe-search-head--></head><body><!--spe-search-crawl--><!--/spe-search-crawl--><script src="/collapse-crawl.js"></script><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;
const injected = injectDocument(shell, "create");
assert.match(injected, /src="\/collapse-crawl\.js"/);
assert.match(injected, /src="\/src\/main\.tsx"/);
assert.match(injected, /rel="canonical" href="https:\/\/systempromptengine\.com\/create"/);
assert.equal((injected.match(/<h1>/g) || []).length, 1);

function idsIn(graph) {
  return new Set(graph.filter((node) => node["@id"]).map((node) => node["@id"]));
}

function refsIn(value, refs = []) {
  if (!value || typeof value !== "object") return refs;
  if (Array.isArray(value)) {
    for (const item of value) refsIn(item, refs);
    return refs;
  }
  if (Object.keys(value).length === 1 && typeof value["@id"] === "string") {
    refs.push(value["@id"]);
  }
  for (const nested of Object.values(value)) refsIn(nested, refs);
  return refs;
}

for (const route of routes) {
  const head = renderHead(route.id);
  const crawl = renderCrawl(route.id);
  const graph = jsonLdGraph(route.id)["@graph"];
  assert.match(head, new RegExp(`rel="canonical" href="${absoluteUrl(route.path)}"`));
  assert.match(head, new RegExp(`content="${route.robotsMeta}"`));
  assert.equal((crawl.match(/<h1>/g) || []).length, 1);
  assert.match(crawl, new RegExp(`<h1>${route.h1}</h1>`));
  assert.doesNotMatch(JSON.stringify(graph), /FAQPage/);
  const known = idsIn(graph);
  for (const ref of refsIn(graph)) {
    assert.equal(known.has(ref), true, `${route.id} dangling ${ref}`);
  }
  for (const link of footerLinks()) {
    assert.match(crawl, new RegExp(`href="${link.path}"`));
  }
  if (route.index) {
    for (const type of ["Organization", "WebSite", "SoftwareApplication", "WebPage", "BreadcrumbList"]) {
      assert.equal(graph.some((node) => node["@type"] === type), true, route.id + type);
    }
  }
}

for (const id of ["lab", "capabilities", "privacy"]) {
  const graph = jsonLdGraph(id)["@graph"];
  assert.equal(graph.some((node) => node["@type"] === "Article"), true, id);
  const article = graph.find((node) => node["@type"] === "Article");
  assert.equal(article.datePublished, SEARCH_REVISION);
  assert.equal(article.dateModified, SEARCH_REVISION);
}

const missing = jsonLdGraph("not-found");
assert.equal(missing["@graph"].some((node) => node["@type"] === "Organization"), true);
assert.equal(missing["@graph"].some((node) => node["@type"] === "WebSite"), true);
assert.doesNotMatch(renderHead("not-found"), /rel="canonical"/);
const missingPage = missing["@graph"].find((node) => node["@type"] === "WebPage");
assert.equal(missingPage.url, undefined);
const missingIds = idsIn(missing["@graph"]);
for (const ref of refsIn(missing["@graph"])) {
  assert.equal(missingIds.has(ref), true, ref);
}

const publicHrefs = new Set(footerLinks().map((link) => absoluteUrl(link.path)));
for (const route of publicIndexRoutes()) {
  assert.equal(publicHrefs.has(absoluteUrl(route.path)) || route.nav, true);
  const crawl = renderCrawl(route.id);
  for (const other of publicIndexRoutes()) {
    assert.match(crawl, new RegExp(`href="${other.path === "/" ? "/" : other.path}"`));
  }
}

assert.equal(classifyRequestPath("/create").kind, "route");
assert.equal(classifyRequestPath("/create/").route.id, "create");
assert.equal(classifyRequestPath("/missing-page").kind, "not-found");
assert.equal(classifyRequestPath("/src/main.tsx").kind, "file");
assert.equal(classifyRequestPath("/art/intent-core.webp").kind, "file");
assert.equal(classifyRequestPath("/@vite/client").kind, "file");

assert.deepEqual(coverage.index, publicIndexRoutes().map((route) => absoluteUrl(route.path)));
assert.equal(coverage.notFound.canonical, null);
assert.deepEqual(coverage.removedStructuredData, ["FAQPage"]);

const capabilities = read("src/pages/Capabilities.tsx");
assert.doesNotMatch(capabilities, /id="faq"/);
assert.doesNotMatch(capabilities, /"@type":\s*"FAQPage"/);
assert.match(capabilities, /not proven/i);

assert.doesNotMatch(measureSource, /google-analytics|googletagmanager|search\.google\.com|webmasters/);
assert.deepEqual(assessLabVitals({ lcpMs: 100, cls: 0, inpMs: 10 }), {
  lcp: true,
  cls: true,
  inp: true,
  thresholds: { lcpMs: 2500, cls: 0.1, inpMs: 200 },
});
assert.equal(assessLabVitals({ lcpMs: 3000, cls: 0.2, inpMs: 400 }).lcp, false);

const standalone = renderStandaloneDocument("privacy");
assert.match(standalone, /"@type":"Article"/);
assert.doesNotMatch(read("public/404.html"), /<script src="\/collapse-crawl\.js">/);

console.log("PASS search foundation");
