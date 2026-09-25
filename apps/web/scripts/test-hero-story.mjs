#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hero = readFileSync(join(root, "src/landing/Hero.tsx"), "utf8");
const story = readFileSync(join(root, "src/landing/HeroStory.tsx"), "utf8");
const css = readFileSync(join(root, "src/index.css"), "utf8");

const orderedStages = [
  "MESSY HUMAN THOUGHT",
  "IDEA",
  "MEANING",
  "SPE",
  "STRUCTURE",
  "SYSTEM PROMPT",
];

let cursor = -1;
for (const stage of orderedStages) {
  const next = story.indexOf(`label: "${stage}"`);
  assert.ok(next > cursor, `${stage} must appear in approved semantic order`);
  cursor = next;
}

for (const fragment of [
  "NOTE",
  "QUESTION",
  "IMAGE",
  "CODE",
  "DOCUMENT",
  "WAVEFORM",
  "URL",
]) {
  assert.match(story, new RegExp(`>${fragment}<`), `missing ${fragment} fragment`);
}

assert.match(story, /aria-label="SPE transforms messy human thought/);
assert.match(story, /className="hero-story-flow spe-pipeline"/);
assert.match(story, /className="hero-engine"/);
assert.match(story, /className="hero-prompt-artifact"/);
assert.doesNotMatch(story, /\b(orb|reactor|turbine|atom)\b/i);

assert.match(hero, /<HeroStory/);
assert.doesNotMatch(hero, /import\("\.\.\/scene\/SpeIntelligence"\)/);
assert.doesNotMatch(hero, /<Scene/);

assert.match(css, /\.hero-story-flow\.spe-pipeline\s*\{[\s\S]*grid-template-columns:/);
assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*\.hero-story-flow\.spe-pipeline\s*\{[\s\S]*grid-template-columns:\s*1fr/,
);
assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*\.hero-theater\s*\{[\s\S]*max-height:\s*none/,
);
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero-story[\s\S]*animation:\s*none/,
);

console.log("PASS hero semantic story contract");
