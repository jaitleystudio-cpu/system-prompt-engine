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
import { createEmptySceneIR } from "./model/sceneIR.ts";
import { createSitePatch, applySitePatch, type SitePatch } from "./history/sitePatch.ts";
import { serializeProjectPackage } from "./export/projectPackage.ts";
import {
  createBlankStudioProject,
  createFromRecipe,
} from "./create/createFromRecipe.ts";

export interface StudioProps {
  initialSpec?: WebsiteSpecV2;
}

export const Studio: React.FC<StudioProps> = ({ initialSpec }) => {
  const [spec, setSpec] = useState<WebsiteSpecV2>(
    () => initialSpec || createDefaultWebsiteSpecV2(),
  );
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeLeftTab, setActiveLeftTab] = useState<"structure" | "behaviors" | "data" | "explore">(
    initialSpec ? "structure" : "explore",
  );
  const [selectionScope, setSelectionScope] = useState<string[]>(["hero"]);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [patchHistory, setPatchHistory] = useState<SitePatch[]>([]);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>();
  const [journeyPhase, setJourneyPhase] = useState<
    "explore" | "created" | "edited" | "exported"
  >(initialSpec ? "created" : "explore");

  const handleApplyPatch = (newSpec: WebsiteSpecV2, patch: SitePatch) => {
    setSpec(newSpec);
    setPatchHistory((prev) => [...prev, patch]);
    setJourneyPhase("edited");
  };

  const handleCreateBlank = () => {
    const next = createBlankStudioProject();
    setSpec(next);
    setSelectedRecipeId(undefined);
    setPatchHistory([]);
    setActiveLeftTab("structure");
    setSelectionScope([next.pages[0]?.id ?? "home"]);
    setJourneyPhase("created");
  };

  const handleCreateFromRecipe = (recipe: InspirationItem) => {
    const next = createFromRecipe(recipe);
    setSpec(next);
    setSelectedRecipeId(recipe.id);
    setPatchHistory([]);
    setActiveLeftTab("structure");
    setSelectionScope([next.pages[0]?.id ?? "home"]);
    setJourneyPhase("created");
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

  const handleExport = async () => {
    try {
      const pkg = await serializeProjectPackage(spec);
      const blob = new Blob([pkg], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = spec.metadata.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "spe-site";
      link.href = url;
      link.download = `${safeName}.spe-site.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportNotice(`Exported .spe-site package (${pkg.length} bytes)`);
      setJourneyPhase("exported");
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      setExportNotice(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="studio-root"
      data-testid="website-studio"
      data-journey-phase={journeyPhase}
    >
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

        {/* Viewport Controls — responsive preview */}
        <div style={{ display: "flex", gap: "6px" }} role="group" aria-label="Responsive preview">
          <button
            type="button"
            className={`studio-btn ${viewMode === "desktop" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("desktop")}
            aria-label="Desktop Preview Mode"
            aria-pressed={viewMode === "desktop"}
          >
            Desktop
          </button>
          <button
            type="button"
            className={`studio-btn ${viewMode === "tablet" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("tablet")}
            aria-label="Tablet Preview Mode"
            aria-pressed={viewMode === "tablet"}
          >
            Tablet
          </button>
          <button
            type="button"
            className={`studio-btn ${viewMode === "mobile" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("mobile")}
            aria-label="Mobile Preview Mode"
            aria-pressed={viewMode === "mobile"}
          >
            Mobile
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {exportNotice && (
            <span style={{ fontSize: "12px", color: "#34d399" }} role="status">
              {exportNotice}
            </span>
          )}
          <button
            type="button"
            className="studio-btn"
            onClick={handleCreateBlank}
            aria-label="Create blank SPE website"
            data-testid="studio-create-blank"
          >
            Create blank
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={() => setActiveLeftTab("explore")}
            aria-label="Explore inspiration recipes"
            data-testid="studio-open-explore"
          >
            Explore
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={handleExport}
            aria-label="Export SPE Site Package"
            data-testid="studio-export"
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
            >
              Tree
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "behaviors" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("behaviors")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
            >
              Graph
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "data" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("data")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
            >
              Data
            </button>
            <button
              type="button"
              className={`studio-btn ${activeLeftTab === "explore" ? "studio-btn-primary" : ""}`}
              onClick={() => setActiveLeftTab("explore")}
              style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px", minWidth: "32px" }}
            >
              Recipes
            </button>
          </div>
        </div>

        {activeLeftTab === "structure" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa" }}>
              <span>Pages & Hierarchy</span>
              {patchHistory.length > 0 && (
                <span>
                  {patchHistory.length} edit{patchHistory.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {spec.pages.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectionScope([p.id])}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectionScope([p.id]);
                  }
                }}
                role="button"
                tabIndex={0}
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
            onChange={(bg) => setSpec({ ...spec, behaviorGraph: bg })}
          />
        )}

        {activeLeftTab === "data" && (
          <DataBindingInspector
            bindings={spec.dataBindings}
            onRemoveBinding={(id) =>
              setSpec({
                ...spec,
                dataBindings: spec.dataBindings.filter((b) => b.id !== id),
              })
            }
          />
        )}

        {activeLeftTab === "explore" && (
          <StudioExplore
            selectedId={selectedRecipeId}
            onSelectRecipe={handleCreateFromRecipe}
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
        <WebsiteRenderer spec={spec} viewMode={viewMode} />
      </main>

      {/* Surface 3: INTELLIGENCE */}
      <aside className="studio-panel studio-panel-right" aria-label="INTELLIGENCE Panel">
        <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "#8e95a5", letterSpacing: "0.05em" }}>
          INTELLIGENCE
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <PerformanceDoctor scene={spec.scene ?? createEmptySceneIR()} />

          <CameraDirectorPanel
            currentPlan={spec.cameraPlan}
            onPlanChange={(plan) => setSpec({ ...spec, cameraPlan: plan })}
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

          <div style={{ display: "flex", gap: "8px", width: "420px" }}>
            <input
              type="text"
              className="studio-input"
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              placeholder="Prompt Copilot to direct motion, lighting, or camera..."
              style={{ minHeight: "36px", fontSize: "12px" }}
              aria-label="Direct Copilot with natural language"
            />
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={handleQueueCopilotEdit}
              style={{ minHeight: "36px", fontSize: "12px", whiteSpace: "nowrap" }}
            >
              Apply Edit
            </button>
          </div>
        </div>

        <MotionBlockEditor
          blocks={spec.motionBlocks}
          onBlocksChange={(blocks) => setSpec({ ...spec, motionBlocks: blocks })}
        />
      </footer>
    </div>
  );
};
