import { useState } from "react";
import { runTaskContinuationPipeline } from "../engine/continuation";
import { composePromptPackage, serializePromptPackage } from "../engine/packageComposer";
import { computeIntentDiff } from "../engine/intentDiff";
import type { TargetModelId } from "../engine/targetModelConfig";

interface Props {
  baselineSha?: string | null;
  onClose?: () => void;
}

const SAMPLE_PRESETS = [
  {
    name: "Distributed Saga Defect",
    task: "Build an event-driven saga transaction coordinator with reverse compensation and DLQ.",
    report: `Traceback (most recent call last):
  File "apps/worker/saga_runner.py", line 142, in process_step
    raise TypeError("Unrecognized event payload format: missing step_id")
TypeError: Unrecognized event payload format: missing step_id`,
    model: "claude" as TargetModelId,
  },
  {
    name: "Rust Lock Panic",
    task: "Implement safe lock-free memory reclamation in high-concurrency coordinator.",
    report: `thread 'worker-pool-2' panicked at 'assertion failed: lock.is_acquired()', src/sync/mutex.rs:88:12
note: run with RUST_BACKTRACE=1 environment variable to display a backtrace`,
    model: "codex" as TargetModelId,
  },
  {
    name: "TypeScript Type Mismatch",
    task: "Enforce strict Hoare-triple type invariants across execution contracts.",
    report: `src/engine/coordinator.ts:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.
45   timeoutMs: "3000",
                ~~~~~~`,
    model: "deepseek" as TargetModelId,
  },
];

