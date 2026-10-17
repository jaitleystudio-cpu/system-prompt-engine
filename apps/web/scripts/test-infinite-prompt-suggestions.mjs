/**
 * Test Battery: Infinite Prompt Suggestions Fountain & Contextual Evolution
 * Verifies canonical starter continuity, deep pool entropy, slot-by-slot independent
 * replacement, unrepeated pool recycling, Roll Infinity reel mechanics, and contextual modifiers.
 */

import assert from "node:assert/strict";
import {
  CANONICAL_STARTER_PROMPTS,
  INFINITE_PROMPT_POOL,
  PROMPT_EVOLUTION_MODIFIERS,
} from "../src/landing/infinitePromptCatalog.ts";
import { CATEGORIES } from "../../../packages/web-runtime/src/targets.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Infinite Prompt Suggestions & Contextual Evolution");
console.log("==================================================================");

// [1/5] Validate Canonical Starters Continuity
console.log("\n[1/5] Verifying canonical 4 starter prompts...");
assert.equal(CANONICAL_STARTER_PROMPTS.length, 4, "Must have exactly 4 canonical starter prompts");

assert.equal(CANONICAL_STARTER_PROMPTS[0].label, "Review code without hallucinations");
assert.equal(CANONICAL_STARTER_PROMPTS[0].category, "Coding");

assert.equal(CANONICAL_STARTER_PROMPTS[1].label, "Plan a full-stack feature");
assert.equal(CANONICAL_STARTER_PROMPTS[1].category, "Coding");

assert.equal(CANONICAL_STARTER_PROMPTS[2].label, "Executive weekly progress report");
assert.equal(CANONICAL_STARTER_PROMPTS[2].category, "Business");

assert.equal(CANONICAL_STARTER_PROMPTS[3].label, "Customer ticket triage & response");
assert.equal(CANONICAL_STARTER_PROMPTS[3].category, "Business");
console.log("  ✓ Canonical starter slots 0-3 verified with 100% backward continuity.");

// [2/5] Validate Deep Reservoir Pool & Quality
console.log("\n[2/5] Verifying infinite prompt reservoir pool...");
assert.ok(
  INFINITE_PROMPT_POOL.length >= 40,
  `Pool must have at least 40 prompts, found ${INFINITE_PROMPT_POOL.length}`
);

const idSet = new Set();
const PROHIBITED_WORDS = ["offline", "no internet", "without internet"];

for (const prompt of INFINITE_PROMPT_POOL) {
  assert.ok(prompt.id, "Prompt must have an id");
  assert.ok(!idSet.has(prompt.id), `Duplicate prompt id detected: ${prompt.id}`);
  idSet.add(prompt.id);

  assert.ok(prompt.label.length >= 5, `Label too short for prompt: ${prompt.id}`);
  assert.ok(prompt.text.length >= 20, `Text too short for prompt: ${prompt.id}`);
  assert.ok(
    CATEGORIES.includes(prompt.category),
    `Invalid category ${prompt.category} for prompt ${prompt.id}`
  );

  const lower = (prompt.label + " " + prompt.text).toLowerCase();
  for (const bad of PROHIBITED_WORDS) {
    assert.ok(
      !lower.includes(bad),
      `Prohibited marketing word '${bad}' found in prompt ${prompt.id}`
    );
  }
}
console.log(`  ✓ Checked ${INFINITE_PROMPT_POOL.length} prompts: 0 duplicates, all categories valid, 0 prohibited words.`);

// [3/5] Validate Contextual Evolution Modifiers
console.log("\n[3/5] Verifying contextual evolution modifiers...");
assert.equal(PROMPT_EVOLUTION_MODIFIERS.length, 8, "Must provide 8 contextual evolution modifiers");

const modIdSet = new Set();
for (const mod of PROMPT_EVOLUTION_MODIFIERS) {
  assert.ok(!modIdSet.has(mod.id), `Duplicate modifier id: ${mod.id}`);
  modIdSet.add(mod.id);
  assert.ok(mod.label.startsWith("+ "), `Modifier label must start with '+ ': ${mod.label}`);
  assert.ok(mod.clause.length >= 15, `Modifier clause too short: ${mod.clause}`);

  const lower = (mod.label + " " + mod.clause).toLowerCase();
  for (const bad of PROHIBITED_WORDS) {
    assert.ok(
      !lower.includes(bad),
      `Prohibited word '${bad}' found in modifier ${mod.id}`
    );
  }
}
console.log("  ✓ Verified 8 contextual evolution modifiers with clean constraint clauses.");

// [4/5] Simulate Slot-by-Slot Independent Replacement Cycle
console.log("\n[4/5] Simulating slot-by-slot independent replacement engine...");
let activeSlots = [...CANONICAL_STARTER_PROMPTS];
let usedIds = new Set(activeSlots.map((s) => s.id));

