#!/usr/bin/env node
/**
 * Lane SEO: crawl/index truth — private pages must not be advertised as indexable;
 * unknown routes must not look like published URLs in static SEO artifacts.
 * No rankings or traffic numbers. Static source inspection only (no browser).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const robots = readFileSync(join(root, "public/robots.txt"), "utf8");
const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const seoHead = readFileSync(join(root, "src/ui/SeoHead.tsx"), "utf8");
const routing = readFileSync(join(root, "src/routing.ts"), "utf8");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");

const INDEXABLE = [
  "/",
  "/create",
  "/code",
  "/daily-lab",
  "/privacy",
  "/capabilities",
];
const NOINDEX_PATHS = ["/my-work", "/workspace"];

// --- robots.txt ownership ---
for (const p of NOINDEX_PATHS) {
  assert.match(
    robots,
    new RegExp(`Disallow:\\s*${p.replace(/\//g, "\\/")}`),
    `robots must Disallow private path ${p}`,
  );
  assert.doesNotMatch(
    robots,
    new RegExp(`Allow:\\s*${p.replace(/\//g, "\\/")}\\b`),
    `robots must not Allow private path ${p}`,
  );
}
for (const p of INDEXABLE.filter((x) => x !== "/")) {
  assert.match(
    robots,
    new RegExp(`Allow:\\s*${p.replace(/\//g, "\\/")}`),
    `robots should Allow public path ${p}`,
  );
}
assert.match(robots, /Sitemap:\s*https:\/\/systempromptengine\.com\/sitemap\.xml/);

// --- sitemap ownership ---
for (const p of INDEXABLE) {
  const loc =
    p === "/"
      ? "https://systempromptengine.com/"
      : `https://systempromptengine.com${p}`;
  assert.match(
    sitemap,
    new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `sitemap must list indexable ${p}`,
  );
}
for (const p of NOINDEX_PATHS) {
  assert.doesNotMatch(
    sitemap,
    new RegExp(p.replace(/\//g, "\\/")),
    `sitemap must not list private ${p}`,
  );
}
// Unknown / invented routes must not appear as published locs
assert.doesNotMatch(sitemap, /\/not-a-real-route/);
assert.doesNotMatch(sitemap, /\/404/);
assert.doesNotMatch(sitemap, /example\.com/);

// --- SeoHead robots / canonical / noindex ownership ---
assert.match(seoHead, /NOINDEX_VIEWS/);
assert.match(seoHead, /"workspace"/);
assert.match(seoHead, /"my-work"/);
assert.match(seoHead, /noindex,\s*nofollow/);
assert.match(seoHead, /index,\s*follow/);
assert.match(seoHead, /removeLink\("canonical"\)/);
assert.match(seoHead, /name",\s*"robots"/);
// Optional shell props accepted without requiring App.tsx edits in this lane
assert.match(seoHead, /unlisted/);
assert.match(seoHead, /notFound/);

// --- Unknown-route truth at START_SHA (routing.ts read-only; product fix is G5) ---
// Current program tip maps unknown paths to "home" via viewFromPath fallback.
// That must not cause static artifacts to list arbitrary paths as published URLs
// (covered above). Full not-found + noindex wiring needs App.tsx / routing resolve
// (shell lane). Document presence of the fallback so CI does not false-PASS a claim
// that unknown routes already render a dedicated not-found SEO surface.
const hasResolveRoute = /export function resolveRoute\b/.test(routing);
const hasHomeFallback =
  /PATH_VIEW\[[^\]]+\]\s*\?\?\s*PATH_VIEW\[[^\]]+\]\s*\?\?\s*"home"/.test(
    routing,
  ) || /\?\?\s*"home"/.test(routing);
if (hasResolveRoute) {
  console.log(
    "NOTE: resolveRoute present — unknown-route product ownership may be shared with shell",
  );
} else {
  assert.ok(
    hasHomeFallback,
    "expected viewFromPath home-fallback on this base (document current truth)",
  );
  console.log(
    "TRUTH: viewFromPath maps unknown paths to home; SeoHead alone cannot see pathname. OWNERSHIP_CONFLICT for App.tsx/routing not-found repair.",
  );
}

// Bootstrap index.html canonical is the public home only (not a private path)
assert.match(indexHtml, /rel="canonical"\s+href="https:\/\/systempromptengine\.com\/"/);
assert.doesNotMatch(indexHtml, /my-work/);
assert.doesNotMatch(indexHtml, /\/workspace/);

console.log("PASS seo index truth");
console.log(
  JSON.stringify(
    {
      indexable_paths: INDEXABLE,
      noindex_paths: NOINDEX_PATHS,
      seo_head_private_views: ["workspace", "my-work"],
      unknown_route_product: hasResolveRoute
        ? "resolveRoute_present"
        : "home_fallback_documented",
      rankings_or_traffic: "not_claimed",
    },
    null,
    2,
  ),
);
