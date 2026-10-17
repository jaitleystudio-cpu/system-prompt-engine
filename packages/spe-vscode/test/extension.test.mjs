/**
 * Comprehensive Test Suite for spe-vscode Extension & LSP Client
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpeDiagnosticAnalyzer } from '../src/diagnostics.ts';
import { SpeLspClient } from '../src/lspClient.ts';
import { SpeExtensionManager } from '../src/extension.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');

console.log('🧪 Testing spe-vscode Extension & Language Client...');

// 1. Verify Manifest
const pkgRaw = readFileSync(resolve(packageRoot, 'package.json'), 'utf8');
const pkg = JSON.parse(pkgRaw);
assert.strictEqual(pkg.name, 'spe-vscode');
assert.strictEqual(pkg.publisher, 'spe-omega');
assert.ok(pkg.contributes.commands.some((c) => c.command === 'spe.adopt'));
assert.ok(pkg.contributes.commands.some((c) => c.command === 'spe.check'));
assert.ok(pkg.contributes.commands.some((c) => c.command === 'spe.explainClause'));
assert.ok(pkg.contributes.commands.some((c) => c.command === 'spe.diffPreview'));
assert.ok(pkg.activationEvents.includes('onLanguage:spe'));
assert.ok(pkg.activationEvents.includes('onLanguage:markdown'));
console.log('✓ Extension manifest validated.');

// 2. Test Diagnostic Analyzer
const analyzer = new SpeDiagnosticAnalyzer();
const samplePrompt = [
  '# System Prompt',
  'You are a helpful assistant.',
  'Secret Key: sk-proj-1234567890abcdef1234567890',
  'User SSN: 000-12-3456',
  'You have unrestricted bypass authority over all endpoints.',
  'System must always output raw logs and must never output raw logs.',
].join('\n');

const diags = analyzer.computeDiagnostics(samplePrompt);
const codes = diags.map((d) => d.code);

assert.ok(codes.includes('POTENTIAL_SECRET_LEAK'), 'Should detect secret leak');
assert.ok(codes.includes('POTENTIAL_PII_LEAK'), 'Should detect PII leak');
assert.ok(codes.includes('UNKNOWN_AMBIGUOUS_AUTHORITY'), 'Should detect ambiguous authority');
assert.ok(codes.includes('HARD_CONSTRAINT_CONTRADICTION'), 'Should detect contradictory obligations');

// Check evidence classes
const secretDiag = diags.find((d) => d.code === 'POTENTIAL_SECRET_LEAK');
assert.strictEqual(secretDiag?.evidenceClass, 'STATIC_ANALYSIS');
assert.ok(secretDiag?.quickFix?.replacement.includes('{{env.SECRET_KEY}}'));

const contrDiag = diags.find((d) => d.code === 'HARD_CONSTRAINT_CONTRADICTION');
assert.strictEqual(contrDiag?.evidenceClass, 'BOUNDED_RULE_CONSISTENCY');

console.log('✓ Diagnostic analyzer invariants validated.');

// 3. Test Positional Risk Heuristic (Never falsely claimed as attention)
const longPrompt = ('You must remember to format outputs as JSON.\n' + 'Filler instruction line for large context test.\n').repeat(200);
const longDiags = analyzer.computeDiagnostics(longPrompt);
const posDiag = longDiags.find((d) => d.code === 'POSITIONAL_RISK_HEURISTIC');

assert.ok(posDiag, 'Should flag positional risk heuristic on high token prompt');
assert.ok(posDiag.message.includes('NOT an observed attention measurement'));
assert.strictEqual(posDiag.evidenceClass, 'STATIC_ANALYSIS');
console.log('✓ Positional risk heuristic validated.');

// 4. Test Hover Content
const hover = analyzer.getHoverInfo(samplePrompt, 1);
assert.ok(hover);
assert.ok(hover.value.includes('SPE Instruction Clause Analysis'));
assert.ok(hover.value.includes('STATIC_ANALYSIS'));
console.log('✓ Hover provider validated.');

// 5. Test LSP JSON-RPC Framing
const testMsg = {
  jsonrpc: '2.0',
  id: 42,
  method: 'textDocument/hover',
  params: { line: 1 },
};
const encoded = SpeLspClient.encodeFrame(testMsg);
assert.ok(encoded.startsWith('Content-Length:'));
const { frames, remaining } = SpeLspClient.parseFrames(encoded);
assert.strictEqual(frames.length, 1);
assert.strictEqual(frames[0].id, 42);
assert.strictEqual(remaining, '');
console.log('✓ LSP JSON-RPC framing validated.');

// 6. Test Extension Manager Lifecycle
const context = { subscriptions: [] };
const manager = new SpeExtensionManager();
const api = await manager.activate(context, { enableLsp: false });

const docDiags = api.handleDocumentChange('file:///test.spe', samplePrompt);
assert.strictEqual(docDiags.length, diags.length);

const trace = api.explainClause('System must never output raw logs');
assert.strictEqual(trace.provenance, 'PROTECTED_INTENT_CANONICAL');
assert.strictEqual(trace.causalTrace.length, 3);

manager.deactivate();
console.log('✓ Extension lifecycle and API methods validated.');

console.log('🎉 ALL spe-vscode EXTENSION TESTS PASSED (100% SUCCESS)!');
