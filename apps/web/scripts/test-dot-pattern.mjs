#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");
const patternPath = join(root, "src/ui/DotPattern.tsx");
assert.ok(existsSync(patternPath), "DotPattern must live in the existing ui owner");

const pattern = readFileSync(patternPath, "utf8");
const hero = readFileSync(join(root, "src/landing/Hero.tsx"), "utf8");
const app = readFileSync(join(root, "src/App.tsx"), "utf8");
const css = readFileSync(join(root, "src/index.css"), "utf8");
const packageJson = readFileSync(join(root, "package.json"), "utf8");

assert.match(pattern, /useId/);
assert.match(pattern, /<pattern/);
assert.match(pattern, /<circle/);
assert.match(pattern, /aria-hidden="true"/);
for (const prop of ["width", "height", "x", "y", "cx", "cy", "cr"]) {
  assert.match(pattern, new RegExp(`${prop}\\?: number`));
}
assert.doesNotMatch(pattern, /\b(inset-0|absolute|pointer-events-none)\b/);
assert.match(hero, /<DotPattern surface="hero"/);
assert.match(app, /<DotPattern surface="create"/);

assert.match(css, /\.spe-dot-pattern__layer--primary/);
assert.match(css, /\.spe-dot-pattern__layer--secondary/);
assert.match(css, /\.spe-dot-pattern__layer--tertiary/);
assert.match(css, /mask-image:\s*radial-gradient/);
assert.match(css, /html\[data-theme="light"\] \.spe-dot-pattern/);
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.spe-dot-pattern__layer[\s\S]*animation:\s*none/,
);
assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*\.spe-dot-pattern[\s\S]*opacity:/,
);

assert.doesNotMatch(packageJson, /tailwind|shadcn|tailwind-merge|clsx/i);
assert.equal(
  existsSync(join(repo, "apps/web/src/components/ui")),
  false,
  "must not create a parallel shadcn UI tree",
);

console.log("PASS native layered DotPattern contract");
