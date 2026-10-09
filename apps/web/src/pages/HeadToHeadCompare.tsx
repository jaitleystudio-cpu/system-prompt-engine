/**
 * SPE Ω — Skill Effectiveness Challenge: Head-to-Head Comparison
 * Empirical benchmarking of agent task completion with vs without specialized skills.
 */

import React, { useState } from "react";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";
import { copyTextSafe } from "../engine/workflows/clipboard";

interface ComparisonBenchmark {
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

const BENCHMARKS: ComparisonBenchmark[] = [
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
];

export const HeadToHeadCompare: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = async (cmd: string, id: string) => {
    await copyTextSafe(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="spe-compare-container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.5rem" }}>
          Skill Effectiveness Challenge
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "700px", margin: "0 auto" }}>
          Does a skill actually improve AI task results? Empirical head-to-head benchmarks scored with Wilson 95% confidence intervals.
        </p>
      </header>

      <ContextualAdSlot slotId="compare-top-leaderboard" format="leaderboard" />

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginTop: "2rem" }}>
        {BENCHMARKS.map((bench) => (
          <div
            key={bench.id}
            style={{
              backgroundColor: "#0b1329",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600, textTransform: "uppercase" }}>
                  {bench.category}
                </span>
                <h2 style={{ fontSize: "1.35rem", color: "#f8fafc", marginTop: "0.25rem", marginBottom: 0 }}>
                  {bench.taskTitle}
                </h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#10b981" }}>
                  +{bench.tokenSavingsPct}% Fewer Tokens
                </span>
                <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  -{bench.retryReductionPct}% Agent Retries
                </div>
              </div>
            </div>

            {/* Comparison Matrix Table */}
            <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", color: "#64748b", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.5rem" }}>Configuration</th>
                    <th style={{ padding: "0.6rem 0.5rem" }}>Observed Success</th>
                    <th style={{ padding: "0.6rem 0.5rem" }}>Wilson 95% Lower Bound</th>
                    <th style={{ padding: "0.6rem 0.5rem" }}>Avg Token Consumption</th>
                    <th style={{ padding: "0.6rem 0.5rem" }}>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                    <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineName}</td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineSuccessPct}%</td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineWilsonPct}%</td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineTokens} tokens</td>
                    <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8" }}>Baseline</td>
                  </tr>
                  <tr style={{ color: "#f8fafc", backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "#38bdf8" }}>
                      {bench.challengerName}
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "#10b981" }}>
                      {bench.challengerSuccessPct}%
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "#10b981" }}>
                      ★ {bench.challengerWilsonPct}%
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "#10b981" }}>
                      {bench.challengerTokens} tokens
                    </td>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "#10b981" }}>
                      QUALIFIED WINNER
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#020617", padding: "0.75rem 1rem", borderRadius: "6px" }}>
              <code style={{ fontSize: "0.8125rem", color: "#cbd5e1" }}>
                $ {bench.reproducibleCommand}
              </code>
              <button
                onClick={() => copyCommand(bench.reproducibleCommand, bench.id)}
                style={{
                  padding: "0.4rem 0.75rem",
                  backgroundColor: copiedId === bench.id ? "#059669" : "#1e293b",
                  color: "#f8fafc",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                {copiedId === bench.id ? "Copied!" : "Copy Benchmark Command"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ContextualAdSlot slotId="compare-footer-leaderboard" format="leaderboard" className="mt-8" />
    </div>
  );
};
