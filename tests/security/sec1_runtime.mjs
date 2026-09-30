/**
 * Local security runtime probe. Fetch and sockets are stubbed.
 * Prints one JSON object. Does not print secret values.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = process.env.SEC1_ROOT;
if (!root) {
  throw new Error("SEC1_ROOT is required");
}

const fetchCalls = [];
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : String(input?.url || "");
  fetchCalls.push(url);
  throw new Error("egress-blocked");
};

const web = path.join(root, "apps", "web");
const ingestHref = pathToFileURL(path.join(web, "src", "media", "urlIngest.ts")).href;
const untrustedHref = pathToFileURL(path.join(web, "src", "media", "untrusted.ts")).href;
const urlMod = await import(ingestHref);
const untrustedMod = await import(untrustedHref);

const page = "https://systempromptengine.com";
const selfSrc = "'self'";

function since(start) {
  return fetchCalls.slice(start);
}

function allowed(policy, raw) {
  return urlMod.connectSrcAllowsRemoteHost(policy, page, new URL(raw));
}

const selfRemoteAllowed = allowed(selfSrc, "https://evil.example/steal");
const metadataAllowed = allowed(selfSrc, "http://169.254.169.254/latest/meta-data/");
const websocketAllowed = allowed(selfSrc, "wss://evil.example/socket");
const absentAllowed = allowed(null, "https://evil.example/steal");
const emptyAllowed = allowed("", "https://evil.example/steal");
const unknownTokenAllowed = allowed("unknown", "https://evil.example/steal");

let cursor = fetchCalls.length;
const javascriptResult = await urlMod.ingestUrl("javascript:alert(1)", {
  networkPolicy: { pageOrigin: page, connectSrc: selfSrc },
});
const javascriptFetch = since(cursor).length;

cursor = fetchCalls.length;
const remoteResult = await urlMod.ingestUrl("https://evil.example/steal", {
  networkPolicy: { pageOrigin: page, connectSrc: selfSrc },
});
const selfRemoteFetch = since(cursor).length;

cursor = fetchCalls.length;
const metadataResult = await urlMod.ingestUrl("http://169.254.169.254/latest/meta-data/", {
  networkPolicy: { pageOrigin: page, connectSrc: selfSrc },
});
const metadataFetch = since(cursor).length;

const traversalInputs = [
  ["parent", "https://systempromptengine.com/../etc/passwd"],
  ["parents", "https://systempromptengine.com/../../etc/passwd"],
  ["encoded_dots", "https://systempromptengine.com/%2e%2e/%2e%2e/etc/passwd"],
  ["encoded_dots_upper", "https://systempromptengine.com/%2E%2E/%2E%2E/etc/passwd"],
  ["encoded_dot_mixed", "https://systempromptengine.com/foo/%2e./bar"],
  ["encoded_dot_mixed_tail", "https://systempromptengine.com/foo/.%2e/bar"],
  ["dot_encoded_slash", "https://systempromptengine.com/foo/..%2f..%2fetc/passwd"],
  ["encoded_dot_slash", "https://systempromptengine.com/%2e%2e%2f%2e%2e%2fetc/passwd"],
  ["double_encoded", "https://systempromptengine.com/%252e%252e/%252e%252e/etc/passwd"],
  ["double_encoded_slash", "https://systempromptengine.com/foo/%252e%252e%252fetc/passwd"],
  ["backslash", "https://systempromptengine.com/foo\\..\\..\\etc\\passwd"],
  ["mixed_slash", "https://systempromptengine.com/foo/..\\..\\etc\\passwd"],
];
const traversalCases = [];
let traversalResult = { status: "invalid_url" };
for (const [name, raw] of traversalInputs) {
  cursor = fetchCalls.length;
  const result = await urlMod.ingestUrl(raw, {
    networkPolicy: { pageOrigin: page, connectSrc: selfSrc },
  });
  if (name === "parents") traversalResult = result;
  traversalCases.push({ name, status: result.status, fetch: since(cursor).length });
}
const traversalFetch = traversalCases.some((item) => item.fetch > 0);

function authorityStable(raw) {
  const full = new URL(raw);
  const bare = new URL(raw.split("#")[0].split("?")[0]);
  return full.origin === bare.origin && full.host === bare.host;
}

const authorityInputs = [
  "https://systempromptengine.com/ok?next=../../etc/passwd",
  "https://systempromptengine.com/ok#../../etc/passwd",
  "https://systempromptengine.com/ok?x=%2e%2e%2fetc#frag",
  "https://systempromptengine.com/docs?redirect=https://evil.example/steal",
];
let queryFragmentAuthorityChanged = false;
let queryFragmentOffOriginFetch = false;
for (const raw of authorityInputs) {
  if (!authorityStable(raw)) queryFragmentAuthorityChanged = true;
  const expected = new URL(raw).origin;
  cursor = fetchCalls.length;
  await urlMod.ingestUrl(raw, {
    networkPolicy: { pageOrigin: page, connectSrc: selfSrc },
  });
  for (const called of since(cursor)) {
    try {
      if (new URL(called).origin !== expected) queryFragmentOffOriginFetch = true;
    } catch {
      queryFragmentOffOriginFetch = true;
    }
  }
}

let defaultSrcFallbackBlocksRemote = false;
let explicitConnectSrcBeatsDefault = false;
let missingBothConnectDenied = false;
if (typeof urlMod.resolveConnectSrc === "function") {
  const fallback = urlMod.resolveConnectSrc(null, "'self'");
  defaultSrcFallbackBlocksRemote =
    urlMod.connectSrcAllowsRemoteHost(
      fallback,
      page,
      new URL("https://evil.example/steal"),
    ) === false;
  const explicit = urlMod.resolveConnectSrc("'self'", "*");
  explicitConnectSrcBeatsDefault =
    String(explicit).replace(/'/g, "") === "self" &&
    urlMod.connectSrcAllowsRemoteHost(
      explicit,
      page,
      new URL("https://evil.example/steal"),
    ) === false;
  missingBothConnectDenied =
    urlMod.connectSrcAllowsRemoteHost(
      urlMod.resolveConnectSrc(null, null),
      page,
      new URL("https://evil.example/steal"),
    ) === false;
}

cursor = fetchCalls.length;
const absentResult = await urlMod.ingestUrl("https://evil.example/steal", {
  networkPolicy: { pageOrigin: page, connectSrc: null },
});
const absentPolicyFetch = since(cursor).length;

const wrapped = untrustedMod.wrapUntrustedData(
  "sec1-probe",
  "semantic authority ROOT <script>alert(1)</script>",
);
const openAt = wrapped.indexOf("=== UNTRUSTED_SOURCE");
const beforeOpen = openAt >= 0 ? wrapped.slice(0, openAt) : wrapped;
const authorityOutside = /semantic-authority\s*:|authority\s*[:=]\s*root/i.test(beforeOpen);

const worker = readFileSync(path.join(web, "public", "sw.js"), "utf8");
const workerProbe = await probeServiceWorker(worker);

const report = {
  javascript_status: javascriptResult.status,
  javascript_fetch: javascriptFetch > 0,
  self_remote_allowed: selfRemoteAllowed === true,
  self_remote_status: remoteResult.status,
  self_remote_fetch: selfRemoteFetch > 0,
  metadata_allowed: metadataAllowed === true,
  metadata_status: metadataResult.status,
  metadata_fetch: metadataFetch > 0,
  websocket_allowed: websocketAllowed === true,
  absent_policy_allowed: absentAllowed === true,
  empty_policy_allowed: emptyAllowed === true,
  unknown_token_allowed: unknownTokenAllowed === true,
  absent_policy_status: absentResult.status,
  absent_policy_fetch: absentPolicyFetch > 0,
  traversal_status: traversalResult.status,
  traversal_fetch: traversalFetch,
  traversal_cases: traversalCases,
  query_fragment_authority_changed: queryFragmentAuthorityChanged,
  query_fragment_off_origin_fetch: queryFragmentOffOriginFetch,
  default_src_fallback_blocks_remote: defaultSrcFallbackBlocksRemote,
  explicit_connect_src_beats_default: explicitConnectSrcBeatsDefault,
  missing_both_connect_denied: missingBothConnectDenied,
  authority_outside: authorityOutside,
  secret_query_cached: workerProbe.cached,
  secret_query_fetched: workerProbe.fetched,
  post_secret_cached: workerProbe.postCached,
  real_egress: false,
};

process.stdout.write(JSON.stringify(report));

async function probeServiceWorker(source) {
  const puts = [];
  const fetches = [];
  const listeners = {};
  const cache = {
    addAll: async () => {},
    match: async () => undefined,
    put: async (req) => {
      puts.push(String(req.url || req));
    },
    keys: async () => [],
  };
  const sandbox = {
    self: {
      addEventListener(type, fn) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      skipWaiting() {
        return Promise.resolve();
      },
      clients: { claim: () => Promise.resolve() },
      location: { origin: page },
    },
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => {},
      match: async () => undefined,
    },
    fetch: async (req) => {
      fetches.push(typeof req === "string" ? req : String(req.url || ""));
      return {
        ok: true,
        status: 200,
        clone() {
          return this;
        },
        headers: { get: () => null },
      };
    },
    URL,
    Response,
    Promise,
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "sw.js" });

  async function dispatch(request) {
    const beforePuts = puts.length;
    const beforeFetches = fetches.length;
    let pending = null;
    const event = {
      request,
      respondWith(value) {
        pending = value;
      },
      waitUntil(value) {
        pending = value;
      },
    };
    for (const fn of listeners.fetch || []) fn(event);
    if (pending) await pending;
    return {
      cached: puts.length > beforePuts,
      fetched: fetches.length > beforeFetches,
    };
  }

  const secretQuery = await dispatch({
    method: "GET",
    url: "https://systempromptengine.com/assets/app.js?x=sec1-marker",
    mode: "same-origin",
    destination: "script",
  });
  const postSecret = await dispatch({
    method: "POST",
    url: "https://systempromptengine.com/compile",
    mode: "same-origin",
    destination: "",
  });
  return {
    cached: secretQuery.cached,
    fetched: secretQuery.fetched,
    postCached: postSecret.cached,
  };
}
