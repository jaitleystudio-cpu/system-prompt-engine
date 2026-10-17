/**
 * SPE Ω — Agency White-Label Branding Modal
 * Allows agencies and consultants to brand exported system prompt deliverables
 * (PDF print specifications and Markdown exports) with custom agency and client metadata.
 */

import React, { useState, useEffect } from "react";
import type { AgencyBranding } from "@spe/web-runtime";

export interface AgencyBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: AgencyBranding;
  onSave: (branding: AgencyBranding) => void;
}

export const AgencyBrandingModal: React.FC<AgencyBrandingModalProps> = ({
  isOpen,
  onClose,
  branding,
  onSave,
}) => {
  const [agencyName, setAgencyName] = useState(branding.agencyName || "");
  const [clientName, setClientName] = useState(branding.clientName || "");
  const [reportSubtitle, setReportSubtitle] = useState(branding.reportSubtitle || "");

  useEffect(() => {
    setAgencyName(branding.agencyName || "");
    setClientName(branding.clientName || "");
    setReportSubtitle(branding.reportSubtitle || "");
  }, [branding, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      agencyName: agencyName.trim(),
      clientName: clientName.trim(),
      reportSubtitle: reportSubtitle.trim(),
    });
    onClose();
  };

  const handleClear = () => {
    setAgencyName("");
    setClientName("");
    setReportSubtitle("");
    onSave({});
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-branding-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#0b1329",
          border: "1px solid #334155",
          borderRadius: "14px",
          maxWidth: "520px",
          width: "100%",
          padding: "1.75rem",
          color: "#f8fafc",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "#38bdf8",
                letterSpacing: "0.05em",
              }}
            >
              Client Deliverables
            </span>
            <h3 id="agency-branding-title" style={{ margin: "0.25rem 0 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
              Agency White-Label Branding
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5 }}>
          Customize your client deliverables. Exported PDFs and Markdown specifications will feature your agency name, client name, and deliverable scope.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: "0.35rem", fontWeight: 600 }}>
              Agency / Organization Name
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Apex AI Studio"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                backgroundColor: "#020617",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: "0.35rem", fontWeight: 600 }}>
              Client Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                backgroundColor: "#020617",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: "0.35rem", fontWeight: 600 }}>
              Report Subtitle / Deliverable Scope
            </label>
            <input
              type="text"
              value={reportSubtitle}
              onChange={(e) => setReportSubtitle(e.target.value)}
              placeholder="e.g. Autonomous Coding Agent Specification v1.0"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                backgroundColor: "#020617",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: "0.55rem 1rem",
                borderRadius: "9999px",
                backgroundColor: "transparent",
                border: "1px solid #475569",
                color: "#94a3b8",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Reset to Default
            </button>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "0.55rem 1rem",
                  borderRadius: "9999px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  color: "#cbd5e1",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: "0.55rem 1.25rem",
                  borderRadius: "9999px",
                  backgroundColor: "#2563eb",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Branding
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
