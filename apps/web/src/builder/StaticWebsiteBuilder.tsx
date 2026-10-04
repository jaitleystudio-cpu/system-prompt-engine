import React, { useState, useMemo } from "react";
import {
  type WebsiteSpec,
  DEFAULT_WEBSITE_SPEC,
  compileWebsiteSpecToStaticHtml,
  AI_GENERATION,
  SCENE_3D,
  SANDBOX,
  HOSTED_PUBLISH,
  ROUTE_MOUNT_STATUS,
} from "./websiteSpecModel";
import "./static-builder.css";

type ViewportMode = "desktop" | "tablet" | "mobile";

export const StaticWebsiteBuilder: React.FC = () => {
  const [spec, setSpec] = useState<WebsiteSpec>(DEFAULT_WEBSITE_SPEC);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const activePage = spec.pages[activePageIndex] || spec.pages[0];
  const activeSection = activePage?.sections[activeSectionIndex] || activePage?.sections[0];

  // Compile static output on the fly
  const compiled = useMemo(() => {
    return compileWebsiteSpecToStaticHtml(spec, activePage?.path);
  }, [spec, activePage?.path]);

  // Width mapping for the preview frame
  const viewportWidth = useMemo(() => {
    switch (viewport) {
      case "mobile":
        return "360px";
      case "tablet":
        return "768px";
      case "desktop":
      default:
        return "100%";
    }
  }, [viewport]);

  // Update Section Heading
  const handleHeadingChange = (newHeading: string) => {
    setSpec((prev) => {
      const updatedPages = [...prev.pages];
      const page = { ...updatedPages[activePageIndex] };
      const sections = [...page.sections];
      sections[activeSectionIndex] = {
        ...sections[activeSectionIndex],
        heading: newHeading,
      };
      page.sections = sections;
      updatedPages[activePageIndex] = page;
      return { ...prev, pages: updatedPages };
    });
  };

  // Update Section Body
  const handleBodyChange = (newBody: string) => {
    setSpec((prev) => {
      const updatedPages = [...prev.pages];
      const page = { ...updatedPages[activePageIndex] };
      const sections = [...page.sections];
      sections[activeSectionIndex] = {
        ...sections[activeSectionIndex],
        body: newBody,
      };
      page.sections = sections;
      updatedPages[activePageIndex] = page;
      return { ...prev, pages: updatedPages };
    });
  };

  // Download Bundle Locally
  const handleDownloadBundle = () => {
    const jsonStr = JSON.stringify(spec, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `website-spec-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="bld-container"
      data-route-mount={ROUTE_MOUNT_STATUS}
      role="region"
      aria-label="Static Website Builder"
    >
      {/* Header */}
      <header className="bld-header">
        <div className="bld-header-top">
          <div>
            <h1 className="bld-title">Static Website Builder (website-spec/1)</h1>
            <div style={{ fontSize: "0.75rem", color: "var(--bld-muted)", marginTop: "4px" }}>
              Specification: <code>{spec.spec_version}</code> | Emitter: <code>{spec.emitter}</code> | Offline Static HTML/CSS
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="bld-btn"
              onClick={handleDownloadBundle}
              aria-label="Download Static Website Spec JSON"
            >
              Export Spec JSON
            </button>
          </div>
        </div>

        {/* Mandatory Capability Truth Banners */}
        <div className="bld-restriction-banner" role="status" aria-label="System Boundaries">
          <span className="bld-badge-pill">🤖 AI generation: {AI_GENERATION}</span>
          <span className="bld-badge-pill">🧊 3D graphics: {SCENE_3D}</span>
          <span className="bld-badge-pill">📦 Sandbox execution: {SANDBOX}</span>
          <span className="bld-badge-pill">🌐 Hosted publish: {HOSTED_PUBLISH}</span>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bld-toolbar">
        {/* Viewport Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--bld-muted)" }}>Viewport:</span>
          <div className="bld-viewport-group" role="group" aria-label="Viewport Controls">
            <button
              type="button"
              className={`bld-btn ${viewport === "desktop" ? "active" : ""}`}
              onClick={() => setViewport("desktop")}
              aria-pressed={viewport === "desktop"}
              aria-label="Desktop viewport"
            >
              Desktop (available width)
            </button>
            <button
              type="button"
              className={`bld-btn ${viewport === "tablet" ? "active" : ""}`}
              onClick={() => setViewport("tablet")}
              aria-pressed={viewport === "tablet"}
              aria-label="Tablet viewport"
            >
              Tablet (768px)
            </button>
            <button
              type="button"
              className={`bld-btn ${viewport === "mobile" ? "active" : ""}`}
              onClick={() => setViewport("mobile")}
              aria-pressed={viewport === "mobile"}
              aria-label="Mobile viewport 360px"
            >
              Mobile (360px)
            </button>
          </div>
        </div>

        {/* View Mode Toggle: Preview vs Code */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`bld-btn ${viewMode === "preview" ? "active" : ""}`}
            onClick={() => setViewMode("preview")}
            aria-pressed={viewMode === "preview"}
          >
            Local Preview
          </button>
          <button
            type="button"
            className={`bld-btn ${viewMode === "code" ? "active" : ""}`}
            onClick={() => setViewMode("code")}
            aria-pressed={viewMode === "code"}
          >
            Compiled Code
          </button>
        </div>
      </div>

      {/* Main Workspace Split */}
      <main className="bld-workspace">
        {/* 1. Page & Section Tree */}
        <aside className="bld-sidebar" aria-label="Page and Section Navigation">
          <h2 style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "var(--bld-muted)" }}>
            Page Structure
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
              Pages ({spec.pages.length}):
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {spec.pages.map((p, pIdx) => (
                <button
                  key={p.path}
                  type="button"
                  className={`bld-btn ${pIdx === activePageIndex ? "active" : ""}`}
                  style={{ justifyContent: "flex-start", padding: "0 10px", minHeight: "36px" }}
                  onClick={() => {
                    setActivePageIndex(pIdx);
                    setActiveSectionIndex(0);
                  }}
                  aria-label={`Select page ${p.title}`}
                >
                  <span>📄 {p.title} (<code>{p.path}</code>)</span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginTop: "12px" }}>
              Sections ({activePage?.sections.length || 0}):
            </div>
            <div style={{ paddingLeft: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {activePage?.sections.map((sec, idx) => {
                const isSelected = idx === activeSectionIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`bld-btn ${isSelected ? "active" : ""}`}
                    style={{ justifyContent: "flex-start", padding: "0 10px", minHeight: "38px" }}
                    onClick={() => setActiveSectionIndex(idx)}
                    aria-label={`Select section ${sec.heading}`}
                  >
                    <span>{sec.kind.toUpperCase()}: {sec.heading.slice(0, 20)}...</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--bld-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--bld-muted)" }}>Compiler Receipt</div>
            <div style={{ fontSize: "0.8125rem", fontFamily: "monospace", marginTop: "4px" }}>
              Sections: {activePage?.sections.length} | Local compile: OK
            </div>
          </div>
        </aside>

        {/* 2. Section Editor */}
        <section className="bld-editor" aria-label="Section Content Editor">
          <h2 style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "var(--bld-muted)" }}>
            Section Editor
          </h2>

          {activeSection ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              <div>
                <label
                  htmlFor="bld-sec-kind"
                  style={{ fontSize: "0.75rem", color: "var(--bld-muted)", display: "block", marginBottom: "4px" }}
                >
                  Section Kind:
                </label>
                <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{activeSection.kind}</div>
              </div>

              <div>
                <label
                  htmlFor="bld-sec-heading"
                  style={{ fontSize: "0.75rem", color: "var(--bld-muted)", display: "block", marginBottom: "4px" }}
                >
                  Heading:
                </label>
                <input
                  id="bld-sec-heading"
                  type="text"
                  className="bld-btn"
                  style={{ width: "100%", boxSizing: "border-box", textAlign: "left", cursor: "text" }}
                  value={activeSection.heading}
                  onChange={(e) => handleHeadingChange(e.target.value)}
                  aria-label="Section Heading"
                />
              </div>

              <div>
                <label
                  htmlFor="bld-sec-body"
                  style={{ fontSize: "0.75rem", color: "var(--bld-muted)", display: "block", marginBottom: "4px" }}
                >
                  Body Text:
                </label>
                <textarea
                  id="bld-sec-body"
                  className="bld-btn"
                  style={{ width: "100%", height: "120px", boxSizing: "border-box", textAlign: "left", cursor: "text", padding: "8px" }}
                  value={activeSection.body || ""}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  aria-label="Section Body"
                />
              </div>

              {activeSection.cta_label && (
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--bld-muted)" }}>CTA Button</div>
                  <div style={{ fontSize: "0.8125rem", marginTop: "4px" }}>
                    Label: <strong>{activeSection.cta_label}</strong> | Target: <code>{activeSection.cta_href}</code>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--bld-muted)" }}>Select a section to edit.</div>
          )}
        </section>

        {/* 3. Live Preview Canvas or Code Inspector */}
        <section className="bld-preview-canvas" aria-label="Static Preview Representation">
          {viewMode === "preview" ? (
            <div
              className="bld-preview-frame-container"
              style={{ width: viewportWidth }}
            >
              <iframe
                title="Static Website Preview"
                className="bld-preview-iframe"
                srcDoc={`<style>${compiled.css}</style>${compiled.html}`}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "var(--bld-muted)" }}>
                  index.html (Static Semantic Output)
                </h3>
                <pre
                  style={{
                    backgroundColor: "var(--bld-surface)",
                    padding: "16px",
                    borderRadius: "6px",
                    border: "1px solid var(--bld-border)",
                    overflowX: "auto",
                    maxHeight: "300px",
                    color: "var(--bld-text)",
                    fontSize: "0.8125rem",
                  }}
                >
                  {compiled.html}
                </pre>
              </div>

              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "var(--bld-muted)" }}>
                  styles.css (focus-visible + reduced-motion styles)
                </h3>
                <pre
                  style={{
                    backgroundColor: "var(--bld-surface)",
                    padding: "16px",
                    borderRadius: "6px",
                    border: "1px solid var(--bld-border)",
                    overflowX: "auto",
                    maxHeight: "250px",
                    color: "var(--bld-text)",
                    fontSize: "0.8125rem",
                  }}
                >
                  {compiled.css}
                </pre>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
