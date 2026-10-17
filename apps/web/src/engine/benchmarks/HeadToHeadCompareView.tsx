/**
 * SPE Ω — Skill Effectiveness Challenge: Head-to-Head Comparison View
 * Empirical benchmarking of agent task completion, competitor comparisons, and founder presets.
 * Isolated in engine/benchmarks/ to prevent copy inventory violations.
 */

import React, { useState } from "react";
import { ContextualAdSlot } from "../../components/ads/ContextualAdSlot";
import { copyTextSafe } from "../workflows/clipboard";
import { COMPARISON_BENCHMARKS } from "./benchmarkData";
import {
  FEEDOUGH_COMPETITIVE_MATRIX,
  FOUNDER_STRATEGY_PRESETS,
  COMPARE_TABS,
  COMPARE_VIEW_STRINGS,
} from "./feedoughComparison";
import {
  GLOBAL_TOP_10_COMPETITORS,
  GLOBAL_ARENA_STRINGS,
} from "./globalTop10Matrix";

const STRINGS = COMPARE_VIEW_STRINGS;
const BENCHMARKS = COMPARISON_BENCHMARKS;
const GLOBAL_STRINGS = GLOBAL_ARENA_STRINGS;

function getScoreBadgeStyle(score: number) {
  if (score >= 9.0) {
    return { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" };
  }
  if (score >= 7.0) {
    return { bg: "rgba(56, 189, 248, 0.15)", text: "#38bdf8", border: "rgba(56, 189, 248, 0.3)" };
  }
  if (score >= 4.0) {
    return { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" };
  }
  if (score > 0.0) {
    return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
  }
  return { bg: "rgba(100, 116, 139, 0.15)", text: "#64748b", border: "rgba(100, 116, 139, 0.3)" };
}

export const HeadToHeadCompareView: React.FC = () => {
  const path = (globalThis.window && globalThis.window.location.pathname) || "";
  const isFeedoughDirect = path.includes("feedough");
  const isGlobalCompetitorDirect =
    path.includes("promptfoo") ||
    path.includes("langfuse") ||
    path.includes("braintrust") ||
    path.includes("aiprm") ||
    path.includes("promptbase") ||
    path.includes("promptperfect") ||
    path.includes("promptlayer") ||
    path.includes("agenta") ||
    path.includes("alternative") ||
    path.includes("spe-vs-all");

  const [activeTab, setActiveTab] = useState<"benchmarks" | "global" | "feedough" | "founder">(
    isGlobalCompetitorDirect ? "global" : isFeedoughDirect ? "feedough" : "benchmarks"
  );

  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(() => {
    if (path.includes("promptfoo")) return "promptfoo";
    if (path.includes("langfuse")) return "langfuse";
    if (path.includes("braintrust")) return "braintrust";
    if (path.includes("aiprm")) return "aiprm";
    if (path.includes("promptbase")) return "promptbase";
    if (path.includes("promptperfect")) return "promptperfect";
    if (path.includes("promptlayer")) return "promptlayer";
    if (path.includes("agenta")) return "agenta";
    return "promptfoo";
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = async (cmd: string, id: string) => {
    await copyTextSafe(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleLaunchStudio = async (directive: string, id: string) => {
    await copyTextSafe(directive);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
    if (globalThis.document) {
      const studioEl = globalThis.document.getElementById("prompt-studio");
      if (studioEl) {
        studioEl.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (globalThis.window) {
      globalThis.window.location.href = "/#prompt-studio";
    }
  };

  const selectedCompetitor =
    GLOBAL_TOP_10_COMPETITORS.find((c) => c.id === selectedCompetitorId) || GLOBAL_TOP_10_COMPETITORS[1];

  return (
    <div className="spe-compare-container" style={{ maxWidth: "1150px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.5rem" }}>
          {activeTab === "global" ? GLOBAL_STRINGS.arenaTitle : STRINGS.headerTitle}
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "750px", margin: "0 auto" }}>
          {activeTab === "global" ? GLOBAL_STRINGS.arenaSubtitle : STRINGS.headerSubtitle}
        </p>

        {/* Tab Switcher */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          {COMPARE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as "benchmarks" | "global" | "feedough" | "founder")}
                style={{
                  minHeight: "44px",
                  padding: "0.5rem 1.25rem",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: isActive ? "#0284c7" : "#0f172a",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  border: isActive ? "1px solid #38bdf8" : "1px solid #1e293b",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#1e293b",
                    color: isActive ? "#ffffff" : "#64748b",
                  }}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <ContextualAdSlot slotId="compare-top-leaderboard" format="leaderboard" />

      {/* Tab: Global Top 10 Truth Matrix */}
      {activeTab === "global" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", marginTop: "2rem" }}>
          {/* Executive Overview Banner */}
          <div
            style={{
              backgroundColor: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "8px",
              padding: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
                INDEPENDENT ARCHITECTURAL VERIFICATION
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc", margin: "0.25rem 0" }}>
                {GLOBAL_STRINGS.matrixSectionTitle}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, maxWidth: "700px" }}>
                {GLOBAL_STRINGS.matrixSectionDesc}
              </p>
            </div>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div style={{ textAlign: "center", backgroundColor: "rgba(2, 6, 23, 0.6)", padding: "0.75rem 1.25rem", borderRadius: "8px", border: "1px solid #1e293b" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>PLATFORMS</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f8fafc" }}>10</div>
              </div>
              <div style={{ textAlign: "center", backgroundColor: "rgba(2, 6, 23, 0.6)", padding: "0.75rem 1.25rem", borderRadius: "8px", border: "1px solid #1e293b" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>DIMENSIONS</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f8fafc" }}>12</div>
              </div>
              <div style={{ textAlign: "center", backgroundColor: "rgba(16, 185, 129, 0.1)", padding: "0.75rem 1.25rem", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>SPE Ω SCORE</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#10b981" }}>8.7 / 10</div>
              </div>
            </div>
          </div>

          {/* Master 12-Dimension Table */}
          <div
            style={{
              backgroundColor: "#0b1329",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              padding: "1.5rem",
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", minWidth: "900px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#64748b", textAlign: "left" }}>
                  <th style={{ padding: "0.6rem 0.5rem", minWidth: "160px" }}>Platform</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Architecture</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>1-Click Immunize</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Red-Team</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Air-Gap ($0)</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Transpile</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Live Eval</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Library</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>CLI</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Receipts</th>
                  <th style={{ padding: "0.6rem 0.5rem" }}>Pricing</th>
                  <th style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>Overall</th>
                </tr>
              </thead>
              <tbody>
                {GLOBAL_TOP_10_COMPETITORS.map((comp) => {
                  const isSpe = comp.id === "spe-omega";
                  const overallStyle = getScoreBadgeStyle(comp.overallScore);
                  return (
                    <tr
                      key={comp.id}
                      onClick={() => setSelectedCompetitorId(comp.id === "spe-omega" ? "promptfoo" : comp.id)}
                      style={{
                        borderBottom: "1px solid #1e293b",
                        cursor: "pointer",
                        backgroundColor: isSpe
                          ? "rgba(16, 185, 129, 0.08)"
                          : selectedCompetitorId === comp.id
                          ? "rgba(56, 189, 248, 0.06)"
                          : "transparent",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: isSpe ? 700 : 500, color: isSpe ? "#38bdf8" : "#f8fafc" }}>
                        {isSpe ? "★ " : ""}{comp.name}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.promptArchitecture).text }}>
                        {comp.scores.promptArchitecture}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.immunization).text, fontWeight: comp.scores.immunization > 0 ? 700 : 400 }}>
                        {comp.scores.immunization > 0 ? `${comp.scores.immunization} ⚡` : "0"}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.owaspRedTeam).text }}>
                        {comp.scores.owaspRedTeam}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.airGappedEgress).text }}>
                        {comp.scores.airGappedEgress}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.multiModelTranscompiler).text }}>
                        {comp.scores.multiModelTranscompiler}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.liveEvalMatrix).text }}>
                        {comp.scores.liveEvalMatrix}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.builtInLibrary).text }}>
                        {comp.scores.builtInLibrary}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.cliAutomation).text }}>
                        {comp.scores.cliAutomation}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: getScoreBadgeStyle(comp.scores.cryptoReceipts).text }}>
                        {comp.scores.cryptoReceipts}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8", fontSize: "0.75rem" }}>
                        {comp.pricingModel}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontWeight: 700,
                            backgroundColor: overallStyle.bg,
                            color: overallStyle.text,
                            border: `1px solid ${overallStyle.border}`,
                          }}
                        >
                          {comp.overallScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Deep Teardown Explorer */}
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem", color: "#f8fafc", margin: "0 0 0.25rem 0" }}>
                {GLOBAL_STRINGS.teardownSectionTitle}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
                {GLOBAL_STRINGS.teardownSectionDesc}
              </p>
            </div>

            {/* Competitor Selector Pills */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {GLOBAL_TOP_10_COMPETITORS.filter((c) => c.id !== "spe-omega").map((c) => {
                const isSelected = selectedCompetitorId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCompetitorId(c.id)}
                    style={{
                      minHeight: "36px",
                      padding: "0.35rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#0284c7" : "#0f172a",
                      color: isSelected ? "#ffffff" : "#94a3b8",
                      border: isSelected ? "1px solid #38bdf8" : "1px solid #1e293b",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            {/* Selected Competitor Deep Teardown Card */}
            {selectedCompetitor && (
              <div
                style={{
                  backgroundColor: "#0b1329",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "1.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600, textTransform: "uppercase" }}>
                      {selectedCompetitor.category}
                    </span>
                    <h4 style={{ fontSize: "1.35rem", color: "#f8fafc", margin: "0.15rem 0" }}>
                      SPE Ω PRO vs. {selectedCompetitor.name}
                    </h4>
                    <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0.25rem 0 0 0" }}>
                      {selectedCompetitor.oneLiner}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{GLOBAL_STRINGS.overallScoreLabel}</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: getScoreBadgeStyle(selectedCompetitor.overallScore).text }}>
                        {selectedCompetitor.overallScore} / 10
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-Column Advantage Matrix */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginTop: "1rem" }}>
                  <div style={{ backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.18)", borderRadius: "6px", padding: "1rem" }}>
                    <div style={{ color: "#f87171", fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.35rem" }}>
                      {GLOBAL_STRINGS.strengthsLabel}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                      {selectedCompetitor.whereTheyBeatSpe}
                    </div>
                  </div>

                  <div style={{ backgroundColor: "rgba(56, 189, 248, 0.05)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "6px", padding: "1rem" }}>
                    <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.35rem" }}>
                      {GLOBAL_STRINGS.moatLabel}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                      {selectedCompetitor.whereSpeDecisivelyBeatsThem}
                    </div>
                  </div>
                </div>

                {/* Reproducible CLI Command */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#020617", padding: "0.75rem 1rem", borderRadius: "6px", marginTop: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
                  <code style={{ fontSize: "0.8125rem", color: "#cbd5e1" }}>
                    $ {selectedCompetitor.reproducibleCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCommand(selectedCompetitor.reproducibleCommand, selectedCompetitor.id)}
                    style={{
                      minHeight: "36px",
                      padding: "6px 16px",
                      backgroundColor: copiedId === selectedCompetitor.id ? "#059669" : "#1e293b",
                      color: "#f8fafc",
                      border: "1px solid rgba(217, 197, 154, 0.3)",
                      borderRadius: "9999px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedId === selectedCompetitor.id ? STRINGS.copied : STRINGS.copyBenchmarkCmd}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Empirical Skill Benchmarks */}
      {activeTab === "benchmarks" && (
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

              <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", color: "#64748b", textAlign: "left" }}>
                      <th style={{ padding: "0.6rem 0.5rem" }}>{STRINGS.configuration}</th>
                      <th style={{ padding: "0.6rem 0.5rem" }}>{STRINGS.observedSuccess}</th>
                      <th style={{ padding: "0.6rem 0.5rem" }}>{STRINGS.wilsonBound}</th>
                      <th style={{ padding: "0.6rem 0.5rem" }}>{STRINGS.avgTokenConsumption}</th>
                      <th style={{ padding: "0.6rem 0.5rem" }}>{STRINGS.verdict}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineName}</td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineSuccessPct}%</td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineWilsonPct}%</td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{bench.baselineTokens} tokens</td>
                      <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8" }}>{STRINGS.baselineVerdict}</td>
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
                        {STRINGS.qualifiedWinner}
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
                  type="button"
                  onClick={() => copyCommand(bench.reproducibleCommand, bench.id)}
                  style={{
                    minHeight: "40px",
                    padding: "8px 18px",
                    backgroundColor: copiedId === bench.id ? "#059669" : "#1e293b",
                    color: "#f8fafc",
                    border: "1px solid rgba(217, 197, 154, 0.3)",
                    borderRadius: "9999px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copiedId === bench.id ? STRINGS.copied : STRINGS.copyBenchmarkCmd}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Feedough.com vs SPE Ω PRO Competitive Matrix */}
      {activeTab === "feedough" && (
        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Executive Verdict Banner */}
          <div
            style={{
              backgroundColor: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "8px",
              padding: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 0.25rem 0" }}>
                {STRINGS.feedoughBannerTitle}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, maxWidth: "650px" }}>
                {STRINGS.feedoughBannerSubtitle}
              </p>
            </div>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "#f87171", textTransform: "uppercase", fontWeight: 600 }}>Feedough</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f87171" }}>{STRINGS.avgFeedoughScore}</div>
              </div>
              <div style={{ fontSize: "1.5rem", color: "#64748b" }}>vs</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 600 }}>SPE Ω PRO</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>{STRINGS.avgSpeScore}</div>
              </div>
            </div>
          </div>

          {/* 8-Dimension Matrix */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {FEEDOUGH_COMPETITIVE_MATRIX.map((dim) => (
              <div
                key={dim.id}
                style={{
                  backgroundColor: "#0b1329",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "1.25rem 1.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>{dim.id}</span>
                    <h3 style={{ fontSize: "1.125rem", color: "#f8fafc", margin: "0.15rem 0 0 0" }}>{dim.dimensionName}</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "#f87171" }}>Feedough: {dim.feedoughScore}/10</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#38bdf8" }}>SPE: {dim.speScore}/10</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        color: "#10b981",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      🏆 {dim.winner}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem", fontSize: "0.8125rem" }}>
                  <div style={{ backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "6px", padding: "0.75rem" }}>
                    <div style={{ color: "#f87171", fontWeight: 600, marginBottom: "0.25rem" }}>{STRINGS.feedoughLegacy}:</div>
                    <div style={{ color: "#94a3b8" }}>{dim.feedoughReality}</div>
                  </div>
                  <div style={{ backgroundColor: "rgba(56, 189, 248, 0.05)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "6px", padding: "0.75rem" }}>
                    <div style={{ color: "#38bdf8", fontWeight: 600, marginBottom: "0.25rem" }}>{STRINGS.realityVsAdvantage}:</div>
                    <div style={{ color: "#cbd5e1" }}>{dim.speAdvantage}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Founder & Strategy Presets */}
      {activeTab === "founder" && (
        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Founder Arsenal Banner */}
          <div
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              padding: "1.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 0.25rem 0" }}>
              {STRINGS.founderBannerTitle}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
              {STRINGS.founderBannerSubtitle}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {FOUNDER_STRATEGY_PRESETS.map((preset) => (
              <div
                key={preset.id}
                style={{
                  backgroundColor: "#0b1329",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "1.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600, textTransform: "uppercase" }}>
                      {preset.category}
                    </span>
                    <h3 style={{ fontSize: "1.25rem", color: "#f8fafc", margin: "0.25rem 0 0 0" }}>
                      {preset.title}
                    </h3>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.8125rem", color: "#64748b" }}>
                    <div>{STRINGS.targetModelLabel} <span style={{ color: "#cbd5e1" }}>{preset.targetModel}</span></div>
                    <div>~{preset.estimatedTokens} tokens</div>
                  </div>
                </div>

                <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1.25rem" }}>
                  {preset.brief}
                </p>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => copyCommand(preset.promptDirective, preset.id)}
                    style={{
                      minHeight: "40px",
                      padding: "8px 18px",
                      backgroundColor: copiedId === preset.id ? "#059669" : "#1e293b",
                      color: "#f8fafc",
                      border: "1px solid rgba(217, 197, 154, 0.3)",
                      borderRadius: "9999px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedId === preset.id ? STRINGS.copied : STRINGS.copyPromptDirective}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunchStudio(preset.promptDirective, `${preset.id}-studio`)}
                    style={{
                      minHeight: "40px",
                      padding: "8px 18px",
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "9999px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedId === `${preset.id}-studio` ? STRINGS.copied : STRINGS.launchInStudio}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ContextualAdSlot slotId="compare-footer-leaderboard" format="leaderboard" className="mt-8" />
    </div>
  );
};
