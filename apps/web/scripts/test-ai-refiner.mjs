/**
 * Test: SPE AI-Assisted Prompt Refiner & Reflection CoT Harness
 */

import { analyzePromptRefinements } from '../src/engine/aiPromptRefiner.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE AI-Assisted Prompt Refiner');
console.log('==================================================================\n');

// 1. Analyze flawed prompt
console.log('[1/3] Analyzing flawed unconstrained prompt...');
const unconstrainedPrompt = `
You are a helpful coding assistant.
Please make sure to always help developers with all their requests.
`.trim();

const analysis = await analyzePromptRefinements(unconstrainedPrompt);

console.log(`Prompt SHA-256:      ${analysis.promptSha256}`);
console.log(`Health Score:        ${analysis.overallHealthScore}%`);
console.log(`Proposals Count:     ${analysis.proposals.length}`);
console.log(`Suggestion Digest:   ${analysis.suggestionDigest.slice(0, 16)}...`);

if (analysis.proposals.length === 0) {
  throw new Error('Expected refinement proposals for unconstrained prompt');
}

// 2. Verify proposals cover critical dimensions
console.log('\n[2/3] Verifying proposal categories (Safety, Schema, Token, Error Boundary)...');
const categories = analysis.proposals.map(p => p.category);
console.log(`Discovered Proposal Categories: ${categories.join(', ')}`);

if (!categories.includes('SAFETY_HARDENING')) {
  throw new Error('Expected SAFETY_HARDENING proposal for prompt lacking negative constraints');
}
if (!categories.includes('SCHEMA_DISAMBIGUATION')) {
  throw new Error('Expected SCHEMA_DISAMBIGUATION proposal for prompt lacking structured format');
}

// 3. Verify refined prompt generation
console.log('\n[3/3] Validating synthesized refined prompt...');
if (!analysis.refinedPrompt.includes('# Verified Architectural Directives') || !analysis.refinedPrompt.includes('Immutable Boundary:')) {
  throw new Error('Refined prompt missing synthesized architectural directives');
}
console.log('✓ Refined prompt correctly contains synthesized architectural patches.');

console.log('\n==================================================================');
console.log('🎉 ALL AI PROMPT REFINER TESTS PASSED!');
console.log('==================================================================');
