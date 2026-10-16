import React, { useState, useMemo } from "react";
import {
  analyzeRealityFrontier,
  compileApprovedWorldline,
  type RealityFrontierAnalysis,
  type CompiledWorldlineContract,
  type ParetoWorldline,
} from "./realityFrontier.ts";

export const RealityFrontierStudio: React.FC = () => {
  const [intentInput, setIntentInput] = useState(
    "Build an original cinematic 3D website inspired by this URL. It must work entirely offline, fetch live remote updates every second, achieve 60 FPS on every phone, and never transmit private user data."
  );
  const [selectedWorldlineId, setSelectedWorldlineId] = useState<string>("worldline_offline_cinematic");
  const [authorizedRelaxations, setAuthorizedRelaxations] = useState<string[]>(["REQ_LIVE_FETCH_02"]);
  const [contract, setContract] = useState<CompiledWorldlineContract | null>(null);
  const [activeExportTab, setActiveExportTab] = useState<"claude" | "cursor" | "spe" | "promptfoo">("claude");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Full Analysis Pipeline
  const analysis: RealityFrontierAnalysis = useMemo(
    () => analyzeRealityFrontier(intentInput),
    [intentInput]
  );

  // Compile contract whenever analysis or selection changes
  React.useEffect(() => {
    const compiled = compileApprovedWorldline(selectedWorldlineId, analysis, authorizedRelaxations);
    setContract(compiled);
  }, [selectedWorldlineId, analysis, authorizedRelaxations]);

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

  const handleToggleRelaxation = (reqId: string) => {
    setAuthorizedRelaxations((prev) =>
      prev.includes(reqId) ? prev.filter((id) => id !== reqId) : [...prev, reqId]
    );
  };

  const sampleIntents = [
    {
      label: "3D Local vs Live (Core Challenge)",
      text: "Build an original cinematic 3D website inspired by this URL. It must run on-device, fetch live remote updates every second, achieve 60 FPS on every phone, and never transmit private user data.",
    },
    {
      label: "Standalone Personal Portfolio (Solvable Clean)",
      text: "Build a standalone personal portfolio website using vanilla HTML, CSS, and LocalStorage with zero external dependencies.",
    },
    {
      label: "E-Commerce with Guest Checkout (Dark-Matter Check)",
      text: "Build a booking website for my restaurant with instant seat confirmation and zero customer account friction.",
    },
    {
      label: "High-Throughput Mobile WebGL",
      text: "Design a mobile WebGL 3D data visualizer running at 60 FPS on low-end smartphones with air-gapped data security.",
    },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "2rem 1.5rem", color: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header & Badges */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ display: "inline-flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            ✦ Feasibility Compiler
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
            ✦ 100% In-Browser ($0 Compute)
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
            ✦ EVOI Gate (ΔH ≥ 0.95 bits)
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            ✦ Evidence Escrow
          </span>
        </div>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.75rem 0", background: "linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          SPE Reality Frontier · Counterfactual Feasibility Compiler
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: 780, margin: "0 auto", lineHeight: 1.6 }}>
          Discover what realities your intention can actually produce. Detect physical and environmental contradictions before code generation, resolve high-rework omissions with one high-value decision, and compile verified outcome contracts.
        </p>
      </div>

      {/* Input Stage */}
      <div style={{ background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(51, 65, 85, 0.7)", borderRadius: 16, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#cbd5e1" }}>
            User Intention Specification:
          </label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {sampleIntents.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setIntentInput(s.text)}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.6rem",
                  background: "rgba(30, 41, 59, 0.8)",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          placeholder="Describe your software system, design requirements, performance targets, and security policies..."
          style={{
            width: "100%",
            background: "rgba(2, 6, 23, 0.85)",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            color: "#f8fafc",
            fontSize: "0.95rem",
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
          <span>Satisfiability Verdict: <strong style={{ color: analysis.boundaryReport.satisfiabilityVerdict === "UNSATISFIABLE" ? "#f43f5e" : analysis.boundaryReport.satisfiabilityVerdict === "CONDITIONALLY_FEASIBLE" ? "#fbbf24" : "#10b981" }}>{analysis.boundaryReport.satisfiabilityVerdict}</strong></span>
          <span>Explicit Requirements: {analysis.typedRequirements.length} · Dark-Matter Omissions: {analysis.darkMatterOmissions.length}</span>
        </div>
      </div>

      {/* 4 Boundary Tension Visualizer */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#e2e8f0" }}>
          ⚡ 1. Reality Boundary & Tension Scanner
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {analysis.boundaryReport.boundaries.map((boundary) => {
            const isConflict = boundary.severity === "CRITICAL_CONFLICT";
            const isWarning = boundary.severity === "FEASIBILITY_WARNING";
            const borderColor = isConflict ? "rgba(244, 63, 94, 0.5)" : isWarning ? "rgba(245, 158, 11, 0.5)" : "rgba(16, 185, 129, 0.4)";
            const badgeBg = isConflict ? "rgba(244, 63, 94, 0.15)" : isWarning ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)";
            const badgeColor = isConflict ? "#f43f5e" : isWarning ? "#fbbf24" : "#10b981";

            return (
              <div
                key={boundary.id}
                style={{
                  background: "rgba(15, 23, 42, 0.75)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 12,
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>{boundary.name.split(":")[0]}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 9999, background: badgeBg, color: badgeColor }}>
                      {boundary.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4, margin: "0 0 0.75rem 0" }}>
                    {boundary.tensionDescription}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", background: "rgba(2, 6, 23, 0.6)", padding: "0.4rem 0.6rem", borderRadius: 6, marginBottom: "0.75rem" }}>
                    <span>{boundary.leftPole}</span>
                    <span style={{ color: "#38bdf8" }}>⇄</span>
                    <span>{boundary.rightPole}</span>
                  </div>
                </div>

                {boundary.minimalChangeAlternatives.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(51, 65, 85, 0.5)", paddingTop: "0.75rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: "0.35rem" }}>
                      Minimal-Change Alternatives:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                      {boundary.minimalChangeAlternatives.slice(0, 2).map((alt) => {
                        const isAuthorized = authorizedRelaxations.includes(alt.id);
                        return (
                          <li key={alt.id} style={{ marginBottom: "0.4rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong style={{ color: "#e2e8f0" }}>{alt.label}</strong>
                              {alt.affectsLockedRequirement && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRelaxation(alt.id)}
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "0.15rem 0.45rem",
                                    borderRadius: 4,
                                    border: isAuthorized ? "1px solid #10b981" : "1px solid #475569",
                                    background: isAuthorized ? "rgba(16, 185, 129, 0.2)" : "rgba(30, 41, 59, 0.6)",
                                    color: isAuthorized ? "#10b981" : "#94a3b8",
                                    cursor: "pointer",
                                  }}
                                >
                                  {isAuthorized ? "✓ Authorized" : "+ Authorize"}
                                </button>
                              )}
                            </div>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{alt.tradeOff}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Intent Dark-Matter & EVOI Gate Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Dark Matter Card */}
        <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(51, 65, 85, 0.7)", borderRadius: 16, padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#e2e8f0" }}>
              🌌 2. Intent Dark-Matter Scanner
            </h3>
            <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: 9999, background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", fontWeight: 600 }}>
              ACL 2026 Finding
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 1rem 0" }}>
            Detects implicit design decisions that prompt optimizers ignore, weighted by potential rework cost:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {analysis.darkMatterOmissions.map((omission) => (
              <div key={omission.id} style={{ background: "rgba(2, 6, 23, 0.6)", border: "1px solid #1e293b", borderRadius: 8, padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f8fafc" }}>{omission.area}</span>
                  <span style={{ fontSize: "0.7rem", color: "#fbbf24", fontWeight: 700 }}>
                    Rework Weight: {(omission.reworkWeight * 100).toFixed(0)}%
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 0.5rem 0" }}>
                  {omission.omissionDescription}
                </p>
                <div style={{ width: "100%", background: "#1e293b", height: 4, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${omission.reworkWeight * 100}%`, height: "100%", background: omission.reworkWeight > 0.8 ? "#f43f5e" : "#fbbf24" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EVOI Decision Gate Card */}
        <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: 16, padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#e2e8f0" }}>
              🎯 3. EVOI Single High-Value Decision Gate
            </h3>
            <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: 9999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 700 }}>
              ΔH = {analysis.evoiGate.entropyReductionDeltaH} bits
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#cbd5e1", margin: "0 0 0.5rem 0", fontWeight: 600 }}>
            {analysis.evoiGate.question}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 1rem 0" }}>
            {analysis.evoiGate.rationale}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {analysis.evoiGate.options.map((opt) => {
              const isSelected = selectedWorldlineId === opt.recommendedWorldline;
              return (
                <div
                  key={opt.key}
                  onClick={() => setSelectedWorldlineId(opt.recommendedWorldline)}
                  style={{
                    background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 6, 23, 0.6)",
                    border: `1px solid ${isSelected ? "#38bdf8" : "#1e293b"}`,
                    borderRadius: 8,
                    padding: "0.75rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isSelected ? "#38bdf8" : "#f8fafc" }}>
                      {opt.label}
                    </span>
                    {isSelected && <span style={{ fontSize: "0.7rem", color: "#38bdf8" }}>✓ Active</span>}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0 }}>
                    {opt.impactOnArchitecture}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3 Pareto Worldlines Selector */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#e2e8f0" }}>
          🌐 4. Pareto Counterfactual Worldlines
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {analysis.worldlines.map((worldline: ParetoWorldline) => {
            const isSelected = selectedWorldlineId === worldline.id;
            return (
              <div
                key={worldline.id}
                onClick={() => setSelectedWorldlineId(worldline.id)}
                style={{
                  background: isSelected ? "rgba(30, 41, 59, 0.9)" : "rgba(15, 23, 42, 0.75)",
                  border: `2px solid ${isSelected ? "#38bdf8" : "rgba(51, 65, 85, 0.6)"}`,
                  borderRadius: 16,
                  padding: "1.5rem",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: isSelected ? "0 0 24px rgba(56, 189, 248, 0.15)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 9999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                      {worldline.badge}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Jaccard: {worldline.jaccardDistinctness.toFixed(2)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
                    {worldline.name}
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.4, margin: "0 0 1rem 0" }}>
                    {worldline.tagline}
                  </p>

                  <div style={{ marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: "0.35rem" }}>
                      Architectural Pillars:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                      {worldline.architecturalPillars.map((p, idx) => (
                        <li key={idx} style={{ marginBottom: "0.2rem" }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid rgba(51, 65, 85, 0.5)", paddingTop: "0.75rem", fontSize: "0.75rem", color: "#64748b" }}>
                  <span>Network: <strong style={{ color: "#e2e8f0" }}>{worldline.protectedConstraints.networkPolicy}</strong></span> · <span>Target: <strong style={{ color: "#e2e8f0" }}>{worldline.protectedConstraints.targetFps} FPS</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Living Outcome Contract & Evidence Escrow */}
      {contract && (
        <div style={{ background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: 16, padding: "1.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                📜 5. Living Outcome Contract · {contract.selectedWorldlineName}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Contract ID: {contract.contractId} · Pinned WASM Hash: {contract.proofPassport.canonicalCompilerHash.substring(0, 16)}...
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => handleCopy(contract.exports.claudeMd, "claude")}
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, background: copiedKey === "claude" ? "#10b981" : "#0284c7", color: "#ffffff", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                {copiedKey === "claude" ? "✓ Copied!" : "Copy for CLAUDE.md"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload("CLAUDE.md", contract.exports.claudeMd)}
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, background: "rgba(30, 41, 59, 0.8)", color: "#cbd5e1", border: "1px solid #475569", borderRadius: 6, cursor: "pointer" }}
              >
                Download
              </button>
            </div>
          </div>

          {/* Evidence Escrow Table */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem 0" }}>
              Predeclared Evidence Escrow (External Witnesses Required)
            </h4>
            <div style={{ background: "rgba(2, 6, 23, 0.7)", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden" }}>
              {contract.evidenceEscrow.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", borderBottom: idx < contract.evidenceEscrow.length - 1 ? "1px solid #1e293b" : "none", fontSize: "0.78rem" }}>
                  <span style={{ color: "#e2e8f0" }}>{item.claim}</span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>Witness: {item.requiredWitness}</span>
                    <span style={{ padding: "0.15rem 0.45rem", borderRadius: 4, background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", fontWeight: 700, fontSize: "0.68rem" }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metamorphic Obligations */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem 0" }}>
              XCAT C01–C12 Metamorphic Acceptance Obligations
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.5rem" }}>
              {contract.metamorphicObligations.map((obl) => (
                <div key={obl.id} style={{ background: "rgba(2, 6, 23, 0.7)", border: "1px solid #1e293b", borderRadius: 8, padding: "0.6rem 0.8rem", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 700, color: "#f8fafc" }}>{obl.id}</span>
                    <span style={{ color: "#64748b", fontSize: "0.68rem" }}>{obl.category}</span>
                  </div>
                  <code style={{ color: "#38bdf8", fontSize: "0.72rem", display: "block" }}>{obl.predicate}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Export Tabs */}
          <div>
            <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #334155", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
              {(["claude", "cursor", "spe", "promptfoo"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveExportTab(tab)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: activeExportTab === tab ? "rgba(56, 189, 248, 0.2)" : "transparent",
                    color: activeExportTab === tab ? "#38bdf8" : "#94a3b8",
                    border: `1px solid ${activeExportTab === tab ? "#38bdf8" : "transparent"}`,
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {tab === "claude" ? "CLAUDE.md" : tab === "cursor" ? ".cursorrules" : tab === "spe" ? "Package .spe" : "promptfoo.yaml"}
                </button>
              ))}
            </div>

            <pre style={{ background: "rgba(2, 6, 23, 0.95)", border: "1px solid #1e293b", borderRadius: 8, padding: "1rem", color: "#e2e8f0", fontSize: "0.78rem", overflowX: "auto", maxHeight: 240, margin: 0, fontFamily: "ui-monospace, monospace" }}>
              {activeExportTab === "claude"
                ? contract.exports.claudeMd
                : activeExportTab === "cursor"
                ? contract.exports.cursorrules
                : activeExportTab === "spe"
                ? contract.exports.spePackageManifestJson
                : contract.exports.promptfooYaml}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
