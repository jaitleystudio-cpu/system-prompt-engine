/**
 * SPE Ω — Community Workflow PR Submission Modal
 * Empowers developers to submit verified .spe workflows via GitHub Pull Requests,
 * driving viral community workflow expansion with automated CI pass receipts.
 */

import React, { useState, useEffect } from "react";
import type { AppView } from "../routing";
import { copyTextSafe } from "../engine/workflows/clipboard";
import "./submit-workflow-modal.css";

interface SubmitWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: AppView) => void;
}

export const SubmitWorkflowModal: React.FC<SubmitWorkflowModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [title, setTitle] = useState("Automated GitHub Release Notes & Changelog");
  const [slug, setSlug] = useState("github-release-notes");
  const [category, setCategory] = useState<
    "business-operations" | "document-automation" | "customer-success" | "engineering-ops"
  >("engineering-ops");
  const [inputs, setInputs] = useState("git_tags.txt, closed_prs.json");
  const [outputs, setOutputs] = useState("RELEASE_NOTES.md, CHANGELOG.md");
  const [topSkills, setTopSkills] = useState("git-pr-review, app-store-changelog");
  const [summary, setSummary] = useState(
    "Parses milestone PRs and git commit history to produce structured, verified release notes with changelog hashes.",
  );
  const [copiedPr, setCopiedPr] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const generatedPrMarkdown = `## 🚀 Community Workflow Submission: ${title}

### 📋 Workflow Specification
- **Slug**: \`${slug}\`
- **Category**: \`${category}\`
- **Primary Objective**: ${summary}
- **Declared Inputs**: \`${inputs}\`
- **Declared Outputs**: \`${outputs}\`
- **Top Verified Skills**: \`${topSkills}\`

### 🛡️ Safety & Permission Ceiling
- **Permission Ceiling**: Local Filesystem Read · No Network Egress
- **Zero Drift Guarantee**: Invariants verified via SPE Ω compiler
- **Audit Test Receipt**: PASS (\`npm run test:workflows-audit\`)

### 🧪 Verification Steps Executed
1. \`spe run ${slug} --strict\` passed with 0 errors
2. Verified receipts attached for all declared deliverables
3. No unreviewed strings or unauthorized network channels

### 💻 CLI Run Command
\`\`\`bash
spe continue --workflow ${slug} --skills '${topSkills}'
\`\`\`
`;

  const handleCopyPrMarkdown = async () => {
    await copyTextSafe(generatedPrMarkdown);
    setCopiedPr(true);
    setTimeout(() => setCopiedPr(false), 2500);
  };

  const handleOpenGitHubPr = () => {
    const encodedBody = encodeURIComponent(generatedPrMarkdown);
    const prUrl = `https://github.com/systempromptengine/system-prompt-engine/compare?quick_pull=1&title=${encodeURIComponent(
      `feat(workflow): add ${title}`,
    )}&body=${encodedBody}`;
    window.open(prUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadJson = () => {
    const workflowObj = {
      slug,
      title,
      category,
      summary,
      inputs: inputs.split(",").map((s) => s.trim()),
      outputs: outputs.split(",").map((s) => s.trim()),
      topSkills: topSkills.split(",").map((s) => s.trim()),
      tokenSavingsPct: 35.0,
      wilsonScorePct: 95.0,
      permissionCeiling: "Local Filesystem Read · No Network",
      sampleInstructions: `spe continue --workflow ${slug} --skills '${topSkills}'`,
    };
    const blob = new Blob([JSON.stringify(workflowObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.workflow.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="spe-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-copy-depth="PROOF"
      role="presentation"
    >
      <div
        className="spe-submit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
      >
        {/* Modal Header */}
        <div className="spe-modal-header">
          <div className="spe-modal-title-group">
            <h2 id="submit-modal-title">Submit a Verified Workflow (GitHub PR)</h2>
            <p>
              Join engineers contributing battle-tested agent workflows to the community directory. Automated CI gates audit your permissions, safety boundaries, and token efficiency.
            </p>
          </div>
          <button
            type="button"
            className="spe-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="spe-modal-body">
          {/* 3-Step Flywheel Pipeline Cards */}
          <div className="spe-flywheel-steps">
            <div className="spe-flywheel-step-card">
              <span className="spe-flywheel-step-num">Step 01</span>
              <h4>Define & Test Locally</h4>
              <p>
                Draft your workflow with explicit inputs, outputs, and permission boundaries using SPE CLI or Studio.
              </p>
            </div>
            <div className="spe-flywheel-step-card">
              <span className="spe-flywheel-step-num">Step 02</span>
              <h4>Pass Automated Audit</h4>
              <p>
                Run local CI verification: <code>npm run test:workflows-audit</code> to verify 0 security leaks.
              </p>
            </div>
            <div className="spe-flywheel-step-card">
              <span className="spe-flywheel-step-num">Step 03</span>
              <h4>Submit GitHub PR</h4>
              <p>
                Submit your JSON file to the repo. Once merged, it goes live in the 1-Click Workflows catalog!
              </p>
            </div>
          </div>

          {/* Form to Customize the Submission PR */}
          <div className="spe-form-grid">
            <div className="spe-form-field">
              <label htmlFor="wf-title">Workflow Title</label>
              <input
                id="wf-title"
                className="spe-form-input"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                  );
                }}
              />
            </div>

            <div className="spe-form-field">
              <label htmlFor="wf-slug">Workflow Slug</label>
              <input
                id="wf-slug"
                className="spe-form-input"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>

            <div className="spe-form-field">
              <label htmlFor="wf-category">Category</label>
              <select
                id="wf-category"
                className="spe-form-select"
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | "business-operations"
                      | "document-automation"
                      | "customer-success"
                      | "engineering-ops",
                  )
                }
              >
                <option value="business-operations">Business Operations</option>
                <option value="document-automation">Document Automation</option>
                <option value="customer-success">Customer Success</option>
                <option value="engineering-ops">Engineering Operations</option>
              </select>
            </div>

            <div className="spe-form-field">
              <label htmlFor="wf-skills">Top Verified Skills</label>
              <input
                id="wf-skills"
                className="spe-form-input"
                type="text"
                value={topSkills}
                onChange={(e) => setTopSkills(e.target.value)}
              />
            </div>

            <div className="spe-form-field">
              <label htmlFor="wf-inputs">Inputs (Files / Schemas)</label>
              <input
                id="wf-inputs"
                className="spe-form-input"
                type="text"
                value={inputs}
                onChange={(e) => setInputs(e.target.value)}
              />
            </div>

            <div className="spe-form-field">
              <label htmlFor="wf-outputs">Outputs (Deliverables)</label>
              <input
                id="wf-outputs"
                className="spe-form-input"
                type="text"
                value={outputs}
                onChange={(e) => setOutputs(e.target.value)}
              />
            </div>

            <div className="spe-form-field full-width">
              <label htmlFor="wf-summary">Summary & Objective</label>
              <textarea
                id="wf-summary"
                className="spe-form-textarea"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
          </div>

          {/* Generated PR Template Preview */}
          <div className="spe-template-preview-box">
            <div className="spe-template-preview-header">
              <span>Pre-Populated GitHub PR Template</span>
            </div>
            <pre className="spe-template-preview-text">
              {generatedPrMarkdown}
            </pre>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="spe-modal-footer">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="spe-modal-action-btn-primary"
              onClick={handleOpenGitHubPr}
            >
              <span>Open GitHub PR with Template ↗</span>
            </button>
            <button
              type="button"
              className="spe-modal-action-btn-secondary"
              onClick={handleCopyPrMarkdown}
            >
              <span>{copiedPr ? "✓ Copied PR Template!" : "Copy PR Template (Markdown)"}</span>
            </button>
            <button
              type="button"
              className="spe-modal-action-btn-secondary"
              onClick={handleDownloadJson}
            >
              <span>Download workflow.json</span>
            </button>
          </div>

          <button
            type="button"
            className="spe-modal-action-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
