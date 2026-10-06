export interface AgentPolicy {
  read: string[];
  propose: string[];
  execute: string[];
  export: boolean;
  network: boolean;
}

export function createDefaultAgentPolicy(): AgentPolicy {
  return { read: [], propose: [], execute: [], export: false, network: false };
}

export function validateAgentPolicy(policy: AgentPolicy): void {
  if (!policy || !Array.isArray(policy.read) || !Array.isArray(policy.propose) || !Array.isArray(policy.execute)) {
    throw new Error("invalid agent policy");
  }
  for (const list of [policy.read, policy.propose, policy.execute]) {
    if (list.includes("*")) throw new Error("wildcard agent authority is forbidden");
  }
}
