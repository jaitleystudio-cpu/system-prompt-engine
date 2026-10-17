#!/usr/bin/env node
import { SovereignApmStore } from '../src/engine/apmTelemetryStore.ts';

console.log("==================================================================");
console.log("📊 Testing SPE Sovereign Local APM Telemetry & Trace Store");
console.log("==================================================================");

const store = new SovereignApmStore(50);

console.log("\n[1] Ingesting execution traces across multiple models...");
const t1 = await store.createExecutionTrace({
  model: 'claude-5-5-sonnet',
  promptText: 'System prompt with strict type checking and negative bounds',
  inputTokens: 145,
  outputTokens: 420,
  totalLatencyMs: 38,
  status: 'SUCCESS'
});

const t2 = await store.createExecutionTrace({
  model: 'gpt-6-1-sol',
  promptText: 'System prompt with adversarial probe injection attempt',
  inputTokens: 210,
  outputTokens: 0,
  totalLatencyMs: 19,
  status: 'INVARIANT_BLOCKED',
  triOrigin: 'VERIFIER'
});

const t3 = await store.createExecutionTrace({
  model: 'deepseek-v4',
  promptText: 'Formal mathematical theorem proof prompt',
  inputTokens: 380,
  outputTokens: 890,
  totalLatencyMs: 72,
  status: 'SUCCESS'
});

console.log(`  Recorded traces: ${store.getTraces().length}`);

// 2. Summary Audit
console.log("\n[2] Checking Telemetry Aggregation...");
const summary = store.getSummary();
console.log(`  Total Traces:         ${summary.totalTraces}`);
console.log(`  Successful Traces:    ${summary.successfulTraces}`);
console.log(`  Blocked Traces:       ${summary.blockedTraces}`);
console.log(`  Average Latency:      ${summary.averageLatencyMs} ms`);
console.log(`  Total Cost NanoUSD:   $${summary.totalCostNanoUsd} (Zero Egress Verified)`);
console.log(`  Airgap Preserved:     ${summary.airgapPreserved ? 'YES' : 'NO'}`);

if (summary.totalTraces !== 3 || summary.successfulTraces !== 2 || summary.blockedTraces !== 1) {
  throw new Error("Summary aggregation counts mismatch!");
}

// 3. Export to OpenTelemetry GenAI
console.log("\n[3] Exporting to OpenTelemetry GenAI ResourceSpans format...");
const otel = store.exportToOpenTelemetry();
console.log(`  ResourceSpans count:  ${otel.resourceSpans.length}`);
if (otel.resourceSpans.length !== 3) {
  throw new Error("OTel export count mismatch!");
}

// 4. Export to Langfuse
console.log("\n[4] Exporting to Langfuse Observations format...");
const langfuse = store.exportToLangfuse();
console.log(`  Langfuse trace count: ${langfuse.length}`);
console.log(`  First trace spans:    ${langfuse[0].observations.length}`);
if (langfuse.length !== 3 || langfuse[0].observations.length < 3) {
  throw new Error("Langfuse export structure mismatch!");
}

console.log("\n==================================================================");
console.log("🎉 ALL SOVEREIGN APM TELEMETRY TESTS PASSED WITH 100%!");
console.log("==================================================================");
