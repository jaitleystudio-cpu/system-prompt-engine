/**
 * SPE Ω — Verified Business Workflows Catalog
 * Outcome-driven directory for high-demand business & document automation jobs.
 */

import React, { useState, useMemo } from "react";
import type { AppView } from "../routing";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";
import { copyTextSafe } from "../engine/workflows/clipboard";
import { SubmitWorkflowModal } from "../components/SubmitWorkflowModal";
import "../components/submit-workflow-modal.css";

interface WorkflowItem {
  slug: string;
  title: string;
  category: "business-operations" | "document-automation" | "customer-success" | "engineering-ops";
  framework: string;
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
    slug: "nextjs-api-guard",
    title: "Next.js App Router API & Zod Validator",
    category: "engineering-ops",
    framework: "Next.js / React",
    summary: "Validates Next.js route handlers, parses request bodies with Zod schemas, enforces error boundaries and generates unit test coverage.",
    inputs: ["route.ts", "schema.ts"],
    outputs: ["route.verified.ts", "route.test.ts"],
    topSkills: ["react-patterns", "backend-security-coder"],
    tokenSavingsPct: 48.0,
    wilsonScorePct: 95.8,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow nextjs-api-guard --skills 'react-patterns,backend-security-coder'",
  },
  {
    slug: "fastapi-pydantic-pipeline",
    title: "FastAPI Router & Pydantic V2 Architecture",
    category: "engineering-ops",
    framework: "FastAPI / Python",
    summary: "Generates typed FastAPI router endpoints with Pydantic V2 response models, dependency injection, and comprehensive pytest fixtures.",
    inputs: ["models.py", "endpoints_spec.json"],
    outputs: ["router.py", "test_router.py"],
    topSkills: ["fastapi-pro", "python-testing-patterns"],
    tokenSavingsPct: 41.5,
    wilsonScorePct: 96.1,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow fastapi-pydantic-pipeline --skills 'fastapi-pro,python-testing-patterns'",
  },
  {
    slug: "github-release-changelog",
    title: "GitHub Release Notes & SemVer Changelog",
    category: "engineering-ops",
    framework: "Git / CI/CD",
    summary: "Scans closed PRs and git commit tags, groups changes by conventional commits (feat, fix, refactor), and generates an immutable Markdown release notes draft.",
    inputs: ["git_log.txt", "closed_prs.json"],
    outputs: ["CHANGELOG.md", "RELEASE_NOTES.md"],
    topSkills: ["github", "changelog-automation"],
    tokenSavingsPct: 44.5,
    wilsonScorePct: 97.2,
    permissionCeiling: "Local Filesystem Read · No Network",
    sampleInstructions: "spe continue --workflow github-release-changelog --skills 'github,changelog-automation'",
  },
  {
    slug: "weekly-project-status",
    title: "Weekly Engineering & Project Status Report",
    category: "business-operations",
    framework: "Git / Projects",
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
    framework: "Product / PM",
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
    framework: "Support / Ops",
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
    framework: "Excel / OCR",
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
    framework: "Financial / Data",
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

export interface WorkflowsCatalogProps {
  onNavigate?: (view: AppView) => void;
  onRunWorkflow?: (workflow: WorkflowItem) => void;
  onSubmitWorkflow?: () => void;
}

export const WorkflowsCatalog: React.FC<WorkflowsCatalogProps> = ({
  onNavigate,
  onRunWorkflow,
  onSubmitWorkflow,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedFramework, setSelectedFramework] = useState<string>("all");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  const handleOpenSubmitModal = () => {
    if (onSubmitWorkflow) {
      onSubmitWorkflow();
    } else {
      setIsSubmitModalOpen(true);
    }
  };

  const handleRunInBrowser = (wf: WorkflowItem) => {
    if (onRunWorkflow) {
      onRunWorkflow(wf);
    } else if (onNavigate) {
      onNavigate("create");
    }
  };

  const filteredWorkflows = useMemo(() => {
    return SEED_WORKFLOWS.filter((wf) => {
      const matchCat = selectedCategory === "all" || wf.category === selectedCategory;
      const matchFw =
        selectedFramework === "all" ||
        wf.framework.toLowerCase().includes(selectedFramework.toLowerCase());
      const matchSearch =
        search === "" ||
        wf.title.toLowerCase().includes(search.toLowerCase()) ||
        wf.summary.toLowerCase().includes(search.toLowerCase()) ||
        wf.framework.toLowerCase().includes(search.toLowerCase()) ||
        wf.topSkills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchFw && matchSearch;
    });
  }, [search, selectedCategory, selectedFramework]);

  const copyToClipboard = async (text: string, slug: string) => {
    await copyTextSafe(text);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  return (
    <div className="spe-workflows-container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.5rem" }}>
          Verified Workflows · Ready-to-Run Agent Operations
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "700px", margin: "0 auto" }}>
          Battle-tested multi-step engineering and business workflows. Zero trial-and-error, 100% verified execution contracts.
        </p>
      </header>

      {/* Community PR Submission Flywheel Banner */}
      <div className="spe-workflow-contribute-banner" data-copy-depth="PROOF">
        <div className="spe-contribute-info">
          <h3>Contribute to the Verified Community Directory</h3>
          <p>
            Have a battle-tested agent workflow? Submit via GitHub Pull Request with automated CI audit pass receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenSubmitModal}
          className="spe-submit-workflow-btn"
          aria-label="Submit a Workflow via GitHub PR"
        >
          <span>➕ Submit a Workflow (GitHub PR)</span>
        </button>
      </div>

      <SubmitWorkflowModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Top Banner Contextual Ad */}
      <ContextualAdSlot slotId="workflows-top-leaderboard" format="leaderboard" />

      {/* Search and Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search jobs & frameworks (e.g., Next.js, FastAPI, release notes, invoice)..."
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
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {["all", "engineering-ops", "business-operations", "document-automation", "customer-success"].map((cat) => (
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
                {cat === "all" ? "All Domains" : cat.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Framework Quick Filter Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
            Stack:
          </span>
          {[
            { id: "all", label: "All Stacks" },
            { id: "react", label: "Next.js / React" },
            { id: "python", label: "FastAPI / Python" },
            { id: "git", label: "Git / CI/CD" },
            { id: "ocr", label: "Excel / OCR" },
            { id: "product", label: "Product / PM" },
          ].map((fw) => (
            <button
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id)}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "999px",
                border: "1px solid",
                borderColor: selectedFramework === fw.id ? "#818cf8" : "rgba(255, 255, 255, 0.1)",
                backgroundColor: selectedFramework === fw.id ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                color: selectedFramework === fw.id ? "#a5b4fc" : "#94a3b8",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: selectedFramework === fw.id ? 600 : 400,
              }}
            >
              {fw.label}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.35rem" }}>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "4px",
                      backgroundColor: "#1e293b",
                      color: "#38bdf8",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {wf.category.replace("-", " ")}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "4px",
                      backgroundColor: "rgba(99, 102, 241, 0.2)",
                      color: "#a5b4fc",
                      fontWeight: 600,
                    }}
                  >
                    {wf.framework}
                  </span>
                </div>
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

            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1rem", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => handleRunInBrowser(wf)}
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  touchAction: "manipulation",
                }}
              >
                <span>⚡ Run in Browser Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(wf.sampleInstructions, wf.slug)}
                style={{
                  width: "100%",
                  padding: "0.55rem 1rem",
                  backgroundColor: copiedSlug === wf.slug ? "#059669" : "#1e293b",
                  color: copiedSlug === wf.slug ? "#ffffff" : "#cbd5e1",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  minHeight: "44px",
                  touchAction: "manipulation",
                }}
              >
                {copiedSlug === wf.slug ? "✓ Copied CLI Command!" : "Copy CLI Command for Terminal"}
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
