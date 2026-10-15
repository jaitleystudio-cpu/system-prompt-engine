/**
 * SPE Ω — Agent Gateway & Permission Shield Types
 *
 * Mandate:
 * Grounded in:
 * - Google WebMCP Standard (October 2026, developer.chrome.com/docs/ai/webmcp).
 * - ST-WebAgentBench (ICLR 2026): Safety & Threat Evaluation for Autonomous Web Agents.
 * - Zero Ambient Authority and Capability-Based Security.
 */

export interface CapabilityToken {
  tokenId: string;
  subject: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  rateLimitPerMinute: number;
  signature: string;
}

export interface WebMcpToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
  capabilityToken?: CapabilityToken;
  requestId: string;
}

export interface WebMcpToolResult {
  toolName: string;
  requestId: string;
  status: "SUCCESS" | "PERMISSION_DENIED" | "TAINT_DETECTED" | "RATE_LIMITED" | "EXECUTION_ERROR";
  output?: unknown;
  executionLatencyMs: number;
  error?: string;
  permissionReceipt?: PermissionAuditReceipt;
}

export interface PermissionAuditReceipt {
  receiptId: string;
  checkedAt: string;
  toolName: string;
  tokenId?: string;
  allowed: boolean;
  reason: string;
  taintFree: boolean;
  rateLimitRemaining: number;
}
