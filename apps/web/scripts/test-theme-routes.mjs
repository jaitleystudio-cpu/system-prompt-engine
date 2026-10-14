#!/usr/bin/env node
/** Smoke: theme module + route map (no browser). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routing = readFileSync(join(root, "src/routing.ts"), "utf8");
const theme = readFileSync(join(root, "src/ui/theme.ts"), "utf8");
const robots = readFileSync(join(root, "public/robots.txt"), "utf8");
const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const effectiveSitemap = sitemap.includes("<sitemapindex")
  ? sitemap + "\n" + readFileSync(join(root, "public/sitemap-core.xml"), "utf8")
  : sitemap;

const publicPaths = ["/", "/create", "/code", "/daily-lab", "/privacy", "/capabilities"];
const privatePaths = ["/my-work", "/workspace", "/website", "/media", "/research"];
for (const routePath of [...publicPaths, ...privatePaths]) {
  assert.match(routing, new RegExp(routePath.replaceAll("/", "\\/")));
}
for (const routePath of publicPaths) {
  if (routePath !== "/") assert.match(effectiveSitemap, new RegExp(routePath));
}
assert.match(effectiveSitemap, /<loc>https:\/\/systempromptengine\.com\/<\/loc>/);
for (const routePath of privatePaths) {
  assert.doesNotMatch(
    effectiveSitemap,
    new RegExp(`<loc>https://systempromptengine\\.com${routePath}</loc>`),
  );
  assert.match(robots, new RegExp(`Disallow:\\s*${routePath.replaceAll("/", "\\/")}`));
}
assert.doesNotMatch(robots, /Allow:\s*\/my-work/);
assert.match(robots, /Allow:\s*\/capabilities/);
assert.match(theme, /ThemePreference/);
assert.match(theme, /spe-theme/);
assert.match(theme, /prefers-color-scheme/);
assert.match(robots, /Sitemap:/);
console.log("PASS theme+routes smoke");
