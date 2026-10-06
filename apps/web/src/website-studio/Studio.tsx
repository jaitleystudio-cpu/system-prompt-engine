import React, { useState } from "react";
import "./studio.css";
import {
  createDefaultWebsiteSpecV2,
  type WebsiteSpecV2,
} from "./model/websiteSpecV2.ts";
import { BehaviorGraphEditor } from "./behavior/BehaviorGraphEditor.tsx";
import { MotionBlockEditor } from "./motion/MotionBlockEditor.tsx";
import { CameraDirectorPanel } from "./camera/CameraDirectorPanel.tsx";
import { PerformanceDoctor } from "./performance/PerformanceDoctor.tsx";
import { DataBindingInspector } from "./data/DataBindingInspector.tsx";
import { WebsiteRenderer } from "./render/WebsiteRenderer.tsx";
import { StudioExplore } from "./explore/StudioExplore.tsx";
import type { InspirationItem } from "./explore/InspirationCard.tsx";
import { createSitePatch, applySitePatch, type SitePatch } from "./history/sitePatch.ts";
import { serializeProjectPackage, deserializeProjectPackage } from "./export/projectPackage.ts";
import {
  analyzeEnhancementOpportunities,
  type EnhancementProposal,
} from "./enhance/analyzeEnhancementOpportunities.ts";

export interface StudioProps {
  initialSpec?: WebsiteSpecV2;
}

