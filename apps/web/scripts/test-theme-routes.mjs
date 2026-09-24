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

for (const p of ["/", "/create", "/code", "/daily-lab", "/my-work", "/privacy"]) {
  assert.match(routing, new RegExp(p.replace("/", "\\/")));
  if (p !== "/") assert.match(sitemap, new RegExp(p));
  assert.match(robots, /Allow:/);
}
assert.match(theme, /ThemePreference/);
assert.match(theme, /spe-theme/);
assert.match(theme, /prefers-color-scheme/);
assert.match(robots, /Sitemap:/);
console.log("PASS theme+routes smoke");
