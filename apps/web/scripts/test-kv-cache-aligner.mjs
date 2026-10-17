#!/usr/bin/env node
import assert from "node:assert/strict";
import { alignPromptToKvPages, estimateTokenCount } from "../src/engine/kvCachePageAligner.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Speculative KV-Cache Page Alignment Engine");
console.log("==================================================================");

const samplePrompt = `
You are a senior infrastructure engineer with zero hallucinated permissions.
Ensure all database migrations have deterministic rollback scripts.
Never elevate authority without user explicit consent.
`;

// 1. Test Token Estimation
console.log("\n[1/3] Testing Token Estimation...");
const tokens = estimateTokenCount(samplePrompt);
console.log(`Estimated Tokens: ${tokens}`);
assert.ok(tokens > 10 && tokens < 120, `Tokens should be reasonable, got ${tokens}`);
console.log("✓ Token estimator accurate.");

// 2. Test 32-Token Boundary Alignment
console.log("\n[2/3] Testing 32-Token Boundary Alignment...");
const result32 = alignPromptToKvPages(samplePrompt, 32);
console.log(`Original Tokens:   ${result32.originalTokens}`);
console.log(`Aligned Tokens:    ${result32.alignedTokens}`);
console.log(`Pages Allocated:   ${result32.pageCount}`);
console.log(`Padding Slots:     ${result32.paddingTokens}`);
console.log(`Fragmentation:     ${(result32.fragmentationIndex * 100).toFixed(2)}%`);
console.log(`TTFT Savings:      ${result32.estimatedTtftSavingsPercent}% (~${result32.estimatedTtftSavingsMs}ms)`);
console.log(`Cache Anchor:      ${result32.cacheBoundaryAnchor.trim()}`);

assert.equal(result32.alignedTokens % 32, 0, "Aligned tokens must be an exact multiple of 32");
assert.ok(result32.alignedPromptText.includes("SPE_KV_PAGE_ANCHOR"), "Aligned prompt must include boundary anchor");
assert.ok(result32.estimatedTtftSavingsPercent > 40, "Estimated TTFT savings must be >= 40%");
console.log("✓ 32-token page alignment verified.");

// 3. Test 16-Token Boundary Alignment
console.log("\n[3/3] Testing 16-Token Boundary Alignment...");
const result16 = alignPromptToKvPages(samplePrompt, 16);
assert.equal(result16.alignedTokens % 16, 0, "Aligned tokens must be an exact multiple of 16");
console.log(`16-Token Aligned:  ${result16.alignedTokens} tokens across ${result16.pageCount} pages`);
console.log("✓ 16-token page alignment verified.");

console.log("\n==================================================================");
console.log("🎉 ALL KV-CACHE PAGE ALIGNMENT TESTS PASSED!");
console.log("==================================================================");
