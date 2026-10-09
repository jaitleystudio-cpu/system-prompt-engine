/**
 * SPE Ω — Verified Business Workflows Catalog
 * Outcome-driven directory for high-demand business & document automation jobs.
 */

import React, { useState, useMemo } from "react";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";

interface WorkflowItem {
  slug: string;
  title: string;
  category: "business-operations" | "document-automation" | "customer-success" | "engineering-ops";
  summary: string;
  inputs: string[];
  outputs: string[];
  topSkills: string[];
  tokenSavingsPct: number;
  wilsonScorePct: number;
  permissionCeiling: string;
  sampleInstructions: string;
}

const SEED_WORKFLOWS: WorkflowItem[] = [
  {
    slug: "weekly-project-status",
    title: "Weekly Engineering & Project Status Report",
    category: "business-operations",
    summary: "Consolidates recent git commit logs, closed issue tickets, and blocker reports into an executive status brief with verifiable milestone tracking.",
    inputs: ["git_log_since_last_week.txt", "completed_tickets.json"],
    outputs: ["WEEKLY_STATUS_REPORT.md"],
    topSkills: ["git-pr-review", "data-storytelling"],
    tokenSavingsPct: 34.5,
    wilsonScorePct: 94.2,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow weekly-project-status --skills 'git-pr-review,data-storytelling'",
  },
  {
    slug: "meeting-followup-synthesis",
    title: "Meeting Transcript Action Item Synthesis",
    category: "business-operations",
    summary: "Transforms raw meeting transcripts or bullet notes into clear action matrices, assigned owners, and ready-to-import task specifications.",
    inputs: ["meeting_transcript.txt"],
    outputs: ["ACTION_ITEMS_SUMMARY.md", "tasks_import.json"],
    topSkills: ["clarity-gate", "product-manager-toolkit"],
    tokenSavingsPct: 42.1,
    wilsonScorePct: 91.8,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow meeting-followup-synthesis --skills 'clarity-gate,product-manager-toolkit'",
  },
  {
    slug: "customer-ticket-triage",
    title: "Customer Support Ticket Triage & Draft",
    category: "customer-success",
    summary: "Categorizes incoming customer tickets by sentiment, urgency, and technical component, producing verified draft resolutions and triage tags.",
    inputs: ["inbox_tickets.json"],
    outputs: ["triaged_tickets.json", "DRAFT_RESPONSES.md"],
    topSkills: ["customer-support", "copywriting-psychologist"],
    tokenSavingsPct: 38.0,
    wilsonScorePct: 89.5,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow customer-ticket-triage --skills 'customer-support,copywriting-psychologist'",
  },
  {
    slug: "invoice-data-extraction",
    title: "Invoice OCR & Accounting Verification",
    category: "document-automation",
    summary: "Extracts line items, vendor details, tax computations, and verifies mathematical integrity before generating accounting ledger records.",
    inputs: ["invoice_raw_text.txt"],
    outputs: ["INVOICE_AUDIT_REPORT.md", "ledger_entry.json"],
    topSkills: ["xlsx-official", "mathguard"],
    tokenSavingsPct: 49.2,
    wilsonScorePct: 96.4,
    permissionCeiling: "Local AST Math Verification · No Egress",
    sampleInstructions: "spe continue --workflow invoice-data-extraction --skills 'xlsx-official,mathguard'",
  },
  {
    slug: "spreadsheet-to-exec-brief",
    title: "Financial Spreadsheet to Executive Brief",
    category: "document-automation",
    summary: "Ingests CSV or Excel quarterly KPI data, calculates growth rates and variances, and renders a concise executive brief with markdown charts.",
    inputs: ["quarterly_kpis.csv"],
    outputs: ["EXECUTIVE_BRIEF.md"],
    topSkills: ["startup-financial-modeling", "data-storytelling"],
    tokenSavingsPct: 31.8,
    wilsonScorePct: 92.0,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow spreadsheet-to-exec-brief --skills 'startup-financial-modeling,data-storytelling'",
  },
];

export const WorkflowsCatalog: React.FC<{ onNavigate?: (view: any) => void }> = () => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const filteredWorkflows = useMemo(() => {
    return SEED_WORKFLOWS.filter((wf) => {
      const matchCat = selectedCategory === "all" || wf.category === selectedCategory;
      const matchSearch =
        search === "" ||
        wf.title.toLowerCase().includes(search.toLowerCase()) ||
        wf.summary.toLowerCase().includes(search.toLowerCase()) ||
        wf.topSkills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [search, selectedCategory]);

  const copyToClipboard = (text: string, slug: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  return (
    <div className="spe-workflows-container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.5rem" }}>
          Verified AI Workflows Exchange
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "700px", margin: "0 auto" }}>
          Tested, reproducible business operations and document workflows. Find the top 3 verified skills for your job with zero trial-and-error.
        </p>
      </header>

      {/* Top Banner Contextual Ad */}
      <ContextualAdSlot slotId="workflows-top-leaderboard" format="leaderboard" />

      {/* Search and Filters */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search business jobs (e.g., weekly report, invoice, triage)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: "280px",
            padding: "0.75rem 1rem",
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "#f8fafc",
            fontSize: "0.95rem",
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["all", "business-operations", "document-automation", "customer-success"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: selectedCategory === cat ? "#38bdf8" : "#334155",
                backgroundColor: selectedCategory === cat ? "rgba(56, 189, 248, 0.15)" : "#0f172a",
                color: selectedCategory === cat ? "#38bdf8" : "#94a3b8",
                cursor: "pointer",
                fontSize: "0.85rem",
                textTransform: "capitalize",
              }}
            >
              {cat === "all" ? "All Jobs" : cat.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
        {filteredWorkflows.map((wf) => (
          <div
            key={wf.slug}
            style={{
              backgroundColor: "#0b1329",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "#1e293b",
                    color: "#38bdf8",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {wf.category.replace("-", " ")}
                </span>
                <span style={{ fontSize: "0.8125rem", color: "#10b981", fontWeight: 600 }}>
                  ★ {wf.wilsonScorePct}% Wilson Bound
                </span>
              </div>

              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc", marginBottom: "0.5rem" }}>
                {wf.title}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1rem", lineHeight: 1.5 }}>
                {wf.summary}
              </p>

              <div style={{ marginBottom: "1rem", fontSize: "0.8125rem" }}>
                <div style={{ color: "#64748b", marginBottom: "0.25rem" }}>
                  <strong>Verified Skills:</strong> {wf.topSkills.map((s) => `@skill/${s}`).join(", ")}
                </div>
                <div style={{ color: "#64748b", marginBottom: "0.25rem" }}>
                  <strong>Token Savings:</strong> ~{wf.tokenSavingsPct}% vs unguided agent
                </div>
                <div style={{ color: "#64748b" }}>
                  <strong>Safety Boundary:</strong> {wf.permissionCeiling}
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1rem", marginTop: "0.5rem" }}>
              <button
                onClick={() => copyToClipboard(wf.sampleInstructions, wf.slug)}
                style={{
                  width: "100%",
                  padding: "0.6rem 1rem",
                  backgroundColor: copiedSlug === wf.slug ? "#059669" : "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                {copiedSlug === wf.slug ? "✓ Copied CLI Command!" : "Copy Ready-to-Run Workflow"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* In-Content Contextual Ad */}
      <ContextualAdSlot slotId="workflows-footer-leaderboard" format="leaderboard" className="mt-8" />
    </div>
  );
};
