#!/usr/bin/env node
/** FINAL CRAFT: presentation-only contract smoke (no hosting). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "src/App.tsx"), "utf8");
const disclosure = readFileSync(
  join(root, "src/composer/SourcesDepthDisclosure.tsx"),
  "utf8",
);
const panel = readFileSync(
  join(root, "src/workspace/ExecutionContractPanel.tsx"),
  "utf8",
);
const caps = readFileSync(join(root, "src/pages/Capabilities.tsx"), "utf8");
const css = readFileSync(join(root, "src/index.css"), "utf8");
const hero = readFileSync(join(root, "src/landing/HeroStory.tsx"), "utf8");

assert.match(app, /SourcesDepthDisclosure/);
assert.match(disclosure, /<details/);
assert.match(disclosure, /Sources &amp; depth/);
assert.match(disclosure, /onToggle/);
assert.match(panel, /presentation === "simple"/);
assert.match(panel, /presentation === "inspect"/);
assert.match(panel, /UNKNOWN is never treated as/);
assert.doesNotMatch(panel, /data-overall=\{.*"pass".*UNKNOWN/i);
assert.match(caps, /spe-capabilities-atlas/);
assert.match(caps, /ProtectedIntent/);
assert.match(caps, /Execution Contract/);
assert.match(caps, /id="faq"/);
assert.match(css, /SPE Ω FINAL CRAFT CLOSURE/);
assert.match(css, /\.spe-create-sources-depth/);
assert.match(css, /\.spe-capabilities-atlas/);
assert.match(css, /\.spe-contract-simple/);
assert.match(css, /\[data-kind="conformance"\]\[data-status="unknown"\]/);
assert.match(hero, /label: "IDEA"/);
assert.match(hero, /label: "PROMPT"/);
assert.doesNotMatch(hero, /\b(orb|reactor|turbine|atom)\b/i);

console.log("PASS final craft presentation contracts");
