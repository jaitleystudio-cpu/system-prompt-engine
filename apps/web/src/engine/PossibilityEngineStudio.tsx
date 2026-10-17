import React, { useState, useMemo } from "react";
import {
  synthesizeTopologies,
  computeEvoiDecision,
  compileLivingOutcomeContract,
  performCausalBisection,
  type LivingOutcomeContract,
  type CausalBisectResult,
  type TopologyId,
} from "./possibilityEngine.ts";

export const PossibilityEngineStudio: React.FC = () => {
  const [intentInput, setIntentInput] = useState(
    "Build a high-performance inventory dashboard with barcode scanning and export"
  );
  const [selectedTopologyId, setSelectedTopologyId] = useState<TopologyId>("topology_resilient");
  const [selectedChoiceKey, setSelectedChoiceKey] = useState<string>("local_worker");
  const [contract, setContract] = useState<LivingOutcomeContract | null>(null);
  const [, setIsCompiling] = useState(false);
  const [activeExportTab, setActiveExportTab] = useState<"claude" | "cursor" | "spe" | "promptfoo">("claude");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Causal Surgery State
  const [errorTraceInput, setErrorTraceInput] = useState("");
  const [bisectResult, setBisectResult] = useState<CausalBisectResult | null>(null);

  // Computed Topologies & EVOI Decision
  const topologies = useMemo(() => synthesizeTopologies(intentInput), [intentInput]);
  const evoi = useMemo(() => computeEvoiDecision(intentInput, topologies), [intentInput, topologies]);

  // Initial contract compilation on mount or intent/selection change
  const handleCompile = async (topoId: TopologyId = selectedTopologyId, choiceKey: string = selectedChoiceKey) => {
    setIsCompiling(true);
    try {
      const compiled = await compileLivingOutcomeContract(intentInput, topoId, choiceKey);
      setContract(compiled);
    } finally {
      setIsCompiling(false);
    }
  };

  React.useEffect(() => {
    handleCompile(selectedTopologyId, selectedChoiceKey);
  }, [selectedTopologyId, selectedChoiceKey]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRunCausalBisect = () => {
    if (!contract) return;
    const result = performCausalBisection(contract, errorTraceInput);
    setBisectResult(result);
  };

  const sampleIntents = [
    { label: "Smart Inventory & Barcodes", text: "Build a high-performance inventory dashboard with barcode scanning and export" },
    { label: "WCAG 2.1 AAA Design Tokens", text: "Create an accessible design token studio with high-contrast color auto-tuning" },
    { label: "Local AI Agent with Memory", text: "Design an in-browser local AI agent assistant with air-gapped memory retention" },
    { label: "High-Throughput Financial Ledger", text: "Build a high-throughput WebWorker transactional ledger with zero allocation" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem", color: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header & Badges */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ display: "inline-flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            ✦ 100% In-Browser WASM
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
            ✦ $0 Compute Cost
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
            ✦ Pearl do-calculus Minimal Cut
          </span>
        </div>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.75rem 0", background: "linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          SPE Possibility Engine · The Living Outcome Contract
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: 760, margin: "0 auto", lineHeight: 1.6 }}>
          Explore three possible execution futures before an AI writes a single line of code. Lock hard boundaries with First-Order Horn logic and repair agent regressions with causal surgery.
        </p>
      </div>

      {/* Input Stage */}
      <div style={{ background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(51, 65, 85, 0.7)", borderRadius: 16, padding: "1.5rem", marginBottom: "2rem" }}>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
          Your High-Level Natural Language Intent:
        </label>
        <textarea
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          rows={3}
          style={{ width: "100%", background: "#0b1329", border: "1px solid #334155", borderRadius: 8, padding: "0.75rem", color: "#f8fafc", fontSize: "0.95rem", resize: "vertical", boxSizing: "border-box" }}
          placeholder="Describe what you want to build (e.g. A high-performance inventory dashboard)..."
        />
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Quick Inspiration:</span>
          {sampleIntents.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIntentInput(sample.text);
              }}
              style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "0.25rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Card Topological Outcome Matrix */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>1. Choose Execution Topology</span>
          <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#64748b" }}>(Three orthogonal futures calculated in sub-50ms)</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          {topologies.map((topo) => {
            const isSelected = topo.id === selectedTopologyId;
            return (
              <div
                key={topo.id}
                onClick={() => setSelectedTopologyId(topo.id)}
                style={{
                  background: isSelected ? "rgba(14, 165, 233, 0.08)" : "rgba(15, 23, 42, 0.6)",
                  border: isSelected ? "2px solid #0ea5e9" : "1px solid #334155",
                  borderRadius: 14,
                  padding: "1.25rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: isSelected ? "#38bdf8" : "#f1f5f9" }}>
                    {topo.name}
                  </h3>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 9999, background: isSelected ? "#0ea5e9" : "#334155", color: "#ffffff" }}>
                    {topo.badge}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", minHeight: 40, margin: "0 0 1rem 0", lineHeight: 1.4 }}>
                  {topo.tagline}
                </p>

                <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Key Architectural Pillars:</div>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#94a3b8" }}>
                    {topo.architecturalPillars.slice(0, 3).map((pillar, i) => (
                      <li key={i} style={{ marginBottom: "0.2rem" }}>{pillar}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: "0.75rem", fontSize: "0.75rem", color: "#64748b" }}>
                  <span>Boot: <strong style={{ color: "#38bdf8" }}>{topo.estimatedColdStartMs}ms</strong></span>
                  <span>RAM: <strong style={{ color: "#a855f7" }}>{topo.memoryFootprintMb}MB</strong></span>
                  <span>Egress: <strong style={{ color: "#10b981" }}>{topo.protectedConstraints.networkPolicy}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EVOI Single High-Value Decision Bar */}
      <div style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid #334155", borderRadius: 12, padding: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#f59e0b" }}>
            ⚡ EVOI Single Decisive Choice (ΔH = {evoi.entropyReductionDeltaH} bits)
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Expected Value of Info: {evoi.expectedValueOfInfo}</span>
        </div>
        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
          {evoi.question}
        </div>
        <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: "0 0 1rem 0" }}>
          {evoi.rationale}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {evoi.options.map((opt) => {
            const isChosen = opt.key === selectedChoiceKey;
            return (
              <button
                key={opt.key}
                onClick={() => setSelectedChoiceKey(opt.key)}
                style={{
                  textAlign: "left",
                  background: isChosen ? "rgba(16, 185, 129, 0.15)" : "#0b1329",
                  border: isChosen ? "2px solid #10b981" : "1px solid #334155",
                  borderRadius: 10,
                  padding: "0.75rem 1rem",
                  cursor: "pointer",
                  color: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isChosen ? "#34d399" : "#f1f5f9", marginBottom: "0.2rem" }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {opt.impactOnArchitecture}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Living Outcome Contract & Multi-Agent Exports */}
      {contract && (
        <div style={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: 16, overflow: "hidden", marginBottom: "2rem" }}>
          {/* Contract Header */}
          <div style={{ background: "rgba(15, 23, 42, 0.8)", padding: "1rem 1.5rem", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>LIVING OUTCOME CONTRACT</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#38bdf8" }}>{contract.contractId}</div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: 6, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                Truth Value: {contract.proofPassport.truthLatticeValue} (0 Contradictions)
              </span>
              <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: 6, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                RFC 8785 Sealed
              </span>
            </div>
          </div>

          {/* Hard Invariant Summary */}
          <div style={{ padding: "1rem 1.5rem", background: "rgba(30, 41, 59, 0.2)", borderBottom: "1px solid #1e293b", fontSize: "0.85rem", color: "#cbd5e1" }}>
            <div style={{ fontWeight: 600, color: "#94a3b8", marginBottom: "0.4rem" }}>Inviolable Invariant Rules:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {contract.protectedIntent.hardBoundaries.map((b, i) => (
                <span key={i} style={{ background: "#1e293b", padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.75rem", color: "#e2e8f0" }}>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Export Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
            <button
              onClick={() => setActiveExportTab("claude")}
              style={{ flex: 1, padding: "0.75rem", background: activeExportTab === "claude" ? "#1e293b" : "transparent", color: activeExportTab === "claude" ? "#38bdf8" : "#94a3b8", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
            >
              CLAUDE.md (Claude Code)
            </button>
            <button
              onClick={() => setActiveExportTab("cursor")}
              style={{ flex: 1, padding: "0.75rem", background: activeExportTab === "cursor" ? "#1e293b" : "transparent", color: activeExportTab === "cursor" ? "#38bdf8" : "#94a3b8", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
            >
              .cursorrules (Cursor IDE)
            </button>
            <button
              onClick={() => setActiveExportTab("spe")}
              style={{ flex: 1, padding: "0.75rem", background: activeExportTab === "spe" ? "#1e293b" : "transparent", color: activeExportTab === "spe" ? "#38bdf8" : "#94a3b8", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
            >
              .spe Manifest (JSON-LD)
            </button>
            <button
              onClick={() => setActiveExportTab("promptfoo")}
              style={{ flex: 1, padding: "0.75rem", background: activeExportTab === "promptfoo" ? "#1e293b" : "transparent", color: activeExportTab === "promptfoo" ? "#38bdf8" : "#94a3b8", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
            >
              promptfoo.yaml (CI Evals)
            </button>
          </div>

          {/* Active Code Content */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: "0.5rem", zIndex: 10 }}>
              <button
                onClick={() => {
                  const content =
                    activeExportTab === "claude"
                      ? contract.exports.claudeMd
                      : activeExportTab === "cursor"
                      ? contract.exports.cursorrules
                      : activeExportTab === "spe"
                      ? contract.exports.spePackageManifestJson
                      : contract.exports.promptfooYaml;
                  handleCopy(content, activeExportTab);
                }}
                style={{ background: "#334155", border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.75rem", color: "#f8fafc", cursor: "pointer" }}
              >
                {copiedKey === activeExportTab ? "✓ Copied" : "Copy"}
              </button>
              <button
                onClick={() => {
                  const filename =
                    activeExportTab === "claude"
                      ? "CLAUDE.md"
                      : activeExportTab === "cursor"
                      ? ".cursorrules"
                      : activeExportTab === "spe"
                      ? `${contract.contractId}.spe.json`
                      : "promptfoo.yaml";
                  const content =
                    activeExportTab === "claude"
                      ? contract.exports.claudeMd
                      : activeExportTab === "cursor"
                      ? contract.exports.cursorrules
                      : activeExportTab === "spe"
                      ? contract.exports.spePackageManifestJson
                      : contract.exports.promptfooYaml;
                  handleDownload(filename, content);
                }}
                style={{ background: "#0ea5e9", border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.75rem", color: "#ffffff", cursor: "pointer" }}
              >
                Download File
              </button>
            </div>
            <pre style={{ margin: 0, padding: "1.25rem", maxHeight: 380, overflowY: "auto", fontSize: "0.85rem", lineHeight: 1.5, background: "#070d1d", color: "#e2e8f0" }}>
              {activeExportTab === "claude" && contract.exports.claudeMd}
              {activeExportTab === "cursor" && contract.exports.cursorrules}
              {activeExportTab === "spe" && contract.exports.spePackageManifestJson}
              {activeExportTab === "promptfoo" && contract.exports.promptfooYaml}
            </pre>
          </div>
        </div>
      )}

      {/* Causal Surgery & Failure Attribution Drawer */}
      <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid #334155", borderRadius: 16, padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>🔬 Causal Surgery & Failure Attribution</span>
          <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: 9999, background: "#475569", color: "#f8fafc" }}>Pearl do-calculus</span>
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 1rem 0" }}>
          Did an AI coding agent hallucinate or break working code? Paste the error log or test failure below. Causal surgery identifies the minimal failing dependency edge instead of wiping and rewriting undamaged code.
        </p>

        <textarea
          value={errorTraceInput}
          onChange={(e) => setErrorTraceInput(e.target.value)}
          rows={3}
          style={{ width: "100%", background: "#0b1329", border: "1px solid #334155", borderRadius: 8, padding: "0.75rem", color: "#f8fafc", fontSize: "0.85rem", fontFamily: "monospace", boxSizing: "border-box", marginBottom: "0.75rem" }}
          placeholder="Paste terminal error, pytest failure, or ECONNREFUSED stack trace here..."
        />

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setErrorTraceInput("TypeError: Failed to fetch at https://api.cloud.com/sync (ECONNREFUSED)")}
            style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "0.25rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}
          >
            Sample: Network Policy Violation
          </button>
          <button
            onClick={() => setErrorTraceInput("Error: EACCES: permission denied, open '.env.production'")}
            style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "0.25rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}
          >
            Sample: File Scope Violation
          </button>
          <button
            onClick={handleRunCausalBisect}
            style={{ marginLeft: "auto", background: "#8b5cf6", border: "none", color: "#ffffff", borderRadius: 6, padding: "0.4rem 1rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
          >
            Run Causal Surgery Bisect
          </button>
        </div>

        {bisectResult && (
          <div style={{ background: "#0b1329", border: "1px solid #6d28d9", borderRadius: 10, padding: "1rem", marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c084fc" }}>
                {bisectResult.isolatedFailingEdge}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
                ✓ {bisectResult.regressionsPreventedCount} Regressions Prevented
              </span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "0.5rem" }}>
              <strong>Suggested Minimal Intervention:</strong> {bisectResult.suggestedMinimalIntervention}
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Immunized Regression Test:</div>
              <pre style={{ margin: 0, padding: "0.75rem", background: "#070d1d", borderRadius: 6, fontSize: "0.8rem", color: "#a5b4fc", overflowX: "auto" }}>
                {bisectResult.immunizedTestSnippet}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
