import React, { useState, useRef, useEffect } from "react";
import {
  type ProjectLibraryBundle,
  SAMPLE_PROJECT_LIBRARY_BUNDLE,
  validateProjectLibraryBundle,
  ROUTE_MOUNT_STATUS,
} from "./projectLibraryModel";
import "./project-library.css";

export const ProjectLibraryView: React.FC = () => {
  const [bundle, setBundle] = useState<ProjectLibraryBundle>(
    SAMPLE_PROJECT_LIBRARY_BUNDLE
  );
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>(
    bundle.artifacts[0]?.artifact_id || ""
  );
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    bundle.artifacts[0]?.head_revision_id || ""
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);

  const importModalRef = useRef<HTMLDivElement>(null);
  const closeImportBtnRef = useRef<HTMLButtonElement>(null);
  const importTriggerBtnRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation & modal focus trap
  useEffect(() => {
    if (!isImportModalOpen) return;

    closeImportBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsImportModalOpen(false);
        importTriggerBtnRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && importModalRef.current) {
        const focusables = importModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImportModalOpen]);

  // Filter artifacts
  const filteredArtifacts =
    typeFilter === "all"
      ? bundle.artifacts
      : bundle.artifacts.filter((a) => a.artifact_type === typeFilter);

  const activeArtifact = bundle.artifacts.find(
    (a) => a.artifact_id === selectedArtifactId
  );

  // Get revisions for the selected artifact
  const artifactRevisions = bundle.revisions.filter(
    (r) => r.artifact_id === selectedArtifactId
  );

  // Get history items (including rollbacks) for the selected artifact
  const artifactHistory = bundle.history.filter(
    (h) => h.artifact_id === selectedArtifactId
  );

  // Find currently inspected revision
  const activeRevision = bundle.revisions.find(
    (r) => r.revision_id === selectedRevisionId
  );

  // Export Bundle as JSON download
  const handleExport = () => {
    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-library-${bundle.project.project_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON Bundle
  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const { valid, errors } = validateProjectLibraryBundle(parsed);
      if (!valid) {
        setImportError(`Validation failed: ${errors.join("; ")}`);
        return;
      }
      setBundle(parsed as ProjectLibraryBundle);
      setSelectedArtifactId(parsed.artifacts[0]?.artifact_id || "");
      setSelectedRevisionId(parsed.artifacts[0]?.head_revision_id || "");
      setIsImportModalOpen(false);
      setImportError(null);
      setImportJsonText("");
      importTriggerBtnRef.current?.focus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setImportError(`Invalid JSON: ${message}`);
    }
  };

  return (
    <div
      className="spe-lib-container"
      data-route-mount={ROUTE_MOUNT_STATUS}
      role="region"
      aria-label="SPE Project Library"
    >
      {/* Header */}
      <header className="spe-lib-header">
        <div className="spe-lib-title-row">
          <div>
            <h1 className="spe-lib-title">{bundle.project.name}</h1>
            <div className="spe-lib-meta-row">
              <span>Project ID: <code>{bundle.project.project_id}</code></span>
              <span>Created: {new Date(bundle.project.created_at).toLocaleString()}</span>
              <span>Artifacts: {bundle.artifacts.length}</span>
              <span>Revisions: {bundle.revisions.length}</span>
            </div>
          </div>

          <div className="spe-lib-badges">
            <span
              className="spe-lib-badge spe-lib-badge-private"
              aria-label="Visibility: Private"
            >
              🔒 {bundle.visibility}
            </span>
            <span
              className="spe-lib-badge spe-lib-badge-noindex"
              aria-label="Search indexing: noindex"
            >
              🚫 {bundle.indexing}
            </span>
            <span
              className="spe-lib-badge spe-lib-badge-unbound"
              aria-label="SPE Contract Status: NOT_YET_BOUND"
            >
              ⚙️ {bundle.spe_contract}
            </span>
          </div>

          <div className="spe-lib-actions">
            <button
              ref={importTriggerBtnRef}
              type="button"
              className="spe-lib-btn"
              onClick={() => setIsImportModalOpen(true)}
              aria-label="Import Project Library Bundle"
            >
              Import Bundle
            </button>
            <button
              type="button"
              className="spe-lib-btn spe-lib-btn-primary"
              onClick={handleExport}
              aria-label="Export Project Library Bundle JSON"
            >
              Export Bundle JSON
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid: Sidebar, Timeline, Inspector */}
      <main className="spe-lib-content">
        {/* 1. Artifacts Sidebar */}
        <aside className="spe-lib-sidebar" aria-label="Artifacts List">
          <h2 className="spe-lib-section-title">Artifacts</h2>

          <div style={{ marginBottom: "12px" }}>
            <label
              htmlFor="spe-artifact-filter"
              style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)", display: "block", marginBottom: "4px" }}
            >
              Filter by Type:
            </label>
            <select
              id="spe-artifact-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="spe-lib-btn"
              style={{ width: "100%", padding: "0 8px" }}
              aria-label="Filter artifacts by type"
            >
              <option value="all">All Types ({bundle.artifacts.length})</option>
              <option value="prompt">Prompt</option>
              <option value="transcript">Transcript</option>
              <option value="website">Website</option>
              <option value="code">Code</option>
              <option value="research_pack">Research Pack</option>
              <option value="template">Template</option>
            </select>
          </div>

          <div className="spe-lib-artifact-list" role="listbox" aria-label="Artifacts">
            {filteredArtifacts.map((art) => {
              const isSelected = art.artifact_id === selectedArtifactId;
              return (
                <div
                  key={art.artifact_id}
                  className={`spe-lib-artifact-card ${isSelected ? "active" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => {
                    setSelectedArtifactId(art.artifact_id);
                    setSelectedRevisionId(art.head_revision_id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedArtifactId(art.artifact_id);
                      setSelectedRevisionId(art.head_revision_id);
                    }
                  }}
                  aria-label={`Artifact ${art.artifact_id} of type ${art.artifact_type}`}
                >
                  <span className="spe-lib-type-badge">{art.artifact_type}</span>
                  <div style={{ fontSize: "0.8125rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {art.artifact_id}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)", marginTop: "4px" }}>
                    HEAD: {art.head_revision_id.substring(0, 12)}...
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 2. Timeline Panel */}
        <section className="spe-lib-main" aria-label="Revision Timeline">
          <h2 className="spe-lib-section-title">
            Revisions & History: {activeArtifact?.artifact_type} ({artifactRevisions.length} Revisions)
          </h2>

          <div className="spe-lib-timeline">
            {artifactHistory.map((item, idx) => {
              if (item.kind === "HEAD_MOVE") {
                return (
                  <div
                    key={`headmove-${idx}`}
                    className="spe-lib-history-item rollback"
                    role="alert"
                    aria-label={`Rollback event to revision ${item.revision_id}`}
                  >
                    <div className="spe-lib-rollback-banner">
                      ⚠️ HEAD MOVE: {item.reason}
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      Rolled back HEAD pointer to revision: <code>{item.revision_id}</code>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)", marginTop: "4px" }}>
                      Timestamp: {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              }

              const isSelected = item.revision_id === selectedRevisionId;
              const isHead = item.revision_id === activeArtifact?.head_revision_id;

              return (
                <div
                  key={item.revision_id}
                  className={`spe-lib-history-item ${isSelected ? "active" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedRevisionId(item.revision_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedRevisionId(item.revision_id);
                    }
                  }}
                  aria-label={`Revision ${item.revision_id} label ${item.version_label || "unlabeled"}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                        {item.version_label || "Revision"}
                      </span>
                      {isHead && (
                        <span style={{ fontSize: "0.6875rem", padding: "2px 6px", borderRadius: "4px", background: "var(--spe-lib-accent)", color: "#fff", fontWeight: 700 }}>
                          HEAD
                        </span>
                      )}
                      {item.branched && (
                        <span style={{ fontSize: "0.6875rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", color: "var(--spe-lib-muted)" }}>
                          Branched
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.8125rem", fontFamily: "monospace", marginTop: "6px", color: "var(--spe-lib-muted)" }}>
                    ID: {item.revision_id}
                  </div>

                  {item.parent_revision_id && (
                    <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)", marginTop: "2px" }}>
                      Parent: <code>{item.parent_revision_id}</code>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "0.75rem" }}>
                    {item.provider_target && (
                      <span>🎯 <strong>Target:</strong> {item.provider_target}</span>
                    )}
                    <span>🔗 <strong>Provenance:</strong> {item.provenance_refs.length} refs</span>
                    <span>🛡️ <strong>Evidence:</strong> {item.quality_evidence_refs.length} refs</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Inspector Panel */}
        <aside className="spe-lib-inspector" aria-label="Revision Inspector">
          <h2 className="spe-lib-section-title">Revision Details</h2>

          {activeRevision ? (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>Revision ID</div>
                  <code style={{ fontSize: "0.8125rem" }}>{activeRevision.revision_id}</code>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>Artifact ID & Type</div>
                  <div>
                    <span className="spe-lib-type-badge">{activeRevision.artifact_type}</span>
                    <code style={{ fontSize: "0.8125rem", display: "block" }}>{activeRevision.artifact_id}</code>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>File fingerprint</div>
                  <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{activeRevision.body_sha256}</code>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>Provider Target</div>
                  <div style={{ fontWeight: 600 }}>{activeRevision.provider_target || "None"}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>Provenance References</div>
                  <div className="spe-lib-chip-list">
                    {activeRevision.provenance_refs.length > 0 ? (
                      activeRevision.provenance_refs.map((ref, idx) => (
                        <span key={idx} className="spe-lib-chip">{ref}</span>
                      ))
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>None</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>Quality Evidence References</div>
                  <div className="spe-lib-chip-list">
                    {activeRevision.quality_evidence_refs.length > 0 ? (
                      activeRevision.quality_evidence_refs.map((ref, idx) => (
                        <span key={idx} className="spe-lib-chip" style={{ color: "var(--spe-lib-success)" }}>
                          {ref}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>None</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--spe-lib-muted)" }}>Revision Body</div>
                  <pre className="spe-lib-body-viewer">
                    {typeof activeRevision.body === "string"
                      ? activeRevision.body
                      : JSON.stringify(activeRevision.body, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--spe-lib-muted)", fontSize: "0.875rem" }}>
              Select a revision from the timeline to inspect its details.
            </div>
          )}
        </aside>
      </main>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="spe-lib-modal-overlay" role="presentation">
          <div
            ref={importModalRef}
            className="spe-lib-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spe-import-modal-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 id="spe-import-modal-title" style={{ margin: 0, fontSize: "1.25rem" }}>
                Import Project Library Bundle
              </h2>
              <button
                ref={closeImportBtnRef}
                type="button"
                className="spe-lib-btn"
                style={{ minHeight: "36px", padding: "0 12px" }}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                  importTriggerBtnRef.current?.focus();
                }}
                aria-label="Close Import Dialog"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "var(--spe-lib-muted)" }}>
              Paste a valid <code>spe.project-library.v1</code> JSON bundle. Local private parsing only (no network transfer).
            </p>

            {importError && (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "var(--spe-lib-danger)",
                  fontSize: "0.8125rem",
                  marginBottom: "12px",
                }}
                role="alert"
              >
                {importError}
              </div>
            )}

            <textarea
              className="spe-lib-body-viewer"
              style={{ width: "100%", height: "200px", boxSizing: "border-box" }}
              placeholder='Paste {"schema": "spe.project-library.v1", ...} here'
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              aria-label="Project Library Bundle JSON"
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
              <button
                type="button"
                className="spe-lib-btn"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                  importTriggerBtnRef.current?.focus();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="spe-lib-btn spe-lib-btn-primary"
                onClick={handleImport}
              >
                Validate & Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
