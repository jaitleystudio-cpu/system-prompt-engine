/**
 * Comprehensive Test Suite for SPE Causal Proof Graph Engine
 */

import assert from 'node:assert';
import {
  CausalProofGraph,
  buildCanonicalProofGraph,
} from '../src/engine/causalProofGraph.ts';

console.log('🧪 Testing SPE Causal Proof Graph Engine (Ring 3 M3)...');

// 1. Build canonical graph
const samplePrompt =
  'System must never disclose API credentials or secret keys under any circumstance.\n' +
  'Output all responses strictly formatted as a valid JSON object.';

const graph = buildCanonicalProofGraph(samplePrompt);

assert.ok(graph.nodes.size >= 8, `Expected at least 8 nodes, got ${graph.nodes.size}`);
assert.ok(graph.edges.size >= 8, `Expected at least 8 edges, got ${graph.edges.size}`);
console.log(`✓ Canonical proof graph constructed with ${graph.nodes.size} nodes and ${graph.edges.size} edges.`);

// 2. Test Backward Provenance Trace: whyDoesThisClauseExist("CLS-001")
const trace = graph.whyDoesThisClauseExist('CLS-001');

assert.strictEqual(trace.clauseId, 'CLS-001');
assert.ok(trace.humanSpans.length >= 1, 'Should trace to at least 1 Human Span');
assert.strictEqual(trace.humanSpans[0].nodeId, 'HS-001');
assert.ok(trace.protectedIntents.length >= 1, 'Should trace to ProtectedIntent');
assert.strictEqual(trace.protectedIntents[0].nodeId, 'PI-001');
assert.ok(trace.requirements.length >= 1, 'Should trace to Requirement');
assert.strictEqual(trace.requirements[0].nodeId, 'REQ-001');
assert.ok(trace.transforms.length >= 1, 'Should trace to Transforms');

console.log('✓ Backward provenance trace (whyDoesThisClauseExist) verified 100%.');

// 3. Test Forward Enforcement Trace: whereIsThisRequirementEnforced("REQ-001")
const reqTrace = graph.whereIsThisRequirementEnforced('REQ-001');

assert.strictEqual(reqTrace.requirementId, 'REQ-001');
assert.ok(reqTrace.constraints.length >= 1, 'Should have constraints');
assert.strictEqual(reqTrace.constraints[0].nodeId, 'CST-001');
assert.ok(reqTrace.clauses.length >= 1, 'Should have clauses');
assert.strictEqual(reqTrace.clauses[0].nodeId, 'CLS-001');
assert.ok(reqTrace.testCases.length >= 1, 'Should have test cases');
assert.strictEqual(reqTrace.testCases[0].nodeId, 'TC-001');
assert.ok(reqTrace.runtimePolicies.length >= 1, 'Should have runtime policies');
assert.strictEqual(reqTrace.runtimePolicies[0].nodeId, 'POL-001');

console.log('✓ Forward enforcement trace (whereIsThisRequirementEnforced) verified 100%.');

// 4. Test Orphan Detection
const orphans = graph.findOrphans();
assert.strictEqual(orphans.unanchoredClauses.length, 0, 'Canonical graph should have 0 unanchored clauses');
assert.strictEqual(orphans.unverifiedRequirements.length, 0, 'Canonical graph should have 0 unverified requirements');

// Artificially inject orphan clause and unverified requirement
const testGraph = CausalProofGraph.fromJSON(graph.toJSON());
testGraph.addNode({
  nodeId: 'CLS-ORPHAN',
  nodeType: 'PROMPT_CLAUSE',
  label: 'Orphan clause with no provenance',
});
testGraph.addNode({
  nodeId: 'REQ-ORPHAN',
  nodeType: 'REQUIREMENT',
  label: 'Requirement with no downstream enforcement',
});

const detectedOrphans = testGraph.findOrphans();
assert.ok(detectedOrphans.unanchoredClauses.includes('CLS-ORPHAN'));
assert.ok(detectedOrphans.unverifiedRequirements.includes('REQ-ORPHAN'));

console.log('✓ Orphan detection and graph integrity diagnostics verified 100%.');

// 5. Test JSON Roundtrip
const exportedJson = graph.toJSON();
assert.ok(exportedJson.nodes.length > 0);
assert.ok(exportedJson.edges.length > 0);

const importedGraph = CausalProofGraph.fromJSON(exportedJson);
assert.strictEqual(importedGraph.nodes.size, graph.nodes.size);
assert.strictEqual(importedGraph.edges.size, graph.edges.size);

const roundtripTrace = importedGraph.whyDoesThisClauseExist('CLS-001');
assert.strictEqual(roundtripTrace.humanSpans[0].nodeId, 'HS-001');

console.log('✓ JSON serialization roundtrip verified 100%.');

console.log('🎉 ALL CAUSAL PROOF GRAPH TESTS PASSED (100% SUCCESS)!');