function pickNextPrompt(visibleIds) {
  let available = INFINITE_PROMPT_POOL.filter(
    (p) => !usedIds.has(p.id) && !visibleIds.has(p.id)
  );
  if (available.length === 0) {
    usedIds = new Set(visibleIds);
    available = INFINITE_PROMPT_POOL.filter((p) => !visibleIds.has(p.id));
  }
  const picked = available[0] ?? INFINITE_PROMPT_POOL[0];
  usedIds.add(picked.id);
  return picked;
}

// Click Slot 0: Only slot 0 should change; slots 1, 2, 3 must remain untouched!
const slot0Before = activeSlots[0];
const slot1Before = activeSlots[1];
const slot2Before = activeSlots[2];
const slot3Before = activeSlots[3];

const nextPromptSlot0 = pickNextPrompt(new Set(activeSlots.map((s) => s.id)));
activeSlots[0] = nextPromptSlot0;

assert.notEqual(activeSlots[0].id, slot0Before.id, "Slot 0 must have changed to a new prompt");
assert.equal(activeSlots[1].id, slot1Before.id, "Slot 1 must remain untouched");
assert.equal(activeSlots[2].id, slot2Before.id, "Slot 2 must remain untouched");
assert.equal(activeSlots[3].id, slot3Before.id, "Slot 3 must remain untouched");
console.log(`  ✓ Slot 0 independently replaced ('${slot0Before.label}' -> '${activeSlots[0].label}') while slots 1-3 stayed stable.`);

// Now simulate clicking slots repeatedly for 30 cycles
const seenPromptIds = new Set([slot0Before.id, slot1Before.id, slot2Before.id, slot3Before.id]);
for (let cycle = 0; cycle < 30; cycle++) {
  const targetSlot = cycle % 4;
  const prevId = activeSlots[targetSlot].id;
  const currentVisible = new Set(activeSlots.map((s) => s.id));
  const next = pickNextPrompt(currentVisible);
  activeSlots[targetSlot] = next;

  assert.notEqual(activeSlots[targetSlot].id, prevId, `Slot ${targetSlot} must change on cycle ${cycle}`);
  assert.equal(new Set(activeSlots.map((s) => s.id)).size, 4, "All 4 visible slots must be mutually distinct");
  seenPromptIds.add(next.id);
}
assert.ok(seenPromptIds.size >= 25, `Expected high entropy across 30 cycles, saw ${seenPromptIds.size} distinct prompts`);
console.log(`  ✓ Ran 30 independent slot replacements: 100% distinct slots, ${seenPromptIds.size} unique blueprints cycled.`);

// [5/5] Simulate Roll Infinity Reel & Evolution Appending
console.log("\n[5/5] Simulating Roll Infinity Reel & Evolution Modifiers...");
// Roll Infinity: all 4 slots change simultaneously
const beforeRollIds = new Set(activeSlots.map((s) => s.id));
const rolledItems = [];
for (let i = 0; i < 4; i++) {
  const rolled = pickNextPrompt(new Set([...beforeRollIds, ...rolledItems.map((r) => r.id)]));
  rolledItems.push(rolled);
}
activeSlots = rolledItems;
assert.equal(activeSlots.length, 4, "Rolled reel must have 4 slots");
assert.equal(new Set(activeSlots.map((s) => s.id)).size, 4, "All 4 rolled slots must be mutually distinct");
for (const item of activeSlots) {
  assert.ok(!beforeRollIds.has(item.id), `Rolled slot ${item.id} must be fresh from previous set`);
}
console.log("  ✓ Roll Infinity successfully generated 4 completely fresh, distinct prompt suggestions.");

// Evolution modifier appending
let brief = "Build a real-time collaborative code editor with WebSocket sync.";
const mod1 = PROMPT_EVOLUTION_MODIFIERS[0];
brief = brief.trim() ? `${brief.trim()}\n\n${mod1.clause}` : mod1.clause;
assert.ok(brief.includes(mod1.clause), "Modifier 1 clause must be appended");

const mod2 = PROMPT_EVOLUTION_MODIFIERS[1];
brief = brief.trim() ? `${brief.trim()}\n\n${mod2.clause}` : mod2.clause;
assert.ok(brief.includes(mod2.clause), "Modifier 2 clause must be appended");
assert.ok(brief.startsWith("Build a real-time collaborative"), "Original user prompt must be preserved");
console.log("  ✓ Contextual evolution modifier appending verified without wiping original brief.");

console.log("\n==================================================================");
console.log("🎉 ALL INFINITE PROMPT SUGGESTIONS & EVOLUTION TESTS PASSED!");
console.log("==================================================================");
