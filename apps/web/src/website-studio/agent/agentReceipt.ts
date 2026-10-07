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
