/**
 * React UI component for inspecting and previewing 3D Enhancement Proposals.
 */
import React from "react";
import type { EnhancementProposal } from "./enhancementTypes.ts";

interface Props {
  proposal: EnhancementProposal;
  onApply?: (proposal: EnhancementProposal) => void;
  onReject?: (proposal: EnhancementProposal) => void;
}

export const EnhancementProposalCard: React.FC<Props> = ({ proposal, onApply, onReject }) => {
  const getBadgeStyle = (label: EnhancementProposal["truthLabel"]) => {
    switch (label) {
      case "TRUE_3D":
        return { backgroundColor: "#1e3a8a", color: "#60a5fa" };
      case "DEPTH_COMPOSITE":
        return { backgroundColor: "#14532d", color: "#4ade80" };
      case "2_5D":
        return { backgroundColor: "#713f12", color: "#facc15" };
      case "CSS_MOTION":
        return { backgroundColor: "#374151", color: "#9ca3af" };
    }
  };

  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "16px",
        margin: "8px 0",
        backgroundColor: "#18181b",
        color: "#f4f4f5"
      }}
      data-testid={`enhancement-${proposal.targetId}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>{proposal.kind} for #{proposal.targetId}</h4>
        <span
          style={{
            ...getBadgeStyle(proposal.truthLabel),
            fontSize: "11px",
            fontWeight: "bold",
            padding: "2px 8px",
            borderRadius: "4px"
          }}
        >
          {proposal.truthLabel}
        </span>
      </div>

      <div style={{ fontSize: "13px", color: "#a1a1aa", margin: "6px 0" }}>
        <div><strong>Current:</strong> {proposal.currentState}</div>
        <div><strong>Proposed:</strong> {proposal.proposedState}</div>
      </div>

      <div style={{ fontSize: "12px", color: "#71717a", marginTop: "8px" }}>
        <span>Draw calls: ~{proposal.performanceImpact.estimatedDrawCalls}</span> •{" "}
        <span>GPU: {proposal.performanceImpact.gpuPressure}</span> •{" "}
        <span>Confidence: {(proposal.confidence * 100).toFixed(0)}%</span>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        {onApply && (
          <button
            onClick={() => onApply(proposal)}
            style={{
              padding: "6px 12px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Apply Enhancement
          </button>
        )}
        {onReject && (
          <button
            onClick={() => onReject(proposal)}
            style={{
              padding: "6px 12px",
              backgroundColor: "#27272a",
              color: "#d4d4d8",
              border: "1px solid #3f3f46",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
