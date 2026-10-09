/**
 * SPE Ω — In-Browser AI Skill Builder & Audit Studio
 * Create, audit, and export portable AI skills (SKILL.md) locally on-device.
 * Zero server inference ($0 compute cost).
 */

import React, { useState, useMemo } from "react";
import { auditSkillContent, ClientAuditReport } from "../engine/workflows/clientAuditScanner";
import { buildSkillMarkdown } from "../engine/workflows/skillBuilder";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";

export const SkillBuilderStudio: React.FC = () => {
  const [skillName, setSkillName] = useState("Weekly Report Auditor");
  const [description, setDescription] = useState(
    "Reviews completed weekly engineering tasks, audits git commits against requirements, and prepares the next-task instructions."
  );
  const [category, setCategory] = useState("Engineering Operations");
  const [stepsText, setStepsText] = useState(
    "Parse recent git commits and issue tracking IDs\nCross-reference modified files against declared scope invariants\nEmit a structured WEEKLY_STATUS.md report and flag regressions"
  );
  const [allowNetwork, setAllowNetwork] = useState(false);
  const [copied, setCopied] = useState(false);

  const steps = useMemo(() => stepsText.split("\n").filter((s) => s.trim().length > 0), [stepsText]);

  const compiledMarkdown = useMemo(() => {
    return buildSkillMarkdown({
      name: skillName,
      description,
      domainCategory: category,
      proceduralSteps: steps,
      allowedPermissions: allowNetwork ? ["NETWORK_EGRESS", "LOCAL_FILESYSTEM_READ"] : ["LOCAL_FILESYSTEM_READ"],
      acceptanceCriteria: [
        "All output reports conform to markdown standards",
        "Zero regressions detected in test suite",
      ],
    });
  }, [skillName, description, category, steps, allowNetwork]);

  const auditReport: ClientAuditReport = useMemo(() => {
    return auditSkillContent(compiledMarkdown);
  }, [compiledMarkdown]);

  const slug = skillName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const installCmd = `mkdir -p ~/.claude/skills/${slug} && cat << 'EOF' > ~/.claude/skills/${slug}/SKILL.md\n${compiledMarkdown}\nEOF`;

  const copyInstall = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="spe-skill-builder-container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.5rem" }}>
          In-Browser AI Skill Builder & Auditor
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "700px", margin: "0 auto" }}>
          Build portable AI agent skills (SKILL.md) in seconds. Audited for security in your browser with $0 server inference.
        </p>
      </header>

      <ContextualAdSlot slotId="skillbuilder-top-leaderboard" format="leaderboard" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        {/* Input Form Column */}
        <div style={{ backgroundColor: "#0b1329", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", color: "#f8fafc", marginBottom: "1rem" }}>Define Procedure</h2>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.35rem" }}>
              Skill Name
            </label>
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.35rem" }}>
              Description & Purpose
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.35rem" }}>
              Domain Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
              }}
            >
              <option>Engineering Operations</option>
              <option>Business Operations</option>
              <option>Document Automation</option>
              <option>Customer Support</option>
              <option>Security & Compliance</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.35rem" }}>
              Step-by-Step Directives (one per line)
            </label>
            <textarea
              rows={5}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "0.875rem",
                fontFamily: "monospace",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.875rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allowNetwork}
                onChange={(e) => setAllowNetwork(e.target.checked)}
              />
              Allow External Network Egress (Defaults to $0 / Local-Only)
            </label>
          </div>
        </div>

        {/* Live Preview & Audit Column */}
        <div style={{ backgroundColor: "#0b1329", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", color: "#f8fafc", margin: 0 }}>Security Audit & Export</h2>
            <div
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                fontWeight: 700,
                backgroundColor: auditReport.isSafe ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: auditReport.isSafe ? "#10b981" : "#ef4444",
                border: `1px solid ${auditReport.isSafe ? "#10b981" : "#ef4444"}`,
              }}
            >
              {auditReport.verdict} (Score: {auditReport.safetyScore}/100)
            </div>
          </div>

          {auditReport.violations.length > 0 && (
            <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
              <strong style={{ color: "#ef4444", fontSize: "0.875rem" }}>Violations Detected:</strong>
              <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0, fontSize: "0.8125rem", color: "#fca5a5" }}>
                {auditReport.violations.map((v, i) => (
                  <li key={i}>{v.description} (Matched: <code>{v.matchedText}</code>)</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>
              Generated SKILL.md Spec
            </label>
            <pre
              style={{
                backgroundColor: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "6px",
                padding: "0.75rem",
                fontSize: "0.75rem",
                color: "#cbd5e1",
                height: "220px",
                overflowY: "auto",
              }}
            >
              {compiledMarkdown}
            </pre>
          </div>

          <button
            onClick={copyInstall}
            disabled={!auditReport.isSafe}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: !auditReport.isSafe ? "#475569" : copied ? "#059669" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: !auditReport.isSafe ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
            }}
          >
            {copied ? "✓ Copied Claude Code Install Command!" : "Export to Claude Code (~/.claude/skills)"}
          </button>
        </div>
      </div>
    </div>
  );
};
