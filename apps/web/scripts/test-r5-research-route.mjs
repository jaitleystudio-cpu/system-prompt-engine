#!/usr/bin/env node
/** Route registration for the stored research mount. No live network success. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NOINDEX_VIEWS, ROUTE_META, resolveRoute } from "../src/routing.ts";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

const resolved = resolveRoute("/research");
assert.equal(resolved.kind, "view");
assert.equal(resolved.view, "research");
assert.equal(resolved.canonicalPath, "/research");
assert.equal(NOINDEX_VIEWS.has("research"), true);
assert.equal(ROUTE_META.research.path, "/research");

const app = read("src/App.tsx");
const nav = read("src/layout/Nav.tsx");
const route = read("src/research/ResearchRoute.tsx");
const ledger = read("src/shell/mountStatus.ts");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const fabric = readFileSync(join(repoRoot, "spe_runtime/grounding/live_fabric.py"), "utf8");

assert.match(app, /ResearchRoute/);
assert.match(app, /view === "research"/);
assert.match(nav, /id: "research"/);
assert.match(robots, /Disallow:\s*\/research/);
assert.doesNotMatch(sitemap, /<loc>[^<]*\/research<\/loc>/);
assert.match(route, /useState\(false\)/);
assert.match(route, /HELD_NO_CONSENT/);
assert.match(route, /response_digest/);
assert.match(route, /verification_status/);
assert.doesNotMatch(route, /\bfetch\s*\(/);
assert.doesNotMatch(route, /XMLHttpRequest/);
assert.doesNotMatch(route, /WebSocket/);
assert.doesNotMatch(route, /sendBeacon/);
assert.doesNotMatch(route, /<a\s/);
assert.match(ledger, /RESEARCH_PRODUCT:\s*"MOUNTED_STORED"/);
assert.match(ledger, /product_LIVE_INDEX:\s*"HOLD"/);
assert.match(ledger, /product_LIVE_RETRACTION:\s*"HOLD"/);
assert.doesNotMatch(ledger, /LIVE_PASS/);
assert.doesNotMatch(ledger, /product_LIVE_INDEX:\s*"PASS"/);
assert.doesNotMatch(ledger, /product_LIVE_RETRACTION:\s*"PASS"/);
assert.match(fabric, /LIVE_INDEX: Final\[str\] = "HOLD"/);
assert.match(fabric, /LIVE_RETRACTION: Final\[str\] = "HOLD"/);
assert.doesNotMatch(fabric, /LIVE_INDEX: Final\[str\] = "PASS"/);
assert.doesNotMatch(fabric, /LIVE_RETRACTION: Final\[str\] = "PASS"/);

console.log("PASS /research registered; LIVE_INDEX HOLD; LIVE_RETRACTION HOLD; RESEARCH_PRODUCT MOUNTED_STORED");
