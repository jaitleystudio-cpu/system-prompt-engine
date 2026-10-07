import React, { useState, useMemo } from "react";
import {
  runBlindedJudgeArena,
  type ArenaEvaluationResult,
  type JudgeId,
} from "./blindedJudgeArena";

export interface BlindedJudgeArenaStudioProps {
  promptText: string;
  onClose?: () => void;
}

export const BlindedJudgeArenaStudio: React.FC<BlindedJudgeArenaStudioProps> = ({
  promptText,
  onClose,
}) => {
  const [selectedJudge, setSelectedJudge] = useState<JudgeId>("alpha");
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Evaluate Arena in real-time
  const arenaResult: ArenaEvaluationResult = useMemo(() => {
    return runBlindedJudgeArena(promptText || "Default prompt to evaluate");
  }, [promptText]);

  const { judges, consensusScore, biasTelemetry, certificate } = arenaResult;
  const currentJudge = judges[selectedJudge];

  const handleCopyCertificate = () => {
    navigator.clipboard.writeText(certificate.exportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierColor = (tier: string) => {
    if (tier === "UNANIMOUS_SUPERMAJORITY") return "#10b981";
    if (tier === "STRONG_CONSENSUS") return "#38bdf8";
    if (tier === "ACCEPTABLE_ALIGNMENT") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div
      className="blinded-judge-arena-studio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "1.25rem",
        borderRadius: "12px",
        background: "var(--spe-surface-card, rgba(15, 23, 42, 0.7))",
        border: "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.1))",
        color: "#f8fafc",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #f59e0b, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            ⚖️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                Game-Theoretic Blinded Multi-Judge Arena (LLM-as-a-Judge)
              </h3>
              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "rgba(245, 158, 11, 0.2)",
                  color: "#fbbf24",
                  fontWeight: 600,
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                }}
              >
                Pillar 5 • Nash Consensus
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
              5 Blinded Judges with Active Position & Verbosity Bias Mitigation and Cryptographic Proof-of-Rigor.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setShowCertificate(!showCertificate)}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "6px",
              background: showCertificate ? "rgba(245, 158, 11, 0.25)" : "rgba(255, 255, 255, 0.1)",
              border: `1px solid ${showCertificate ? "#f59e0b" : "rgba(255, 255, 255, 0.15)"}`,
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📜 {showCertificate ? "Close Certificate" : "View Proof-of-Rigor"}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "1.1rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Consensus Banner & Bias Telemetry */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "1rem",
        }}
      >
        {/* Consensus Score Card */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(56, 189, 248, 0.1))",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Nash Equilibrium Consensus
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: 900, color: consensusScore >= 85 ? "#10b981" : "#38bdf8", margin: "0.2rem 0" }}>
            {consensusScore}
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b" }}> / 100</span>
          </div>
          <span
            style={{
              fontSize: "0.65rem",
              padding: "0.2rem 0.6rem",
              borderRadius: "999px",
              background: "rgba(0, 0, 0, 0.4)",
              color: getTierColor(certificate.agreementTier),
              border: `1px solid ${getTierColor(certificate.agreementTier)}`,
              fontWeight: 700,
            }}
          >
            {certificate.agreementTier.replace(/_/g, " ")}
          </span>
        </div>

        {/* Bias Mitigation Telemetry */}
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.6rem",
            alignContent: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Position Bias Inversion</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>
              ✓ Neutralized (±{biasTelemetry.positionScoreShift.toFixed(1)} pts)
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Verbosity Normalization</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: biasTelemetry.verbosityPenalty < 0 ? "#f59e0b" : "#10b981" }}>
              {biasTelemetry.verbosityPenalty >= 0 ? "+0 pts (Optimal Density)" : `${biasTelemetry.verbosityPenalty} pts (Bloat Penalty)`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Fleiss' Kappa Agreement</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#a855f7" }}>
              {(biasTelemetry.fleissKappaAgreement * 100).toFixed(1)}% Alignment
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Inter-Judge Variance (λ=0.05)</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>
              σ² = {biasTelemetry.interJudgeVariance}
            </div>
          </div>
        </div>
      </div>

      {/* 5 Judge Pods Selection Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "0.5rem",
        }}
      >
        {(["alpha", "beta", "gamma", "delta", "epsilon"] as JudgeId[]).map((id) => {
          const j = judges[id];
          const isSelected = selectedJudge === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedJudge(id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0.6rem 0.4rem",
                borderRadius: "8px",
                background: isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(0, 0, 0, 0.25)",
                border: `1px solid ${isSelected ? "#f59e0b" : "rgba(255, 255, 255, 0.08)"}`,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>{j.avatar}</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: isSelected ? "#fbbf24" : "#e2e8f0" }}>
                {j.judgeName}
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 800, color: j.overallScore >= 85 ? "#10b981" : "#38bdf8", marginTop: "0.2rem" }}>
                {j.overallScore}/100
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Judge Pod Detail Inspector */}
      <div
        style={{
          padding: "1rem",
          borderRadius: "8px",
          background: "rgba(0, 0, 0, 0.35)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.4rem" }}>{currentJudge.avatar}</span>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f8fafc" }}>
                {currentJudge.judgeName} — {currentJudge.specialty}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                Confidence: {(currentJudge.confidence * 100).toFixed(0)}% • Blinded Independent Evaluation
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: currentJudge.overallScore >= 85 ? "#10b981" : "#38bdf8" }}>
              {currentJudge.overallScore}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/ 100</span>
          </div>
        </div>

        <div style={{ fontSize: "0.75rem", color: "#cbd5e1", fontStyle: "italic", background: "rgba(255,255,255,0.03)", padding: "0.5rem 0.75rem", borderRadius: "6px" }}>
          "{currentJudge.rationale}"
        </div>

        {/* Rubrics Breakdown Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
            Independent Rubrics Breakdown
          </span>
          {currentJudge.rubrics.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e2e8f0" }}>
                  {r.criterion} (Weight: {(r.weight * 100).toFixed(0)}%)
                </div>
                <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{r.notes}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: r.mitigatedScore >= 85 ? "#10b981" : "#38bdf8" }}>
                  {r.mitigatedScore}/100
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Certificate Modal / Export Section */}
      {showCertificate && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.6)",
            border: "1px solid #f59e0b",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fbbf24" }}>
              🔒 Cryptographic Proof-of-Rigor Certificate ({certificate.certificateId})
            </span>
            <button
              type="button"
              onClick={handleCopyCertificate}
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "6px",
                background: "#f59e0b",
                border: "none",
                color: "#000",
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied to Clipboard" : "📋 Copy Certificate"}
            </button>
          </div>

          <pre
            style={{
              margin: 0,
              padding: "0.75rem",
              borderRadius: "6px",
              background: "#090d16",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "0.7rem",
              color: "#38bdf8",
              overflowX: "auto",
              lineHeight: 1.4,
              fontFamily: "monospace",
            }}
          >
            {certificate.exportMarkdown}
          </pre>
        </div>
      )}
    </div>
  );
};
