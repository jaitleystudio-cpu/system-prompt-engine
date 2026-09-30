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

cursor = fetchCalls.length;
const traversalResult = await urlMod.ingestUrl(
  "https://systempromptengine.com/../../etc/passwd",
  { networkPolicy: { pageOrigin: page, connectSrc: selfSrc } },
);
const traversalFetch = since(cursor).length;

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
  traversal_fetch: traversalFetch > 0,
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
