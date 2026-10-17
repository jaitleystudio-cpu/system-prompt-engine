import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSystemPrompt } from '../../packages/spe-plugin/src/tools.ts';
import { parseCustomSentence } from '../../apps/web/src/engine/plainEnglishParser.ts';

test('explicit user constraints survive capacity budgeting', () => {
  const constraints = ['Never offer discounts.', 'Preserve account_id unchanged.', 'Return only JSON.'];
  const result = compileSystemPrompt({ goal: 'Background context. '.repeat(2000), constraints });
  assert.ok(result.prompt.length <= 30000);
  for (const value of constraints) assert.ok(result.prompt.includes(value), value);
  assert.ok(result.prompt.includes('Acceptance Verification Battery'));
});
test('Unicode output is well formed across all instruction fields', () => {
  const result = compileSystemPrompt({ goal: 'తెలుగు report 😀\uD800', role: 'Role\uDC00', constraints: ['Keep 😀 intact\uD800'], output_format: 'JSON\uDFFF' });
  assert.equal(result.prompt.isWellFormed(), true);
  assert.ok(result.prompt.includes('😀'));
});
test('compound customer-support preview retains the four known obligations', () => {
  const r = parseCustomSentence('Build a support assistant. It must reply warmly. It must ask for consent. Never offer discounts. Never disclose account IDs. Return only JSON.');
  const text = [r.role, r.goal, r.constraint, r.output].join(' ').toLowerCase();
  for (const value of ['reply warmly', 'ask for consent', 'never offer discounts', 'never disclose account ids', 'return only json']) assert.ok(text.includes(value), value);
});
test('an oversized protected constraint is rejected instead of silently removed', () => {
  assert.throws(() => compileSystemPrompt({ goal: 'Write report', constraints: ['Never disclose ' + 'sensitive '.repeat(5000)] }), /CAPACITY|PROTECTED|CEILING/i);
});
