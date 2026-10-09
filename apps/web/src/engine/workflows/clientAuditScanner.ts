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
    pattern: /(curl|wget|fetch)\s+[^|\n]+\|\s*(sudo\s+|(\/usr)?\/bin\/)?(bash|sh|zsh|python[23]?|perl)\b/i,
  },
  {
    ruleId: "EVAL_REMOTE_EXEC",
    severity: "CRITICAL",
    description: "Arbitrary remote code execution via eval of downloaded content",
    pattern: /eval\s+["'`]?(\$\((curl|wget)\b|`(curl|wget)\b)/i,
  },
  {
    ruleId: "BASE64_EXEC_PIPE",
    severity: "CRITICAL",
    description: "Obfuscated payload execution via base64 decode piped into shell",
    pattern: /(base64\s+(-d|--decode)|openssl\s+enc\s+-[dD])\s*\|\s*(sudo\s+|(\/usr)?\/bin\/)?(bash|sh|zsh)\b/i,
  },
  {
    ruleId: "RECURSIVE_ROOT_DELETE",
    severity: "CRITICAL",
    description: "Destructive root filesystem deletion",
    pattern: /rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+-[a-zA-Z]*[rf][a-zA-Z]*|-[a-zA-Z]*r[a-zA-Z]*|--recursive(\s+--force)?)\s+(\/|~|\$HOME|\.\/|\*|\/etc|\/usr|\/var)/i,
  },
  {
    ruleId: "CREDENTIAL_EXFILTRATION",
    severity: "CRITICAL",
    description: "Access or exfiltration of sensitive credentials or environment keys",
    pattern: /(id_(rsa|ed25519|ecdsa|dsa)|\.ssh\/|\.aws\/credentials|\.env|\/etc\/shadow|API_KEY|SECRET_KEY|PRIVATE_KEY|TOKEN)/i,
  },
  {
    ruleId: "OUTBOUND_EXFILTRATION_SOCKET",
    severity: "HIGH",
    description: "Outbound socket or reverse shell connection",
    pattern: /(nc|netcat|ncat)\s+(-[a-zA-Z]*e\b|-[lvpne]+\s*|\d+\.\d+|\b\d{2,5}\b)|socat\s+|bash\s+-i\s+>&|\/dev\/tcp\//i,
  },
  {
    ruleId: "UNCONSTRAINED_CHMOD",
    severity: "HIGH",
    description: "Dangerous global file permission modification",
    pattern: /chmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+|--recursive\s+)?(0?777|a\+rwx|u\+s)/i,
  },
  {
    ruleId: "RAW_DISK_WRITE",
    severity: "CRITICAL",
    description: "Direct raw block device or disk write",
    pattern: /dd\s+[^|\n]*(of=\/dev\/(sd[a-z]|nvme|disk|rdisk|vda)|if=\/dev\/(sd[a-z]|nvme|disk|rdisk|vda))/i,
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

  // Handle multiline escaped commands (e.g. bash backslash escapes `\`)
  const normalized = content.replace(/\\\r?\n\s*/g, " ");
  if (normalized !== content) {
    for (const rule of DANGEROUS_PATTERNS) {
      const match = rule.pattern.exec(normalized);
      if (match && !violations.some((v) => v.ruleId === rule.ruleId)) {
        const index = match.index;
        const prefix = normalized.slice(0, index);
        const approxLine = prefix.split("\n").length;
        violations.push({
          ruleId: rule.ruleId,
          severity: rule.severity,
          description: `${rule.description} (multiline/escaped)`,
          matchedText: match[0],
          line: approxLine,
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
