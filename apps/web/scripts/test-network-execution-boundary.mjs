#!/usr/bin/env node
/**
 * SPE-R9-G repair — network execution-boundary adversarial gate.
 *
 * Exercises the canonical SSRF owner (engine/multimodal/urlSecurity.ts) at the
 * point of execution: resolved-address classification, trusted-resolver
 * fail-closed behaviour, per-hop redirect validation, destination binding, and
 * the wiring of media/urlIngest.ts (the only existing web fetch sink).
 *
 * Builder regression only. This is NOT independent security qualification.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const target = process.env.SPE_URL_SECURITY_PATH || join(src, "engine/multimodal/urlSecurity.ts");
// Mutation hook for the only fetch sink: a temp copy of media/urlIngest.ts.
const ingestSource = process.env.SPE_URL_INGEST_PATH || join(src, "media/urlIngest.ts");
const sec = await import(pathToFileURL(target).href);

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks += 1; };

// Fake transport: scripted responses keyed by URL; records every request.
// A pinning fake reports the peer it "connected" to: the pinned address by
// default, or `connectedOverride` (string / null) to simulate a binding defect.
function scriptedTransport(script, { pins = false, connectedOverride } = {}) {
  const calls = [];
  const peers = new WeakMap();
  const t = {
    calls,
    pinsResolvedAddress: pins,
    async request(url, init, pinned) {
      calls.push({ url, redirect: init.redirect, pinned });
      const step = script[url];
      if (!step) assert.fail("UNEXPECTED_REQUEST (forbidden hop reached transport) " + url);
      const res = step.opaque
        ? { type: "opaqueredirect", status: 0, headers: new Headers(), body: null }
        : new Response(step.body ?? "", { status: step.status ?? 200, headers: step.headers ?? {} });
      peers.set(res, connectedOverride === undefined ? pinned : connectedOverride);
      return res;
    },
  };
  if (pins) t.connectedAddress = (res) => peers.get(res);
  return t;
}
const publicResolver = (map) => async (host) => {
  if (!(host in map)) throw new Error("NXDOMAIN " + host);
  return map[host];
};

console.log("B1: forbidden address classes (resolved addresses)...");
const forbidden = [
  "0.0.0.0", "0.1.2.3", "10.0.0.1", "100.64.0.1", "100.127.255.254", "127.0.0.1", "127.255.255.255",
  "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "224.0.0.1", "239.255.255.250",
  "240.0.0.1", "255.255.255.255", "192.0.2.10", "198.51.100.7", "203.0.113.9", "198.18.0.1", "192.0.0.8",
  "::", "::1", "0:0:0:0:0:0:0:1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%en0", "febf::1", "ff02::1",
  "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe",
  "::127.0.0.1", "::7f00:1", "::ffff:0:127.0.0.1", "64:ff9b::169.254.169.254", "64:ff9b::a00:1",
  "64:ff9b:1::1", "2002:7f00:1::", "2002:a9fe:a9fe::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2",
  "2001:db8::1", "3fff::1", "3fff:0fff::1", "fec0::1", "100::1", "3fff::1".replace("3fff", "4000"), "not-an-ip", "", "1.2.3", "01.2.3.4",
];
for (const a of forbidden) {
  const c = sec.classifyIpAddress(a);
  ok(c.forbidden === true, `address must be forbidden: ${JSON.stringify(a)} -> ${JSON.stringify(c)}`);
}
const allowed = ["93.184.215.14", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1"];
for (const a of allowed) {
  const c = sec.classifyIpAddress(a);
  ok(c.forbidden === false, `public address must be allowed: ${a} -> ${JSON.stringify(c)}`);
}

console.log("B2: lexical gate preserved + strengthened for alternate localhost / embedded IPv6 forms...");
for (const u of [
  "http://127.0.0.1/", "http://127.1/", "http://0x7f.0.0.1/", "http://2130706433/", "http://017700000001/",
  "http://localhost/", "http://localhost./", "http://LOCALHOST/", "http://a.localhost/", "http://[::1]/",
  "http://[::ffff:127.0.0.1]/", "http://[0:0:0:0:0:ffff:7f00:1]/", "http://[::127.0.0.1]/",
  "http://[64:ff9b::169.254.169.254]/", "http://[2002:7f00:1::]/", "http://[::ffff:0:127.0.0.1]/",
  "http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/", "http://169.254.169.254/latest/meta-data",
  "http://metadata.google.internal/", "http://0.0.0.0/",
]) {
  eq(sec.isSsrfSafeUrl(new URL(u)).safe, false, `lexical gate must refuse ${u}`);
}
for (const u of ["https://example.com/", "https://docs.github.com/en", "http://[2606:4700:4700::1111]/"]) {
  eq(sec.isSsrfSafeUrl(new URL(u)).safe, true, `lexical gate must allow ${u}`);
}

console.log("B3: public hostname -> private DNS answer refused before connect...");
for (const [answers, label] of [
  [["10.0.0.5"], "rfc1918"], [["127.0.0.1"], "loopback"], [["169.254.169.254"], "metadata"],
  [["::1"], "v6 loopback"], [["::ffff:127.0.0.1"], "v4-mapped loopback"], [["fd00::1"], "ula"],
  [["93.184.215.14", "10.0.0.5"], "mixed public+private"],
]) {
  const t = scriptedTransport({});
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", {
    transport: t, resolveHost: async () => answers, policy: sec.DestinationPolicies.REQUIRE_RESOLUTION,
  });
  eq(r.ok, false, `private DNS (${label}) must be refused`);
  ok(String(r.reason).startsWith("RESOLVED_"), `reason RESOLVED_* for ${label}: ${r.reason}`);
  eq(t.calls.length, 0, `no connection attempted for ${label}`);
}

console.log("B4: DNS failure / empty answer / garbage answer fail closed...");
for (const [resolver, reason] of [
  [async () => { throw new Error("SERVFAIL"); }, "DNS_RESOLUTION_FAILED"],
  [async () => [], "DNS_NO_ADDRESSES"],
  [async () => ["not-an-address"], "RESOLVED_ADDRESS_UNPARSEABLE"],
]) {
  const t = scriptedTransport({});
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", {
    transport: t, resolveHost: resolver, policy: sec.DestinationPolicies.REQUIRE_RESOLUTION,
  });
  eq(r.ok, false, `${reason} must fail closed`);
  eq(r.reason, reason, `reason ${reason}`);
  eq(t.calls.length, 0, `no connection for ${reason}`);
}

console.log("B5: redirect hops validated before request (public -> loopback / metadata / public->public->private)...");
const resolver = publicResolver({
  "public-site.example.org": ["93.184.215.14"],
  "hop2.example.net": ["93.184.215.15"],
  "rebind.example.net": ["10.1.2.3"],
});
const chains = [
  ["public -> 127.0.0.1", { "https://public-site.example.org/": { status: 302, headers: { location: "http://127.0.0.1/admin" } } }, 1],
  ["public -> metadata", { "https://public-site.example.org/": { status: 301, headers: { location: "http://169.254.169.254/latest/meta-data/" } } }, 1],
  ["public -> localhost", { "https://public-site.example.org/": { status: 307, headers: { location: "http://localhost/" } } }, 1],
  ["public -> RFC1918", { "https://public-site.example.org/": { status: 308, headers: { location: "http://192.168.0.1/" } } }, 1],
  ["public -> private IPv6", { "https://public-site.example.org/": { status: 302, headers: { location: "http://[fd00::1]/" } } }, 1],
  ["public -> v4-mapped IPv6", { "https://public-site.example.org/": { status: 302, headers: { location: "http://[::ffff:169.254.169.254]/" } } }, 1],
  ["public -> NAT64 metadata", { "https://public-site.example.org/": { status: 302, headers: { location: "http://[64:ff9b::a9fe:a9fe]/" } } }, 1],
  ["public -> public -> private literal", {
    "https://public-site.example.org/": { status: 302, headers: { location: "https://hop2.example.net/next" } },
    "https://hop2.example.net/next": { status: 303, headers: { location: "http://10.0.0.7/" } },
  }, 2],
  ["public -> public -> host resolving private", {
    "https://public-site.example.org/": { status: 302, headers: { location: "https://hop2.example.net/next" } },
    "https://hop2.example.net/next": { status: 302, headers: { location: "https://rebind.example.net/" } },
  }, 2],
];
for (const [label, script, expectedCalls] of chains) {
  const t = scriptedTransport(script);
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", {
    transport: t, resolveHost: resolver, policy: sec.DestinationPolicies.REQUIRE_RESOLUTION,
  });
  eq(r.ok, false, `${label} must be refused`);
  eq(t.calls.length, expectedCalls, `${label}: forbidden hop must never be requested (calls=${t.calls.length})`);
  ok(t.calls.every((c) => c.redirect === "manual"), `${label}: transport must never auto-follow`);
}
{
  // Same chain without a resolver in browser policy: lexical per-hop still refuses literal private hops.
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 302, headers: { location: "http://127.0.0.1/" } } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE });
  eq(r.ok, false, "browser policy still refuses literal loopback hop");
  eq(t.calls.length, 1, "browser policy: loopback hop never requested");
}

console.log("B6: opaque browser redirect, missing Location, redirect limit fail closed...");
{
  const t = scriptedTransport({ "https://public-site.example.org/": { opaque: true } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE });
  eq(r.reason, "REDIRECT_DESTINATION_UNVERIFIABLE", "opaqueredirect fails closed");
  eq(sec.isUnverifiableDestinationRefusal(r.reason), true, "opaque classified as unverifiable");
}
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 302 } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver, policy: sec.DestinationPolicies.REQUIRE_RESOLUTION });
  eq(r.reason, "REDIRECT_LOCATION_MISSING", "3xx without Location fails closed");
}
{
  const script = {};
  for (let i = 0; i < 10; i += 1) script[`https://public-site.example.org/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
  const t = scriptedTransport(script);
  const r = await sec.guardedPublicFetch("https://public-site.example.org/0", { transport: t, resolveHost: resolver, policy: sec.DestinationPolicies.REQUIRE_RESOLUTION, maxRedirects: 3 });
  eq(r.reason, "REDIRECT_LIMIT_EXCEEDED", "redirect loop bounded");
  eq(t.calls.length, 4, "exactly maxRedirects+1 requests");
}

console.log("B7: destination binding (DNS rebinding) — default policy requires a pinning transport...");
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "ok" } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.ok, false, "non-pinning transport under default policy must fail closed");
  eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", "binding unverifiable reason");
  eq(t.calls.length, 0, "no request when binding unverifiable");
}
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "ok" } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t });
  eq(r.reason, "TRUSTED_RESOLVER_UNAVAILABLE", "default policy without resolver fails closed");
}
{
  // Rebinding resolver: first answer public, every later answer private. A pinning transport
  // must receive exactly the validated address; the resolver must be consulted once per hop.
  let n = 0;
  const rebinding = async () => (n++ === 0 ? ["93.184.215.14"] : ["127.0.0.1"]);
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "ok" } }, { pins: true });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: rebinding });
  eq(r.ok, true, "pinned public destination permitted");
  eq(r.destinationIdentity, "RESOLVED_AND_PINNED", "identity RESOLVED_AND_PINNED");
  eq(t.calls[0].pinned, "93.184.215.14", "connection pinned to the validated address");
  eq(n, 1, "resolver consulted exactly once for the hop");
}
{
  // Explicit opt-in policy on the canonical primitive only (disclosed TOCTOU).
  // No product sink may select it — see the static check in B10.
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "ok" } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver, policy: sec.DestinationPolicies.REQUIRE_RESOLUTION });
  eq(r.ok, true, "resolution-only policy permits safe public host");
  eq(r.destinationIdentity, "RESOLVED_NOT_PINNED", "TOCTOU disclosed as RESOLVED_NOT_PINNED");
}

console.log("B7b: binding — validated address must equal the connected destination...");
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "secret" } }, { pins: true, connectedOverride: "10.0.0.9" });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.ok, false, "pinning transport that connected elsewhere fails closed");
  eq(r.reason, "DESTINATION_BINDING_MISMATCH", "mismatch reason");
  // Updated in the literal-binding closure: a proven different peer is a HARD
  // refusal, no longer grouped with "unverifiable" (which maps to reference-only).
  eq(sec.isDestinationBindingMismatch(r.reason), true, "mismatch classified as hard binding mismatch");
  eq(sec.isUnverifiableDestinationRefusal(r.reason), false, "mismatch is NOT an unverifiable/reference-only refusal");
  eq(sec.isDestinationBindingUnverifiable(r.reason), false, "mismatch is NOT binding-unverifiable");
  ok(!("response" in r), "mismatched body never delivered");
}
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "secret" } }, { pins: true, connectedOverride: null });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", "pinning transport that cannot report its peer fails closed");
  eq(sec.isUnverifiableDestinationRefusal(r.reason), true, "missing peer proof is unverifiable (reference-only acceptable)");
  eq(sec.isDestinationBindingMismatch(r.reason), false, "missing peer proof is not a mismatch");
}
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "secret" } });
  t.pinsResolvedAddress = true; // declares pinning but exposes no connectedAddress
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", "pinning declaration alone is not trusted");
}

console.log("B7c: browser policy — cross-origin hops refused before any request...");
{
  const t = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "x" } });
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE, sameOriginOnly: { origin: "https://spe.app" } });
  eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", "cross-origin browser read refused");
  eq(t.calls.length, 0, "cross-origin browser read: zero requests");
  const t2 = scriptedTransport({ "https://public-site.example.org/": { status: 200, body: "x" } });
  const r2 = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t2, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE, sameOriginOnly: { origin: null } });
  eq(r2.reason, "DESTINATION_BINDING_UNVERIFIABLE", "unknown page origin trusts nothing");
  eq(t2.calls.length, 0, "unknown page origin: zero requests");
  const t3 = scriptedTransport({ "https://93.184.215.14/": { status: 200, body: "x" } });
  const r3 = await sec.guardedPublicFetch("https://93.184.215.14/", { transport: t3, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE, sameOriginOnly: { origin: "https://spe.app" } });
  eq(r3.reason, "DESTINATION_BINDING_UNVERIFIABLE", "cross-origin public IP literal refused in browser policy");
  eq(t3.calls.length, 0, "cross-origin IP literal: zero requests");
  const t4 = scriptedTransport({
    "https://spe.app/page": { status: 302, headers: { location: "https://public-site.example.org/" } },
  });
  const r4 = await sec.guardedPublicFetch("https://spe.app/page", { transport: t4, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE, sameOriginOnly: { origin: "https://spe.app" } });
  eq(r4.reason, "DESTINATION_BINDING_UNVERIFIABLE", "same-origin -> cross-origin redirect refused");
  eq(t4.calls.length, 1, "cross-origin redirect hop never requested");
  const t5 = scriptedTransport({ "https://spe.app/page": { status: 200, body: "x" } });
  const r5 = await sec.guardedPublicFetch("https://spe.app/page", { transport: t5, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE, sameOriginOnly: { origin: "https://spe.app" } });
  eq(r5.ok, true, "same-origin browser read permitted");
  eq(r5.destinationIdentity, "UNVERIFIED_BROWSER", "same-origin browser read stays UNVERIFIED_BROWSER (never labelled verified)");
  const t6 = scriptedTransport({ "https://93.184.215.14/page": { status: 200, body: "x" } });
  const r6 = await sec.guardedPublicFetch("https://93.184.215.14/page", { transport: t6, policy: sec.DestinationPolicies.BROWSER_UNVERIFIABLE, sameOriginOnly: { origin: "https://93.184.215.14" } });
  eq(r6.ok, true, "same-origin IP-literal browser read permitted");
  eq(r6.destinationIdentity, "UNVERIFIED_BROWSER", "same-origin IP literal in browser stays UNVERIFIED_BROWSER, not IP_LITERAL");
}

console.log("B7d: IP-literal destinations need connected-address proof under the pinned policy...");
// Stream body that records whether anyone read it (highWaterMark 0: no pre-pull).
function trackedBody(text) {
  const state = { pulls: 0, cancelled: false };
  const stream = new ReadableStream({
    pull(controller) { state.pulls += 1; controller.enqueue(new TextEncoder().encode(text)); controller.close(); },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  return { stream, state };
}
function peerTransport(peer, { pins = true } = {}) {
  const calls = [];
  const bodies = [];
  return {
    calls, bodies, pinsResolvedAddress: pins,
    async request(url, init, pinned) {
      calls.push({ url, pinned, redirect: init.redirect });
      const b = trackedBody("secret");
      bodies.push(b.state);
      return new Response(b.stream, { status: 200, headers: { "content-type": "text/html" } });
    },
    connectedAddress: () => (typeof peer === "function" ? peer() : peer),
  };
}
for (const [label, url] of [["A: public IPv4 literal", "https://93.184.215.14/"], ["B: public IPv6 literal", "https://[2606:4700:4700::1111]/"]]) {
  for (const extra of [{}, { resolveHost: resolver }]) {
    const t = peerTransport("93.184.215.14", { pins: false });
    const r = await sec.guardedPublicFetch(url, { transport: t, ...extra });
    eq(r.ok, false, `${label}: non-pinning transport refused`);
    eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", `${label}: DESTINATION_BINDING_UNVERIFIABLE`);
    eq(t.calls.length, 0, `${label}: ZERO requests (literal is not connected-destination proof)`);
  }
  const t2 = peerTransport("93.184.215.14", { pins: false });
  const r2 = await sec.guardedPublicFetch(url, { transport: t2, policy: sec.DestinationPolicies.REQUIRE_PINNED_RESOLUTION });
  eq(t2.calls.length, 0, `${label}: explicit REQUIRE_PINNED_RESOLUTION also zero requests`);
  eq(r2.reason, "DESTINATION_BINDING_UNVERIFIABLE", `${label}: explicit policy reason`);
}
{
  const t = peerTransport("93.184.215.14");
  const r = await sec.guardedPublicFetch("https://93.184.215.14/", { transport: t });
  eq(r.ok, true, "C: public IPv4 literal + pinning transport + connected == literal permitted");
  eq(r.destinationIdentity, "IP_LITERAL", "C: identity IP_LITERAL (bound)");
  eq(t.calls[0].pinned, "93.184.215.14", "C: transport pinned to the literal");
  const t6 = peerTransport("2606:4700:4700::1111");
  const r6 = await sec.guardedPublicFetch("https://[2606:4700:4700::1111]/", { transport: t6 });
  eq(r6.ok, true, "C: public IPv6 literal + pinning + matching peer permitted");
}
{
  const t = peerTransport("10.0.0.9");
  const r = await sec.guardedPublicFetch("https://93.184.215.14/", { transport: t });
  eq(r.ok, false, "D: literal + pinning + different peer refused");
  eq(r.reason, "DESTINATION_BINDING_MISMATCH", "D: DESTINATION_BINDING_MISMATCH");
  eq(sec.isUnverifiableDestinationRefusal(r.reason), false, "D: mismatch never unverifiable/reference-only");
  ok(!("response" in r), "D: no response handed to caller");
  eq(t.bodies[0].pulls, 0, "D: body never consumed");
  eq(t.bodies[0].cancelled, true, "D: body discarded");
}
{
  const t = peerTransport(null);
  const r = await sec.guardedPublicFetch("https://93.184.215.14/", { transport: t });
  eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", "literal + pinning + missing peer -> unverifiable");
  eq(t.bodies[0].pulls, 0, "missing peer: body never consumed");
  eq(t.bodies[0].cancelled, true, "missing peer: body discarded");
}
{
  const t = peerTransport("10.1.1.1");
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.reason, "DESTINATION_BINDING_MISMATCH", "E: hostname resolved public + connected mismatch");
  eq(sec.isDestinationBindingMismatch(r.reason), true, "E: hard mismatch classification");
  eq(sec.isUnverifiableDestinationRefusal(r.reason), false, "E: not unverifiable");
  eq(t.bodies[0].pulls, 0, "E: body never consumed");
}
{
  const t = peerTransport(undefined);
  const r = await sec.guardedPublicFetch("https://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.reason, "DESTINATION_BINDING_UNVERIFIABLE", "F: hostname resolved public + missing connected identity -> unverifiable");
  eq(sec.isDestinationBindingMismatch(r.reason), false, "F: not a mismatch");
  eq(t.bodies[0].pulls, 0, "F: body never consumed");
}

console.log("B8: safe public chain remains permitted...");
{
  const t = scriptedTransport({
    "http://public-site.example.org/": { status: 301, headers: { location: "https://public-site.example.org/" } },
    "https://public-site.example.org/": { status: 200, body: "<html>hi</html>" },
  }, { pins: true });
  const r = await sec.guardedPublicFetch("http://public-site.example.org/", { transport: t, resolveHost: resolver });
  eq(r.ok, true, "public -> public permitted");
  eq(r.finalUrl, "https://public-site.example.org/", "finalUrl tracks validated hop");
  eq(r.hops.length, 2, "two validated hops recorded");
  eq(await r.response.text(), "<html>hi</html>", "body delivered");
}

console.log("B9: real socket — redirect to metadata is refused after exactly one server hit...");
{
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits += 1;
    res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/iam" });
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  // Test transport: routes the validated public hostname to the local server, pinning by construction.
  // Test double: it reports the pinned address as its peer (routing by construction).
  const peers = new WeakMap();
  const transport = {
    pinsResolvedAddress: true,
    calls: 0,
    async request(url, init, pinned) {
      transport.calls += 1;
      const u = new URL(url);
      const res = await fetch(`http://127.0.0.1:${port}${u.pathname}`, { ...init, headers: { host: u.host } });
      peers.set(res, pinned);
      return res;
    },
    connectedAddress: (res) => peers.get(res),
  };
  try {
    const r = await sec.guardedPublicFetch("https://public-site.example.org/start", { transport, resolveHost: resolver });
    eq(r.ok, false, "real 302 -> metadata refused");
    eq(r.reason, "LEXICAL_METADATA_LINK_LOCAL_IP", "metadata reason");
    eq(hits, 1, "server hit exactly once");
    eq(transport.calls, 1, "metadata hop never requested");
  } finally {
    server.close();
  }
}

console.log("B10: urlIngest wiring — the existing fetch sink uses the boundary and fails closed on binding...");
async function bundleIngest() {
  const resolveDir = join(src, "media");
  const redirectSecurity = {
    name: "spe-url-security-under-test",
    setup(b) {
      b.onResolve({ filter: /engine\/multimodal\/urlSecurity$/ }, () => ({ path: target }));
    },
  };
  const bundled = await build({
    stdin: { contents: readFileSync(ingestSource, "utf8"), resolveDir, sourcefile: "media/urlIngest.ts", loader: "ts" },
    bundle: true, write: false, format: "esm", platform: "node", plugins: [redirectSecurity],
  });
  return import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
}
{
  // Static: no product source selects the non-pinning resolution policy.
  const ingestText = readFileSync(join(src, "media/urlIngest.ts"), "utf8");
  ok(!/DestinationPolicies\.REQUIRE_RESOLUTION\b/.test(ingestText), "urlIngest.ts must not select REQUIRE_RESOLUTION");
}
{
  const ingest = await bundleIngest();
  const realFetch = globalThis.fetch;
  const open = { pageOrigin: null, connectSrc: "*" };
  // Same-origin page: the only browser read SPE still attempts.
  const sameOrigin = { pageOrigin: "https://public-site.example.org", connectSrc: "*" };
  const html = () => new Response("<html><title>x</title></html>", { status: 200, headers: { "content-type": "text/html" } });
  try {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, redirect: init?.redirect });
      if (url === "https://public-site.example.org/") return new Response("", { status: 302, headers: { location: "http://127.0.0.1/admin" } });
      assert.fail("UNEXPECTED_REQUEST " + url);
    };
    const r1 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: sameOrigin });
    eq(r1.status, "invalid_url", "ingestUrl: public -> loopback redirect refused");
    eq(calls.length, 1, "ingestUrl: loopback hop never requested");
    eq(calls[0].redirect, "manual", "ingestUrl: transport never auto-follows");

    calls.length = 0;
    globalThis.fetch = async (url) => { calls.push({ url }); return { type: "opaqueredirect", status: 0, headers: new Headers(), body: null }; };
    const r2 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: sameOrigin });
    eq(r2.status, "url_reference_only", "ingestUrl: opaque browser redirect -> reference only");
    eq(r2.reason, "remote_fetch_unavailable", "ingestUrl: opaque reference reason");

    calls.length = 0;
    globalThis.fetch = async (url) => { calls.push({ url }); return html(); };
    const r3 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: open, resolveHost: async () => ["10.9.9.9"] });
    eq(r3.status, "invalid_url", "ingestUrl: resolver says private -> refused");
    eq(calls.length, 0, "ingestUrl: zero requests when DNS private");

    const r4 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: open, resolveHost: async () => { throw new Error("SERVFAIL"); } });
    eq(r4.status, "invalid_url", "ingestUrl: DNS failure fails closed");
    eq(calls.length, 0, "ingestUrl: zero requests on DNS failure");

    // OBSOLETE before this repair: r5 expected status "ok" (RESOLVED_NOT_PINNED + plain fetch = TOCTOU).
    // A resolver's "public" answer alone no longer authorises a read: no pinning transport exists here.
    const r5 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: open, resolveHost: async () => ["93.184.215.14"] });
    eq(r5.status, "url_reference_only", "ingestUrl: resolver public + non-pinning transport -> reference only");
    eq(r5.reason, "destination_binding_unverifiable", "ingestUrl: binding-unverifiable reason");
    eq(calls.length, 0, "ingestUrl: ZERO requests when binding cannot be pinned");

    const r6 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: { pageOrigin: "https://spe.app", connectSrc: "'self'" } });
    eq(r6.status, "url_reference_only", "ingestUrl: product CSP connect-src 'self' still reference-only");
    eq(r6.reason, "csp_connect_src_self", "ingestUrl: CSP reason preserved");

    const r7 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: open });
    eq(r7.status, "url_reference_only", "ingestUrl: browser cross-origin remote -> reference only");
    eq(r7.reason, "destination_binding_unverifiable", "ingestUrl: browser cross-origin reason");
    eq(calls.length, 0, "ingestUrl: ZERO requests for unverifiable browser destination");

    const r8 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: { pageOrigin: "https://spe.app", connectSrc: "*" } });
    eq(r8.status, "url_reference_only", "ingestUrl: open CSP does not make a cross-origin destination verifiable");
    eq(calls.length, 0, "ingestUrl: zero requests (open CSP, cross-origin)");

    const r9 = await ingest.ingestUrl("https://public-site.example.org/page", { networkPolicy: sameOrigin });
    eq(r9.status, "ok", "ingestUrl: same-origin read still permitted");
    eq(calls.length, 1, "ingestUrl: same-origin read made one request");
    ok(!r9.notes.some((n) => /verified|pinned/i.test(n)), "ingestUrl: unverified browser read never labelled verified/pinned");

    calls.length = 0;
    globalThis.fetch = async (url, init) => {
      calls.push({ url, redirect: init?.redirect });
      if (url === "https://public-site.example.org/") return new Response("", { status: 302, headers: { location: "https://elsewhere.example.net/" } });
      assert.fail("UNEXPECTED_REQUEST " + url);
    };
    const r10 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: sameOrigin });
    eq(r10.status, "url_reference_only", "ingestUrl: same-origin -> cross-origin redirect -> reference only");
    eq(r10.reason, "destination_binding_unverifiable", "ingestUrl: cross-origin redirect reason");
    eq(calls.length, 1, "ingestUrl: cross-origin redirect hop never requested");

    calls.length = 0;
    globalThis.fetch = async (url) => { calls.push({ url }); return html(); };
    for (const lit of ["https://93.184.215.14/", "https://[2606:4700:4700::1111]/"]) {
      const rl = await ingest.ingestUrl(lit, { networkPolicy: open, resolveHost: async () => ["93.184.215.14"] });
      eq(rl.status, "url_reference_only", `ingestUrl: public literal ${lit} + non-pinning sink -> reference only`);
      eq(rl.reason, "destination_binding_unverifiable", "ingestUrl: literal binding-unverifiable reason");
      const rb = await ingest.ingestUrl(lit, { networkPolicy: open });
      eq(rb.status, "url_reference_only", `ingestUrl: browser cross-origin literal ${lit} -> reference only (G)`);
    }
    eq(calls.length, 0, "ingestUrl: ZERO requests for public IP literals");

    // Mismatch is a hard refusal at the sink; unverifiable stays reference-only.
    const mm = ingest.guardRefusalToResult("DESTINATION_BINDING_MISMATCH", "https://public-site.example.org/", "https://public-site.example.org/");
    ok(mm.status !== "url_reference_only", "mismatch never maps to url_reference_only");
    eq(mm.status, "invalid_url", "mismatch -> existing hard-refusal path (nothing appended to the prompt)");
    eq(mm.refusal, "DESTINATION_BINDING_MISMATCH", "mismatch carries its distinct boundary classification");
    eq(ingest.urlResultToPromptBlock(mm), null, "mismatch produces no prompt block");
    const uv = ingest.guardRefusalToResult("DESTINATION_BINDING_UNVERIFIABLE", "https://public-site.example.org/", "https://public-site.example.org/");
    eq(uv.status, "url_reference_only", "unverifiable -> reference only");
    eq(uv.reason, "destination_binding_unverifiable", "unverifiable reason code");
    const block = ingest.urlResultToPromptBlock(uv);
    ok(block && !block.includes("destination_binding_unverifiable"), "machine reason code never surfaced in the composer block");
    const priv = ingest.guardRefusalToResult("RESOLVED_PRIVATE_IP", "https://x.example/", "https://x.example/");
    eq(priv.status, "invalid_url", "forbidden-address refusal stays hard");

    calls.length = 0;
    const ac = new AbortController();
    ac.abort();
    const r11 = await ingest.ingestUrl("https://public-site.example.org/", { networkPolicy: sameOrigin, signal: ac.signal });
    eq(r11.status, "aborted", "ingestUrl: pre-aborted signal -> aborted");
    eq(calls.length, 0, "ingestUrl: zero requests when pre-aborted");
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log("B11: REAL_PRODUCT_PINNING_TRANSPORT=NOT_PRESENT drift guard (see evidence/r9-g-network-boundary/CROSS_ORIGIN_FETCH_ASSESSMENT.md)...");
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const srcFiles = walk(src).filter((p) => /\.(ts|tsx|js|mjs)$/.test(p));
  const pinning = srcFiles.filter((p) => /pinsResolvedAddress\s*:\s*true/.test(readFileSync(p, "utf8")));
  eq(pinning.length, 0, `no product pinning transport exists (assessment NOT_PRESENT); found: ${pinning.join(",")}`);
  const ingestText = readFileSync(join(src, "media/urlIngest.ts"), "utf8");
  const call = ingestText.slice(ingestText.indexOf("guardedPublicFetch(parsed"), ingestText.indexOf("init: {", ingestText.indexOf("guardedPublicFetch(parsed")));
  ok(call.length > 0 && !/transport\s*:/.test(call), "ingestUrl passes no custom transport (default non-pinning fetch)");
  const secText = readFileSync(join(src, "engine/multimodal/urlSecurity.ts"), "utf8");
  ok(/function defaultTransport\(\): BoundaryTransport \{\s*return \{\s*pinsResolvedAddress: false,/.test(secText), "canonical default transport declares pinsResolvedAddress: false");
  ok(/export const LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE"/.test(readFileSync(join(src, "website/productFlow.ts"), "utf8")), "product contract: live URL reconstruction NOT_AVAILABLE");
  ok(/liveUrlReconstruction: "NOT_AVAILABLE"/.test(readFileSync(join(src, "website/mount-contract.ts"), "utf8")), "mount contract: liveUrlReconstruction NOT_AVAILABLE");
  for (const f of ["index.html", "public/_headers"]) {
    ok(/connect-src 'self'[;\s]/.test(readFileSync(join(root, f), "utf8")), `${f}: product CSP connect-src 'self'`);
  }
}

console.log(`PASS: SPE-R9-G network execution-boundary gate (${checks} checks). Builder regression only — not independent qualification.`);
