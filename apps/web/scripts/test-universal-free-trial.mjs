import assert from "node:assert/strict";
import {
  startBrowserFreeTrial,
  resolveBrowserTrialEntitlement,
  clearBrowserTrialEntitlement,
  verifySignedEntitlementToken,
} from "../src/engine/entitlementVerifier.ts";
import { isVerifiedPaidEntitlementResult } from "../src/engine/promptSynthesizer.mjs";
import { AuthoritativeBillingAuthority } from "../src/server/billingAuthority.ts";

console.log("==================================================================");
console.log("🎁 TESTING: Universal 7-Day Free Trial Architecture");
console.log("==================================================================");

// Mock browser localStorage for node test execution
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, val) => memoryStorage.set(key, String(val)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};

// [1/5] Testing 7-day trial initiation
console.log("[1/5] Testing 1-click Free Trial Initiation...");
const now = Date.now();
const trialRecord = startBrowserFreeTrial("pro", "developer@spe.local", 7, now);
assert.equal(trialRecord.status, "ACTIVE_TRIAL", "Status must be ACTIVE_TRIAL");
assert.equal(trialRecord.tier, "pro", "Tier must be pro");
assert.equal(trialRecord.isTrial, true, "isTrial flag must be true");
assert.ok(trialRecord.trialId.startsWith("SPE-TRIAL-PRO-"), "trialId must be prefixed with SPE-TRIAL-PRO-");
assert.equal(trialRecord.expiresAtMs, now + 7 * 24 * 60 * 60 * 1000, "Expires in exactly 7 days");
console.log("  ✓ 7-day trial initiated cleanly with unique trialId:", trialRecord.trialId);

// [2/5] Testing active trial resolution
console.log("[2/5] Testing Browser Trial Entitlement Resolution...");
const resolved = resolveBrowserTrialEntitlement(now + 1000);
assert.ok(resolved !== null, "Resolved trial should not be null");
assert.equal(resolved.status, "ACTIVE_TRIAL");
assert.equal(resolved.trialId, trialRecord.trialId);
console.log("  ✓ Active trial successfully resolved from browser state");

// [3/5] Testing trial expiration handling
console.log("[3/5] Testing Expiration & Fail-Closed Downgrade...");
const expiredTime = now + 8 * 24 * 60 * 60 * 1000;
const expiredResolution = resolveBrowserTrialEntitlement(expiredTime);
assert.ok(expiredResolution !== null);
assert.equal(expiredResolution.status, "EXPIRED_TRIAL", "Status must be EXPIRED_TRIAL after 7 days");

// Prompt Synthesizer gate check
const activeEntitlement = {
  verified: true,
  tier: "pro",
  isTrial: true,
  payload: {
    isTrial: true,
    expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
  },
};
assert.equal(
  isVerifiedPaidEntitlementResult(activeEntitlement, now + 5000),
  true,
  "Active trial entitlement must be accepted as authorized for Pro features",
);

assert.equal(
  isVerifiedPaidEntitlementResult(activeEntitlement, expiredTime),
  false,
  "Expired trial entitlement must be rejected by synthesizer gate",
);
console.log("  ✓ Expiration boundary verified (active accepted, expired rejected)");

// [4/5] Testing Server-Side Authoritative Ed25519-Signed Trial Token
console.log("[4/5] Testing Server-Side Authoritative Ed25519 Trial Issuance...");
const billing = new AuthoritativeBillingAuthority();
const signedTrialToken = billing.issueSignedTrialEntitlementToken("pro", "agent@autonomous.org", 7, now);
assert.ok(signedTrialToken.startsWith("spe_entitlement.v1."), "Token format valid");

const verification = verifySignedEntitlementToken(signedTrialToken, {
  issuerPublicKeyHex: billing.publicKeyHex,
  currentEpochMs: now + 1000,
});
assert.equal(verification.verified, true, "Authoritative Ed25519 token must verify cryptographically");
assert.equal(verification.tier, "pro");
assert.equal(verification.isTrial, true);
assert.equal(verification.trialDaysRemaining, 7);
console.log("  ✓ Authoritative Ed25519 trial token verified cryptographically with 7 days remaining");

// [5/5] Testing Cleanup & Downgrade to Universal Free Tier
console.log("[5/5] Testing Trial Cleanup...");
clearBrowserTrialEntitlement();
assert.equal(resolveBrowserTrialEntitlement(now), null, "Trial record purged from localStorage");
console.log("  ✓ Trial storage purged cleanly on deactivation");

// [6/6] Testing Anti-Spoofing: Tampered Far-Future Expiry Rejected
console.log("[6/6] Testing Anti-Spoofing: Far-Future and Tampered Expiry Rejection...");
// Attempt 1: Far-future year 2100 unsigned trial in localStorage
localStorage.setItem("spe-trial-entitlement", JSON.stringify({
  status: "ACTIVE_TRIAL",
  tier: "team",
  planName: "Hacked Team Pass",
  email: "hacker@test.local",
  trialId: "SPE-TRIAL-TEAM-HACK",
  activatedAtMs: now,
  expiresAtMs: 4_100_000_000_000, // Year 2100
  isTrial: true,
}));
assert.equal(
  resolveBrowserTrialEntitlement(now),
  null,
  "Trial with duration exceeding 7-day maximum MUST be rejected by resolveBrowserTrialEntitlement",
);

// Attempt 2: Far-future unsigned trial passed directly to isVerifiedPaidEntitlementResult
const spoofedFarFutureEntitlement = {
  verified: true,
  tier: "team",
  isTrial: true,
  payload: {
    isTrial: true,
    activatedAtMs: now,
    expiresAtMs: 4_100_000_000_000,
  },
};
assert.equal(
  isVerifiedPaidEntitlementResult(spoofedFarFutureEntitlement, now),
  false,
  "Far-future trial entitlement MUST be rejected by synthesizer gate",
);
clearBrowserTrialEntitlement();
console.log("  ✓ Anti-spoofing verified: Far-future and tampered trial durations strictly rejected.");

console.log("==================================================================");
console.log("🎉 ALL 7-DAY UNIVERSAL FREE TRIAL TESTS PASSED (100%)!");
console.log("==================================================================");
