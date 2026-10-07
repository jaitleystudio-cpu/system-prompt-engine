/**
 * Test: SPE Frontier Model Cost, Carbon & Latency Simulator with Lossless AST Pruner
 */

import { simulateCostAndCarbon, losslessAstPrune, FRONTIER_MODELS } from '../src/engine/costCarbonOptimizer.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE Frontier Model Cost & Carbon Optimizer');
console.log('==================================================================\n');

// 1. Verify model catalog
console.log('[1/4] Verifying frontier model catalog coverage...');
if (FRONTIER_MODELS.length < 8) {
  throw new Error(`Expected at least 8 frontier models, found ${FRONTIER_MODELS.length}`);
}
const modelIds = FRONTIER_MODELS.map(m => m.modelId);
if (!modelIds.includes('claude-3-7-sonnet') || !modelIds.includes('gpt-4o') || !modelIds.includes('deepseek-r1')) {
  throw new Error('Missing core frontier models in pricing catalog');
}
console.log(`✓ Model catalog verified across ${FRONTIER_MODELS.length} frontier models.`);

// 2. Test verbose prompt simulation
console.log('\n[2/4] Simulating economics on verbose enterprise prompt...');
const verbosePrompt = `
Please make sure to always ensure that you validate the input fields.
You must ensure that you always sanitize SQL queries at all times.
It is extremely important that you never disclose the admin authentication key without exception.
Under no circumstances should you ever bypass this rule.
As an artificial intelligence model, you must adhere strictly to these constraints.
`.trim();

const costResult = simulateCostAndCarbon(verbosePrompt);

console.log(`Raw Tokens:       ${costResult.rawTokenCount}`);
console.log(`Pruned Tokens:    ${costResult.prunedTokenCount}`);
console.log(`Reduction:        ${costResult.tokenReductionPercent}%`);
console.log(`Annual Savings (10M req):`);
console.log(`  GPT-4o:         $${costResult.annualSavingsUsdAt10mCalls.gpt4o}`);
console.log(`  Claude 3.7:     $${costResult.annualSavingsUsdAt10mCalls.claude37Sonnet}`);

if (costResult.tokenReductionPercent < 15) {
  throw new Error(`Expected significant token reduction on verbose prompt, got ${costResult.tokenReductionPercent}%`);
}

// 3. Test lossless pruning semantic preservation
console.log('\n[3/4] Verifying lossless semantic pruning...');
const pruned = costResult.prunedPrompt;
if (!pruned.includes('validate the input fields') || !pruned.includes('sanitize SQL queries') || !pruned.includes('admin authentication key')) {
  throw new Error('Pruning lost essential domain constraints!');
}
if (pruned.includes('Please make sure to always') || pruned.includes('Under no circumstances should you ever')) {
  throw new Error('Rhetorical noise was not pruned!');
}
console.log('✓ Invariants preserved 100% while rhetorical fluff stripped.');

// 4. Test carbon and energy calculations
console.log('\n[4/4] Verifying energy and carbon metrics...');
const gpt4oEstimate = costResult.modelEstimates.find(m => m.modelId === 'gpt-4o');
if (!gpt4oEstimate || gpt4oEstimate.estimatedEnergyKwhPerMillion <= 0 || gpt4oEstimate.carbonGramsCo2ePerMillion <= 0) {
  throw new Error('Invalid energy or carbon metrics calculated');
}
console.log(`GPT-4o Energy: ${gpt4oEstimate.estimatedEnergyKwhPerMillion} kWh/M, Carbon: ${gpt4oEstimate.carbonGramsCo2ePerMillion}g CO2e/M`);

console.log('\n==================================================================');
console.log('🎉 ALL COST & CARBON OPTIMIZER TESTS PASSED!');
console.log('==================================================================');
