import React, { useState, useEffect, useRef } from "react";
import {
  type WorkflowPlatform,
  type PromptExportInput,
  generateWorkflowExport,
} from "./workflowExporters";
import "./workflow-export.css";

export interface WorkflowExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportInput: PromptExportInput;
}

const PLATFORM_OPTIONS: Array<{ id: WorkflowPlatform; label: string; badge: string }> = [
  { id: "n8n", label: "n8n", badge: "Workflow v1.7" },
  { id: "make", label: "Make", badge: "Blueprint v1" },
  { id: "zapier", label: "Zapier", badge: "Template 2026" },
  { id: "generic", label: "Generic", badge: "Pipeline JSON" },
];

export const WorkflowExportModal: React.FC<WorkflowExportModalProps> = ({
  isOpen,
  onClose,
  exportInput,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<WorkflowPlatform>("n8n");
  const [copied, setCopied] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const receipt = generateWorkflowExport(selectedPlatform, exportInput);

  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.exportPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([receipt.exportPayload], { type: receipt.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = receipt.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="spe-workflow-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="spe-workflow-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spe-workflow-modal-title"
      >
        {/* Header */}
        <header className="spe-workflow-modal-header">
          <h2 id="spe-workflow-modal-title" className="spe-workflow-modal-title">
            Export Prompt Workflow
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="spe-workflow-close-btn"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            ✕
          </button>
        </header>

        {/* Platform Tabs */}
        <nav
          className="spe-workflow-platforms-bar"
          role="tablist"
          aria-label="Target Workflow Platforms"
        >
          {PLATFORM_OPTIONS.map((plat) => {
            const isSelected = selectedPlatform === plat.id;
            return (
              <button
                key={plat.id}
                type="button"
                role="tab"
                className={`spe-workflow-tab ${isSelected ? "active" : ""}`}
                aria-selected={isSelected}
                aria-label={`${plat.label} export format`}
                onClick={() => {
                  setSelectedPlatform(plat.id);
                  setCopied(false);
                }}
              >
                <span>{plat.label}</span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: isSelected ? "var(--spe-export-accent)" : "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                  }}
                >
                  {plat.badge}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Body Content */}
        <div className="spe-workflow-stage">
          {/* Preservation & Degradation Receipt Card */}
          <section className="spe-receipt-card" aria-label="Preservation and degradation audit">
            <header className="spe-receipt-header">
              <div className="spe-receipt-title">
                <span>Preservation & Degradation Receipt</span>
              </div>
              <span className="spe-fidelity-badge">
                Fidelity Score: {Math.round(receipt.losslessnessScore * 100)}%
              </span>
            </header>

            {/* Preserved Fields */}
            <div className="spe-receipt-section">
              <div className="spe-receipt-label">Preserved Fields</div>
              <div className="spe-badge-list">
                {receipt.preservedFields.map((f, idx) => (
                  <span key={idx} className="spe-pill preserved">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Transformed Fields */}
            {receipt.transformedFields.length > 0 && (
              <div className="spe-receipt-section">
                <div className="spe-receipt-label">Transformed Fields</div>
                <div className="spe-badge-list">
                  {receipt.transformedFields.map((tf, idx) => (
                    <span
                      key={idx}
                      className="spe-pill transformed"
                      title={`${tf.field}: ${tf.from} → ${tf.to} (${tf.explanation})`}
                    >
                      ⇄ {tf.field} ({tf.explanation})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unsupported Fields */}
            {receipt.unsupportedFields.length > 0 && (
              <div className="spe-receipt-section">
                <div className="spe-receipt-label">Unsupported Fields (Target Platform Boundary)</div>
                <div className="spe-badge-list">
                  {receipt.unsupportedFields.map((uf, idx) => (
                    <span
                      key={idx}
                      className="spe-pill unsupported"
                      title={`${uf.field}: ${uf.reason}`}
                    >
                      ⚠ {uf.field}: {uf.reason}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Steps Required */}
            <div className="spe-receipt-section" style={{ marginBottom: 0 }}>
              <div className="spe-receipt-label">Manual Steps Required in {selectedPlatform.toUpperCase()}</div>
              <ol className="spe-steps-list">
                {receipt.manualStepsRequired.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          </section>

          {/* Code Payload Preview */}
          <section aria-label="Workflow Payload Preview">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <span className="spe-receipt-label">Export Payload Preview</span>
              <span style={{ fontSize: "0.75rem", color: "var(--spe-export-muted)" }}>
                {receipt.filename}
              </span>
            </div>
            <pre className="spe-payload-preview" tabIndex={0} aria-label="Export code preview">
              {receipt.exportPayload}
            </pre>
          </section>
        </div>

        {/* Footer Actions */}
        <footer className="spe-workflow-modal-footer">
          <button
            type="button"
            className="spe-export-action-btn secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="spe-export-action-btn secondary"
            onClick={handleCopy}
            aria-label="Copy payload to clipboard"
          >
            {copied ? "✓ Copied to Clipboard" : "Copy Payload"}
          </button>
          <button
            type="button"
            className="spe-export-action-btn primary"
            onClick={handleDownload}
            aria-label={`Download ${receipt.filename}`}
          >
            Download {receipt.filename.endsWith(".json") ? "JSON" : "File"}
          </button>
        </footer>
      </div>
    </div>
  );
};
