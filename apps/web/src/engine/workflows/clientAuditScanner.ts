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

const BINARY_MAGIC_HEADERS: Array<{ header: string; desc: string }> = [
  { header: "\x7fELF", desc: "ELF Binary" },
  { header: "\xfe\xed\xfa\xce", desc: "Mach-O Binary (32-bit)" },
  { header: "\xfe\xed\xfa\xcf", desc: "Mach-O Binary (64-bit)" },
  { header: "\xce\xfa\xed\xfe", desc: "Mach-O Binary (reverse 32-bit)" },
  { header: "\xcf\xfa\xed\xfe", desc: "Mach-O Binary (reverse 64-bit)" },
  { header: "MZ", desc: "DOS/PE Executable" },
  { header: "PK\x03\x04", desc: "ZIP Archive" },
  { header: "\x1f\x8b", desc: "GZIP Compressed" },
];

const MULTILINE_POLYGLOT_PATTERNS: Array<{ pattern: RegExp; desc: string }> = [
  { pattern: /<!--[\s\S]*?#!\s*\/bin\/(bash|sh|zsh|dash)/i, desc: "Shell shebang inside HTML comment" },
  { pattern: /<!--[\s\S]*?(\$\([\s\S]*?\)|\`[\s\S]*?\`)[\s\S]*?-->/i, desc: "Subshell or backtick expansion inside HTML comment" },
  { pattern: /<!--[\s\S]*?\b(eval|exec|sudo|curl|wget|bash|sh)\b[\s\S]*?-->/i, desc: "Shell command invocation inside HTML comment" },
  { pattern: /\/\*[\s\S]*?#!\s*\/bin\/(bash|sh|zsh)[\s\S]*?\*\//i, desc: "Shell shebang inside C-style comment" },
  { pattern: /("""|''')\s*:\s*[\r\n]+\s*(exec|eval|sh|bash)\b/i, desc: "Python docstring polyglot" },
];

export function auditSkillContent(
  content: string,
  options?: { ceiling?: string }
): ClientAuditReport {
  const violations: SecurityViolation[] = [];

  // 1. Binary Magic Bytes Check (ERR-SEC-POLYGLOT)
  for (const magic of BINARY_MAGIC_HEADERS) {
    if (content.startsWith(magic.header)) {
      violations.push({
        ruleId: "ERR_SEC_POLYGLOT",
        severity: "CRITICAL",
        description: `HARD_DISQUALIFICATION (ERR-SEC-POLYGLOT): Binary magic header detected (${magic.desc})`,
        matchedText: magic.desc,
        line: 1,
      });
      break;
    }
  }

  // 2. Unicode NFKC Normalization & Zero-width codepoint detection
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

  // 3. Multiline Mixed-Syntax Polyglot Hard-Gate (ERR-SEC-POLYGLOT)
  for (const { pattern, desc } of MULTILINE_POLYGLOT_PATTERNS) {
    const match = pattern.exec(nfkcContent);
    if (match && !violations.some((v) => v.ruleId === "ERR_SEC_POLYGLOT")) {
      const index = match.index;
      const prefix = nfkcContent.slice(0, index);
      const approxLine = prefix.split("\n").length;
      violations.push({
        ruleId: "ERR_SEC_POLYGLOT",
        severity: "CRITICAL",
        description: `HARD_DISQUALIFICATION (ERR-SEC-POLYGLOT): Mixed-syntax polyglot vector detected (${desc})`,
        matchedText: match[0].slice(0, 80),
        line: approxLine,
      });
      break;
    }
  }

  // 4. Homoglyph inspection across tokens
  const homoglyphsDetected: string[] = [];
  const tokens = nfkcContent.match(/[\p{L}\p{N}]+/gu) || [];
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
  const ceilingUpper = (options?.ceiling || "").toUpperCase();
  if (["LOCAL_FIRST", "AIR_GAPPED", "SANDBOXED"].includes(ceilingUpper) && detectedPermissions.includes("NETWORK_EGRESS")) {
    violations.push({
      ruleId: "HALT_PERMISSION_ESCALATION",
      severity: "CRITICAL",
      description: `HALT_PERMISSION_ESCALATION: Network egress requested under ${ceilingUpper} ceiling`,
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
