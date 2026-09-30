/**
 * Search R1 oracles. Read-only against the search foundation donor.
 * No live Google fetch, no Search Console API, no host.
 * Missing live data stays UNKNOWN. A failure here is donor evidence.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectTypes,
  hasUserinfo,
  lintCanonicals,
  lintHreflang,
  lintSitemap,
  metaContent,
  parseRedirects,
  parseRobots,
  redirectCycle,
  robotsDecision,
  robotsFirstMatch,
  sitemapLocs,
  titleOf,
} from "./lint.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const REAL_FOUNDATION = join(ROOT, "apps/web/src/search/foundation.mjs");
const REAL_CWV = join(ROOT, "apps/web/scripts/measure-cwv.mjs");
const REAL_PLUGIN = join(ROOT, "apps/web/src/search/vitePlugin.mjs");
const FIXTURES = join(HERE, "fixtures");

const ORIGIN = "https://systempromptengine.com";
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const PRIVATE_DISALLOW = [
  ["/workspace", "/workspace"],
  ["/workspace/session", "/workspace"],
  ["/models/pack.onnx", "/models/"],
  ["/ort/ort-wasm.wasm", "/ort/"],
  ["/search/public-index.json", "/search/public-index.json"],
  ["/search/private-noindex.json", "/search/private-noindex.json"],
];
const ALLOWED_CRAWL = ["/", "/create", "/my-work", "/privacy"];
const INDEX_PATHS = ["/", "/create", "/code", "/daily-lab", "/capabilities", "/privacy"];
const NOINDEX_IDS = ["my-work", "workspace"];
const COMPANION_TYPES = new Set(["ImageObject", "Offer", "ListItem", "WebSite"]);
const BANNED_TYPES = ["FAQPage", "HowTo", "Review", "AggregateRating", "ClaimReview"];
const RANKING_BANS = [
  /ranked\s*#?\s*1/i,
  /ranking\s+proven/i,
  /successfully indexed/i,
  /live serp/i,
  /search console:\s*verified/i,
];

export const LEDGER = {
  liveSerp: "NO",
  searchConsole: "NO",
  fieldCwv: "UNKNOWN",
  hreflangLiveHost: "UNKNOWN",
  lastmodContentAccuracy: "UNKNOWN",
  semanticAuthority: "NONE",
  indexingClaimed: false,
  rankingClaimed: false,
};

function href(path) {
  return pathToFileURL(path).href;
}

function readFixture(name) {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function invoke(pluginModule, url) {
  const plugin = pluginModule.searchFoundationPlugin();
  let handler;
  plugin.configureServer({
    middlewares: {
      use(fn) {
        handler = fn;
      },
    },
  });
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(body) {
      this.body = body ?? "";
    },
  };
  let nexted = false;
  handler({ url }, res, () => {
    nexted = true;
  });
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
    nexted,
  };
}

function userinfoHits(label, text) {
  const failures = [];
  const urls = String(text).match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  for (const raw of urls) {
    const value = raw.replace(/[),]+$/, "");
    if (hasUserinfo(value)) failures.push(`${label} retains credentials in ${value}`);
  }
  return failures;
}

function proseFailures(text) {
  const failures = [];
  for (const pattern of RANKING_BANS) {
    if (pattern.test(text)) failures.push(`ranking or indexing claim /${pattern.source}/`);
  }
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!/ranking/i.test(sentence)) continue;
    if (!/not proven|unproven|not claimed/i.test(sentence)) {
      failures.push(`ranking sentence without a negation: ${sentence}`);
    }
  }
  return failures;
}

async function loadModules() {
  const foundationPath = process.env.SR1_FOUNDATION || REAL_FOUNDATION;
  const cwvPath = process.env.SR1_CWV || REAL_CWV;
  const pluginPath = process.env.SR1_PLUGIN || REAL_PLUGIN;
  const real = await import(href(REAL_FOUNDATION));
  const actual = foundationPath === REAL_FOUNDATION ? real : await import(href(foundationPath));
  const realCwv = await import(href(REAL_CWV));
  const cwv = cwvPath === REAL_CWV ? realCwv : await import(href(cwvPath));
  const plugin = await import(href(pluginPath));
  return {
    real,
    actual,
    cwv,
    plugin,
    cwvSource: readFileSync(cwvPath, "utf8"),
    foundationPath,
    cwvPath,
  };
}

function observe(modules) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = (input) => {
    calls.push(String(input));
    return Promise.resolve(new Response("blocked"));
  };
  try {
    const { actual, real, cwv, plugin, cwvSource } = modules;
    const heads = {};
    const graphs = {};
    for (const route of real.routes) {
      heads[route.id] = actual.renderHead(route.id);
      graphs[route.id] = actual.jsonLdGraph(route.id);
    }
    heads["not-found"] = actual.renderHead(real.NOT_FOUND_VIEW);
    graphs["not-found"] = actual.jsonLdGraph(real.NOT_FOUND_VIEW);
    return {
      calls,
      cwvSource,
      robots: actual.renderRobotsTxt(),
      sitemap: actual.renderSitemapXml(),
      redirects: actual.renderRedirects(),
      heads,
      graphs,
      coverage: actual.coverageExpectations(),
      publicRegistry: actual.publicIndexRegistry(),
      privateRegistry: actual.privateNoindexRegistry(),
      vitals: {
        omit: cwv.assessLabVitals({}),
        partial: cwv.assessLabVitals({ lcpMs: 100 }),
        zeros: cwv.assessLabVitals({ lcpMs: 0, cls: 0, inpMs: 0 }),
        slow: cwv.assessLabVitals({ lcpMs: 3000, cls: 0.2, inpMs: 400 }),
        nulls: cwv.assessLabVitals({ lcpMs: null, cls: null, inpMs: null }),
        blanks: cwv.assessLabVitals({ lcpMs: "", cls: "", inpMs: "" }),
      },
      missing: invoke(plugin, "/missing-page"),
      create: invoke(plugin, "/create"),
      slash: actual.classifyRequestPath("/create/"),
      unknown: actual.classifyRequestPath("/missing-page"),
    };
  } finally {
    globalThis.fetch = original;
  }
}

function check(name, fn, bucket) {
  try {
    const failures = fn();
    bucket[name] = { pass: failures.length === 0, failures };
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    bucket[name] = { pass: false, failures: [`threw ${message}`] };
  }
}

function robotsHonored(obs, real) {
  const failures = [];
  const parsed = parseRobots(obs.robots);
  failures.push(...parsed.failures.map((item) => `donor robots ${item}`));
  if (parsed.sitemaps.length !== 1 || parsed.sitemaps[0] !== SITEMAP_URL) {
    failures.push(`sitemap directive ${parsed.sitemaps.join(",") || "missing"}`);
  }
  for (const [requestPath] of PRIVATE_DISALLOW) {
    if (robotsDecision(parsed.rules, requestPath) !== "disallow") {
      failures.push(`longest-match allows private ${requestPath}`);
    }
    if (robotsFirstMatch(parsed.rules, requestPath) !== "disallow") {
      failures.push(`first-match allows private ${requestPath}`);
    }
  }
  for (const requestPath of ALLOWED_CRAWL) {
    if (robotsDecision(parsed.rules, requestPath) !== "allow") {
      failures.push(`longest-match blocks ${requestPath}`);
    }
  }
  for (const route of real.publicIndexRoutes()) {
    if (!obs.robots.includes(`Allow: ${route.path}`)) {
      failures.push(`missing Allow ${route.path}`);
    }
  }
  if (!obs.robots.includes("Disallow: /workspace")) {
    failures.push("workspace disallow missing");
  }
  return failures;
}

function malformedRobotsRejected() {
  const failures = [];
  const missingColon = parseRobots(readFixture("robots-missing-colon.txt"));
  const credential = parseRobots(readFixture("robots-credential-sitemap.txt"));
  if (missingColon.failures.length === 0) failures.push("missing-colon robots accepted");
  if (credential.failures.length === 0) failures.push("credential sitemap robots accepted");
  return failures;
}

function notFoundNotIndexable(obs, real) {
  const failures = [];
  const head = obs.heads["not-found"];
  const robots = metaContent(head, "name", "robots");
  if (robots !== real.NOT_FOUND.robotsMeta || !String(robots).startsWith("noindex")) {
    failures.push(`404 robots meta is ${robots}`);
  }
  if (lintCanonicals(head).count !== 0) failures.push("404 invented a canonical");
  if (obs.coverage.notFound?.status !== 404) failures.push("404 status is not 404");
  if (obs.coverage.notFound?.canonical !== null) failures.push("404 coverage canonical is set");
  if (obs.missing.statusCode !== 404) failures.push(`dev unknown status ${obs.missing.statusCode}`);
  if (!String(obs.missing.body).includes("noindex")) failures.push("dev 404 body is indexable");
  if (lintCanonicals(obs.missing.body).count !== 0) failures.push("dev 404 body has a canonical");
  if (obs.sitemap.includes("/missing-page")) failures.push("unknown URL is in the sitemap");
  return failures;
}

function unknownRoute404(obs) {
  const failures = [];
  if (obs.unknown.kind !== "not-found") failures.push(`unknown kind ${obs.unknown.kind}`);
  if (obs.missing.statusCode !== 404 || obs.missing.nexted) {
    failures.push("unknown dev request was not a terminal 404");
  }
  if (obs.missing.headers["X-Robots-Tag"] !== "noindex, follow") {
    failures.push("unknown dev request missing noindex header");
  }
  if (!obs.create.nexted) failures.push("known route did not continue");
  const redirects = parseRedirects(obs.redirects);
  failures.push(...redirects.failures);
  const catchAll = redirects.rules.filter((rule) => rule.from === "/*");
  if (catchAll.length !== 1 || catchAll[0].status !== 404 || catchAll[0].to !== "/404.html") {
    failures.push(`catch-all is ${JSON.stringify(catchAll)}`);
  }
  if (/\/\*\s+\/index\.html\s+200/.test(obs.redirects)) {
    failures.push("unknown URLs rewrite to index.html 200");
  }
  return failures;
}

function redirectsNotComplete(obs) {
  const failures = [];
  const parsed = parseRedirects(obs.redirects);
  failures.push(...parsed.failures);
  if (obs.redirects.includes("REDIRECT_LOOP_STATUS: COMPLETE")) {
    failures.push("redirect loop marked complete");
  }
  if (redirectCycle(parsed.rules)) failures.push("redirect graph has a cycle");
  return failures;
}

function canonicalsNotInvented(obs, real) {
  const failures = [];
  for (const route of real.routes) {
    const linted = lintCanonicals(obs.heads[route.id]);
    failures.push(...linted.failures.map((item) => `${route.id} ${item}`));
    const expected = real.absoluteUrl(route.path);
    if (linted.hrefs.length !== 1 || linted.hrefs[0] !== expected) {
      failures.push(`${route.id} canonical ${linted.hrefs.join(",") || "missing"} != ${expected}`);
    }
  }
  const missing = lintCanonicals(obs.heads["not-found"]);
  if (missing.count !== 0) failures.push("not-found canonical invented");
  for (const row of obs.publicRegistry.routes) {
    if (row.canonical !== real.absoluteUrl(row.path)) {
      failures.push(`registry canonical invented for ${row.path}: ${row.canonical}`);
    }
  }
  for (const row of obs.privateRegistry.routes) {
    if (row.canonical !== real.absoluteUrl(row.path)) {
      failures.push(`private registry canonical invented for ${row.path}: ${row.canonical}`);
    }
  }
  return failures;
}

function malformedCanonicalsRejected() {
  const failures = [];
  if (lintCanonicals(readFixture("canonical-relative.html")).failures.length === 0) {
    failures.push("relative canonical accepted");
  }
  if (lintCanonicals(readFixture("canonical-credential.html")).failures.length === 0) {
    failures.push("credential canonical accepted");
  }
  return failures;
}

function sitemapNotFabricated(obs, real) {
  const failures = [];
  const linted = lintSitemap(obs.sitemap);
  failures.push(...linted.failures.map((item) => `donor sitemap ${item}`));
  const expected = real.publicIndexRoutes().map((route) => real.absoluteUrl(route.path));
  const actual = sitemapLocs(obs.sitemap);
  if (actual.length !== expected.length || actual.some((loc, index) => loc !== expected[index])) {
    failures.push(`sitemap locs ${actual.join(",")} != ${expected.join(",")}`);
  }
  for (const path of INDEX_PATHS) {
    if (!expected.includes(path === "/" ? `${ORIGIN}/` : `${ORIGIN}${path}`)) {
      failures.push(`frozen index path missing from donor expectation ${path}`);
    }
  }
  for (const id of NOINDEX_IDS) {
    const route = real.routes.find((item) => item.id === id);
    if (obs.sitemap.includes(real.absoluteUrl(route.path))) {
      failures.push(`${id} fabricated into the sitemap`);
    }
  }
  return failures;
}

function malformedSitemapRejected() {
  const failures = [];
  if (lintSitemap(readFixture("sitemap-http-loc.xml")).failures.length === 0) {
    failures.push("http sitemap loc accepted");
  }
  if (lintSitemap(readFixture("sitemap-broken.xml")).failures.length === 0) {
    failures.push("broken sitemap accepted");
  }
  return failures;
}

function hreflangFailClosed(obs, real) {
  const failures = [];
  let observed = 0;
  const ids = [...real.routes.map((route) => route.id), "not-found"];
  for (const id of ids) {
    const linted = lintHreflang(obs.heads[id]);
    observed += linted.count;
    failures.push(...linted.failures.map((item) => `${id} ${item}`));
  }
  if (observed !== 0) failures.push(`rendered hreflang count ${observed}`);
  if (lintHreflang(readFixture("hreflang-bad-lang.html")).failures.length === 0) {
    failures.push("bad hreflang language accepted");
  }
  if (lintHreflang(readFixture("hreflang-credential.html")).failures.length === 0) {
    failures.push("credential hreflang accepted");
  }
  return failures;
}

function metadataNotInvented(obs, real) {
  const failures = [];
  for (const route of real.routes) {
    const head = obs.heads[route.id];
    const title = titleOf(head);
    const description = metaContent(head, "name", "description");
    const robots = metaContent(head, "name", "robots");
    if (title !== real.escapeHtml(route.title)) {
      failures.push(`${route.id} title became ${title}`);
    }
    if (description !== real.escapeHtml(route.description)) {
      failures.push(`${route.id} description drifted`);
    }
    if (robots !== route.robotsMeta) failures.push(`${route.id} robots meta ${robots}`);
  }
  const missingTitle = titleOf(obs.heads["not-found"]);
  if (missingTitle !== real.escapeHtml(real.NOT_FOUND.title)) {
    failures.push(`404 title became ${missingTitle}`);
  }
  return failures;
}

function schemaNotInvented(obs, real) {
  const failures = [];
  for (const route of real.routes) {
    const graph = obs.graphs[route.id];
    if (graph["@context"] !== "https://schema.org") failures.push(`${route.id} context`);
    const top = graph["@graph"].map((node) => node["@type"]);
    for (const type of top) {
      if (!route.schemas.includes(type)) failures.push(`${route.id} invented ${type}`);
    }
    for (const type of collectTypes(graph)) {
      if (!route.schemas.includes(type) && !COMPANION_TYPES.has(type)) {
        failures.push(`${route.id} nested invented ${type}`);
      }
      if (BANNED_TYPES.includes(type)) failures.push(`${route.id} banned ${type}`);
    }
  }
  const missing = obs.graphs["not-found"];
  const missingTypes = missing["@graph"].map((node) => node["@type"]);
  for (const type of missingTypes) {
    if (!["Organization", "WebSite", "WebPage"].includes(type)) {
      failures.push(`404 invented ${type}`);
    }
  }
  const page = missing["@graph"].find((node) => node["@type"] === "WebPage");
  if (page?.url !== undefined) failures.push("404 WebPage invented a url");
  if (JSON.stringify(missing).includes("FAQPage")) failures.push("404 FAQPage");
  return failures;
}

function flags(sample) {
  return ["lcp", "cls", "inp"].filter((key) => sample[key] === true);
}

function cwvOmittedNotPass(obs) {
  const failures = [];
  const omit = flags(obs.vitals.omit);
  if (omit.length) failures.push(`omitted sample passed ${omit.join(",")}`);
  if (obs.vitals.partial.cls || obs.vitals.partial.inp) {
    failures.push("partial sample passed omitted cls or inp");
  }
  if (obs.vitals.partial.lcp !== true) failures.push("supplied lcp 100 did not pass");
  return failures;
}

function cwvMeasuredZero(obs) {
  const failures = [];
  const passed = flags(obs.vitals.zeros);
  if (passed.length !== 3) {
    failures.push(`supplied zeros did not stay measurements: ${passed.join(",")}`);
  }
  return failures;
}

function cwvSlowFails(obs) {
  const failures = [];
  const passed = flags(obs.vitals.slow);
  if (passed.length) failures.push(`slow sample passed ${passed.join(",")}`);
  return failures;
}

function cwvNullAndBlank(obs) {
  const failures = [];
  const nullPass = flags(obs.vitals.nulls);
  const blankPass = flags(obs.vitals.blanks);
  if (nullPass.length || blankPass.length) {
    failures.push(
      "OBLIGATION CWV_MISSING_NULL_OR_BLANK: null and blank vitals are missing, not measurements. " +
        `assessLabVitals(null) passed ${nullPass.join(",") || "none"}; ` +
        `assessLabVitals("") passed ${blankPass.join(",") || "none"}. ` +
        "Number(null) and Number(\"\") are 0, and 0 is inside LCP<=2500, CLS<=0.1, INP<=200, so missing becomes zero and PASS.",
    );
  }
  return failures;
}

function cwvUnobserved(obs) {
  const failures = [];
  const lcp = /lcpMs:\s*vitals\.lcpMs\s*\|\|\s*Date\.now\(\)\s*-\s*started/;
  const inp = /inpMs:\s*vitals\.inpMs\s*\|\|\s*clickMs/;
  if (lcp.test(obs.cwvSource) || inp.test(obs.cwvSource)) {
    failures.push(
      "OBLIGATION CWV_UNOBSERVED_NOT_SUBSTITUTED: an unobserved lab vital must stay UNKNOWN. " +
        "measure-cwv.mjs replaces falsy lcpMs with Date.now()-started and falsy inpMs with clickMs, then scores that stand-in.",
    );
  }
  return failures;
}

function fieldCwvNotClaimed(obs) {
  const failures = [];
  const field = obs.coverage.fieldCwv;
  if (field === 0 || field === "0" || field === "PASS" || field === true) {
    failures.push(`field CWV claimed ${field}`);
  }
  if (/pagespeedonline|crux|fieldCwv"\s*:\s*"(?:PASS|0)"/i.test(obs.cwvSource)) {
    failures.push("CWV harness source claims field data");
  }
  return failures;
}

function liveSerpNotClaimed(obs) {
  const failures = [];
  const value = obs.coverage.liveSerp;
  if (value !== undefined && value !== "UNKNOWN" && value !== "NO") {
    failures.push(`live SERP claimed ${value}`);
  }
  failures.push(...proseFailures(JSON.stringify(obs.heads)));
  return failures;
}

function searchConsoleNotClaimed(obs) {
  const failures = [];
  const value = obs.coverage.searchConsole;
  if (value !== undefined && value !== "NOT_SUBMITTED" && value !== "NO" && value !== "UNKNOWN") {
    failures.push(`coverage searchConsole claimed ${value}`);
  }
  const property = JSON.parse(
    readFileSync(join(ROOT, "apps/web/search-console/property.json"), "utf8"),
  );
  if (property.status !== "NOT_SUBMITTED") failures.push(`property status ${property.status}`);
  if (property.verification !== null) failures.push("verification token present");
  if (property.doNotSubmit !== true) failures.push("doNotSubmit is not true");
  if (property.hosting !== "NOT_AUTHORIZED") failures.push(`property hosting ${property.hosting}`);
  return failures;
}

function networkNotEnabled(obs) {
  const failures = [];
  if (obs.calls.length) failures.push(`fetch called: ${obs.calls.join(",")}`);
  if (/"remote":\s*true|remote:\s*true/.test(obs.cwvSource)) {
    failures.push("CWV harness sets remote true");
  }
  if (/www\.google\.com|search\.google\.com|pagespeedonline/.test(obs.cwvSource)) {
    failures.push("CWV harness names a Google network endpoint");
  }
  return failures;
}

function privateUrlNotIndexed(obs, real) {
  const failures = [];
  const parsed = parseRobots(obs.robots);
  for (const id of NOINDEX_IDS) {
    const route = real.routes.find((item) => item.id === id);
    const loc = real.absoluteUrl(route.path);
    if (sitemapLocs(obs.sitemap).includes(loc)) failures.push(`${id} is in the sitemap`);
    const robots = metaContent(obs.heads[id], "name", "robots");
    if (!String(robots).startsWith("noindex")) failures.push(`${id} robots ${robots}`);
  }
  if (robotsDecision(parsed.rules, "/workspace") !== "disallow") {
    failures.push("workspace would be crawled");
  }
  return failures;
}

function credentialUrlsRejected(obs) {
  const failures = [];
  failures.push(...userinfoHits("robots", obs.robots));
  failures.push(...userinfoHits("sitemap", obs.sitemap));
  failures.push(...userinfoHits("redirects", obs.redirects));
  for (const [id, head] of Object.entries(obs.heads)) {
    failures.push(...userinfoHits(id, head));
  }
  failures.push(...userinfoHits("coverage", JSON.stringify(obs.coverage)));
  if (hasUserinfo(readFixture("canonical-credential.html").match(/href="([^"]+)"/)[1]) !== true) {
    failures.push("credential fixture was not detected");
  }
  return failures;
}

function duplicatesNotProven(obs, real) {
  const failures = [];
  if (obs.sitemap.includes("duplicate-collapse") || obs.sitemap.includes("PROVEN")) {
    failures.push("sitemap claims duplicate collapse is proven");
  }
  const locs = sitemapLocs(obs.sitemap);
  const expected = real.publicIndexRoutes().map((route) => real.absoluteUrl(route.path));
  if (locs.length !== expected.length) {
    failures.push(`sitemap length ${locs.length} collapsed or expanded ${expected.length}`);
  }
  const unique = new Set(locs);
  if (unique.size !== locs.length) failures.push("sitemap contains duplicate locs");
  return failures;
}

function noindexStays(obs, real) {
  const failures = [];
  for (const id of NOINDEX_IDS) {
    const route = real.routeById(id);
    const robots = metaContent(obs.heads[id], "name", "robots");
    if (robots !== route.robotsMeta || !String(robots).includes("noindex")) {
      failures.push(`${id} noindex became ${robots}`);
    }
    if (obs.sitemap.includes(real.absoluteUrl(route.path))) {
      failures.push(`${id} entered the sitemap`);
    }
  }
  return failures;
}

function trailingSlashIdentity(obs, real) {
  const failures = [];
  if (obs.slash.kind !== "route" || obs.slash.route?.id !== "create") {
    failures.push("trailing slash did not keep /create identity");
  }
  const hrefs = lintCanonicals(obs.heads.create).hrefs;
  if (hrefs[0] !== real.absoluteUrl("/create")) {
    failures.push(`create canonical forged as ${hrefs[0]}`);
  }
  const home = lintCanonicals(obs.heads.home).hrefs;
  if (home[0] !== `${ORIGIN}/`) failures.push(`home canonical forged as ${home[0]}`);
  if (sitemapLocs(obs.sitemap).includes(`${ORIGIN}/create/`)) {
    failures.push("trailing-slash create URL entered the sitemap");
  }
  return failures;
}

function semanticAuthorityNone(obs) {
  const failures = [];
  for (const [label, record] of [
    ["coverage", obs.coverage],
    ["public", obs.publicRegistry],
    ["private", obs.privateRegistry],
  ]) {
    const value = record.semanticAuthority;
    if (value !== undefined && value !== "NONE") {
      failures.push(`${label} semanticAuthority ${value}`);
    }
  }
  return failures;
}

function knownGapsRemain(obs) {
  const failures = [];
  if (obs.coverage.doNotSubmit !== true) failures.push("doNotSubmit gap removed");
  if (obs.coverage.hosting !== "NOT_AUTHORIZED") failures.push("hosting gap removed");
  if (obs.coverage.notFound?.status !== 404 || obs.coverage.notFound?.canonical !== null) {
    failures.push("404 gap removed");
  }
  const removed = obs.coverage.removedStructuredData;
  if (!Array.isArray(removed) || !removed.includes("FAQPage")) {
    failures.push("FAQPage removal gap disappeared");
  }
  if (obs.coverage.gaps === "NONE" || obs.coverage.gapsClosed === true) {
    failures.push("gaps marked closed without evidence");
  }
  return failures;
}

function hostingNotAuthorized(obs) {
  const failures = [];
  for (const [label, record] of [
    ["coverage", obs.coverage],
    ["public", obs.publicRegistry],
    ["private", obs.privateRegistry],
  ]) {
    if (record.hosting !== "NOT_AUTHORIZED") failures.push(`${label} hosting ${record.hosting}`);
  }
  return failures;
}

function rankingNotClaimed(obs) {
  const blob = [
    ...Object.values(obs.heads),
    JSON.stringify(obs.coverage),
    JSON.stringify(obs.publicRegistry),
  ].join("\n");
  return proseFailures(blob);
}

function artifactsMatch(obs, real) {
  const failures = [];
  const web = join(ROOT, "apps/web");
  const pairs = [
    ["public/robots.txt", obs.robots, real.renderRobotsTxt()],
    ["public/sitemap.xml", obs.sitemap, real.renderSitemapXml()],
    ["public/_redirects", obs.redirects, real.renderRedirects()],
  ];
  for (const [path, actualText, expectedText] of pairs) {
    const file = readFileSync(join(web, path), "utf8");
    if (file !== expectedText) failures.push(`committed ${path} drifted from donor renderer`);
    if (actualText !== expectedText) failures.push(`rendered ${path} drifted from donor renderer`);
  }
  const coverage = JSON.parse(readFileSync(join(web, "search-console/coverage.json"), "utf8"));
  if (JSON.stringify(coverage) !== JSON.stringify(real.coverageExpectations())) {
    failures.push("committed coverage.json drifted from donor coverageExpectations");
  }
  if (JSON.stringify(obs.coverage) !== JSON.stringify(real.coverageExpectations())) {
    failures.push("coverageExpectations drifted from the donor");
  }
  return failures;
}

function cwvUsesInp(obs) {
  const failures = [];
  const thresholds = obs.vitals.omit.thresholds;
  if (!thresholds || thresholds.lcpMs !== 2500 || thresholds.cls !== 0.1 || thresholds.inpMs !== 200) {
    failures.push(`thresholds ${JSON.stringify(thresholds)}`);
  }
  if (/\bFID\b/.test(obs.cwvSource)) failures.push("CWV harness references FID");
  if (!obs.cwvSource.includes("inpMs")) failures.push("CWV harness has no INP");
  return failures;
}

export async function runAll() {
  const modules = await loadModules();
  const obs = observe(modules);
  const bucket = {};
  const { real } = modules;
  check("robots_honored", () => robotsHonored(obs, real), bucket);
  check("malformed_robots_rejected", () => malformedRobotsRejected(), bucket);
  check("not_found_not_indexable", () => notFoundNotIndexable(obs, real), bucket);
  check("unknown_route_404", () => unknownRoute404(obs), bucket);
  check("redirects_not_a_completed_loop", () => redirectsNotComplete(obs), bucket);
  check("canonicals_not_invented", () => canonicalsNotInvented(obs, real), bucket);
  check("malformed_canonicals_rejected", () => malformedCanonicalsRejected(), bucket);
  check("sitemap_urls_not_fabricated", () => sitemapNotFabricated(obs, real), bucket);
  check("malformed_sitemap_rejected", () => malformedSitemapRejected(), bucket);
  check("hreflang_fail_closed", () => hreflangFailClosed(obs, real), bucket);
  check("metadata_not_invented", () => metadataNotInvented(obs, real), bucket);
  check("schema_not_invented", () => schemaNotInvented(obs, real), bucket);
  check("cwv_omitted_not_pass", () => cwvOmittedNotPass(obs), bucket);
  check("cwv_measured_zero_is_a_measurement", () => cwvMeasuredZero(obs), bucket);
  check("cwv_slow_sample_fails", () => cwvSlowFails(obs), bucket);
  check("cwv_null_and_blank_stay_unknown", () => cwvNullAndBlank(obs), bucket);
  check("cwv_unobserved_not_substituted", () => cwvUnobserved(obs), bucket);
  check("field_cwv_not_claimed", () => fieldCwvNotClaimed(obs), bucket);
  check("live_serp_not_claimed", () => liveSerpNotClaimed(obs), bucket);
  check("search_console_not_claimed", () => searchConsoleNotClaimed(obs), bucket);
  check("network_not_enabled", () => networkNotEnabled(obs), bucket);
  check("private_url_not_indexed", () => privateUrlNotIndexed(obs, real), bucket);
  check("credential_urls_rejected", () => credentialUrlsRejected(obs), bucket);
  check("duplicates_not_proven", () => duplicatesNotProven(obs, real), bucket);
  check("noindex_stays_noindex", () => noindexStays(obs, real), bucket);
  check("trailing_slash_identity", () => trailingSlashIdentity(obs, real), bucket);
  check("semantic_authority_none", () => semanticAuthorityNone(obs), bucket);
  check("known_gaps_remain", () => knownGapsRemain(obs), bucket);
  check("hosting_not_authorized", () => hostingNotAuthorized(obs), bucket);
  check("ranking_and_indexing_not_claimed", () => rankingNotClaimed(obs), bucket);
  check("emitted_artifacts_match_renderer", () => artifactsMatch(obs, real), bucket);
  check("cwv_uses_inp_thresholds", () => cwvUsesInp(obs), bucket);
  return {
    ledger: LEDGER,
    hreflangInRenderedArtifacts: 0,
    checks: bucket,
  };
}

const isMain = Boolean(
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]),
);

if (isMain) {
  const result = await runAll();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
