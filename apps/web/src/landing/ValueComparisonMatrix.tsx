import { useState } from "react";
import type { AppView } from "../routing";
import { copyTextSafe } from "../engine/workflows/clipboard";
import "./conversion-kernel.css";

interface ValueComparisonMatrixProps {
  onNavigate?: (view: AppView) => void;
}

type FilterCategory = "all" | "cost" | "receipts" | "security" | "airgap";

interface MatrixRow {
  id: string;
  category: FilterCategory;
  categoryLabel: string;
  painTitle: string;
  painDetail: string;
  solutionTitle: string;
  solutionDetail: string;
  solutionPill: string;
  cliCommand?: string;
}

const MATRIX_ROWS: MatrixRow[] = [
  {
    id: "cost-bills",
    category: "cost",
    categoryLabel: "Cost & Bills",
    painTitle: "Paying $20/mo to ChatGPT/Claude just to paste terminal logs",
    painDetail: "Wasting subscription fees and pasting terminal logs into hosted web chats with rate limits and data retention.",
    solutionTitle: "Run `spe continue -` locally for $0.00 with instant terminal pipes",
    solutionDetail: "Pipes stdin directly to the local compiler at $0.00 with zero network hops and zero inference bills.",
    solutionPill: "Local Pipe",
    cliCommand: "spe continue -",
  },
  {
    id: "test-receipts",
    category: "receipts",
    categoryLabel: "Test Receipts",
    painTitle: "Agent claims \"Task Completed!\" but 4 unit tests are broken",
    painDetail: "Hallucinated completion reports that merge broken code into production, forcing costly emergency fixes.",
    solutionTitle: "Kleene-3 verification: tasks require tangible witness receipts",
    solutionDetail: "Three-valued logic (True / False / Unknown) halts PRs unless proof witnesses and test receipts pass.",
    solutionPill: "Kleene-3 Receipt",
    cliCommand: "spe check prompt.md --strict",
  },
  {
    id: "security-drift",
    category: "security",
    categoryLabel: "Security Invariants",
    painTitle: "Prompts silently drift, leaking internal keys or system bounds",
    painDetail: "Silent prompt drift over model versions, exposing internal boundaries and sensitive system context.",
    solutionTitle: "ProtectedIntent compiler halts pull requests on invariant violations",
    solutionDetail: "Deterministic boundary compilation with zero drift and cryptographically bound invariants.",
    solutionPill: "Invariant Halt",
    cliCommand: "npx @systempromptengine/cli adopt .",
  },
  {
    id: "offline-airgap",
    category: "airgap",
    categoryLabel: "Offline Air-Gap",
    painTitle: "Cloud tools store your company prompts on their servers",
    painDetail: "Internal code architecture, confidential schemas, and IP stored on 3rd-party servers without guarantees.",
    solutionTitle: "100% WebAssembly in-browser sandbox — zero prompt bytes leave device",
    solutionDetail: "Air-gapped client execution with canonical SHA-256 hash and zero telemetry egress.",
    solutionPill: "WASM Sandbox",
    cliCommand: "npm install -g @systempromptengine/cli",
  },
];

