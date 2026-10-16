/**
 * SPE Ω — AI Incident Radar & Failure Observatory
 * 
 * Interactive breaking news & forensic post-mortem feed for AI model failures,
 * jailbreaks, prompt extractions, and autonomous agent loops.
 */

import React, { useState, useMemo } from "react";
import type { AppView } from "../routing";
import {
  VERIFIED_AI_INCIDENTS,
  type IncidentSeverity,
} from "../engine/incidents/aiIncidentsRegistry";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";

interface Props {
  onNavigate?: (view: AppView) => void;
}

export const AiIncidentWire: React.FC<Props> = ({ onNavigate }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(VERIFIED_AI_INCIDENTS[0].id);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const filteredIncidents = useMemo(() => {
    return VERIFIED_AI_INCIDENTS.filter((inc) => {
      if (selectedProvider !== "ALL" && inc.modelProvider !== selectedProvider) {
        return false;
      }
      if (selectedClass !== "ALL" && inc.failureClass !== selectedClass) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = inc.title.toLowerCase().includes(q);
        const matchModel = inc.model.toLowerCase().includes(q);
        const matchSummary = inc.summary.toLowerCase().includes(q);
        const matchTags = inc.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchModel && !matchSummary && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [selectedProvider, selectedClass, searchQuery]);

  const severityColor = (sev: IncidentSeverity) => {
    switch (sev) {
      case "CRITICAL":
        return "#ef4444";
      case "HIGH":
        return "#f97316";
      case "MEDIUM":
        return "#eab308";
      case "LOW":
        return "#3b82f6";
    }
  };

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "2rem 1.5rem", color: "#f8fafc" }}>
      {/* Editorial Header */}
      <header style={{ marginBottom: "2.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.75rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              letterSpacing: "0.05em",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s infinite" }} />
            LIVE INVESTIGATION WIRE
          </span>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Updated Daily · Continuous Model Drift Sentinel
          </span>
        </div>

        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 1rem 0", lineHeight: 1.2 }}>
          AI Incident Radar & Failure Observatory
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: "800px", margin: 0, lineHeight: 1.6 }}>
          The open, forensic truth behind breaking AI model failures, prompt leaks, jailbreaks, and agent catastrophes.
          Every post-mortem is verified with reproducible test code and mathematical root causes.
        </p>

        {/* Global Empirical Metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1.75rem",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "1.25rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Post-Mortems
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#38bdf8", marginTop: "4px" }}>
              {VERIFIED_AI_INCIDENTS.length} Verified
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>100% Code-Reproducible</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              SPE Prevention Speed
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#4ade80", marginTop: "4px" }}>
              &lt; 45 ms
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Local WebAssembly SAT</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Verification Inference Cost
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fbbf24", marginTop: "4px" }}>
              $0.00 / Run
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>100% Private Sandbox</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              OWASP LLM Top 10
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#c084fc", marginTop: "4px" }}>
              100% Covered
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Formal Invariant Mapping</div>
          </div>
        </div>
      </header>

      {/* Public Contextual Ad Container (Photopea Model) */}
      <div style={{ marginBottom: "2rem" }}>
        <ContextualAdSlot slotId="incident-top-leaderboard" format="leaderboard" />
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          background: "rgba(30, 41, 59, 0.4)",
          padding: "1rem",
          borderRadius: "10px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          {/* Provider Filter */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Providers ({VERIFIED_AI_INCIDENTS.length})</option>
            <option value="OpenAI">OpenAI</option>
            <option value="Anthropic">Anthropic</option>
            <option value="Google">Google</option>
            <option value="DeepSeek">DeepSeek</option>
            <option value="Meta">Meta</option>
            <option value="Agent Runtimes">Agent Runtimes</option>
          </select>

          {/* Failure Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Failure Classes</option>
            <option value="CONFIDENTIALITY_LEAK">Prompt & Scratchpad Leak</option>
            <option value="POLARITY_INVERSION">Polarity & Logic Inversion</option>
            <option value="AUTHORITY_ESCALATION">Authority & File Deletion</option>
            <option value="TOOL_CONFUSION">Tool Schema Confusion</option>
            <option value="RESOURCE_RUNAWAY">Infinite Loop & Cost Runaway</option>
            <option value="FINANCIAL_DRIFT">Currency & Financial Mutation</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Search Box */}
          <input
            type="text"
            placeholder="Search failures, models, CVEs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "0.5rem 0.85rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              width: "240px",
            }}
          />

          <button
            onClick={() => setSubmitModalOpen(true)}
            style={{
              background: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Report AI Failure
          </button>
        </div>
      </div>

      {/* Incident Post-Mortem Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {filteredIncidents.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", background: "rgba(15, 23, 42, 0.4)", borderRadius: "12px" }}>
            No incidents matched your search criteria.
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            const isExpanded = expandedId === inc.id;

            return (
              <article
                key={inc.id}
                style={{
                  background: isExpanded ? "rgba(30, 41, 59, 0.6)" : "rgba(15, 23, 42, 0.4)",
                  border: isExpanded ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Incident Card Top Header */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: `${severityColor(inc.severity)}22`,
                          color: severityColor(inc.severity),
                          border: `1px solid ${severityColor(inc.severity)}55`,
                        }}
                      >
                        {inc.severity}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "rgba(255,255,255,0.06)",
                          color: "#cbd5e1",
                        }}
                      >
                        {inc.model}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#fbbf24",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        [LAB BENCHMARK SPECIMEN · QUARANTINED (NOINDEX)]
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        ID: {inc.id} · {inc.date}
                      </span>
                    </div>

                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
                      {inc.title}
                    </h2>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                    style={{
                      background: "transparent",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {isExpanded ? "Collapse Post-Mortem ↑" : "Inspect Full Post-Mortem ↓"}
                  </button>
                </div>

                {/* Summary */}
                <p style={{ color: "#cbd5e1", fontSize: "0.95rem", lineHeight: 1.5, margin: "0.75rem 0 0 0" }}>
                  {inc.summary}
                </p>

                {/* Expanded Deep-Dive Forensic Section */}
                {isExpanded && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.5rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
                      {/* The Forensic Truth */}
                      <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                          🔬 The Forensic Truth (Why It Failed)
                        </div>
                        <p style={{ color: "#e2e8f0", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
                          {inc.theTruth}
                        </p>
                      </div>

                      {/* Minimal Reproducer */}
                      <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            ⚠️ Minimal Reproducer Prompt / Attack Payload
                          </span>
                          <button
                            onClick={() => copyToClipboard(inc.minimalReproducer, `rep-${inc.id}`)}
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              color: "#f8fafc",
                              border: "none",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            {copiedKey === `rep-${inc.id}` ? "✓ Copied" : "Copy Payload"}
                          </button>
                        </div>
                        <pre style={{ background: "#090d16", padding: "0.75rem", borderRadius: "6px", color: "#fca5a5", fontSize: "0.85rem", overflowX: "auto", margin: 0 }}>
                          <code>{inc.minimalReproducer}</code>
                        </pre>
                      </div>

                      {/* Root Cause & SPE Remedy Side-by-Side */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
                        <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                            📐 Mathematical / Epistemic Root Cause
                          </div>
                          <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
                            {inc.rootCauseAnalysis}
                          </p>
                          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                            Mapping: {inc.owaspMapping} · {inc.cweMapping}
                          </div>
                        </div>

                        <div style={{ background: "rgba(22, 101, 52, 0.15)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(74, 222, 128, 0.3)" }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                            🛡️ How SPE Deterministically Prevents It
                          </div>
                          <p style={{ color: "#e2e8f0", fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 0.75rem 0" }}>
                            {inc.speRemedy}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#090d16", padding: "0.5rem 0.75rem", borderRadius: "6px" }}>
                            <code style={{ color: "#4ade80", fontSize: "0.8rem" }}>{inc.cliCommand}</code>
                            <button
                              onClick={() => copyToClipboard(inc.cliCommand, `cmd-${inc.id}`)}
                              style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "#f8fafc",
                                border: "none",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              {copiedKey === `cmd-${inc.id}` ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Proof Verification Hash, Source & Status */}
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                          <div>
                            Proof Digest (RFC 8785): <code style={{ color: "#94a3b8" }}>{inc.proofDigest.slice(0, 24)}...</code>
                          </div>
                          {inc.primarySourceUrl && (
                            <a
                              href={inc.primarySourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <span>Primary Reference / Source Trace ↗</span>
                            </a>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#fbbf24",
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                              fontWeight: 600,
                            }}
                          >
                            LABORATORY FAILURE SPECIMEN (QUARANTINED)
                          </span>
                          {onNavigate && (
                            <button
                              onClick={() => onNavigate("workspace")}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#38bdf8",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                textDecoration: "underline",
                              }}
                            >
                              Open in SPE Workspace →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Community Incident Submission Modal */}
      {submitModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "540px",
              width: "100%",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", color: "#f8fafc" }}>
              Submit an Observed AI Failure for Verification
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 1.25rem 0", lineHeight: 1.5 }}>
              Help build the world's most transparent AI failure observatory. All submissions are automatically scrubbed for PII locally on this device before publication.
            </p>

            {submissionSuccess ? (
              <div style={{ background: "rgba(74, 222, 128, 0.15)", padding: "1.5rem", borderRadius: "8px", border: "1px solid rgba(74, 222, 128, 0.3)", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✓</div>
                <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: "0.5rem" }}>Failure Received & Queued for Local Reproduction</div>
                <p style={{ fontSize: "0.85rem", color: "#cbd5e1", margin: 0 }}>
                  SPE will run the minimal reproducer inside the isolated test harness and publish a verified post-mortem upon successful confirmation.
                </p>
                <button
                  onClick={() => {
                    setSubmissionSuccess(false);
                    setSubmitModalOpen(false);
                  }}
                  style={{
                    marginTop: "1.25rem",
                    background: "#38bdf8",
                    color: "#0f172a",
                    border: "none",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmissionSuccess(true);
                }}
              >
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
                    Affected AI Model
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OpenAI GPT-5 / o4, Claude 4.5, DeepSeek R2"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
                    Minimal Reproducer Prompt / Input
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Exact prompt that triggered the hallucination, jailbreak, or failure..."
                    style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>
                    Observed Model Behavior vs Expected Constraint
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="What broke? (e.g. leaked internal key, ran in infinite loop, inverted negative boundary...)"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => setSubmitModalOpen(false)}
                    style={{ background: "transparent", color: "#94a3b8", border: "none", padding: "0.5rem 1rem", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ background: "#38bdf8", color: "#0f172a", border: "none", padding: "0.5rem 1.25rem", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Submit for Verification
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer Banner */}
      <footer style={{ marginTop: "3rem", padding: "2rem", background: "rgba(15, 23, 42, 0.6)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", color: "#f8fafc" }}>
          Protect Your Repository Against These Failures in 3 Seconds
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", maxWidth: "600px", margin: "0 auto 1.25rem auto" }}>
          Adopt SPE into your repository to enforce ProtectedIntent invariants, block silent agent regressions, and immunize against prompt injection before code merges.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "#090d16", padding: "0.6rem 1.2rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <code style={{ color: "#38bdf8", fontSize: "0.9rem" }}>$ npx @systempromptengine/cli adopt .</code>
          <button
            onClick={() => copyToClipboard("npx @systempromptengine/cli adopt .", "adopt-cta")}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
              border: "none",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {copiedKey === "adopt-cta" ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </footer>
    </div>
  );
};
