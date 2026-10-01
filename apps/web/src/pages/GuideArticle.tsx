import React, { useEffect } from "react";
import {
  type AuthorityDocument,
  type EvidenceRecord,
  generateArticleJsonLd,
} from "../authority/evidenceRegistry";
import "../authority/hub.css";

interface GuideArticleProps {
  document: AuthorityDocument;
  onBack?: () => void;
}

export const GuideArticle: React.FC<GuideArticleProps> = ({ document: doc, onBack }) => {
  // Inject Google-compliant JSON-LD into DOM head (clean single schema type: Article OR TechArticle, never stacked)
  useEffect(() => {
    const isTech = doc.schemaType === "TechArticle";
    const schemaType = isTech ? "TechArticle" : "Article";
    const jsonLdData = {
      ...generateArticleJsonLd(doc),
      "@type": schemaType,
    };

    const scriptId = `spe-jsonld-${doc.slug}`;
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = scriptId;
      scriptEl.type = "application/ld+json";
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(jsonLdData);

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [doc]);

  return (
    <article className="spe-authority-page spe-article-view" aria-labelledby="spe-guide-title">
      {/* Navigation Breadcrumb & Back */}
      <nav className="spe-article-breadcrumbs" aria-label="Breadcrumbs">
        {onBack && (
          <button
            type="button"
            className="spe-article-back-btn"
            onClick={onBack}
            aria-label="Back to Authority Hub"
          >
            ← Back to Hub
          </button>
        )}
        <span>/</span>
        <span>Authority</span>
        <span>/</span>
        <span aria-current="page">{doc.slug}</span>
      </nav>

      {/* Article Header */}
      <header className="spe-article-header">
        <div className="spe-doc-badge-row">
          <span className="spe-doc-type-badge">
            {doc.docType === "technical_spec" ? "Technical Specification" : "Research Guide"}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--spe-hub-muted)" }}>
            Schema: {doc.schemaType}
          </span>
        </div>

        <h1 id="spe-guide-title">{doc.title}</h1>
        <p style={{ fontSize: "1.125rem", color: "var(--spe-hub-muted)", margin: "0 0 16px 0" }}>
          {doc.summary}
        </p>

        <div className="spe-article-meta">
          <span>By {doc.author.name} ({doc.author.role})</span>
          <span>•</span>
          <time dateTime={doc.publishedDate}>
            Published {new Date(doc.publishedDate).toLocaleDateString()}
          </time>
          <span>•</span>
          <time dateTime={doc.modifiedDate}>
            Updated {new Date(doc.modifiedDate).toLocaleDateString()}
          </time>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="spe-article-body">
        {doc.sections.map((sec, idx) => (
          <section key={idx} aria-labelledby={`section-heading-${idx}`}>
            <h2 id={`section-heading-${idx}`}>{sec.heading}</h2>
            {sec.content.map((p, pIdx) => (
              <p key={pIdx}>{p}</p>
            ))}
          </section>
        ))}
      </div>

      {/* Verifiable Evidence Ledger Section (14 Mandatory Fields) */}
      {doc.evidenceRecords && doc.evidenceRecords.length > 0 && (
        <section className="spe-evidence-section" aria-labelledby="spe-evidence-heading">
          <h2 id="spe-evidence-heading" className="spe-evidence-title">
            Verifiable Evidence Ledger
          </h2>
          <p style={{ fontSize: "0.9375rem", color: "var(--spe-hub-muted)", marginBottom: "20px" }}>
            The following empirical claims have been independently evaluated according to our 14-field
            verifiable benchmark standard.
          </p>

          {doc.evidenceRecords.map((ev: EvidenceRecord) => (
            <div key={ev.id} className="spe-evidence-card">
              <div className="spe-evidence-card-header">
                <span className="spe-evidence-id">{ev.id}</span>
                <span className={`spe-evidence-status-badge ${ev.status}`}>
                  {ev.status}
                </span>
              </div>

              <div className="spe-evidence-grid">
                {/* 1. Claim */}
                <div className="spe-evidence-field-label">Claim:</div>
                <div className="spe-evidence-field-val"><strong>{ev.claim}</strong></div>

                {/* 2. Dataset */}
                <div className="spe-evidence-field-label">Dataset:</div>
                <div className="spe-evidence-field-val">{ev.dataset}</div>

                {/* 3. Baseline */}
                <div className="spe-evidence-field-label">Baseline:</div>
                <div className="spe-evidence-field-val">{ev.baseline}</div>

                {/* 4. Metric */}
                <div className="spe-evidence-field-label">Metric:</div>
                <div className="spe-evidence-field-val">{ev.metric}</div>

                {/* 5. Sample Size */}
                <div className="spe-evidence-field-label">Sample Size:</div>
                <div className="spe-evidence-field-val">{ev.sampleSize}</div>

                {/* 6. Provider Version */}
                <div className="spe-evidence-field-label">Provider Version:</div>
                <div className="spe-evidence-field-val">{ev.providerVersion}</div>

                {/* 7. Date */}
                <div className="spe-evidence-field-label">Measurement Date:</div>
                <div className="spe-evidence-field-val">{ev.date}</div>

                {/* 8. Methodology */}
                <div className="spe-evidence-field-label">Methodology:</div>
                <div className="spe-evidence-field-val">{ev.methodology}</div>

                {/* 9. Evidence Links */}
                <div className="spe-evidence-field-label">Evidence Links:</div>
                <div className="spe-evidence-field-val">
                  <ul style={{ margin: 0, paddingLeft: "16px" }}>
                    {ev.evidenceLinks.map((link, lIdx) => {
                      const isHttp = /^https?:\/\//i.test(link);
                      // Gap tokens (NOT_PUBLISHED / UNAVAILABLE / MISSING_IN_REPO) are
                      // truthful non-clickable provenance — never invent a dead href.
                      if (!isHttp) {
                        return (
                          <li key={lIdx}>
                            <span
                              data-evidence-gap="true"
                              style={{ color: "var(--spe-hub-muted, #94a3b8)", fontStyle: "italic" }}
                            >
                              {link}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={lIdx}>
                          <a
                            href={link}
                            {...{ target: "_blank", rel: "noopener noreferrer" }}
                            style={{ color: "var(--spe-hub-accent)" }}
                          >
                            {link}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* 10. Raw Results */}
                <div className="spe-evidence-field-label">Raw Results:</div>
                <div className="spe-evidence-field-val"><code>{ev.rawResults}</code></div>

                {/* 11. Repro Steps */}
                <div className="spe-evidence-field-label">Repro Steps:</div>
                <div className="spe-evidence-field-val">
                  <ol style={{ margin: 0, paddingLeft: "16px" }}>
                    {ev.reproSteps.map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ol>
                </div>

                {/* 12. Limitations */}
                <div className="spe-evidence-field-label">Limitations:</div>
                <div className="spe-evidence-field-val" style={{ color: "#fbbf24" }}>
                  {ev.limitations}
                </div>

                {/* 13. Status */}
                <div className="spe-evidence-field-label">Audit Status:</div>
                <div className="spe-evidence-field-val">{ev.status}</div>

                {/* 14. Last Verified */}
                <div className="spe-evidence-field-label">Last Verified:</div>
                <div className="spe-evidence-field-val">
                  <time dateTime={ev.lastVerified}>
                    {new Date(ev.lastVerified).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </article>
  );
};
