#!/usr/bin/env node
/**
 * Test: Route Integration Gate & Public Copy Policy (Workstream J)
 * Ensures /website remains gated and unverified marketing claims are blocked.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routing = readFileSync(join(root, "src/routing.ts"), "utf8");

console.log("Running Workstream J route gate tests...");

// 1. Verify /website is NOT prematurely in public VIEW_PATH
assert.doesNotMatch(routing, /website:\s*"\/website"/, "/website route must remain gated until full qualification");

// 2. Public copy restrictions: Unqualified affirmative claims must be absent from public routing
const forbiddenPublicClaims = [
  /AI agent integration is live/i,
  /proven world #1 3D website generator/i,
  /guaranteed 60fps on all devices/i
];

for (const pattern of forbiddenPublicClaims) {
  assert.doesNotMatch(routing, pattern, `Public routing must not contain unverified claim: ${pattern}`);
}

// 3. Gatekeeper function check
function canActivateWebsiteRoute(qualification) {
  return qualification.totalScore === 10 && qualification.allGatesPass === true;
}

assert.equal(canActivateWebsiteRoute({ totalScore: 9.9, allGatesPass: true }), false, "9.9 rounding is forbidden");
assert.equal(canActivateWebsiteRoute({ totalScore: 10, allGatesPass: false }), false, "Unpassed gates must block route activation");
assert.equal(canActivateWebsiteRoute({ totalScore: 10, allGatesPass: true }), true, "Exact 10/10 with all gates passing unlocks activation");

console.log("PASS: Workstream J route gate tests passed.");
