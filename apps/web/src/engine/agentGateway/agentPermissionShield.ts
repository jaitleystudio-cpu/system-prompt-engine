/**
 * SPE Ω — Agent Permission Shield (APS)
 *
 * Mandate:
 * Grounded in:
 * - ST-WebAgentBench (ICLR 2026): Autonomous Web Agent Security & Ambient Threat Defense.
 * - OWASP Top 10 for LLM Applications: LLM01 (Prompt Injection), LLM06 (Sensitive Info Disclosure).
 * - Saltzer & Schroeder Principle of Least Privilege: Zero ambient authority.
 *
 * Blocks ambient credential exfiltration, rate limit exhaustion, and indirect prompt injection.
 */

import { computeSha256 } from "../hashUtils.ts";
import type { CapabilityToken, WebMcpToolCall, PermissionAuditReceipt } from "./types.ts";

export class AgentPermissionShield {
  private callBuckets: Map<string, number[]> = new Map();

  // Hostile injection & exfiltration patterns
  private taintPatterns: RegExp[] = [
    /document\.cookie/i,
    /window\.localStorage/i,
    /window\.sessionStorage/i,
    /process\.env/i,
    /\bcurl\b.*https?:\/\//i,
    /\bwget\b.*https?:\/\//i,
    /;\s*(rm|cat|sh|bash)\s+/i,
    /\.\.\/(\.\.\/)+/i, // Path traversal
    /[\u202A-\u202E]/, // Bidi overrides
    /[\u200B-\u200D\uFEFF]/, // Invisible zero-width codepoints
    /<script\b[^>]*>/i,
    /javascript:/i,
  ];

  /**
   * Generates a safe local capability token for testing or authorized user sessions.
   */
  public mintLocalToken(subject: string, scopes: string[], durationMinutes: number = 60): CapabilityToken {
    const now = new Date();
    const expires = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const tokenId = `tok_${computeSha256(`${subject}_${now.toISOString()}`).slice(0, 16)}`;

    return {
      tokenId,
      subject,
      scopes,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      rateLimitPerMinute: 60,
      signature: computeSha256(`sig_${tokenId}_${scopes.join(",")}`),
    };
  }

  /**
   * Audits an incoming tool call against permission, taint, and rate-limit policies.
   */
  public auditToolCall(call: WebMcpToolCall, requiredScope: string): PermissionAuditReceipt {
    const now = new Date();
    const nowIso = now.toISOString();
    const receiptId = `rcpt_${computeSha256(`${call.requestId}_${nowIso}`).slice(0, 16)}`;

    // 1. Taint Analysis on Input Arguments
    const serializedArgs = JSON.stringify(call.arguments);
    for (const pattern of this.taintPatterns) {
      if (pattern.test(serializedArgs)) {
        return {
          receiptId,
          checkedAt: nowIso,
          toolName: call.toolName,
          tokenId: call.capabilityToken?.tokenId,
          allowed: false,
          reason: `TAINT_DETECTED: Input arguments match forbidden injection pattern (${pattern.source})`,
          taintFree: false,
          rateLimitRemaining: 0,
        };
      }
    }

    // 2. Token & Scope Verification
    const token = call.capabilityToken;
    if (!token) {
      // If tool is strictly public read, may allow; otherwise require token
      if (requiredScope !== "spe:public") {
        return {
          receiptId,
          checkedAt: nowIso,
          toolName: call.toolName,
          allowed: false,
          reason: "PERMISSION_DENIED: Missing required CapabilityToken.",
          taintFree: true,
          rateLimitRemaining: 0,
        };
      }
    } else {
      // Expiration check
      const expiryDate = new Date(token.expiresAt);
      if (expiryDate < now) {
        return {
          receiptId,
          checkedAt: nowIso,
          toolName: call.toolName,
          tokenId: token.tokenId,
          allowed: false,
          reason: `PERMISSION_DENIED: CapabilityToken expired at ${token.expiresAt}.`,
          taintFree: true,
          rateLimitRemaining: 0,
        };
      }

      // Scope match check
      if (!token.scopes.includes(requiredScope) && !token.scopes.includes("spe:admin")) {
        return {
          receiptId,
          checkedAt: nowIso,
          toolName: call.toolName,
          tokenId: token.tokenId,
          allowed: false,
          reason: `PERMISSION_DENIED: Token missing required scope '${requiredScope}' (has [${token.scopes.join(",")}]).`,
          taintFree: true,
          rateLimitRemaining: 0,
        };
      }

      // 3. Rate Limit Enforcement
      const rateLimitKey = token.tokenId;
      const history = this.callBuckets.get(rateLimitKey) || [];
      const windowStart = now.getTime() - 60 * 1000;
      const validHistory = history.filter((ts) => ts > windowStart);

      if (validHistory.length >= token.rateLimitPerMinute) {
        return {
          receiptId,
          checkedAt: nowIso,
          toolName: call.toolName,
          tokenId: token.tokenId,
          allowed: false,
          reason: `RATE_LIMITED: Token exceeded ${token.rateLimitPerMinute} requests per minute limit.`,
          taintFree: true,
          rateLimitRemaining: 0,
        };
      }

      validHistory.push(now.getTime());
      this.callBuckets.set(rateLimitKey, validHistory);

      return {
        receiptId,
        checkedAt: nowIso,
        toolName: call.toolName,
        tokenId: token.tokenId,
        allowed: true,
        reason: "ALLOWED: Token valid, scope verified, zero taint detected.",
        taintFree: true,
        rateLimitRemaining: token.rateLimitPerMinute - validHistory.length,
      };
    }

    return {
      receiptId,
      checkedAt: nowIso,
      toolName: call.toolName,
      allowed: true,
      reason: "ALLOWED: Public tool invocation.",
      taintFree: true,
      rateLimitRemaining: 100,
    };
  }
}
