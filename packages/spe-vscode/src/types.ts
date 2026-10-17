/**
 * Type definitions for SPE VS Code Extension & Language Client
 */

export type DiagnosticSeverityLevel = 1 | 2 | 3 | 4;

export interface SpeDiagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverityLevel; // 1: Error, 2: Warning, 3: Information, 4: Hint
  line: number;
  startChar: number;
  endChar: number;
  evidenceClass: 'STATIC_ANALYSIS' | 'BOUNDED_RULE_CONSISTENCY' | 'OBSERVED_RECALL_PROBE';
  quickFix?: SpeQuickFix;
}

export interface SpeQuickFix {
  title: string;
  kind: 'quickfix';
  replacement: string;
  range: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  };
}

export interface SpeHoverContent {
  kind: 'markdown';
  value: string;
}

export interface SpeCausalTraceResult {
  clauseId: string;
  humanSpans: Array<{ id: string; label: string }>;
  protectedIntents: Array<{ id: string; label: string }>;
  requirements: Array<{ id: string; label: string }>;
  transforms: Array<{ id: string; label: string }>;
  fullLineage: Array<{ id: string; type: string; label: string }>;
}
