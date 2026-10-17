import React, { useState, useRef } from "react";
import {
  CODE_TARGETS,
  CODE_TARGET_LABELS,
  type CodeTarget,
  screenshotToCodePackage,
} from "./screenshotToCode";
import { observeImageFile } from "./imageObserve";
import type { ImageObservation } from "./types";
import "./visual-workspace.css";

export type VisualWorkspaceMode = "screenshot_to_code" | "visual_evidence";

export interface VisualTruthReceipt {
  ocrStatus: "OBSERVED" | "UNKNOWN";
  assetsStatus: "FOUND" | "INFERRED" | "UNKNOWN";
  responsiveStatus: "OBSERVED" | "INFERRED" | "UNKNOWN";
  fidelityStatus: "MEASURED" | "UNPROVEN";
  measuredConfidencePercent?: number;
}

// Contract-mandated truth states:
// OCR: OBSERVED / UNKNOWN
// assets: FOUND / INFERRED / UNKNOWN
// responsive: OBSERVED / INFERRED / UNKNOWN
// fidelity: MEASURED / UNPROVEN

export const VisualScreenshotWorkspace: React.FC = () => {
  const [activeMode, setActiveMode] = useState<VisualWorkspaceMode>("screenshot_to_code");
  const [selectedTarget, setSelectedTarget] = useState<CodeTarget>("react");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageObs, setImageObs] = useState<ImageObservation | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verifiable Truth Receipt (never claims false pixel perfection)
  const truthReceipt: VisualTruthReceipt = {
    ocrStatus: "UNKNOWN",
    assetsStatus: imageObs ? "INFERRED" : "UNKNOWN",
    responsiveStatus: "INFERRED",
    // Fidelity is UNPROVEN until live pixel-level rendering comparison is executed
    fidelityStatus: "UNPROVEN",
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const previewUrl = URL.createObjectURL(file);
    setImageSrc(previewUrl);
    setIsProcessing(true);

    try {
      const obs = await observeImageFile(file);
      setImageObs(obs);
      const pkg = screenshotToCodePackage(obs);
      const scaffold = pkg.scaffolds.find((s) => s.target === selectedTarget) || pkg.scaffolds[0];
      if (scaffold) {
        setGeneratedCode(scaffold.code);
      }
    } catch {
      // Fallback
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTargetChange = (target: CodeTarget) => {
    setSelectedTarget(target);
    if (imageObs) {
      const pkg = screenshotToCodePackage(imageObs);
      const scaffold = pkg.scaffolds.find((s) => s.target === target) || pkg.scaffolds[0];
      if (scaffold) {
        setGeneratedCode(scaffold.code);
      }
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="spe-visual-workspace" aria-labelledby="spe-visual-title">
      <header className="spe-visual-header">
        <h1 id="spe-visual-title">Visual & Screenshot Intelligence</h1>
        <p>
          Browser pixel sampling and inferred starter scaffolds.
          OCR, target compilation, and visual fidelity are not verified here.
        </p>
      </header>

      {/* Mode Switcher */}
      <nav className="spe-visual-mode-bar" aria-label="Visual Intelligence Modes">
        <button
          type="button"
          className={`spe-visual-mode-btn ${activeMode === "screenshot_to_code" ? "active" : ""}`}
          aria-pressed={activeMode === "screenshot_to_code"}
          onClick={() => setActiveMode("screenshot_to_code")}
        >
          Screenshot to Code
        </button>
        <button
          type="button"
          className={`spe-visual-mode-btn ${activeMode === "visual_evidence" ? "active" : ""}`}
          aria-pressed={activeMode === "visual_evidence"}
          onClick={() => setActiveMode("visual_evidence")}
        >
          Visual Evidence Inspector
        </button>
      </nav>

      {/* Main Inspection Grid */}
      <div className="spe-visual-grid">
        {/* Left: Image / Screenshot Input & Truth Receipt */}
        <section className="spe-visual-card" aria-label="Image Reference Input">
          <h2>Reference Image</h2>

          {!imageSrc ? (
            <div
              className="spe-visual-dropzone"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload screenshot or UI image"
            >
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📷</div>
              <strong style={{ color: "#ffffff" }}>
                Click to choose a UI screenshot
              </strong>
              <span style={{ fontSize: "0.8125rem", color: "var(--spe-vis-muted)", marginTop: "4px" }}>
                PNG, JPEG, WebP up to 25 MiB and 40 megapixels. Browser pixel sampling only.
              </span>
            </div>
          ) : (
            <div className="spe-visual-preview-frame">
              <img
                src={imageSrc}
                alt="Uploaded reference UI"
                className="spe-visual-preview-img"
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            aria-label="File upload"
          />

          {imageSrc && (
            <button
              type="button"
              className="spe-vis-btn secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace Image
            </button>
          )}

          {/* Verifiable Truth Receipt (Strictly Mandated Truth Labels) */}
          <div className="spe-truth-receipt" aria-label="Observation disclosures">
            <div className="spe-truth-receipt-header">Evidence Disclosure Ledger</div>
            <div className="spe-truth-pills-row">
              <span className={`spe-truth-pill ${truthReceipt.ocrStatus.toLowerCase()}`}>
                OCR: {truthReceipt.ocrStatus} (OBSERVED / UNKNOWN)
              </span>
              <span className={`spe-truth-pill ${truthReceipt.assetsStatus.toLowerCase()}`}>
                assets: {truthReceipt.assetsStatus} (FOUND / INFERRED / UNKNOWN)
              </span>
              <span className={`spe-truth-pill ${truthReceipt.responsiveStatus.toLowerCase()}`}>
                responsive: {truthReceipt.responsiveStatus} (OBSERVED / INFERRED / UNKNOWN)
              </span>
              <span className={`spe-truth-pill ${truthReceipt.fidelityStatus.toLowerCase()}`}>
                fidelity: {truthReceipt.fidelityStatus} (MEASURED / UNPROVEN)
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--spe-vis-muted)", margin: 0, lineHeight: 1.4 }}>
              * Honest boundary: Visual fidelity remains UNPROVEN until measured against rendered browser DOM.
              No artificial guarantees or synthetic pixel metrics.
            </p>
          </div>
        </section>

        {/* Right: Target Selector & Code Output */}
        <section className="spe-visual-card" aria-label="Generated Code & Spec">
          <h2>Compiler Target Output</h2>

          {/* Canonical Target Selector */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--spe-vis-muted)", marginBottom: "8px" }}>
              Select Framework Target
            </div>
            <div className="spe-target-selector-bar" role="tablist" aria-label="Compiler Targets">
              {CODE_TARGETS.map((target) => {
                const isSelected = selectedTarget === target;
                return (
                  <button
                    key={target}
                    type="button"
                    role="tab"
                    className={`spe-target-chip ${isSelected ? "active" : ""}`}
                    aria-selected={isSelected}
                    onClick={() => handleTargetChange(target)}
                  >
                    {CODE_TARGET_LABELS[target]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Output Box */}
          <pre
            className="spe-code-output-box"
            tabIndex={0}
            aria-label="Synthesized component code"
          >
            {isProcessing
              ? "// Analyzing image layout and extracting UI regions..."
              : generatedCode ||
                `// Upload an image or screenshot to synthesize ${CODE_TARGET_LABELS[selectedTarget]} starter scaffolds.\n// Regions are inferred from coarse pixel summaries; text, fonts, interactions, and fidelity are unproven.`}
          </pre>

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              className="spe-vis-btn primary"
              disabled={!generatedCode || isProcessing}
              onClick={handleCopyCode}
              aria-label="Copy generated code to clipboard"
            >
              {copied ? "✓ Copied to Clipboard" : "Copy Code"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};