export function TaskContinuationInspector({ baselineSha, onClose }: Props) {
  const [taskText, setTaskText] = useState(SAMPLE_PRESETS[0].task);
  const [reportText, setReportText] = useState(SAMPLE_PRESETS[0].report);
  const [selectedModel, setSelectedModel] = useState<TargetModelId>("claude");
  const [activeTab, setActiveTab] = useState<"review" | "graph" | "diff" | "package" | "prompt">("review");
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const activeSha = baselineSha || "aef95b835dd779673ee22bf80c51176db8b33d2c";

  // Run the full pipeline
  const pipelineResult = runTaskContinuationPipeline({
    taskId: "INSP-" + Date.now().toString(36),
    originalTask: taskText,
    targetAgent: selectedModel,
    agentReport: reportText,
    candidateSha: activeSha,
    authority: "REVIEW_ONLY",
    researchConsent: true,
  });

  const { gildenReview, claimEvidenceGraph, graphSummary } = pipelineResult;
  const { review, continuationContract, cycleState } = gildenReview;

  // Build the multi-stage package
  const pkg = composePromptPackage({
    k3CompiledPrompt: `## Role & Mandate\nYou are an expert systems engineer.\n\n## Instructions\nResolve task: ${taskText}`,
    category: "Coding & Systems",
    domainId: "coding",
    goal: taskText,
    depth: "DEEP",
    taskReportTelemetry: {
      rawOutput: reportText,
      modelTarget: selectedModel,
    },
    rawUserInput: taskText,
  });

  // Build semantic diff
  const intentDiffReport = computeIntentDiff(taskText, pkg);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(continuationContract.nextTaskPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadPackage = () => {
    try {
      const serialized = serializePromptPackage(pkg);
      const blob = new Blob([serialized], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spe-package-${pkg.manifest.packageId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch {
      // Error
    }
  };

  const verdictColor =
    review.verdict === "PASS"
      ? "#10b981"
      : review.verdict === "FAIL"
      ? "#ef4444"
      : "#f59e0b";

  return (
    <div
      className="spe-continuation-inspector"
      data-copy-depth="PROOF"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "1.5rem",
        backgroundColor: "var(--spe-surface, #131720)",
        color: "var(--spe-text, #f1f5f9)",
        borderRadius: "12px",
        border: "1px solid var(--spe-border, #242c3d)",
        fontFamily: "var(--spe-font, system-ui, sans-serif)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--spe-border, #242c3d)",
          paddingBottom: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.25rem" }}>🔬</span>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
              Task Review & Evidence Continuation Engine
            </h2>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.4)",
              }}
            >
              Waves RT-A—E Active
            </span>
          </div>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", opacity: 0.8 }}>
            Audits downstream AI reports, binds proof receipts, retrieves open specifications, and compiles calibrated continuation prompts.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
            aria-label="Close Task Review Inspector"
          >
            ✕
          </button>
        )}
      </div>

      {/* Preset Pickers */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>Quick Telemetry Presets:</span>
        {SAMPLE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => {
              setTaskText(preset.task);
              setReportText(preset.report);
              setSelectedModel(preset.model);
            }}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--spe-border, #242c3d)",
              background: taskText === preset.task ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
              color: taskText === preset.task ? "#93c5fd" : "inherit",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Inputs Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Original Task / Objective</label>
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "0.6rem",
              borderRadius: "6px",
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--spe-border, #242c3d)",
              color: "inherit",
              fontSize: "0.85rem",
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Downstream AI Output / Traceback Log
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>Target Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as TargetModelId)}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.2rem 0.4rem",
                  borderRadius: "4px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "inherit",
                  border: "1px solid var(--spe-border, #242c3d)",
                }}
              >
                <option value="claude">Claude Code</option>
                <option value="codex">OpenAI Codex</option>
                <option value="cursor">Cursor IDE</option>
                <option value="grok">Grok</option>
                <option value="deepseek">Qwen / DeepSeek</option>
                <option value="general">Generic Agent</option>
              </select>
            </div>
          </div>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "0.6rem",
              borderRadius: "6px",
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--spe-border, #242c3d)",
              color: "inherit",
              fontSize: "0.85rem",
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.03)",
            border: `1px solid ${verdictColor}`,
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Review Verdict</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: verdictColor }}>
            {review.verdict}
          </div>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--spe-border, #242c3d)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Material Coverage</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#60a5fa" }}>
            {Math.round(review.materialReportCoverage * 100)}%
          </div>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--spe-border, #242c3d)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Fidelity Score</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#34d399" }}>
            {intentDiffReport.metrics.fidelityScore}/100
          </div>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--spe-border, #242c3d)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Claims Verified</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
            {review.supportedClaimsCount} / {review.totalClaimsCount}
          </div>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--spe-border, #242c3d)",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Autonomous Loop</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#cbd5e1" }}>
            Cycle {cycleState.cycleCount}/{cycleState.maxCycles}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--spe-border, #242c3d)" }}>
        {[
          { id: "review", label: "📋 Verified Report" },
          { id: "graph", label: "🕸️ Claim-Evidence Graph" },
          { id: "diff", label: "⚖️ ProtectedIntent Diff" },
          { id: "package", label: "📦 .spe Package Manifest" },
          { id: "prompt", label: "⚡ Machine Continuation Prompt" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === tab.id ? "#60a5fa" : "inherit",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.2)",
          borderRadius: "8px",
          padding: "1rem",
          minHeight: "220px",
          maxHeight: "380px",
          overflowY: "auto",
        }}
      >
        {activeTab === "review" && (
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>Extracted Material Claims & Receipts</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {review.claims.map((claim) => (
                <div
                  key={claim.claimId}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderLeft: `4px solid ${
                      claim.disposition === "SUPPORTED"
                        ? "#10b981"
                        : claim.disposition === "CONTRADICTED"
                        ? "#ef4444"
                        : "#f59e0b"
                    }`,
                    fontSize: "0.85rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 600 }}>{claim.claimText}</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {claim.claimType} • {claim.disposition}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>{claim.verificationRationale}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "graph" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Peer-Reviewed Literature & Specification Grounding</h4>
              <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                {Object.keys(claimEvidenceGraph.claims).length} claims • {Object.keys(claimEvidenceGraph.sources).length} sources • {claimEvidenceGraph.edges.length} edges
              </span>
            </div>
            <pre
              style={{
                fontSize: "0.8rem",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {graphSummary.formattedGraphSummary}
            </pre>
          </div>
        )}

        {activeTab === "diff" && (
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>ProtectedIntent Differential Audit</h4>
            <pre
              style={{
                fontSize: "0.8rem",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {intentDiffReport.formattedReport}
            </pre>
          </div>
        )}

        {activeTab === "package" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
                Multi-Stage .spe Package ({pkg.manifest.totalWordCount} words across 8 modules)
              </h4>
              <button
                type="button"
                onClick={handleDownloadPackage}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  border: "none",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {downloadSuccess ? "✓ Downloaded" : "📥 Download .spe (JSON)"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {Object.entries(pkg.modules).map(([id, mod]) => (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "4px",
                    background: "rgba(255, 255, 255, 0.03)",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{id}</span>
                  <span style={{ opacity: 0.8 }}>{mod.wordCount} words</span>
                  <span style={{ opacity: 0.6, fontSize: "0.75rem" }}>SHA: {mod.sha256.slice(0, 16)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "prompt" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
                Next-Task Model Continuation Prompt ({selectedModel.toUpperCase()})
              </h4>
              <button
                type="button"
                onClick={handleCopyPrompt}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: copied ? "#10b981" : "#3b82f6",
                  color: "#fff",
                  border: "none",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Copied to Clipboard" : "📋 Copy Prompt"}
              </button>
            </div>
            <pre
              style={{
                fontSize: "0.8rem",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
                margin: 0,
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                padding: "0.75rem",
                borderRadius: "6px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {continuationContract.nextTaskPrompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
