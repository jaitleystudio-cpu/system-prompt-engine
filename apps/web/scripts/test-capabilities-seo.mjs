#!/usr/bin/env node
/** Capability route stays honest and indexable. FAQPage markup stays removed. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routing = readFileSync(join(root, "src/routing.ts"), "utf8");
const seoHead = readFileSync(join(root, "src/ui/SeoHead.tsx"), "utf8");
const page = readFileSync(join(root, "src/pages/Capabilities.tsx"), "utf8");
const app = readFileSync(join(root, "src/App.tsx"), "utf8");
const nav = readFileSync(join(root, "src/layout/Nav.tsx"), "utf8");
const seoContent = readFileSync(join(root, "src/landing/SeoContent.tsx"), "utf8");
const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const robots = readFileSync(join(root, "public/robots.txt"), "utf8");
const foundation = readFileSync(join(root, "src/search/foundation.mjs"), "utf8");

assert.match(routing, /capabilities:\s*"\/capabilities"/);
assert.doesNotMatch(routing, /jsonLdCapabilitiesFaq/);
assert.doesNotMatch(routing, /"@type":\s*"FAQPage"/);
assert.doesNotMatch(routing, /SPE is the world'?s best/i);
assert.doesNotMatch(routing, /WORLD\s*#\s*1\s*=\s*PROVEN/i);
assert.doesNotMatch(routing, /award-winning|guaranteed results/i);

assert.match(seoHead, /JSONLD_ELEMENT_ID/);
assert.match(foundation, /spe-jsonld-graph/);
assert.doesNotMatch(seoHead, /jsonLdCapabilitiesFaq/);
assert.match(seoHead, /view === "capabilities"|ROUTE_META\[view\]/);

assert.match(page, /id="capabilities-title"/);
assert.match(page, /ProtectedIntent/);
assert.match(page, /Execution Contract/);
assert.match(page, /provider profiles/i);
assert.match(page, /local-first/i);
assert.doesNotMatch(page, /id="faq"/);
assert.doesNotMatch(page, /"@type":\s*"FAQPage"/);
assert.match(page, /spe-capabilities-atlas/);
assert.match(page, /spe-atlas-outcome/);
assert.match(page, /not proven/i);
assert.doesNotMatch(page, /SPE is the world'?s best/i);
assert.doesNotMatch(page, /award-winning|guaranteed results/i);

assert.match(foundation, /id: "capabilities"/);
assert.match(foundation, /"Article"/);
assert.match(foundation, /removedStructuredData: \["FAQPage"\]/);

assert.match(app, /<Capabilities\s*\/>/);
assert.match(app, /view === "capabilities"/);
assert.match(nav, /id:\s*"capabilities"/);
assert.match(seoContent, /pathForView\("capabilities"\)/);
assert.match(sitemap, /systempromptengine\.com\/capabilities/);
assert.match(robots, /Allow:\s*\/capabilities/);

console.log("PASS capabilities SEO smoke");
