/**
 * SPE Ω — Contextual Ad Container (Privacy-Preserving & Ethical)
 * Strict Constitutional Boundary: Only renders on public discovery surfaces.
 * 100% prohibited in private workspaces and execution environments.
 */

import React from "react";

export interface ContextualAdSlotProps {
  slotId: string;
  format?: "leaderboard" | "rectangle" | "badge";
  label?: string;
  className?: string;
}

export const ContextualAdSlot: React.FC<ContextualAdSlotProps> = ({
  slotId,
  format = "leaderboard",
  label = "Sponsored Dev Partner",
  className = "",
}) => {
  const dimensions =
    format === "leaderboard"
      ? { width: "100%", maxWidth: "728px", minHeight: "90px" }
      : format === "rectangle"
      ? { width: "100%", maxWidth: "300px", minHeight: "250px" }
      : { width: "100%", maxWidth: "180px", minHeight: "60px" };

  return (
    <aside
      className={`spe-contextual-ad-slot ${className}`}
      data-ad-slot-id={slotId}
      aria-label="Contextual developer advertisement"
      style={{
        margin: "1.5rem auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...dimensions,
      }}
    >
      <div
        style={{
          width: "100%",
          padding: "0.25rem 0.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.6875rem",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <span>{label}</span>
        <span title="SPE funds free deterministic tools via contextual developer ads">
          Free Utility via Ads
        </span>
      </div>

      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#090d16",
          border: "1px dashed #1e293b",
          borderRadius: "0 0 6px 6px",
          padding: "0.75rem",
          color: "#94a3b8",
          fontSize: "0.8125rem",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Contextual Ad Inventory:</strong> Certified AI model infrastructure, developer tools, and hosting providers. (Zero tracking cookies · Zero user data egress)
        </p>
      </div>
    </aside>
  );
};
