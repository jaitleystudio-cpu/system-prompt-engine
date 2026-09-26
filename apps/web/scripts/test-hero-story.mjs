#!/usr/bin/env node
/**
 * Hero contract: founder PNG verbatim as right-side art.
 * Story semantics IDEA→MEANING→SPE→STRUCTURE→PROMPT live in the image.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hero = readFileSync(join(root, "src/landing/Hero.tsx"), "utf8");
const story = readFileSync(join(root, "src/landing/HeroStory.tsx"), "utf8");
const css = readFileSync(join(root, "src/index.css"), "utf8");
const asset = join(root, "public/hero/founder-hero-story.png");

assert.ok(existsSync(asset), "founder-hero-story.png must exist in public/hero");
const bytes = readFileSync(asset);
assert.ok(bytes.length > 100_000, "founder PNG should be substantial");
const sha = createHash("sha256").update(bytes).digest("hex");
assert.equal(
  sha,
  "fb7edd8fbb1e197fed417a5866441ee950c58600b0c805aa7377d2bc06a6da93",
  "founder PNG must match known attachment SHA-256",
);
assert.ok(statSync(asset).size === bytes.length);

assert.match(story, /founder-hero-story\.png/);
assert.match(story, /src="\/hero\/founder-hero-story\.png"/);
assert.match(story, /className="hero-story-art"/);
assert.match(
  story,
  /alt="SPE transformation story:[\s\S]*IDEA[\s\S]*MEANING[\s\S]*SPE[\s\S]*STRUCTURE[\s\S]*PROMPT/,
);
assert.match(
  story,
  /aria-label="SPE transforms messy human fragments[\s\S]*IDEA[\s\S]*PROMPT/,
);
assert.match(story, /className="hero-story spe-pipeline"/);
assert.doesNotMatch(story, /hero-story-flow/);
assert.doesNotMatch(story, /hero-flow-lines/);
assert.doesNotMatch(story, /hero-story-stage/);
assert.doesNotMatch(story, /chaos-to-idea/);
assert.doesNotMatch(story, /glass-filter-stack/);
assert.doesNotMatch(story, /hero-engine/);
assert.doesNotMatch(story, /MESSY HUMAN FRAGMENTS/);
assert.doesNotMatch(story, /\b(orb|reactor|turbine|atom)\b/i);
assert.doesNotMatch(story, /<svg[\s\S]*hero-flow/);

assert.match(hero, /<HeroStory\s*\/>/);
assert.doesNotMatch(hero, /Pause story/);
assert.doesNotMatch(hero, /Resume story/);
assert.doesNotMatch(hero, /motion-button/);
assert.doesNotMatch(hero, /import\("\.\.\/scene\/SpeIntelligence"\)/);
assert.doesNotMatch(hero, /<Scene/);

assert.match(css, /\.hero-story-art\s*\{[\s\S]*object-fit:\s*contain/);
assert.match(css, /\.hero-story-plate\s*\{/);
assert.match(
  css,
  /html\[data-theme="light"\]\s*\.hero-story-plate\s*\{/,
);
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero-story[\s\S]*animation:\s*none/,
);
assert.match(
  css,
  /\.hero-stage\s*\{[\s\S]*width:\s*58%/,
);
assert.match(
  css,
  /@media \(min-width: 701px\)[\s\S]*\.hero-copy\s*\{[\s\S]*width:\s*42%/,
);

console.log("PASS hero founder-PNG contract", sha.slice(0, 12));
