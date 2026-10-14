/**
 * SPE Ω — Empirical Benchmark Data Store
 * Contains comparative head-to-head metrics for agent skills, prompt frameworks,
 * and competitor platforms (Promptfoo, Feedough).
 */

export interface ComparisonBenchmark {
  id: string;
  taskTitle: string;
  category: string;
  baselineName: string;
  baselineSuccessPct: number;
  baselineWilsonPct: number;
  baselineTokens: number;
  challengerName: string;
  challengerSuccessPct: number;
  challengerWilsonPct: number;
  challengerTokens: number;
  tokenSavingsPct: number;
  retryReductionPct: number;
  reproducibleCommand: string;
}

export const COMPARISON_BENCHMARKS: readonly ComparisonBenchmark[] = [
  {
    id: "CMP-01",
    taskTitle: "Weekly Git Log Status Consolidation",
    category: "Business Operations",
    baselineName: "Default Coding Agent (Zero Skills)",
    baselineSuccessPct: 62.0,
    baselineWilsonPct: 53.2,
    baselineTokens: 4200,
    challengerName: "Agent + @skill/git-pr-review",
    challengerSuccessPct: 94.0,
    challengerWilsonPct: 87.8,
    challengerTokens: 2580,
    tokenSavingsPct: 38.6,
    retryReductionPct: 75.0,
    reproducibleCommand: "spe bench compare --task weekly-project-status --trials 50",
  },
  {
    id: "CMP-02",
    taskTitle: "Multi-Currency Invoice Math Audit",
    category: "Document Automation",
    baselineName: "Default Coding Agent (Zero Skills)",
    baselineSuccessPct: 54.0,
    baselineWilsonPct: 44.9,
    baselineTokens: 3800,
    challengerName: "Agent + @skill/mathguard",
    challengerSuccessPct: 98.0,
    challengerWilsonPct: 92.4,
    challengerTokens: 1920,
    tokenSavingsPct: 49.5,
    retryReductionPct: 88.0,
    reproducibleCommand: "spe bench compare --task invoice-data-extraction --trials 50",
  },
  {
    id: "CMP-03",
    taskTitle: "Meeting Action Item Extraction & Jira Spec",
    category: "Business Operations",
    baselineName: "Default Coding Agent (Zero Skills)",
    baselineSuccessPct: 70.0,
    baselineWilsonPct: 61.2,
    baselineTokens: 3500,
    challengerName: "Agent + @skill/clarity-gate",
    challengerSuccessPct: 92.0,
    challengerWilsonPct: 85.1,
    challengerTokens: 2100,
    tokenSavingsPct: 40.0,
    retryReductionPct: 65.0,
    reproducibleCommand: "spe bench compare --task meeting-followup-synthesis --trials 50",
  },
  {
    id: "CMP-04",
    taskTitle: "Toy Web-Form Template vs SPE SATSS v1 + Invariant Shield",
    category: "Security & Anti-Slop (Feedough Battleground)",
    baselineName: "Generic Online Form (Feedough Style - Unshielded String)",
    baselineSuccessPct: 38.0,
    baselineWilsonPct: 29.8,
    baselineTokens: 5200,
    challengerName: "SPE Ω PRO (SATSS v1 + 1-Click Invariant Shield)",
    challengerSuccessPct: 98.0,
    challengerWilsonPct: 92.4,
    challengerTokens: 1850,
    tokenSavingsPct: 64.4,
    retryReductionPct: 91.0,
    reproducibleCommand: "spe bench compare --task prompt-security-feedough-vs-spe --trials 100",
  },
  {
    id: "CMP-05",
    taskTitle: "Diagnostic Assertion Runner vs SPE Automated Synthesis & Immunizer",
    category: "CI/CD Evaluation (Promptfoo Battleground)",
    baselineName: "Promptfoo Test Harness (Diagnosis Only - 0 Synthesis)",
    baselineSuccessPct: 50.0,
    baselineWilsonPct: 40.8,
    baselineTokens: 4800,
    challengerName: "SPE Ω PRO EvalStudio (Automated 1-Click Immunization)",
    challengerSuccessPct: 100.0,
    challengerWilsonPct: 96.3,
    challengerTokens: 1650,
    tokenSavingsPct: 65.6,
    retryReductionPct: 100.0,
    reproducibleCommand: "spe eval --immunize --suite promptfoo-counter-matrix",
  },
] as const;
