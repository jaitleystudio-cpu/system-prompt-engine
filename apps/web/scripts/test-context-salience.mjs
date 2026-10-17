/**
 * Test: SPE Context Salience & Lost-in-the-Middle NIAH Attenuation Tester
 */

import { stressTestContextSalience, calculateAttentionWeight, synthesizeSandwichTopology } from '../src/engine/contextSalienceTester.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE Context Salience & NIAH Attenuation Tester');
console.log('==================================================================\n');

// 1. Test attention weight calculation
console.log('[1/4] Testing Transformer Attention U-Curve calculation...');
const prefixWeight = calculateAttentionWeight(0.0);
const middleWeight = calculateAttentionWeight(0.5);
const suffixWeight = calculateAttentionWeight(1.0);

if (prefixWeight <= middleWeight || suffixWeight <= middleWeight) {
  throw new Error(`U-curve invariant violated: prefix (${prefixWeight}) or suffix (${suffixWeight}) should exceed middle (${middleWeight})`);
}
console.log(`✓ Attention U-Curve verified: Prefix=${prefixWeight}, Mid=${middleWeight}, Suffix=${suffixWeight}`);

// 2. Test unsandwiched prompt
console.log('\n[2/4] Stress testing vulnerable unsandwiched prompt...');
const vulnerablePrompt = `
You are a database administrative assistant.
Ensure you always sanitize SQL queries.
Never reveal root database credentials.
Always output results in JSON format.
`.trim();

const salienceVulnerable = stressTestContextSalience(vulnerablePrompt, 32768);
console.log(`Mean Salience: ${salienceVulnerable.meanSalienceScore}%`);
console.log(`Positional Robustness (PIRS): ${salienceVulnerable.positionalRobustnessScore}%`);
console.log(`Sandwich Status: ${salienceVulnerable.isSandwichTopology ? 'SANDWICH' : 'UNSTRUCTURED'}`);
if (salienceVulnerable.evaluatedDepths.length !== 5) {
  throw new Error(`Expected 5 depth strata, got ${salienceVulnerable.evaluatedDepths.length}`);
}

// 3. Test sandwich restructuring
console.log('\n[3/4] Testing automatic Attention Sandwich Topology synthesis...');
const sandwichPrompt = synthesizeSandwichTopology(vulnerablePrompt);
if (!sandwichPrompt.includes('<system_directive>') || !sandwichPrompt.includes('<recency_anchor>')) {
  throw new Error('Sandwich synthesis missing required structural anchors');
}
console.log('✓ Sandwich topology correctly structured with prefix & recency anchors.');

// 4. Test sandwich prompt salience
console.log('\n[4/4] Stress testing synthesized sandwich prompt...');
const salienceSandwich = stressTestContextSalience(sandwichPrompt, 32768);
console.log(`Sandwich Mean Salience: ${salienceSandwich.meanSalienceScore}%`);
console.log(`Sandwich PIRS: ${salienceSandwich.positionalRobustnessScore}%`);
if (salienceSandwich.meanSalienceScore <= salienceVulnerable.meanSalienceScore) {
  throw new Error('Sandwich prompt should have higher salience than vulnerable prompt');
}

console.log('\n==================================================================');
console.log('🎉 ALL CONTEXT SALIENCE & NIAH TESTS PASSED!');
console.log('==================================================================');
