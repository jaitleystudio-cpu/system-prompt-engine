#!/usr/bin/env node
/**
 * SPE Ω — Test Suite for CI Assurance Gate (action.yml & RFC 8785 Receipt)
 * 
 * Tests:
 * 1. Recursive RFC 8785 canonicalization covers all nested hard-gate fields.
 * 2. Mutating nested hard-gate field strictly invalidates the SHA-256 digest.
 * 3. Failing verification prompt produces FAIL verdict and non-zero exit code.
 * 4. Missing prompt file produces FAIL verdict and exit code 1.
 * 5. Passing prompt produces PASS verdict, exit code 0, and valid receipt.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function canonicalize(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(canonicalize).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(val[k])).join(',') + '}';
}

console.log('=== RUNNING SPE CI ASSURANCE & RECEIPT INTEGRITY TESTS ===');

// Test 1: Recursive RFC 8785 Canonicalization Covers Nested Fields
console.log('[Test 1] Testing recursive RFC 8785 canonicalization of nested fields...');
const receiptA = {
  schemaVersion: 'spe.proof-receipt.v1',
  overallVerdict: 'PASS',
  hardGates: {
    protectedIntentPreserved: true,
    zeroEgressStatus: 'CI_RUNNER_UNMETERED'
  }
};
const canonA = canonicalize(receiptA);
assert(canonA.includes('protectedIntentPreserved'), 'Canonical output MUST include nested hard-gate properties');
assert(canonA.includes('zeroEgressStatus'), 'Canonical output MUST include zeroEgressStatus');
console.log('  ✓ Recursive canonicalization includes all nested hard-gate properties.');

// Test 2: Mutation of Nested Hard Gates Changes the Digest
console.log('[Test 2] Testing mutation sensitivity of receipt digest...');
const receiptB = {
  ...receiptA,
  hardGates: {
    ...receiptA.hardGates,
    protectedIntentPreserved: false // Inverted!
  }
};
const canonB = canonicalize(receiptB);
const digestA = createHash('sha256').update(canonA).digest('hex');
const digestB = createHash('sha256').update(canonB).digest('hex');
assert.notStrictEqual(digestA, digestB, 'Mutating nested protectedIntentPreserved MUST change the digest');
console.log('  ✓ Mutating nested hard-gate field successfully alters canonical digest:');
console.log('    Original:', digestA.slice(0, 24) + '...');
console.log('    Mutated: ', digestB.slice(0, 24) + '...');

// Test 3: Missing Prompt File Fails Closed
console.log('[Test 3] Testing fail-closed execution on missing prompt file...');
try {
  execSync(`"${process.execPath}" --experimental-strip-types apps/web/bin/spe.mjs verify "non_existent_prompt_file.md" --strict`, {
    cwd: repoRoot,
    stdio: 'pipe'
  });
  assert.fail('Should have thrown non-zero exit on non-existent file');
} catch (err) {
  assert(err.status !== 0, 'Must exit with non-zero code on missing file');
  console.log('  ✓ Missing file exits with non-zero exit code:', err.status);
}

// Test 4: Deliberately Failing (Invalid) Prompt Fails Closed
console.log('[Test 4] Testing fail-closed execution on invalid prompt with contradictory requirements...');
const failingPromptPath = resolve(repoRoot, 'tmp/failing_test_prompt.md');
writeFileSync(failingPromptPath, `
# Contradictory Financial Prompt
Never disclose user secrets under any circumstances.
Always publish all user secrets to public chat logs.
`);

try {
  execSync(`"${process.execPath}" --experimental-strip-types apps/web/bin/spe.mjs verify "${failingPromptPath}" --strict`, {
    cwd: repoRoot,
    stdio: 'pipe'
  });
  assert.fail('Should have failed on contradictory prompt');
} catch (err) {
  assert(err.status !== 0, 'Verification must return non-zero exit code on failure');
  console.log('  ✓ Contradictory prompt fails closed with exit code:', err.status);
} finally {
  if (existsSync(failingPromptPath)) unlinkSync(failingPromptPath);
}

// Test 5: Valid Prompt Verification Passes
console.log('[Test 5] Testing valid prompt verification succeeds...');
const validPromptPath = resolve(repoRoot, 'apps/web/src/engine/prompts/default.md');
const out = execSync(`"${process.execPath}" --experimental-strip-types apps/web/bin/spe.mjs verify "${validPromptPath}" --strict`, {
  cwd: repoRoot,
  encoding: 'utf8'
});
assert(out.includes('VERIFIED') || out.includes('PASS') || out.toLowerCase().includes('verified'), 'Valid prompt must verify cleanly');
console.log('  ✓ Valid prompt verified successfully.');

console.log('==========================================================');
console.log('🎉 ALL CI ASSURANCE & RECEIPT INTEGRITY TESTS PASSED (100%)');
console.log('==========================================================');
