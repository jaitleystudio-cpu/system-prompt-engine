export interface AgentReceipt {
  agent: string;
  session: string;
  tool: string;
  timestamp: string;
  inputHash: string;
  beforeHash: string;
  afterHash: string;
  operations: number;
  authorizationSource: string;
  verification: "PASS" | "FAIL" | "NOT_RUN";
}

export function createAgentReceipt(
  agent: string,
  tool: string,
  status: "SUCCESS" | "FAIL",
  payload?: unknown,
): AgentReceipt & { status?: string; payload?: unknown } {
  return {
    agent,
    session: `sess-${Date.now()}`,
    tool,
    timestamp: new Date().toISOString(),
    inputHash: "input-hash",
    beforeHash: "before-hash",
    afterHash: "after-hash",
    operations: 1,
    authorizationSource: "USER_UI",
    verification: status === "SUCCESS" ? "PASS" : "FAIL",
    status,
    payload,
  };
}
