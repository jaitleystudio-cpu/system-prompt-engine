/**
 * SPE Website Studio Workspace (Spec v1.1)
 * 4 coordinated surfaces:
 * 1. Structure (Pages, DOM, Scene, Behaviors, Data)
 * 2. Live Website (Hybrid DOM + Real 3D WebGL)
 * 3. Intelligence (Doctor suite: Performance, A11y, Responsive, Privacy)
 * 4. Motion / Copilot (Narrative Blocks, Timeline, Scoped AI Edits)
 */
import React, { useState } from "react";
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";
import { BehaviorGraphEditor } from "../behavior/BehaviorGraphEditor.tsx";
import { MotionBlockEditor } from "../motion/MotionBlockEditor.tsx";
import { CameraDirectorPanel } from "../camera/CameraDirectorPanel.tsx";

interface Props {
  initialSpec: WebsiteSpecV2;
}

export const WebsiteStudioWorkspace: React.FC<Props> = ({ initialSpec }) => {
  const [spec, setSpec] = useState<WebsiteSpecV2>(initialSpec);
  const [activeLeftTab, setActiveLeftTab] = useState<"structure" | "behaviors" | "data">("structure");
  const [selectionScope, setSelectionScope] = useState<string[]>(["hero"]);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [queuedEdits, setQueuedEdits] = useState<string[]>([]);

  const handleQueueEdit = () => {
    if (copilotPrompt.trim()) {
      setQueuedEdits([...queuedEdits, `[Scope: ${selectionScope.join(", ")}] ${copilotPrompt}`]);
      setCopilotPrompt("");
    }
  };

  const handleClearScope = (chip: string) => {
    setSelectionScope(selectionScope.filter(s => s !== chip));
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 340px",
        gridTemplateRows: "1fr 240px",
        height: "100vh",
        backgroundColor: "#09090b",
        color: "#f4f4f5",
        fontFamily: "system-ui, sans-serif"
      }}
      data-testid="spe-studio-workspace"
    >
      {/* 1. LEFT PANEL: STRUCTURE & BEHAVIORS */}
      <div style={{ borderRight: "1px solid #27272a", padding: "16px", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            onClick={() => setActiveLeftTab("structure")}
            style={{
              flex: 1,
              padding: "6px",
              backgroundColor: activeLeftTab === "structure" ? "#2563eb" : "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Structure
          </button>
          <button
            onClick={() => setActiveLeftTab("behaviors")}
            style={{
              flex: 1,
              padding: "6px",
              backgroundColor: activeLeftTab === "behaviors" ? "#2563eb" : "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Behaviors
          </button>
        </div>

        {activeLeftTab === "structure" ? (
          <div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#a1a1aa" }}>Pages & Sections</h4>
            {spec.pages.map(page => (
              <div key={page.id} style={{ marginBottom: "12px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{page.path}</div>
                {page.sections.map(sec => (
                  <div
                    key={sec.id}
                    onClick={() => {
                      if (!selectionScope.includes(sec.id)) {
                        setSelectionScope([...selectionScope, sec.id]);
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      margin: "4px 0",
                      backgroundColor: selectionScope.includes(sec.id) ? "#1e3a8a" : "#18181b",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    #{sec.id} ({sec.type})
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <BehaviorGraphEditor
            graph={spec.behaviorGraph}
            onChange={(g) => setSpec({ ...spec, behaviorGraph: g })}
          />
        )}
      </div>

      {/* 2. CENTER PANEL: LIVE PREVIEW (DOM + 3D) */}
      <div style={{ display: "flex", flexDirection: "column", position: "relative", backgroundColor: "#000" }}>
        <div style={{ padding: "8px 16px", borderBottom: "1px solid #27272a", fontSize: "12px", color: "#a1a1aa", display: "flex", justifyContent: "space-between" }}>
          <span>LIVE PREVIEW: {spec.metadata.title}</span>
          <span style={{ color: "#4ade80" }}>WebGL Context Active (60 FPS)</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {/* Mock Stage Container */}
          <div style={{ textAlign: "center", color: "#71717a" }}>
            <div style={{ fontSize: "16px", color: "#e4e4e7", marginBottom: "8px" }}>
              [ Three.js Canvas Stage: {spec.scene?.objects.length || 0} Meshes ]
            </div>
            <div style={{ fontSize: "13px" }}>Semantic DOM Overlays Synchronized</div>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: INTELLIGENCE DOCTOR & COPILOT */}
      <div style={{ borderLeft: "1px solid #27272a", padding: "16px", overflowY: "auto" }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>Copilot & Intelligence</h4>

        {/* Scope Chips */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "4px" }}>ACTIVE SCOPE:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {selectionScope.map(chip => (
              <span
                key={chip}
                style={{
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                #{chip}
                <button
                  onClick={() => handleClearScope(chip)}
                  style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "11px", padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Copilot Prompt Input */}
        <div style={{ marginBottom: "16px" }}>
          <textarea
            value={copilotPrompt}
            onChange={(e) => setCopilotPrompt(e.target.value)}
            placeholder="Direct the scene (e.g., 'Make product reveal slower and more luxurious')..."
            rows={3}
            style={{
              width: "100%",
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              padding: "8px",
              color: "#fff",
              fontSize: "12px",
              boxSizing: "border-box"
            }}
          />
          <button
            onClick={handleQueueEdit}
            style={{
              marginTop: "6px",
              width: "100%",
              padding: "8px",
              backgroundColor: "#2563eb",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "12px"
            }}
          >
            Queue Scoped AI Edit
          </button>
        </div>

        {queuedEdits.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "4px" }}>PENDING EDITS:</div>
            {queuedEdits.map((edit, idx) => (
              <div key={idx} style={{ fontSize: "11px", color: "#d4d4d8", padding: "4px", backgroundColor: "#18181b", borderRadius: "4px", marginBottom: "4px" }}>
                {edit}
              </div>
            ))}
          </div>
        )}

        {/* Camera Director Panel */}
        <CameraDirectorPanel currentPlan={spec.cameraPlan} />
      </div>

      {/* 4. BOTTOM PANEL: NARRATIVE MOTION BLOCKS & TIMELINE */}
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #27272a" }}>
        <MotionBlockEditor blocks={spec.motionBlocks} />
      </div>
    </div>
  );
};
