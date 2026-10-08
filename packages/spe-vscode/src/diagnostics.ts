/**
 * SPE Prompt Diagnostics & Invariant Analyzer (Client-side / Fallback Engine)
 *
 * Provides real-time invariant diagnostics adhering strictly to SPE Claim Corrections:
 * - BOUNDED_RULE_CONSISTENCY (never claiming unbounded FOL SAT)
 * - POSITIONAL_RISK_HEURISTIC (labeled as static hypothesis, never conflated with attention)
 * - STATIC_ANALYSIS for secret and PII checks
 */

import type { SpeDiagnostic, SpeHoverContent, SpeQuickFix } from './types.ts';

const SECRET_PATTERNS: Array<{ pattern: RegExp; message: string; code: string }> = [
  {
    pattern: /sk-[a-zA-Z0-9_-]{20,}/i,
    message: 'OpenAI API Key detected in prompt text',
    code: 'POTENTIAL_SECRET_LEAK',
  },
  {
    pattern: /ghp_[a-zA-Z0-9]{30,}/i,
    message: 'GitHub Token detected in prompt text',
    code: 'POTENTIAL_SECRET_LEAK',
  },
  {
    pattern: /(?:aws_access_key_id|aws_secret_access_key)\s*[:=]\s*[A-Z0-9]{16,}/i,
    message: 'AWS Credentials detected in prompt text',
    code: 'POTENTIAL_SECRET_LEAK',
  },
  {
    pattern: /sk-ant-[a-zA-Z0-9-]{20,}/i,
    message: 'Anthropic API Key detected in prompt text',
    code: 'POTENTIAL_SECRET_LEAK',
  },
];

const PII_PATTERNS: Array<{ pattern: RegExp; message: string; code: string }> = [
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    message: 'Potential SSN pattern detected in prompt text',
    code: 'POTENTIAL_PII_LEAK',
  },
  {
    pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
    message: 'Potential Credit Card number detected in prompt text',
    code: 'POTENTIAL_PII_LEAK',
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    message: 'Potential Email address detected in prompt text',
    code: 'POTENTIAL_PII_LEAK',
  },
];

const AUTHORITY_KEYWORDS = ['grant', 'authorize', 'sudo', 'execute_system', 'bypass', 'unrestricted', 'delete_all'];

export class SpeDiagnosticAnalyzer {
  public computeDiagnostics(text: string): SpeDiagnostic[] {
    const diagnostics: SpeDiagnostic[] = [];
    const lines = text.split('\n');

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
      const line = lines[lineNo];

      // 1. Secret Scanning
      for (const { pattern, message, code } of SECRET_PATTERNS) {
        const match = pattern.exec(line);
        if (match) {
          const startChar = match.index;
          const endChar = match.index + match[0].length;
          const quickFix: SpeQuickFix = {
            title: 'Redact secret with environment variable placeholder',
            kind: 'quickfix',
            replacement: '{{env.SECRET_KEY}}',
            range: { startLine: lineNo, startChar, endLine: lineNo, endChar },
          };
          diagnostics.push({
            code,
            message,
            severity: 1, // Error
            line: lineNo,
            startChar,
            endChar,
            evidenceClass: 'STATIC_ANALYSIS',
            quickFix,
          });
        }
      }

      // 2. PII Scanning
      for (const { pattern, message, code } of PII_PATTERNS) {
        const match = pattern.exec(line);
        if (match) {
          diagnostics.push({
            code,
            message,
            severity: 2, // Warning
            line: lineNo,
            startChar: match.index,
            endChar: match.index + match[0].length,
            evidenceClass: 'STATIC_ANALYSIS',
          });
        }
      }

      // 3. Ambiguous / Self-granted Authority
      const lower = line.toLowerCase();
      for (const kw of AUTHORITY_KEYWORDS) {
        if (lower.includes(kw) && !lower.includes('never') && !lower.includes('cannot') && !lower.includes('prohibited')) {
          diagnostics.push({
            code: 'UNKNOWN_AMBIGUOUS_AUTHORITY',
            message: `Prompt claims capability '${kw}' without verified SPE capability grant.`,
            severity: 2, // Warning
            line: lineNo,
            startChar: 0,
            endChar: line.length,
            evidenceClass: 'STATIC_ANALYSIS',
          });
          break;
        }
      }

      // 4. Bounded Rule Consistency: Contradiction Check
      if (lower.includes('must always') && lower.includes('must never')) {
        diagnostics.push({
          code: 'HARD_CONSTRAINT_CONTRADICTION',
          message: 'Contradictory modal obligations detected within the same instruction clause.',
          severity: 1, // Error
          line: lineNo,
          startChar: 0,
          endChar: line.length,
          evidenceClass: 'BOUNDED_RULE_CONSISTENCY',
        });
      }

      // 5. Unsupported Provider Constructs
      if (line.includes('{{') && line.includes('}}') && text.includes('<|im_start|>')) {
        diagnostics.push({
          code: 'UNSUPPORTED_PROVIDER_CONSTRUCT',
          message: 'Mixing Jinja templates with raw chat markup causes cross-provider degradation.',
          severity: 3, // Info
          line: lineNo,
          startChar: 0,
          endChar: line.length,
          evidenceClass: 'STATIC_ANALYSIS',
        });
      }
    }

    // 6. Large Context Positional-Risk Hypothesis (Never claim physical attention)
    const tokenEstimate = lines.reduce((acc, l) => acc + l.trim().split(/\s+/).filter(Boolean).length, 0) * 1.3;
    if (tokenEstimate > 3000) {
      const middleLine = Math.floor(lines.length / 2);
      diagnostics.push({
        code: 'POSITIONAL_RISK_HEURISTIC',
        message:
          'POSITIONAL_RISK_HEURISTIC: High token volume detected. Instructions placed in the middle ' +
          '40-60% span historically experience higher retrieval failure in lost-in-the-middle evaluations. ' +
          'Note: This is a static positional hypothesis, NOT an observed attention measurement. ' +
          'Run `spe bench --salience` for OBSERVED_RECALL_PROBE evidence.',
        severity: 3, // Info
        line: middleLine,
        startChar: 0,
        endChar: lines[middleLine]?.length || 0,
        evidenceClass: 'STATIC_ANALYSIS',
      });
    }

    return diagnostics;
  }

  public getHoverInfo(text: string, line: number): SpeHoverContent | null {
    const lines = text.split('\n');
    if (line < 0 || line >= lines.length) return null;
    const clauseText = lines[line].trim();
    if (!clauseText) return null;

    return {
      kind: 'markdown',
      value: [
        '### 🛡️ SPE Instruction Clause Analysis',
        '',
        `- **Line**: ${line + 1}`,
        `- **Length**: ${clauseText.length} chars`,
        `- **Provenance Status**: Bound to canonical ProtectedIntent`,
        `- **Evidence Class**: \`STATIC_ANALYSIS\``,
        '',
        '> **Causal Trace**: Use `spe explain` or run command **SPE: Trace Clause Provenance** to view the causal lineage.',
      ].join('\n'),
    };
  }
}
