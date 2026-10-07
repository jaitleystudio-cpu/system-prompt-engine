/**
 * Test: SPE OpenTelemetry GenAI Semantic Conventions & Prometheus Exporter
 */

import { exportTelemetryPackage } from '../src/engine/otelTelemetryExporter.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE OpenTelemetry GenAI & Prometheus Exporter');
console.log('==================================================================\n');

// 1. Export telemetry package
console.log('[1/3] Generating OpenTelemetry GenAI span and Prometheus metrics...');
const samplePrompt = `
You are the Apollo Order Routing Orchestrator.
Validate all incoming JSON orders for inventory availability.
`.trim();

const telemetry = await exportTelemetryPackage(samplePrompt, {
  modelTarget: 'claude-3-7-sonnet',
  receiptDigest: 'receipt_sha256_canonical_test_hash_42',
  securityScore: 99,
  folSoundness: true,
  isKvAligned: true
});

// 2. Validate OpenTelemetry GenAI attributes
console.log('\n[2/3] Validating OpenTelemetry v1.28 GenAI Semantic Conventions...');
const span = telemetry.otelSpan;
if (span.attributes['gen_ai.system'] !== 'spe-assured-runtime') {
  throw new Error('Missing gen_ai.system attribute');
}
if (span.attributes['gen_ai.request.model'] !== 'claude-3-7-sonnet') {
  throw new Error('Model target mismatch in span');
}
if (span.attributes['spe.assurance.receipt_digest'] !== 'receipt_sha256_canonical_test_hash_42') {
  throw new Error('Receipt digest mismatch in span baggage');
}
if (span.attributes['spe.assurance.security_mkr'] !== 99) {
  throw new Error('Security score mismatch in span');
}
console.log('✓ OpenTelemetry GenAI span validated successfully.');

// 3. Validate Prometheus exposition text
console.log('\n[3/3] Validating Prometheus exposition metrics...');
const promText = telemetry.prometheusMetricsText;
if (!promText.includes('spe_prompt_tokens{') || !promText.includes('spe_prompt_security_score{') || !promText.includes('spe_prompt_fol_soundness{')) {
  throw new Error('Prometheus metrics missing expected gauge definitions');
}
if (!telemetry.datadogTagString.includes('spe_receipt:')) {
  throw new Error('Datadog tag string missing receipt identifier');
}
console.log('✓ Prometheus and Datadog metric formats validated.');

console.log('\n==================================================================');
console.log('🎉 ALL OPENTELEMETRY & PROMETHEUS EXPORTER TESTS PASSED!');
console.log('==================================================================');
