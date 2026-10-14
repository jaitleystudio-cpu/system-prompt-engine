#!/usr/bin/env node
/** R20 evidence-first incident preview: static architecture & noindex guard. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const route = read("src/routing.ts");
const app = read("src/App.tsx");
const page = read("src/pages/IncidentIntelligence.tsx");
const style = read("src/pages/incident-intelligence.css");
const intake = read("src/pages/PrivateFailureIntake.tsx");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const faq = read("src/pages/Capabilities.tsx");

assert.match(route, /incidents:\s*"\/ai-incidents"/);
assert.match(route, /"incidents",[\s\S]*?\]\)/);
assert.match(route, /"incidents"[\s\S]*?path:\s*"\/ai-incidents"/);
assert.match(app, /view === "incidents"\s*&&\s*<IncidentIntelligence/);
assert.match(app, /view === "research" \|\|\s*view === "incidents"/);
assert.match(robots, /Disallow:\s*\/ai-incidents/);
assert.doesNotMatch(sitemap, /<loc>[^<]*\/ai-incidents/);
assert.match(faq, /view="incidents"/);

assert.match(page, /data-publication-state="NOT_QUALIFIED"/);
assert.match(page, /<PrivateFailureIntake\s*\/>/);
assert.match(intake, /data-intake-scope="LOCAL_ONLY_UNVERIFIED"/);
assert.match(page, /data-source-connection="NOT_ACTIVATED"/);
assert.match(page, /No qualified incident brief is available yet/);
assert.match(page, /No continuously running incident feed/);
assert.match(page, /Not yet live/);
assert.match(page, /Not activated/);
assert.match(page, /Real-model proof required/);
assert.match(page, /Independent review required/);
assert.match(page, /Not authorized/);
assert.match(page, /publication/);
assert.match(page, /status\.openai\.com/);
assert.match(page, /status\.claude\.com/);
assert.match(page, /aria-labelledby=/);
assert.match(page, /aria-hidden="true"/);
assert.match(page, /rel="noopener noreferrer"/);
assert.match(page, /referrerPolicy="no-referrer"/);
assert.match(style, /prefers-reduced-motion:\s*reduce/);
assert.match(style, /:focus-visible/);
assert.match(style, /max-width:\s*650px/);

// Critically, adding the page must not secretly enable a live network API,
// accept user-provided headlines, mint a signed receipt or use synthetic cases.
// Check executable source: design comments may describe forbidden capabilities.
const executablePage = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const unauthorized of [
  /\bfetch\s*\(/, /XMLHttpRequest/, /EventSource\s*\(/,
  /WebSocket\s*\(/, /localStorage/, /sessionStorage/,
  /dangerouslySetInnerHTML/, /\bwindow\.location\b/, /Math\.random\s*\(/,
  /performance\.now\s*\(/, /setInterval\s*\(/, /document\.cookie/,
]) {
  assert.doesNotMatch(executablePage, unauthorized, "forbidden incident page capability: " + unauthorized);
}
assert.equal((page.match(/status\.(?:openai|claude)\.com/g) ?? []).length, 2);
assert.equal((page.match(/status:\s*"/g) ?? []).length, 5);

// Layout and route intentionally can't claim a real-world observed failure.
for (const fakeClaim of [/we are #1/i, /first in the world/i, /99\.9% verified/i,
  /verified incidents:\s*[1-9]/i, /every model failure fixed/i]) {
  assert.doesNotMatch(page, fakeClaim);
}

console.log("PASS R20 noindex AI Failure Intelligence route: evidence-first, accessible, no-network");
