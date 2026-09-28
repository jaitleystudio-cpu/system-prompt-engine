#!/usr/bin/env node
/** Batch F: capability route + AEO FAQ JSON-LD + honest-claim smoke (no browser). */
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

assert.match(routing, /capabilities:\s*"\/capabilities"/);
assert.match(routing, /jsonLdCapabilitiesFaq/);
assert.match(routing, /"@type":\s*"FAQPage"/);
assert.match(routing, /not proven/i);
// Affirmative hype must stay absent (denial language is allowed / required).
assert.doesNotMatch(routing, /SPE is the world'?s best/i);
assert.doesNotMatch(routing, /WORLD\s*#\s*1\s*=\s*PROVEN/i);
assert.doesNotMatch(routing, /award-winning|guaranteed results/i);

assert.match(seoHead, /jsonLdCapabilitiesFaq/);
assert.match(seoHead, /view === "capabilities"/);

assert.match(page, /id="capabilities-title"/);
assert.match(page, /ProtectedIntent/);
assert.match(page, /Execution Contract/);
assert.match(page, /provider profiles/i);
assert.match(page, /local-first/i);
assert.match(page, /id="faq"/);
assert.match(page, /spe-capabilities-atlas/);
assert.match(page, /spe-atlas-outcome/);
assert.match(page, /not proven/i);
assert.doesNotMatch(page, /SPE is the world'?s best/i);
assert.doesNotMatch(page, /award-winning|guaranteed results/i);

assert.match(app, /<Capabilities\s*\/>/);
assert.match(app, /pathForView\("capabilities"\)/);
assert.match(nav, /id:\s*"capabilities"/);
assert.match(seoContent, /pathForView\("capabilities"\)/);
assert.match(sitemap, /systempromptengine\.com\/capabilities/);
assert.match(robots, /Allow:\s*\/capabilities/);

console.log("PASS capabilities SEO/AEO smoke");
