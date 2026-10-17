import React, { useState } from "react";
import {
  AUTHORITY_DOCUMENTS,
  EVIDENCE_LEDGER,
  type AuthorityDocument,
} from "../authority/evidenceRegistry";
import { GuideArticle } from "./GuideArticle";
import "../authority/hub.css";

export const AuthorityHub: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeDoc, setActiveDoc] = useState<AuthorityDocument | null>(null);

  if (activeDoc) {
    return <GuideArticle document={activeDoc} onBack={() => setActiveDoc(null)} />;
  }

  const filteredDocs =
    selectedCategory === "all"
      ? AUTHORITY_DOCUMENTS
      : AUTHORITY_DOCUMENTS.filter(
          (doc) => doc.category === selectedCategory || doc.docType === selectedCategory
        );

  return (
    <main className="spe-authority-page" aria-labelledby="spe-authority-main-title">
      <header className="spe-authority-header">
        <h1 id="spe-authority-main-title">Evidence & Authority Hub</h1>
        <p>
          Qualification plans and evidence requirements for the System Prompt Engine.
          Provisional records do not establish measured results or independent verification.
        </p>

        {/* Global Evidence Ledger Metrics */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "20px",
            padding: "16px",
            background: "var(--spe-hub-surface)",
            border: "1px solid var(--spe-hub-border)",
            borderRadius: "8px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--spe-hub-muted)", textTransform: "uppercase" }}>
              Verified Claims
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--spe-hub-success)" }}>
              {EVIDENCE_LEDGER.filter((e) => e.status === "verified").length} / {EVIDENCE_LEDGER.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--spe-hub-muted)", textTransform: "uppercase" }}>
              Technical Specs
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--spe-hub-accent)" }}>
              {AUTHORITY_DOCUMENTS.filter((d) => d.docType === "technical_spec").length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--spe-hub-muted)", textTransform: "uppercase" }}>
              Research Guides
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>
              {AUTHORITY_DOCUMENTS.filter((d) => d.docType === "research_guide").length}
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <nav className="spe-hub-filter-bar" aria-label="Filter authority publications">
        <button
          type="button"
          className={`spe-hub-filter-btn ${selectedCategory === "all" ? "active" : ""}`}
          aria-pressed={selectedCategory === "all"}
          onClick={() => setSelectedCategory("all")}
        >
          All Publications
        </button>
        <button
          type="button"
          className={`spe-hub-filter-btn ${selectedCategory === "technical_spec" ? "active" : ""}`}
          aria-pressed={selectedCategory === "technical_spec"}
          onClick={() => setSelectedCategory("technical_spec")}
        >
          Technical Specifications
        </button>
        <button
          type="button"
          className={`spe-hub-filter-btn ${selectedCategory === "research_guide" ? "active" : ""}`}
          aria-pressed={selectedCategory === "research_guide"}
          onClick={() => setSelectedCategory("research_guide")}
        >
          Research Guides
        </button>
        <button
          type="button"
          className={`spe-hub-filter-btn ${selectedCategory === "privacy" ? "active" : ""}`}
          aria-pressed={selectedCategory === "privacy"}
          onClick={() => setSelectedCategory("privacy")}
        >
          Privacy & Security
        </button>
      </nav>

      {/* Publication Cards Grid */}
      <section className="spe-docs-grid" aria-label="Available publications">
        {filteredDocs.map((doc) => (
          <article
            key={doc.slug}
            className="spe-doc-card"
            tabIndex={0}
            role="button"
            onClick={() => setActiveDoc(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveDoc(doc);
              }
            }}
            aria-label={`Read ${doc.title}`}
          >
            <div>
              <div className="spe-doc-badge-row">
                <span className="spe-doc-type-badge">
                  {doc.docType === "technical_spec" ? "Tech Spec" : "Guide"}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--spe-hub-muted)" }}>
                  {doc.category}
                </span>
              </div>
              <h3>{doc.title}</h3>
              <p>{doc.summary}</p>
            </div>

            <div className="spe-doc-footer">
              <span>{doc.evidenceRecords.filter((e) => e.status === "verified" || e.status === "replicated").length} / {doc.evidenceRecords.length} records verified</span>
              <span style={{ color: "var(--spe-hub-accent)", fontWeight: 600 }}>Read →</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};
