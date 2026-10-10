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
  taintCleared?: boolean;
  zeroWidthStrippedCount?: number;
  homoglyphsDetected?: string[];
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
  {
    ruleId: "ERR_SEC_POLYGLOT",
    severity: "CRITICAL",
    description: "HARD_DISQUALIFICATION (ERR-SEC-POLYGLOT): Mixed-syntax polyglot vector detected",
    pattern: /<!--\s*#!\s*\/bin\/(bash|sh|zsh|dash)|<!--\s*.*(\$\(.*?\)|`.*?`).*-->|<!--\s*(eval|exec|sudo|curl|wget)\b/i,
  },
  {
    ruleId: "UNICODE_BIDI_OVERRIDE",
    severity: "CRITICAL",
    description: "Directional Unicode bidi override attack detected",
    pattern: /[\u202A-\u202E\u2066-\u2069]/,
  },
  {
    ruleId: "AST_TAINT_DANGEROUS_TOKEN",
    severity: "CRITICAL",
    description: "Forbidden ambient authority or runtime code execution token detected",
    pattern: /\b(child_process|WebSocket|XMLHttpRequest)\b|\bprocess\.env\b|\beval\s*\(|\bFunction\s*\(/,
  },
];

export function auditSkillContent(
  content: string,
  options?: { ceiling?: string }
): ClientAuditReport {
  const violations: SecurityViolation[] = [];

  // 1. Unicode NFKC Normalization & Zero-width codepoint detection
  let zeroWidthStrippedCount = 0;
  const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u2060]/g;
  const zwMatches = content.match(zeroWidthRegex);
  if (zwMatches) {
    zeroWidthStrippedCount = zwMatches.length;
    violations.push({
      ruleId: "UNICODE_ZERO_WIDTH",
      severity: "HIGH",
      description: `Invisible zero-width codepoints detected (${zeroWidthStrippedCount} instances)`,
      matchedText: "[zero-width-codepoints]",
    });
  }

  const nfkcContent = content.normalize("NFKC").replace(zeroWidthRegex, "");

  // 2. Homoglyph inspection across tokens
  const homoglyphsDetected: string[] = [];
  const tokens = nfkcContent.match(/\b\w+\b/g) || [];
  const cyrillicHomoglyphs = /[асеорхуіјѕАВСЕНІЈКМОРТХ]/;
  const greekHomoglyphs = /[αονρυταβγδεζηικλμνξοπρστυφχψωΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]/;
  for (const tok of tokens) {
    if (/[a-zA-Z]/.test(tok) && (cyrillicHomoglyphs.test(tok) || greekHomoglyphs.test(tok))) {
      homoglyphsDetected.push(tok);
      violations.push({
        ruleId: "HOMOGLYPH_SPOOFING",
        severity: "CRITICAL",
        description: `Mixed Latin/Cyrillic or Greek homoglyph spoofing detected in token '${tok}'`,
        matchedText: tok,
      });
      break;
    }
  }

  const lines = nfkcContent.split("\n");

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
  const normalized = nfkcContent.replace(/\\\r?\n\s*/g, " ");
  if (normalized !== nfkcContent) {
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
  if (/(curl|wget|fetch|axios|http:\/\/|https:\/\/)/i.test(nfkcContent)) {
    detectedPermissions.push("NETWORK_EGRESS");
  }
  if (/(fs\.|readFile|writeFile|open\(|cat\s+|echo\s+.*>)/i.test(nfkcContent)) {
    detectedPermissions.push("FILESYSTEM_ACCESS");
  }
  if (/(exec\(|spawn\(|subprocess|system\()/i.test(nfkcContent)) {
    detectedPermissions.push("SUBPROCESS_EXECUTION");
  }

  // Check permission ceiling
  if (options?.ceiling === "LOCAL_FIRST" && detectedPermissions.includes("NETWORK_EGRESS")) {
    violations.push({
      ruleId: "HALT_PERMISSION_ESCALATION",
      severity: "CRITICAL",
      description: "HALT_PERMISSION_ESCALATION: Network egress requested under LOCAL_FIRST ceiling",
      matchedText: "NETWORK_EGRESS",
    });
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
    taintCleared: verdict === "SAFE",
    zeroWidthStrippedCount,
    homoglyphsDetected,
  };
}
