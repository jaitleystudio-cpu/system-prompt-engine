import React, { useState } from "react";

export interface PcscFact {
  factId: string;
  statement: string;
  witnessHash: string;
}

export interface PcscDependency {
  depId: string;
  sourceFactId: string;
  targetObligation: string;
}

export interface ContinuationInspectorProps {
  rawTokenCount?: number;
  pcscTokenCount?: number;
  verifiedFacts?: PcscFact[];
  causalDependencies?: PcscDependency[];
}

export const SAMPLE_FACTS: PcscFact[] = [
  {
    factId: "F1",
    statement: "User authenticated with local ephemeral keypair and granted READ_FILE on ./src",
    witnessHash: "sha256:8f412e8b0a...",
  },
  {
    factId: "F2",
    statement: "Device profiler detected Apple Silicon M-series with 32GB unified memory (headroom 2.1x)",
    witnessHash: "sha256:1a92b7c43d...",
  },
  {
    factId: "F3",
    statement: "Local AST compilation completed with zero syntax violations and 42 AST nodes",
    witnessHash: "sha256:ec94f1078a...",
  },
];

export const SAMPLE_DEPENDENCIES: PcscDependency[] = [
  {
    depId: "D1",
    sourceFactId: "F1",
    targetObligation: "ob_sandbox_airgap",
  },
  {
    depId: "D2",
    sourceFactId: "F2",
    targetObligation: "ob_hardware_ceiling",
  },
  {
    depId: "D3",
    sourceFactId: "F3",
    targetObligation: "ob_deterministic_syntax",
  },
];

export const ContinuationInspector: React.FC<ContinuationInspectorProps> = ({
  rawTokenCount = 45_000,
  pcscTokenCount = 75,
  verifiedFacts = SAMPLE_FACTS,
  causalDependencies = SAMPLE_DEPENDENCIES,
}) => {
  const [activeView, setActiveView] = useState<"COMPARISON" | "JSON">("COMPARISON");

  const ratio = Math.round(rawTokenCount / pcscTokenCount);

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: "12px",
        padding: "24px",
        color: "#f0f6fc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header and Reduction Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
            PCSC Minimal Continuation Cut Inspector (C*)
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8b949e" }}>
            Proof-Carrying Semantic Continuation replaces 50k token context dumps with compact causal cuts.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚡</span>
            {ratio}x Token Reduction | $0.0000 Egress
          </span>

          <div style={{ display: "flex", background: "#161b22", borderRadius: "6px", padding: "2px", border: "1px solid #30363d" }}>
            <button
              onClick={() => setActiveView("COMPARISON")}
              style={{
                background: activeView === "COMPARISON" ? "#21262d" : "transparent",
                color: activeView === "COMPARISON" ? "#f0f6fc" : "#8b949e",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setActiveView("JSON")}
              style={{
                background: activeView === "JSON" ? "#21262d" : "transparent",
                color: activeView === "JSON" ? "#f0f6fc" : "#8b949e",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Raw Cut JSON
            </button>
          </div>
        </div>
      </div>

      {activeView === "COMPARISON" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Left: Traditional Naive Context Dump */}
          <div
            style={{
              background: "#161b22",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#f87171" }}>
                TRADITIONAL CONTEXT DUMP
              </span>
              <span style={{ fontSize: "11px", color: "#f87171", fontFamily: "monospace" }}>
                {rawTokenCount.toLocaleString()} tokens ($0.675 / turn)
              </span>
            </div>
            <div
              style={{
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: "6px",
                padding: "12px",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#8b949e",
                maxHeight: "220px",
                overflowY: "auto",
                lineHeight: "1.5",
              }}
            >
              [Turn 1 / User]: Can you build a system prompt engine?<br />
              [Turn 1 / Assistant]: Absolutely! Here is an introduction...<br />
              [Turn 2 / User]: Now optimize the token cost...<br />
              [Turn 3 / Assistant]: Detailed 3,000 word explanation...<br />
              ... [44,800 lines of redundant conversational chat history] ...<br />
              <span style={{ color: "#f87171" }}>⚠️ High latency, unindexed token buffer, compounded hallucinations.</span>
            </div>
          </div>

          {/* Right: SPE Minimal Continuation Cut C* */}
          <div
            style={{
              background: "#161b22",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#34d399" }}>
                SPE MINIMAL CONTINUATION CUT (C*)
              </span>
              <span style={{ fontSize: "11px", color: "#34d399", fontFamily: "monospace" }}>
                {pcscTokenCount} tokens ($0.0000 egress)
              </span>
            </div>

            <div
              style={{
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: "6px",
                padding: "12px",
                fontSize: "12px",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: "11px", color: "#58a6ff", fontWeight: 600, marginBottom: "4px" }}>
                Verified Facts (F):
              </div>
              {verifiedFacts.map((f) => (
                <div key={f.factId} style={{ marginBottom: "6px", paddingLeft: "8px", borderLeft: "2px solid #10b981" }}>
                  <span style={{ color: "#f0f6fc", fontSize: "11px" }}>{f.statement}</span>
                  <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace" }}>
                    Witness: {f.witnessHash}
                  </div>
                </div>
              ))}

              <div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 600, marginTop: "10px", marginBottom: "4px" }}>
                Active Causal Dependencies (D):
              </div>
              {causalDependencies.map((d) => (
                <div key={d.depId} style={{ fontSize: "11px", color: "#c9d1d9", paddingLeft: "8px", borderLeft: "2px solid #f59e0b" }}>
                  {d.depId}: {d.sourceFactId} → {d.targetObligation}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#090d13",
            border: "1px solid #21262d",
            borderRadius: "8px",
            padding: "16px",
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#58a6ff",
            overflowX: "auto",
            maxHeight: "280px",
          }}
        >
          <pre style={{ margin: 0 }}>
            {JSON.stringify(
              {
                continuation_cut_id: "c_star_4a2d8e",
                minimal_token_count: pcscTokenCount,
                raw_transcript_tokens: rawTokenCount,
                reduction_ratio: `${ratio}x`,
                verified_facts: verifiedFacts,
                causal_dependencies: causalDependencies,
                canonical_sha256: "d5a8b3c9f2e1a7b4c6e8d0f3a5b7c9e1d3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3",
                remediation_budget_nanos: 0,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
};
