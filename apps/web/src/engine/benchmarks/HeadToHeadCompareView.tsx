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

const STRINGS = COMPARE_VIEW_STRINGS;
const BENCHMARKS = COMPARISON_BENCHMARKS;

export const HeadToHeadCompareView: React.FC = () => {
  const isFeedoughDirect = Boolean(globalThis.window && globalThis.window.location.pathname.includes("feedough"));
  const [activeTab, setActiveTab] = useState<"benchmarks" | "feedough" | "founder">(
    isFeedoughDirect ? "feedough" : "benchmarks"
  );
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

  return (
    <div className="spe-compare-container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.5rem" }}>
          {STRINGS.headerTitle}
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "700px", margin: "0 auto" }}>
          {STRINGS.headerSubtitle}
        </p>

        {/* Tab Switcher */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          {COMPARE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as "benchmarks" | "feedough" | "founder")}
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

      {/* Tab 1: Empirical Skill Benchmarks */}
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

      {/* Tab 2: Feedough.com vs SPE Ω PRO Competitive Matrix */}
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

      {/* Tab 3: Founder & Strategy Presets */}
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
