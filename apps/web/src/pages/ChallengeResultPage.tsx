import React from "react";
import { ChallengeResultStudio } from "../engine/ChallengeResultStudio.tsx";
import type { AppView } from "../routing.ts";

interface ChallengeResultPageProps {
  onNavigate?: (view: AppView) => void;
}

export const ChallengeResultPage: React.FC<ChallengeResultPageProps> = ({ onNavigate }) => {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "24px 20px 80px",
        fontFamily: "var(--spe-font-sans, system-ui, -apple-system, sans-serif)",
        color: "#F8FAFC",
      }}
    >
      {/* Breadcrumb Header */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.82rem",
          color: "#94A3B8",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => onNavigate?.("home")}
          style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 0 }}
        >
          Home
        </button>
        <span>/</span>
        <span style={{ color: "#38BDF8", fontWeight: 600 }}>Challenge This Result</span>
      </nav>

      {/* Main Studio Component */}
      <ChallengeResultStudio />
    </div>
  );
};
