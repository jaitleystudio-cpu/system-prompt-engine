import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LIVE_IMPORT_STATUS,
  RUNTIME_BINDING,
  presentExportDocument,
  type WorkflowExportView,
} from "./workflowExportViewModel";
import "./workflow-export.css";

export interface WorkflowExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Already-produced spe.workflow-export.v1 documents. Empty means the runtime is not bound. */
  documents: readonly unknown[];
}

interface ReadyDocument {
  view: WorkflowExportView;
}

interface RejectedDocument {
  status: "REFUSE" | "UNKNOWN";
  reason: string;
}

export const WorkflowExportModal: React.FC<WorkflowExportModalProps> = ({
  isOpen,
  onClose,
  documents,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const presented = useMemo(() => {
    const ready: ReadyDocument[] = [];
    const rejected: RejectedDocument[] = [];
    for (const document of documents) {
      const result = presentExportDocument(document);
      if (result.ok) ready.push({ view: result.view });
      else rejected.push({ status: result.status, reason: result.reason });
    }
    return { ready, rejected };
  }, [documents]);

  const selected =
    presented.ready.find((item) => item.view.target === selectedTarget) ??
    presented.ready[0] ??
    null;

  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyDocument = async (view: WorkflowExportView) => {
    try {
      await navigator.clipboard.writeText(view.targetDocumentText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const downloadDocument = (view: WorkflowExportView) => {
    const blob = new Blob([view.targetDocumentText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = view.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="spe-workflow-modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="spe-workflow-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spe-workflow-modal-title"
      >
        <header className="spe-workflow-modal-header">
          <h2 id="spe-workflow-modal-title" className="spe-workflow-modal-title">
            Export receipt
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="spe-workflow-close-btn"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            Close
          </button>
        </header>

        <p className="spe-receipt-label">
          Live import status: {LIVE_IMPORT_STATUS}. Runtime binding: {RUNTIME_BINDING}.
        </p>

        {presented.ready.length === 0 ? (
          <div className="spe-workflow-stage">
            <p>No workflow export document was supplied. This screen does not build one.</p>
          </div>
        ) : (
          <>
            <nav className="spe-workflow-platforms-bar" role="tablist" aria-label="Supplied export documents">
              {presented.ready.map((item) => {
                const isSelected = selected?.view.target === item.view.target;
                return (
                  <button
                    key={item.view.target}
                    type="button"
                    role="tab"
                    className={`spe-workflow-tab ${isSelected ? "active" : ""}`}
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedTarget(item.view.target);
                      setCopied(false);
                    }}
                  >
                    <span>{item.view.target}</span>
                    <span className="spe-fidelity-badge">{item.view.lossState}</span>
                  </button>
                );
              })}
            </nav>

            {selected ? (
              <ExportReceipt
                view={selected.view}
                copied={copied}
                onCopy={() => void copyDocument(selected.view)}
                onDownload={() => downloadDocument(selected.view)}
                onClose={onClose}
              />
            ) : null}
          </>
        )}

        {presented.rejected.length > 0 ? (
          <section className="spe-workflow-stage" aria-label="Rejected export documents">
            <div className="spe-receipt-label">Rejected documents</div>
            <ul className="spe-steps-list">
              {presented.rejected.map((item) => (
                <li key={`${item.status}:${item.reason}`}>
                  {item.status}: {item.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
};

function ExportReceipt({
  view,
  copied,
  onCopy,
  onDownload,
  onClose,
}: {
  view: WorkflowExportView;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="spe-workflow-stage">
        <section className="spe-receipt-card" aria-label="Workflow export receipt">
          <header className="spe-receipt-header">
            <div className="spe-receipt-title">
              <span>{view.target}</span>
            </div>
            <span className="spe-fidelity-badge">Loss state: {view.lossState}</span>
          </header>

          <div className="spe-receipt-section">
            <div className="spe-receipt-label">Fidelity ledger</div>
            <div className="spe-badge-list">
              {view.fidelity.map((entry) => (
                <span key={entry.facet} className="spe-pill preserved" title={entry.reason}>
                  {entry.facet}: {entry.state}
                </span>
              ))}
            </div>
          </div>

          {view.warnings.length > 0 ? (
            <div className="spe-receipt-section">
              <div className="spe-receipt-label">Warnings</div>
              <ul className="spe-steps-list">
                {view.warnings.map((warning) => (
                  <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="spe-receipt-section">
            <div className="spe-receipt-label">Stripped paths</div>
            {view.strippedPaths.length === 0 ? (
              <p>None recorded.</p>
            ) : (
              <div className="spe-badge-list">
                {view.strippedPaths.map((path) => (
                  <span key={path} className="spe-pill unsupported">
                    {path}
                  </span>
                ))}
              </div>
            )}
          </div>

          {view.strippedVariableNames.length > 0 ? (
            <div className="spe-receipt-section">
              <div className="spe-receipt-label">Stripped variables</div>
              <div className="spe-badge-list">
                {view.strippedVariableNames.map((name) => (
                  <span key={name} className="spe-pill unsupported">
                    {name}: withheld
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="spe-receipt-section">
            <div className="spe-receipt-label">Prompt</div>
            <p>
              {view.promptDisposition === "WITHHELD_CREDENTIAL"
                ? "Prompt withheld. The value is not shown."
                : view.promptPreview}
            </p>
          </div>
        </section>

        <section aria-label="Target document preview">
          <div className="spe-receipt-label">Target document</div>
          <pre className="spe-payload-preview" tabIndex={0}>
            {view.previewText}
          </pre>
        </section>
      </div>

      <footer className="spe-workflow-modal-footer">
        <button type="button" className="spe-export-action-btn secondary" onClick={onClose}>
          Close
        </button>
        <button type="button" className="spe-export-action-btn secondary" onClick={onCopy}>
          {copied ? "Copied" : "Copy target document"}
        </button>
        <button type="button" className="spe-export-action-btn primary" onClick={onDownload}>
          Download JSON
        </button>
      </footer>
    </>
  );
}
