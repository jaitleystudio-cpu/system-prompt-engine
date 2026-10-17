/**
 * Test Suite for @spe/runtime (CapabilityFirewall, McpSecurityGateway, A2ADelegationPolicyEngine)
 */

import assert from 'node:assert';
import { CapabilityFirewall } from '../src/firewall.ts';
import { McpSecurityGateway } from '../src/mcpProxy.ts';
import { A2ADelegationPolicyEngine } from '../src/a2a.ts';

console.log('🧪 Testing @spe/runtime Zero-Dependency Gateway...');

// 1. Test CapabilityFirewall
const firewall = new CapabilityFirewall([
  {
    grantId: 'grant-docs-read',
    capability: 'READ_FILE',
    resourceScope: 'docs/*',
    issuer: 'security-admin',
  },
  {
    grantId: 'grant-deploy-prod',
    capability: 'DEPLOY',
    resourceScope: 'prod',
    issuer: 'ops-lead',
    approvalRequired: true,
  },
]);

// Read authorized doc
const res1 = firewall.evaluateAction('READ_FILE', 'docs/policy.md');
assert.strictEqual(res1.decision, 'ALLOW');
assert.strictEqual(res1.grantId, 'grant-docs-read');

// Read unauthorized secret
const res2 = firewall.evaluateAction('READ_FILE', 'secrets/keys.json');
assert.strictEqual(res2.decision, 'DENY');

// Action requiring approval
const res3 = firewall.evaluateAction('DEPLOY', 'prod');
assert.strictEqual(res3.decision, 'REQUIRES_APPROVAL');

console.log('✓ CapabilityFirewall tests passed.');

// 2. Test McpSecurityGateway
const mcpGateway = new McpSecurityGateway(firewall);

const mcpAllowed = mcpGateway.evaluateMcpToolCall({
  toolName: 'read_file',
  arguments: { path: 'docs/readme.md' },
});
assert.strictEqual(mcpAllowed.decision, 'ALLOW');

const mcpBlocked = mcpGateway.evaluateMcpToolCall({
  toolName: 'run_command',
  arguments: { CommandLine: 'rm -rf /' },
});
assert.strictEqual(mcpBlocked.decision, 'DENY');

console.log('✓ McpSecurityGateway tests passed.');

// 3. Test A2ADelegationPolicyEngine
const a2a = new A2ADelegationPolicyEngine([
  {
    agentId: 'lead-orchestrator',
    allowedCapabilities: ['READ_FILE', 'WRITE_FILE', 'TOOL_EXECUTE'],
    canDelegate: true,
    delegatableCapabilities: ['READ_FILE'],
  },
  {
    agentId: 'restricted-worker',
    allowedCapabilities: ['READ_FILE'],
    canDelegate: false,
  },
]);

// Valid delegation (READ_FILE is delegatable by lead-orchestrator)
const delAllowed = a2a.evaluateDelegation({
  fromAgentId: 'lead-orchestrator',
  toAgentId: 'sub-researcher',
  delegatedCapabilities: ['READ_FILE'],
  taskDescription: 'Search knowledge base',
});
assert.strictEqual(delAllowed.allowed, true);

// Invalid delegation (WRITE_FILE is not in delegatableCapabilities)
const delBlocked = a2a.evaluateDelegation({
  fromAgentId: 'lead-orchestrator',
  toAgentId: 'sub-researcher',
  delegatedCapabilities: ['WRITE_FILE'],
  taskDescription: 'Write system files',
});
assert.strictEqual(delBlocked.allowed, false);

// Forbidden delegator (restricted-worker cannot delegate at all)
const delForbidden = a2a.evaluateDelegation({
  fromAgentId: 'restricted-worker',
  toAgentId: 'another-worker',
  delegatedCapabilities: ['READ_FILE'],
  taskDescription: 'Delegate reading',
});
assert.strictEqual(delForbidden.allowed, false);

console.log('✓ A2ADelegationPolicyEngine tests passed.');
console.log('🎉 ALL @spe/runtime TESTS PASSED (100% SUCCESS)!');