export function ValueComparisonMatrix({ onNavigate }: ValueComparisonMatrixProps) {
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredRows =
    filter === "all"
      ? MATRIX_ROWS
      : MATRIX_ROWS.filter((row) => row.category === filter);

  const copyToClipboard = async (text: string, key: string) => {
    const success = await copyTextSafe(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    }
  };

  return (
    <section
      className="spe-matrix-section"
      id="comparison-matrix"
      data-copy-depth="PROOF"
      aria-labelledby="comparison-matrix-heading"
    >
      <div className="spe-matrix-box">
        {/* Header */}
        <div className="spe-matrix-header">
          <p className="spe-matrix-eyebrow">VALUE COMPARISON MATRIX</p>
          <h2 id="comparison-matrix-heading" className="spe-matrix-title">
            Pain with Existing Chat Tools vs. SPE Ω Solution
          </h2>
          <p className="spe-matrix-subtitle">
            Produce on demand: See why developers replace expensive cloud prompt wrappers with deterministic offline invariants.
          </p>
        </div>

        {/* Filter Pills / Produce on Demand */}
        <div className="spe-matrix-filter-bar" role="group" aria-label="Matrix Filters">
          <button
            type="button"
            className={`spe-matrix-filter-btn ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Invariants
          </button>
          <button
            type="button"
            className={`spe-matrix-filter-btn ${filter === "cost" ? "is-active" : ""}`}
            onClick={() => setFilter("cost")}
          >
            Cost &amp; Bills
          </button>
          <button
            type="button"
            className={`spe-matrix-filter-btn ${filter === "receipts" ? "is-active" : ""}`}
            onClick={() => setFilter("receipts")}
          >
            Test Receipts
          </button>
          <button
            type="button"
            className={`spe-matrix-filter-btn ${filter === "security" ? "is-active" : ""}`}
            onClick={() => setFilter("security")}
          >
            Security Invariants
          </button>
          <button
            type="button"
            className={`spe-matrix-filter-btn ${filter === "airgap" ? "is-active" : ""}`}
            onClick={() => setFilter("airgap")}
          >
            Offline Air-Gap
          </button>
        </div>

        {/* Column Headers */}
        <div className="spe-matrix-grid">
          <div className="spe-matrix-col-header is-pain">
            <span>Existing Chat Tools</span>
          </div>
          <div className="spe-matrix-col-header is-solution">
            <span>SPE Ω Engine</span>
          </div>
        </div>

        {/* Matrix Rows */}
        <div className="spe-matrix-rows">
          {filteredRows.map((row) => (
            <div className="spe-matrix-card-pair" key={row.id}>
              {/* Pain Side */}
              <div className="spe-pain-cell">
                <span className="spe-pain-pill">{row.categoryLabel}</span>
                <h3 className="spe-pain-title">{row.painTitle}</h3>
                <p className="spe-pain-detail">{row.painDetail}</p>
              </div>

              {/* Solution Side */}
              <div className="spe-solution-cell">
                <span className="spe-solution-pill">{row.solutionPill}</span>
                <h3 className="spe-solution-title">{row.solutionTitle}</h3>
                <p className="spe-solution-detail">{row.solutionDetail}</p>
                {row.cliCommand && (
                  <div className="spe-cell-action-row">
                    <button
                      type="button"
                      className={`spe-action-btn-sm ${copiedKey === row.id ? "is-copied" : ""}`}
                      onClick={() => copyToClipboard(row.cliCommand!, row.id)}
                      aria-label="Copy CLI command"
                    >
                      {copiedKey === row.id ? (
                        <span>Copied!</span>
                      ) : (
                        <span>$ {row.cliCommand}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Developer Action Footer */}
        <div className="spe-matrix-footer">
          <div className="spe-matrix-footer-info">
            <h4 className="spe-matrix-footer-title">Developer CLI Quickstart</h4>
            <p className="spe-matrix-footer-sub">
              Zero cloud telemetry · 100% offline air-gap · $0.00 spend
            </p>
          </div>

          <div className="spe-matrix-footer-buttons">
            <button
              type="button"
              className="spe-btn-cta-primary"
              onClick={() =>
                copyToClipboard("npm install -g @systempromptengine/cli", "matrix-footer-install")
              }
            >
              {copiedKey === "matrix-footer-install" ? (
                <span>Copied!</span>
              ) : (
                <span>Install Free CLI: npm install -g @systempromptengine/cli</span>
              )}
            </button>
            <button
              type="button"
              className="spe-btn-cta-secondary"
              onClick={() => {
                if (onNavigate) {
                  onNavigate("workflows");
                  window.scrollTo(0, 0);
                }
              }}
            >
              Explore 1-Click Business Workflows →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
