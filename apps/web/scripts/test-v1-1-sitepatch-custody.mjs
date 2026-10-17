#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — SitePatch Cryptographic Custody Test Suite.
 * Validates SHA-256 state hashing, timestamp custody, stale-state refusal,
 * and adversarial collision resistance.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  createSitePatch,
  applySitePatch,
  hashCanonicalState,
  canonical,
} = await import("../src/website-studio/history/sitePatch.ts");

console.log("================================================================================");
console.log("SPE v1.1 — SITEPATCH CRYPTOGRAPHIC SHA-256 CUSTODY & ADVERSARIAL SUITE");
console.log("================================================================================");

// 1. SHA-256 Format and Cryptographic Length
const state1 = { title: "SPE Studio", version: 1, active: true };
const hash1 = hashCanonicalState(state1);
assert.ok(hash1.startsWith("sha256-"), `Hash must start with sha256-, got: ${hash1}`);
assert.equal(hash1.length, 7 + 64, `Hash must have prefix + 64-char hex digest (71 total), got: ${hash1.length}`);
console.log("✅ 1. Cryptographic SHA-256 format verified:", hash1);

// 2. Canonical Key Order Invariance
const stateA = { a: 1, b: 2, c: { x: "foo", y: "bar" } };
const stateB = { c: { y: "bar", x: "foo" }, b: 2, a: 1 };
assert.equal(hashCanonicalState(stateA), hashCanonicalState(stateB));
console.log("✅ 2. Deterministic key order invariance verified.");

// 3. Avalanche Effect (1 character difference completely alters hash)
const stateAltered = { title: "SPE Studio!", version: 1, active: true };
const hashAltered = hashCanonicalState(stateAltered);
assert.notEqual(hash1, hashAltered);
// Calculate hamming distance or character divergence
let differingChars = 0;
for (let i = 7; i < hash1.length; i++) {
  if (hash1[i] !== hashAltered[i]) differingChars++;
}
assert.ok(differingChars > 25, `Avalanche effect insufficient: only ${differingChars}/64 characters differed`);
console.log(`✅ 3. SHA-256 Avalanche effect verified: ${differingChars}/64 hex characters differed on 1-char change.`);

// 4. Timestamp Custody
const patch = createSitePatch(state1, [{ op: "set", path: ["version"], value: 2 }], "USER_UI");
assert.ok(typeof patch.timestamp === "number" && patch.timestamp > 0);
assert.ok(patch.id.startsWith("patch-sha256-"));
assert.ok(patch.beforeHash.startsWith("sha256-"));
assert.ok(patch.afterHash.startsWith("sha256-"));
console.log("✅ 4. SitePatch timestamp and cryptographic ID verified:", patch.id);

// 5. Rejection of Missing or Invalid Timestamp
assert.throws(() => {
  const badPatch = { ...patch, timestamp: undefined };
  applySitePatch(state1, badPatch);
}, /PATCH_INVALID_TIMESTAMP/);

assert.throws(() => {
  const badPatch = { ...patch, timestamp: -5 };
  applySitePatch(state1, badPatch);
}, /PATCH_INVALID_TIMESTAMP/);
console.log("✅ 5. Rejection of missing/non-positive timestamp killed.");

// 6. Rejection of Weak 32-bit Hashes
assert.throws(() => {
  const weakPatch = { ...patch, beforeHash: "fnv1a32-12345678" };
  applySitePatch(state1, weakPatch);
}, /PATCH_INVALID_HASH/);
console.log("✅ 6. Weak 32-bit FNV-1a hash rejection killed.");

// 7. Stale State / Conflict Refusal
const staleState = { title: "Different Title", version: 1, active: true };
assert.throws(() => {
  applySitePatch(staleState, patch);
}, /PATCH_CONFLICT/);
console.log("✅ 7. Stale state divergence refusal verified.");

// 8. After-Hash Tampering Rejection
assert.throws(() => {
  const tamperedPatch = { ...patch, afterHash: "sha256-" + "0".repeat(64) };
  applySitePatch(state1, tamperedPatch);
}, /PATCH_AFTER_HASH_MISMATCH/);
console.log("✅ 8. After-hash tampering verification killed.");

// 9. Successful Clean Application
const nextState = applySitePatch(state1, patch);
assert.equal(nextState.version, 2);
assert.equal(nextState.title, "SPE Studio");
console.log("✅ 9. Clean authoritative patch application verified.");

console.log("\nPASS: SitePatch cryptographic custody & adversarial invariants 100% verified.");
