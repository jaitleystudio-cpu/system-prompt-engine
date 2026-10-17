/**
 * SPE Runtime — Agent-to-Agent (A2A) Delegation Policy Engine
 * 
 * Enforces delegation contracts:
 * An agent cannot delegate capabilities it does not possess.
 * Sensitive capabilities (e.g. PAYMENT, PRODUCTION_CHANGE) require explicit delegation flags.
 */

import type { CapabilityType } from './firewall.ts';

export interface AgentPolicyProfile {
  agentId: string;
  allowedCapabilities: CapabilityType[];
  canDelegate: boolean;
  delegatableCapabilities?: CapabilityType[];
}

export interface DelegationRequest {
  fromAgentId: string;
  toAgentId: string;
  delegatedCapabilities: CapabilityType[];
  taskDescription: string;
}

export interface DelegationVerdict {
  allowed: boolean;
  reason: string;
  sanctionedCapabilities: CapabilityType[];
  rejectedCapabilities: CapabilityType[];
}

export class A2ADelegationPolicyEngine {
  private agentProfiles: Map<string, AgentPolicyProfile> = new Map();

  constructor(profiles: AgentPolicyProfile[] = []) {
    for (const p of profiles) {
      this.agentProfiles.set(p.agentId, p);
    }
  }

  public registerAgentProfile(profile: AgentPolicyProfile): void {
    this.agentProfiles.set(profile.agentId, profile);
  }

  public evaluateDelegation(request: DelegationRequest): DelegationVerdict {
    const delegator = this.agentProfiles.get(request.fromAgentId);
    if (!delegator) {
      return {
        allowed: false,
        reason: `Delegator agent '${request.fromAgentId}' is not registered in policy`,
        sanctionedCapabilities: [],
        rejectedCapabilities: request.delegatedCapabilities,
      };
    }

    if (!delegator.canDelegate) {
      return {
        allowed: false,
        reason: `Agent '${request.fromAgentId}' is forbidden by policy from delegating any authority`,
        sanctionedCapabilities: [],
        rejectedCapabilities: request.delegatedCapabilities,
      };
    }

    const delegatable = delegator.delegatableCapabilities ?? delegator.allowedCapabilities;
    const sanctioned: CapabilityType[] = [];
    const rejected: CapabilityType[] = [];

    for (const cap of request.delegatedCapabilities) {
      if (delegatable.includes(cap)) {
        sanctioned.push(cap);
      } else {
        rejected.push(cap);
      }
    }

    if (rejected.length > 0) {
      return {
        allowed: false,
        reason: `Delegation rejected: Agent '${request.fromAgentId}' attempted to delegate unauthorized capabilities: ${rejected.join(', ')}`,
        sanctionedCapabilities: sanctioned,
        rejectedCapabilities: rejected,
      };
    }

    return {
      allowed: true,
      reason: `Delegation approved for ${sanctioned.length} capabilities from '${request.fromAgentId}' to '${request.toAgentId}'`,
      sanctionedCapabilities: sanctioned,
      rejectedCapabilities: [],
    };
  }
}