export const Studio: React.FC<StudioProps> = ({ initialSpec }) => {
  const [history, setHistory] = useState<WebsiteSpecV2[]>(() => [
    initialSpec || createDefaultWebsiteSpecV2(),
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const spec = history[historyIndex] || createDefaultWebsiteSpecV2();

  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"structure" | "behaviors" | "data" | "explore" | "enhance">("structure");
  const [selectionScope, setSelectionScope] = useState<string[]>(["hero"]);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [patchHistory, setPatchHistory] = useState<SitePatch[]>([]);
  const [proposedPatch, setProposedPatch] = useState<SitePatch | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [lastExportedPkg, setLastExportedPkg] = useState<string | null>(null);
  const [contextLostStatus, setContextLostStatus] = useState<string | null>(null);

  const handleApplyPatch = (newSpec: WebsiteSpecV2, patch: SitePatch) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newSpec);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setPatchHistory((prev) => [...prev, patch]);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleCreateFromIntent = () => {
    const title = copilotPrompt.trim() || "Futuristic Cybernetic Showcase";
    const patch = createSitePatch(
      spec,
      [
        {
          op: "set",
          path: ["metadata", "title"],
          value: title,
        },
        {
          op: "set",
          path: ["metadata", "description"],
          value: `High-fidelity 3D experience generated from intent: "${title}"`,
        },
      ],
      "USER_LANGUAGE",
    );
    const updated = applySitePatch(spec, patch);
    handleApplyPatch(updated, patch);
    setCopilotPrompt("");
  };

  const handleQueueCopilotEdit = () => {
    if (!copilotPrompt.trim()) return;
    const patch = createSitePatch(
      spec,
      [
        {
          op: "set",
          path: ["metadata", "title"],
          value: `${spec.metadata.title} (Updated)`,
        },
      ],
      "USER_LANGUAGE",
    );
    const updated = applySitePatch(spec, patch);
    handleApplyPatch(updated, patch);
    setCopilotPrompt("");
  };

  const handleProposeAgentPatch = () => {
    const patch = createSitePatch(
      spec,
      [
        {
          op: "set",
          path: ["metadata", "title"],
          value: `${spec.metadata.title} [Agent Enhanced]`,
        },
        {
          op: "set",
          path: ["cameraPlan", "shots", 0, "intent"],
          value: "dynamic-reveal",
        },
      ],
      "AGENT",
    );
    setProposedPatch(patch);
  };

  const handleApprovePatch = () => {
    if (!proposedPatch) return;
    const updated = applySitePatch(spec, proposedPatch);
    handleApplyPatch(updated, proposedPatch);
    setProposedPatch(null);
  };

  const handleRejectPatch = () => {
    setProposedPatch(null);
  };

  const handleBlendRecipe = (item: InspirationItem) => {
    const patch = createSitePatch(
      spec,
      [
        {
          op: "set",
          path: ["designDNA", "colors", "background"],
          value: "#090a0f",
        },
        {
          op: "set",
          path: ["designDNA", "colors", "accents"],
          value: ["#3b82f6", "#60a5fa"],
        },
        {
          op: "set",
          path: ["metadata", "title"],
          value: `${spec.metadata.title} • ${item.title} Blend`,
        },
      ],
      "USER_UI",
    );
    const updated = applySitePatch(spec, patch);
    handleApplyPatch(updated, patch);
  };

  const handleProposeEnhancementPatch = (proposal: EnhancementProposal) => {
    const patch = createSitePatch(
      spec,
      [
        {
          op: "set",
          path: ["metadata", "title"],
          value: `${spec.metadata.title} (3D Enhanced: ${proposal.targetId})`,
        },
        {
          op: "set",
          path: ["scene", "environment", "preset"],
          value: "studio-cinematic",
        },
      ],
      "AGENT",
    );
    setProposedPatch(patch);
  };

  const handleExport = async () => {
    try {
      const pkg = await serializeProjectPackage(spec);
      setLastExportedPkg(pkg);
      setExportNotice(`Exported .spe-site package (${pkg.length} bytes)`);
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err) {
      setExportNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReopen = async () => {
    try {
      const pkgToLoad = lastExportedPkg || (await serializeProjectPackage(spec));
      const { websiteSpec } = await deserializeProjectPackage(pkgToLoad);
      setHistory([websiteSpec]);
      setHistoryIndex(0);
      setExportNotice("Reopened .spe-site project package");
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err) {
      setExportNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSimulateContextLoss = () => {
    setContextLostStatus("WebGL Context Lost — Recovering...");
    setTimeout(() => {
      setContextLostStatus("WebGL Context Restored — All Scene State Preserved");
      setTimeout(() => setContextLostStatus(null), 4000);
    }, 400);
  };

  const enhancementOpportunities = analyzeEnhancementOpportunities({
    heroHasStaticImage: true,
    semanticDom: true,
  });

  return (
    <div className="studio-root" data-testid="website-studio">
      {/* Top Header */}
      <header className="studio-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em" }}>
            SPE Website Studio
          </h1>
          <span
            style={{
              fontSize: "11px",
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              padding: "2px 8px",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            v1.1 Free 3D Architecture
          </span>
        </div>

        {/* Viewport Controls */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`studio-btn ${viewMode === "desktop" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("desktop")}
            data-testid="viewport-desktop"
            aria-label="Desktop Preview Mode"
          >
            Desktop
          </button>
          <button
            type="button"
            className={`studio-btn ${viewMode === "tablet" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("tablet")}
            data-testid="viewport-tablet"
            aria-label="Tablet Preview Mode"
          >
            Tablet
          </button>
          <button
            type="button"
            className={`studio-btn ${viewMode === "mobile" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("mobile")}
            data-testid="viewport-mobile"
            aria-label="Mobile Preview Mode"
          >
            Mobile
          </button>
        </div>

        {/* Accessibility & History Actions */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className={`studio-btn ${reducedMotion ? "studio-btn-primary" : ""}`}
            onClick={() => setReducedMotion(!reducedMotion)}
            data-testid="toggle-reduced-motion"
            aria-label="Toggle Reduced Motion"
          >
            {reducedMotion ? "Motion: Reduced" : "Motion: Normal"}
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            data-testid="studio-undo-btn"
            aria-label="Undo Edit"
          >
            Undo
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            data-testid="studio-redo-btn"
            aria-label="Redo Edit"
          >
            Redo
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={handleSimulateContextLoss}
            data-testid="simulate-context-loss-btn"
            aria-label="Simulate WebGL Context Loss"
          >
            Simulate Context Loss
          </button>
        </div>

        {/* Export / Reopen */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {exportNotice && (
            <span data-testid="export-notice" style={{ fontSize: "12px", color: "#34d399" }}>
              {exportNotice}
            </span>
          )}
          <button
            type="button"
            className="studio-btn"
            onClick={handleReopen}
            data-testid="studio-reopen-btn"
            aria-label="Reopen SPE Site Package"
          >
            Reopen .spe-site
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={handleExport}
            data-testid="studio-export-btn"
            aria-label="Export SPE Site Package"
          >
            Export .spe-site
          </button>
        </div>
      </header>

      {/* Surface 1: STRUCTURE */}
      <aside className="studio-panel" aria-label="STRUCTURE Panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#8e95a5", letterSpacing: "0.05em" }}>
            STRUCTURE
          </h3>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "structure" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("structure")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
              data-testid="tab-structure"
            >
              Tree
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "behaviors" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("behaviors")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
              data-testid="tab-behaviors"
            >
              Graph
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "enhance" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("enhance")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
              data-testid="tab-enhance"
            >
              Enhance
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "data" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("data")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
              data-testid="tab-data"
            >
              Data
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "explore" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("explore")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
              data-testid="tab-explore"
            >
              Recipes
            </button>
          </div>
        </div>

        {activeLeftTab === "structure" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa" }}>
              <span>Pages & Hierarchy</span>
              {patchHistory.length > 0 && <span>{patchHistory.length} edit{patchHistory.length === 1 ? "" : "s"}</span>}
            </div>
            {spec.pages.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectionScope([p.id])}
                style={{
                  backgroundColor: selectionScope.includes(p.id) ? "#1e293b" : "#161922",
                  border: selectionScope.includes(p.id) ? "1px solid #3b82f6" : "1px solid #232736",
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div style={{ color: "#8e95a5", fontSize: "11px" }}>{p.path}</div>
              </div>
            ))}
          </div>
        )}

        {activeLeftTab === "behaviors" && (
          <BehaviorGraphEditor
            graph={spec.behaviorGraph}
            onChange={(bg) => {
              const patch = createSitePatch(
                spec,
                [{ op: "set", path: ["behaviorGraph"], value: bg }],
                "USER_UI",
              );
              const updated = applySitePatch(spec, patch);
              handleApplyPatch(updated, patch);
            }}
          />
        )}

        {activeLeftTab === "enhance" && (
          <div data-testid="enhancement-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "13px", color: "#f4f5f8" }}>3D Enhancement Opportunities</h4>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8e95a5" }}>
                Multi-tier analysis strictly mapping 3D fidelity without deceptive labeling.
              </p>
            </div>

            {/* 4 Truth Tiers */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <span data-testid="tier-badge-TRUE_3D" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                TRUE_3D
              </span>
              <span data-testid="tier-badge-DEPTH_COMPOSITE" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", fontWeight: 700 }}>
                DEPTH_COMPOSITE
              </span>
              <span data-testid="tier-badge-2_5D" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", fontWeight: 700 }}>
                2_5D
              </span>
              <span data-testid="tier-badge-CSS_MOTION" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(168, 85, 247, 0.2)", color: "#c084fc", fontWeight: 700 }}>
                CSS_MOTION
              </span>
            </div>

            {/* Proposals */}
            {enhancementOpportunities.map((prop, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: "#161922",
                  border: "1px solid #232736",
                  borderRadius: "6px",
                  padding: "10px",
                  fontSize: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#f4f5f8" }}>{prop.targetId}</strong>
                  <span style={{ fontSize: "10px", color: "#60a5fa" }}>{prop.truthLabel}</span>
                </div>
                <div style={{ color: "#8e95a5", fontSize: "11px" }}>{prop.proposedState}</div>
                <button
                  type="button"
                  className="studio-btn studio-btn-primary"
                  onClick={() => handleProposeEnhancementPatch(prop)}
                  data-testid="generate-enhancement-patch-btn"
                  style={{ fontSize: "11px", padding: "4px 8px", minHeight: "30px", marginTop: "4px" }}
                >
                  Propose 3D Enhancement
                </button>
              </div>
            ))}
          </div>
        )}

        {activeLeftTab === "data" && (
          <DataBindingInspector
            bindings={spec.dataBindings}
            onRemoveBinding={(id) => {
              const patch = createSitePatch(
                spec,
                [
                  {
                    op: "set",
                    path: ["dataBindings"],
                    value: spec.dataBindings.filter((b) => b.id !== id),
                  },
                ],
                "USER_UI",
              );
              const updated = applySitePatch(spec, patch);
              handleApplyPatch(updated, patch);
            }}
          />
        )}

        {activeLeftTab === "explore" && (
          <StudioExplore
            onSelectRecipe={(recipe) => {
              const patch = createSitePatch(
                spec,
                [{ op: "set", path: ["metadata", "title"], value: recipe.title }],
                "USER_UI",
              );
              const updated = applySitePatch(spec, patch);
              handleApplyPatch(updated, patch);
              setActiveLeftTab("structure");
            }}
            onBlendRecipe={handleBlendRecipe}
          />
        )}
      </aside>

      {/* Surface 2: LIVE WEBSITE */}
      <main className="studio-stage" aria-label="LIVE WEBSITE Stage" style={{ position: "relative", height: "100%" }}>
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "12px",
            zIndex: 10,
            fontSize: "11px",
            fontWeight: 700,
            color: "#60a5fa",
            letterSpacing: "0.05em",
            backgroundColor: "rgba(18, 21, 30, 0.75)",
            backdropFilter: "blur(8px)",
            padding: "4px 8px",
            borderRadius: "4px",
          }}
        >
          LIVE WEBSITE
        </div>

        {/* Proposed Patch & Visible Semantic Diff Viewer */}
        {proposedPatch && (
          <div
            data-testid="semantic-diff-panel"
            style={{
              position: "absolute",
              bottom: "16px",
              left: "16px",
              right: "16px",
              zIndex: 50,
              backgroundColor: "#161922",
              border: "1px solid #3b82f6",
              borderRadius: "8px",
              padding: "16px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  data-testid="diff-source"
                  style={{
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    color: "#60a5fa",
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  {proposedPatch.source}
                </span>
                <strong data-testid="diff-patch-id" style={{ fontSize: "13px", color: "#f4f5f8" }}>
                  {proposedPatch.id}
                </strong>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="studio-btn"
                  onClick={handleRejectPatch}
                  data-testid="reject-patch-btn"
                  style={{ minHeight: "32px", fontSize: "12px" }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-primary"
                  onClick={handleApprovePatch}
                  data-testid="approve-patch-btn"
                  style={{ minHeight: "32px", fontSize: "12px" }}
                >
                  Approve & Apply Patch
                </button>
              </div>
            </div>

            <div data-testid="diff-hashes" style={{ fontSize: "11px", color: "#8e95a5", fontFamily: "monospace" }}>
              beforeHash: {proposedPatch.beforeHash.slice(0, 18)}... → afterHash: {proposedPatch.afterHash.slice(0, 18)}...
            </div>

            <div style={{ maxHeight: "120px", overflowY: "auto", fontSize: "12px", backgroundColor: "#0b0d12", padding: "8px", borderRadius: "4px" }}>
              {proposedPatch.operations.map((op, i) => (
                <div key={i} data-testid="diff-operation-row" style={{ fontFamily: "monospace", color: "#cbd5e1" }}>
                  <span style={{ color: "#34d399" }}>+ [{op.path.join(".")}]</span>: {JSON.stringify(op.value)}
                </div>
              ))}
            </div>
          </div>
        )}

        <WebsiteRenderer
          spec={spec}
          viewMode={viewMode}
          reducedMotion={reducedMotion}
          contextLostStatus={contextLostStatus}
        />
      </main>

      {/* Surface 3: INTELLIGENCE */}
      <aside className="studio-panel studio-panel-right" aria-label="INTELLIGENCE Panel">
        <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "#8e95a5", letterSpacing: "0.05em" }}>
          INTELLIGENCE
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <PerformanceDoctor scene={spec.scene} />

          {/* Camera Director in Intelligence Sidebar */}
          <CameraDirectorPanel
            currentPlan={spec.cameraPlan}
            scene={spec.scene}
            onPlanChange={(plan) => {
              const patch = createSitePatch(
                spec,
                [{ op: "set", path: ["cameraPlan"], value: plan }],
                "USER_UI",
              );
              const updated = applySitePatch(spec, patch);
              handleApplyPatch(updated, patch);
            }}
          />
        </div>
      </aside>

      {/* Surface 4: COPILOT & TIMELINE */}
      <footer className="studio-timeline-panel" aria-label="COPILOT & Motion Timeline">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#8e95a5", letterSpacing: "0.05em" }}>
              COPILOT
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              {selectionScope.map((scope) => (
                <span
                  key={scope}
                  style={{
                    backgroundColor: "rgba(59, 130, 246, 0.15)",
                    color: "#93c5fd",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 500,
                  }}
                >
                  #{scope}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Natural Language Copilot Input & Proposal Actions */}
          <div style={{ display: "flex", gap: "8px", width: "540px" }}>
            <input
              type="text"
              className="studio-input"
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              placeholder="Direct Copilot with natural language..."
              style={{ minHeight: "36px", fontSize: "12px" }}
              data-testid="copilot-input"
              aria-label="Direct Copilot with natural language"
            />
            <button
              type="button"
              className="studio-btn"
              onClick={handleCreateFromIntent}
              style={{ minHeight: "36px", fontSize: "11px", whiteSpace: "nowrap" }}
              data-testid="create-from-intent-btn"
            >
              Create from Intent
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={handleQueueCopilotEdit}
              style={{ minHeight: "36px", fontSize: "11px", whiteSpace: "nowrap" }}
              data-testid="apply-edit-btn"
            >
              Apply Edit
            </button>
            <button
              type="button"
              className="studio-btn"
              onClick={handleProposeAgentPatch}
              style={{ minHeight: "36px", fontSize: "11px", whiteSpace: "nowrap" }}
              data-testid="propose-patch-btn"
            >
              Propose Patch
            </button>
          </div>
        </div>

        <MotionBlockEditor
          blocks={spec.motionBlocks}
          onBlocksChange={(blocks) => {
            const patch = createSitePatch(
              spec,
              [{ op: "set", path: ["motionBlocks"], value: blocks }],
              "USER_UI",
            );
            const updated = applySitePatch(spec, patch);
            handleApplyPatch(updated, patch);
          }}
        />
      </footer>
    </div>
  );
};
