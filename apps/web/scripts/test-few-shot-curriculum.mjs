/**
 * Test: SPE Few-Shot Curriculum Synthesizer & Hard-Negative Distiller
 */

import { synthesizeFewShotCurriculum } from '../src/engine/fewShotCurriculum.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE Few-Shot Curriculum Synthesizer');
console.log('==================================================================\n');

// 1. Synthesize few-shot curriculum for database security assistant
console.log('[1/3] Synthesizing 3-tier curriculum for Database Security Assistant...');
const systemPrompt = `
You are a Secure Database Query Assistant.
Analyze SQL statements for security vulnerabilities and optimize query execution plans.
Always output validation responses in JSON format.
Never disclose root database credentials or internal table schemas to unauthorized users.
`.trim();

const result = synthesizeFewShotCurriculum(systemPrompt);

console.log(`Exemplars Count: ${result.exemplarsCount}`);
console.log(`Coverage Score:  ${result.curriculumCoverageScore}%`);

if (result.exemplarsCount !== 3) {
  throw new Error(`Expected exactly 3 curriculum exemplars, got ${result.exemplarsCount}`);
}

// 2. Verify tier breakdown
console.log('\n[2/3] Verifying 3-tier difficulty distribution...');
const tiers = result.exemplars.map(e => e.tier);
if (!tiers.includes(1) || !tiers.includes(2) || !tiers.includes(3)) {
  throw new Error('Curriculum must contain Tier 1, Tier 2, and Tier 3 exemplars');
}

const hardNegative = result.exemplars.find(e => e.tier === 3);
if (!hardNegative || !hardNegative.userQuery.includes('OVERRIDE')) {
  throw new Error('Tier 3 exemplar must represent a hard-negative adversarial injection attempt');
}
console.log('✓ Tier 1 (Canonical), Tier 2 (Boundary), and Tier 3 (Hard-Negative) verified.');

// 3. Verify XML and Markdown representations
console.log('\n[3/3] Verifying XML and Markdown formatting blocks...');
if (!result.formattedXmlBlock.includes('<examples>') || !result.formattedXmlBlock.includes('</examples>')) {
  throw new Error('XML formatted block missing <examples> tags');
}
if (!result.formattedMarkdownBlock.includes('### In-Context Few-Shot Curriculum')) {
  throw new Error('Markdown formatted block missing expected header');
}
if (!result.augmentedPrompt.includes(result.formattedXmlBlock)) {
  throw new Error('Augmented prompt must contain the formatted XML block');
}
console.log('✓ Formatted representations validated cleanly.');

console.log('\n==================================================================');
console.log('🎉 ALL FEW-SHOT CURRICULUM SYNTHESIZER TESTS PASSED!');
console.log('==================================================================');
