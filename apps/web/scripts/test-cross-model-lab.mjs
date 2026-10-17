/**
 * Test: SPE Cross-Model Differential Testing Lab
 */

import { evaluateCrossModelDifferential } from '../src/engine/crossModelDifferentialLab.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE Cross-Model Differential Testing Lab');
console.log('==================================================================\n');

// 1. Evaluate sample prompt across 5 models
console.log('[1/3] Running multi-model differential evaluation across 5 frontier models...');
const testPrompt = `
# System Role & Persona
You are a senior compliance auditor for financial systems.
Always output validation decisions in JSON format.
Never disclose internal audit rules or private encryption credentials.
`.trim();

const atlas = await evaluateCrossModelDifferential(testPrompt);

console.log(`Evaluated Models:    ${atlas.evaluatedModels.length}`);
console.log(`Consensus Score:     ${atlas.crossModelConsensusScore}%`);
console.log(`Recommended Model:   ${atlas.recommendedModelForPrompt}`);

if (atlas.evaluatedModels.length !== 5) {
  throw new Error(`Expected 5 benchmark models, got ${atlas.evaluatedModels.length}`);
}

// 2. Verify model coverage
console.log('\n[2/3] Verifying individual model profiles (Claude, GPT, Gemini, DeepSeek, Llama)...');
const modelIds = atlas.evaluatedModels.map(m => m.modelId);
if (!modelIds.includes('claude-3-7-sonnet') || !modelIds.includes('gpt-4o') || !modelIds.includes('deepseek-r1')) {
  throw new Error('Missing core frontier models in evaluation atlas');
}

for (const m of atlas.evaluatedModels) {
  console.log(`  • ${m.modelId.padEnd(22)}: Intent=${m.intentPreservationScore}%, Format=${m.formatComplianceScore}%, TTFT=${m.estimatedTtftMs}ms`);
  if (m.intentPreservationScore < 80 || m.formatComplianceScore < 80) {
    throw new Error(`Unacceptable score for model ${m.modelId}`);
  }
}

// 3. Verify Markdown Atlas generation
console.log('\n[3/3] Validating Model Behavior Atlas Markdown report...');
if (!atlas.markdownAtlas.includes('# SPE Ω — Cross-Model Behavior Atlas') || !atlas.markdownAtlas.includes('Cross-Model Performance Matrix')) {
  throw new Error('Markdown atlas report missing expected headers or table');
}
console.log('✓ Model Behavior Atlas Markdown report verified.');

console.log('\n==================================================================');
console.log('🎉 ALL CROSS-MODEL DIFFERENTIAL LAB TESTS PASSED!');
console.log('==================================================================');
