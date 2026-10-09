import React, { useState } from "react";
import { SavingsTicker } from "./SavingsTicker";
import { ExecutionDagViewer } from "./ExecutionDagViewer";
import { ContinuationInspector } from "./ContinuationInspector";
import { ReceiptExporter, SAMPLE_CERTIFICATE } from "./ReceiptExporter";

export type ConsoleTab = "OVERVIEW" | "DAG_VIEWER" | "CONTINUATION_CUT" | "RECEIPTS";

export interface ConsoleDashboardProps {
  onClose?: () => void;
}

export const ConsoleDashboard: React.FC<ConsoleDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("OVERVIEW");

  return (
    <div
      style={{
        background: "#090d13",
        color: "#f0f6fc",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Banner / Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #21262d",
          paddingBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: "#ffffff",
                fontSize: "14px",
              }}
            >
              Ω
            </span>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
              SPE Planetary Developer Console
            </h2>
            <span
              style={{
                fontSize: "11px",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "12px",
                padding: "2px 8px",
                fontWeight: 600,
              }}
            >
              v10.0 Monarchy
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8b949e" }}>
            Hardware-aware local execution, 2PC financial escrow, and Proof-Carrying Semantic Continuations.
          </p>
        </div>

        {/* Tab selection */}
        <div style={{ display: "flex", gap: "8px", background: "#161b22", padding: "4px", borderRadius: "8px", border: "1px solid #30363d" }}>
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            style={{
              background: activeTab === "OVERVIEW" ? "#21262d" : "transparent",
              color: activeTab === "OVERVIEW" ? "#f0f6fc" : "#8b949e",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Overview & Ticker
          </button>
          <button
            onClick={() => setActiveTab("DAG_VIEWER")}
            style={{
              background: activeTab === "DAG_VIEWER" ? "#21262d" : "transparent",
              color: activeTab === "DAG_VIEWER" ? "#f0f6fc" : "#8b949e",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Execution DAG
          </button>
          <button
            onClick={() => setActiveTab("CONTINUATION_CUT")}
            style={{
              background: activeTab === "CONTINUATION_CUT" ? "#21262d" : "transparent",
              color: activeTab === "CONTINUATION_CUT" ? "#f0f6fc" : "#8b949e",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            PCSC Continuation
          </button>
          <button
            onClick={() => setActiveTab("RECEIPTS")}
            style={{
              background: activeTab === "RECEIPTS" ? "#21262d" : "transparent",
              color: activeTab === "RECEIPTS" ? "#f0f6fc" : "#8b949e",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Signed Receipts
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                color: "#8b949e",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === "OVERVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SavingsTicker />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <ExecutionDagViewer />
            <ContinuationInspector />
          </div>
          <ReceiptExporter certificate={SAMPLE_CERTIFICATE} />
        </div>
      )}

      {activeTab === "DAG_VIEWER" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <ExecutionDagViewer />
        </div>
      )}

      {activeTab === "CONTINUATION_CUT" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <ContinuationInspector />
        </div>
      )}

      {activeTab === "RECEIPTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <ReceiptExporter certificate={SAMPLE_CERTIFICATE} />
        </div>
      )}
    </div>
  );
};
