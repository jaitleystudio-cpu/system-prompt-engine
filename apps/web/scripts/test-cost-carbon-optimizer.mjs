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
if (!modelIds.includes('claude-5-5-sonnet') || !modelIds.includes('gpt-6-1-sol') || !modelIds.includes('deepseek-r2')) {
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
console.log(`  GPT-6.1-Sol:    $${costResult.annualSavingsUsdAt10mCalls.gpt5}`);
console.log(`  Claude 5.5:     $${costResult.annualSavingsUsdAt10mCalls.claude45Sonnet}`);

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
const gptEstimate = costResult.modelEstimates.find(m => m.modelId === 'gpt-6-1-sol');
if (!gptEstimate || gptEstimate.estimatedEnergyKwhPerMillion <= 0 || gptEstimate.carbonGramsCo2ePerMillion <= 0) {
  throw new Error('Invalid energy or carbon metrics calculated');
}
console.log(`GPT-6.1-Sol Energy: ${gptEstimate.estimatedEnergyKwhPerMillion} kWh/M, Carbon: ${gptEstimate.carbonGramsCo2ePerMillion}g CO2e/M`);

console.log('\n==================================================================');
console.log('🎉 ALL COST & CARBON OPTIMIZER TESTS PASSED!');
console.log('==================================================================');
