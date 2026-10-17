#!/usr/bin/env node
/**
 * Test battery for SPE Flagship Centerpiece: PlainEnglishShowcase.
 * Verifies strict headings hierarchy, macOS dual-pane window presentation,
 * 4-slot color coding invariants, presets, real-time parser, and conversion hooks.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCustomSentence, segmentCustomInput } from "../src/engine/plainEnglishParser.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const showcasePath = join(root, "src/engine/PlainEnglishShowcase.tsx");
const parserPath = join(root, "src/engine/plainEnglishParser.ts");
const cssPath = join(root, "src/engine/plain-english-showcase.css");
const appPath = join(root, "src/App.tsx");

console.log("=== Running SPE Plain English Showcase Verification Battery ===");

// 1. Files existence
assert.ok(existsSync(showcasePath), "PlainEnglishShowcase.tsx must exist");
assert.ok(existsSync(parserPath), "plainEnglishParser.ts must exist");
assert.ok(existsSync(cssPath), "plain-english-showcase.css must exist");

const showcase = readFileSync(showcasePath, "utf8");
const css = readFileSync(cssPath, "utf8");
const app = readFileSync(appPath, "utf8");

// 2. Integration into App.tsx
assert.match(app, /import\s+\{\s*PlainEnglishShowcase\s*\}\s+from\s+["']\.\/engine\/PlainEnglishShowcase["']/, "App.tsx must import PlainEnglishShowcase");
assert.match(app, /<Hero[\s\S]*?\/>\s*<PlainEnglishShowcase/, "App.tsx must render PlainEnglishShowcase immediately below Hero");
console.log("✓ Integration into App.tsx right below Hero verified");

// 3. Strict Headings Hierarchy (STRICT REQUIREMENT)
// Exactly one main heading: Say it plainly. Get a prompt that holds.
// Section titles strictly in this exact order underneath it:
// 1. Three steps from idea to instruction.
// 2. Same request. Clearer instructions.
// 3. Your words stay on your device.
// 4. Made for the prompts you actually write.
// 5. Start with one sentence.

// Extract all heading tags from showcase component
const headings = [...showcase.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => ({
  tag: m[1].toLowerCase(),
  text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}));

assert.ok(headings.length === 6, `Expected exactly 6 headings in showcase, found ${headings.length}: ${JSON.stringify(headings)}`);

// Main heading must be the first heading and have exact text
const mainHeading = headings[0];
assert.equal(mainHeading.text, "Say it plainly. Get a prompt that holds.", "Main heading must match exactly");

// Next 5 headings strictly in order
const expectedSectionTitles = [
  "Three steps from idea to instruction.",
  "Same request. Clearer instructions.",
  "Your words stay on your device.",
  "Made for the prompts you actually write.",
  "Start with one sentence.",
];

for (let i = 0; i < expectedSectionTitles.length; i++) {
  assert.equal(
    headings[i + 1].text,
    expectedSectionTitles[i],
    `Heading index ${i + 1} must strictly match "${expectedSectionTitles[i]}", got "${headings[i + 1]?.text}"`
  );
  assert.equal(
    headings[i + 1].tag,
    "h3",
    `Section heading ${i + 1} must be an h3 tag subordinate to the main heading`
  );
}
console.log("✓ Strict Headings Hierarchy verified (1 main heading + 5 ordered section titles)");

// 4. Window Presentation & Visual Structure
assert.match(showcase, /brief\.txt\s*→\s*system-prompt\.md/, "macOS window title present");
assert.match(showcase, /YOUR WORDS/, "Left pane 'YOUR WORDS' present");
assert.match(showcase, /STRUCTURED PROMPT/, "Right pane 'STRUCTURED PROMPT' present");
assert.match(showcase, /spe-cursor/, "Blinking cursor element present");
console.log("✓ macOS dual-pane window presentation verified");

// 5. 4 Color-Coded Slot Invariants
// Role (#10b981), Goal (#38bdf8), Constraint (#f97316), Output (#c084fc)
assert.match(css, /#10b981/, "Emerald green color #10b981 defined for ROLE");
assert.match(css, /#38bdf8/, "Sky blue color #38bdf8 defined for GOAL");
assert.match(css, /#f97316/, "Orange color #f97316 defined for CONSTRAINT");
assert.match(css, /#c084fc/, "Purple color #c084fc defined for OUTPUT");

assert.match(showcase, /ROLE/, "Slot ROLE badge present");
assert.match(showcase, /GOAL/, "Slot GOAL badge present");
assert.match(showcase, /CONSTRAINT/, "Slot CONSTRAINT badge present");
assert.match(showcase, /OUTPUT/, "Slot OUTPUT badge present");
console.log("✓ 4 Color-Coded Slot invariants verified");

// 6. Presets
assert.match(showcase, /Bike Shop Assistant|bike-shop/, "Bike shop preset present");
assert.match(showcase, /TypeScript Refactor Bot|code-refactor/, "Code refactor preset present");
assert.match(showcase, /Cohort Growth Analyst|growth-analyst/, "Growth analyst preset present");
assert.match(showcase, /SQL Migration Engineer|sql-dba/, "SQL migration preset present");
console.log("✓ Realistic Presets verified");

// 7. Live Scratchpad with Real-time Parser (Runtime Invariants)
// Test empty sentence
const emptyRes = parseCustomSentence("   ");
assert.ok(emptyRes.role.length > 0, "Empty sentence must have fallback role");
assert.ok(emptyRes.goal.length > 0, "Empty sentence must have fallback goal");
assert.ok(emptyRes.constraint.length > 0, "Empty sentence must have fallback constraint");
assert.ok(emptyRes.output.length > 0, "Empty sentence must have fallback output");

// Test Bike shop sentence
const bikeRes = parseCustomSentence("I need a support assistant for my bike shop that helps people pick the right repair. Never promise refunds, and keep answers short, with a price range.");
assert.match(bikeRes.role, /support assistant for my bike shop/i, "Bike shop role extracted correctly");
assert.match(bikeRes.goal, /helps people pick the right repair/i, "Bike shop goal extracted correctly");
assert.match(bikeRes.constraint, /never promise refunds/i, "Bike shop constraint extracted correctly");
assert.match(bikeRes.output, /keep answers short, with a price range/i, "Bike shop output extracted correctly");

// Test TS refactor sentence
const tsRes = parseCustomSentence("Act as a senior TypeScript architect that refactors legacy async callbacks to async/await. Never change external function signatures or delete tests, and return only the unified git diff with explanations.");
assert.match(tsRes.role, /senior TypeScript architect/i, "TS role extracted");
assert.match(tsRes.goal, /refactors legacy async callbacks/i, "TS goal extracted");
assert.match(tsRes.constraint, /never change external function signatures/i, "TS constraint extracted");
assert.match(tsRes.output, /return only the unified git diff/i, "TS output extracted");

// Test Python tutor sentence
const pyRes = parseCustomSentence("I need an expert Python tutor that teaches beginners recursion without confusing math jargon and keeps answers under 3 paragraphs.");
assert.match(pyRes.role, /expert Python tutor/i, "Python tutor role extracted");
assert.match(pyRes.goal, /teaches beginners recursion/i, "Python tutor goal extracted");
assert.match(pyRes.constraint, /without confusing math jargon/i, "Python tutor constraint extracted");
assert.match(pyRes.output, /under 3 paragraphs/i, "Python tutor output extracted");

// Test phrase segmentation
const testSegs = segmentCustomInput(
  "I need an expert Python tutor that teaches beginners recursion without confusing math jargon and keeps answers under 3 paragraphs.",
  pyRes.phrases
);
assert.ok(testSegs.length > 1, "Must produce multiple highlighted segments");
assert.ok(testSegs.some(s => s.type === "role" && s.text.includes("expert Python tutor")), "Role segment identified");
assert.ok(testSegs.some(s => s.type === "goal" && s.text.includes("teaches beginners recursion")), "Goal segment identified");
assert.ok(testSegs.some(s => s.type === "constraint" && s.text.includes("without confusing math jargon")), "Constraint segment identified");

console.log("✓ Live Scratchpad with real-time heuristic parsing verified");

// 8. Dynamic Clipboard Copying & Conversion Hooks
assert.match(showcase, /handleCopyPrompt/, "handleCopyPrompt defined");
assert.match(showcase, /isScratchpadActive\s*\?\s*parsedScratchpad\s*:\s*activePreset\.slots/, "Copies custom prompt when scratchpad is active");
assert.match(showcase, /spe continue -/, "CLI pipe command hook present");
assert.match(showcase, /Developer Pro|DEVELOPER PRO/, "Developer Pro conversion hook present");
assert.match(showcase, /copyTextSafe/, "Safe clipboard copy utilized");
console.log("✓ Dynamic clipboard copy and conversion hooks verified");

// 9. Accessibility, Touch Targets & Reduced Motion
assert.match(css, /min-height:\s*44px/, "Touch target minimum 44px present in CSS");
assert.match(css, /:focus-visible/, "Focus visible outline defined");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "prefers-reduced-motion handled in CSS");
assert.match(showcase, /prefers-reduced-motion/, "prefers-reduced-motion handled in component");
console.log("✓ Accessibility, touch targets, and reduced motion verified");

console.log("================================================================");
console.log("🎉 ALL SPE PLAIN ENGLISH SHOWCASE VERIFICATIONS PASSED!");
console.log("================================================================");
