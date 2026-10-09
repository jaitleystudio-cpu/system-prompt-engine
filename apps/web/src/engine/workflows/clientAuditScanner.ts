/**
 * Client-Side Static Security Scanner for AI Skills & Workflows.
 * 100% In-Browser Execution — Zero Network Egress ($0 Server Cost).
 */

export interface SecurityViolation {
  ruleId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  matchedText: string;
  line?: number;
}

export interface ClientAuditReport {
  isSafe: boolean;
  verdict: "SAFE" | "WARNING" | "REJECTED";
  safetyScore: number; // 0 to 100
  violations: SecurityViolation[];
  detectedPermissions: string[];
  scanTimestamp: string;
}

const DANGEROUS_PATTERNS: Array<{
  ruleId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  description: string;
  pattern: RegExp;
}> = [
  {
    ruleId: "PIPE_TO_SHELL",
    severity: "CRITICAL",
    description: "Arbitrary remote code execution via pipe to shell",
    pattern: /(curl|wget)\s+[^|\n]+\|\s*(bash|sh|zsh)/i,
  },
  {
    ruleId: "RECURSIVE_ROOT_DELETE",
    severity: "CRITICAL",
    description: "Destructive root filesystem deletion",
    pattern: /rm\s+-(rf|fr|r)\s+(\/|~|\$HOME|\.\/|\*)/i,
  },
  {
    ruleId: "CREDENTIAL_EXFILTRATION",
    severity: "CRITICAL",
    description: "Access or exfiltration of sensitive credentials or environment keys",
    pattern: /(id_rsa|\.aws\/credentials|\.env|API_KEY|SECRET_KEY|TOKEN)/i,
  },
  {
    ruleId: "OUTBOUND_EXFILTRATION_SOCKET",
    severity: "HIGH",
    description: "Outbound socket or reverse shell connection",
    pattern: /(nc|netcat)\s+-[lvpne]+\s+\d+|socat\s+|bash\s+-i\s+>&/i,
  },
  {
    ruleId: "UNCONSTRAINED_CHMOD",
    severity: "HIGH",
    description: "Dangerous global file permission modification",
    pattern: /chmod\s+(-R\s+)?(777|a\+rwx|u\+s)/i,
  },
  {
    ruleId: "RAW_DISK_WRITE",
    severity: "CRITICAL",
    description: "Direct raw block device or disk write",
    pattern: /dd\s+if=[^\n]+of=\/dev\/(sd[a-z]|nvme|disk)/i,
  },
];

export function auditSkillContent(content: string): ClientAuditReport {
  const violations: SecurityViolation[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of DANGEROUS_PATTERNS) {
      const match = rule.pattern.exec(line);
      if (match) {
        violations.push({
          ruleId: rule.ruleId,
          severity: rule.severity,
          description: rule.description,
          matchedText: match[0],
          line: i + 1,
        });
      }
    }
  }

  // Detect permission footprints
  const detectedPermissions: string[] = [];
  if (/(curl|wget|fetch|axios|http:\/\/|https:\/\/)/i.test(content)) {
    detectedPermissions.push("NETWORK_EGRESS");
  }
  if (/(fs\.|readFile|writeFile|open\(|cat\s+|echo\s+.*>)/i.test(content)) {
    detectedPermissions.push("FILESYSTEM_ACCESS");
  }
  if (/(exec\(|spawn\(|subprocess|system\()/i.test(content)) {
    detectedPermissions.push("SUBPROCESS_EXECUTION");
  }

  const criticalCount = violations.filter((v) => v.severity === "CRITICAL").length;
  const highCount = violations.filter((v) => v.severity === "HIGH").length;

  let verdict: "SAFE" | "WARNING" | "REJECTED" = "SAFE";
  let safetyScore = 100;

  if (criticalCount > 0) {
    verdict = "REJECTED";
    safetyScore = Math.max(0, 100 - criticalCount * 50 - highCount * 20);
  } else if (highCount > 0) {
    verdict = "WARNING";
    safetyScore = Math.max(20, 100 - highCount * 25);
  } else if (violations.length > 0) {
    verdict = "WARNING";
    safetyScore = 80;
  }

  return {
    isSafe: verdict === "SAFE",
    verdict,
    safetyScore,
    violations,
    detectedPermissions,
    scanTimestamp: new Date().toISOString(),
  };
}
