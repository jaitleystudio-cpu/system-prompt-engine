import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  PRESET_LAYOUTS,
  analyzeLayoutFromImageData,
  compileArchitectureFromLayout,
  type UIComponentNode,
  type CompiledArchitecture,
  type LayoutAnalysisResult,
} from "./visionInverseCompiler";

export interface VisionCompilerStudioProps {
  onApplyCompiledPrompt?: (prompt: string) => void;
  onClose?: () => void;
}

export const VisionCompilerStudio: React.FC<VisionCompilerStudioProps> = ({
  onApplyCompiledPrompt,
  onClose,
}) => {
  const [activePresetKey, setActivePresetKey] = useState<string>("saas-dashboard");
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [customImageMeta, setCustomImageMeta] = useState<{ width: number; height: number; pixels?: Uint8ClampedArray } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"prompt" | "components" | "state" | "api" | "wireframe">("prompt");
  const [copied, setCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute Layout Analysis
  const currentAnalysis: LayoutAnalysisResult = useMemo(() => {
    if (customImageSrc) {
      const w = customImageMeta?.width || 1200;
      const h = customImageMeta?.height || 800;
      return analyzeLayoutFromImageData(w, h, customImageMeta?.pixels);
    }
    const preset = PRESET_LAYOUTS[activePresetKey] || PRESET_LAYOUTS["saas-dashboard"];
    const rootTree: UIComponentNode = {
      id: "root-layout",
      type: "hero_banner",
      label: preset.title,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      confidence: 1.0,
      props: { theme: preset.theme },
      suggestedStyles: {
        bg: preset.theme === "dark" ? "#090d16" : "#f8fafc",
        text: preset.theme === "dark" ? "#f8fafc" : "#0f172a",
        border: "transparent",
        accent: preset.accent,
      },
      children: preset.nodes,
    };
    return {
      theme: preset.theme,
      primaryAccent: preset.accent,
      estimatedComplexity: "enterprise",
      components: preset.nodes,
      rootTree,
    };
  }, [activePresetKey, customImageSrc, customImageMeta]);

  // Compile Architecture
  const compiled: CompiledArchitecture = useMemo(() => {
    const title = customImageSrc
      ? "Uploaded Custom Visual Interface"
      : PRESET_LAYOUTS[activePresetKey]?.title || "Synthesized Visual Interface";
    return compileArchitectureFromLayout(currentAnalysis, title);
  }, [currentAnalysis, customImageSrc, activePresetKey]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      setCustomImageSrc(src);

      if (typeof window !== "undefined" && typeof Image !== "undefined") {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || img.width || 1200;
          const h = img.naturalHeight || img.height || 800;
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(w, 800);
          canvas.height = Math.min(h, 600);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setCustomImageMeta({
              width: w,
              height: h,
              pixels: imgData.data,
            });
          } else {
            setCustomImageMeta({ width: w, height: h });
          }
        };
        img.src = src;
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCopyCurrent = () => {
    let text = compiled.compiledSystemPrompt;
    if (activeTab === "components") text = compiled.componentHierarchyTypeScript;
    if (activeTab === "state") text = compiled.stateMachineModel;
    if (activeTab === "api") text = compiled.apiSchemaEndpoints;
    if (activeTab === "wireframe") text = compiled.wireframeAscii;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="vision-compiler-studio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "1.25rem",
        borderRadius: "12px",
        background: "var(--spe-surface-card, rgba(15, 23, 42, 0.7))",
        border: "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.1))",
        color: "#f8fafc",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #38bdf8, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            👁️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                S-Code · Screenshot to Clean Code Studio
              </h3>
              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  fontWeight: 600,
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                }}
              >
                S-Code • Visual Layout
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
              Transforms screenshots, UI mockups, and whiteboard designs into verified typed architectures and system prompts.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            📁 Upload Screenshot
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "1.1rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Preset selector buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Sample Blueprints:</span>
        {Object.entries(PRESET_LAYOUTS).map(([key, p]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setCustomImageSrc(null);
              setCustomImageMeta(null);
              setActivePresetKey(key);
            }}
            style={{
              fontSize: "0.7rem",
              padding: "0.3rem 0.65rem",
              borderRadius: "6px",
              border: "none",
              background:
                !customImageSrc && activePresetKey === key
                  ? "rgba(56, 189, 248, 0.25)"
                  : "rgba(0, 0, 0, 0.3)",
              color: !customImageSrc && activePresetKey === key ? "#38bdf8" : "#94a3b8",
              fontWeight: !customImageSrc && activePresetKey === key ? 700 : 500,
              cursor: "pointer",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor:
                !customImageSrc && activePresetKey === key
                  ? "rgba(56, 189, 248, 0.4)"
                  : "rgba(255, 255, 255, 0.08)",
            }}
          >
            {p.title.split(" ")[0]} {p.title.split(" ")[1]}
          </button>
        ))}
      </div>

      {/* Main Studio View: Visual Inspector Canvas + Component Hierarchy */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem" }}>
        {/* Visual Segmentation Canvas */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8" }}>
              Visual Layout Segmentation (Bounding Boxes & Contours)
            </span>
            <span style={{ fontSize: "0.65rem", color: "#38bdf8" }}>
              {currentAnalysis.components.length} Zones Detected • 100% Local Inference
            </span>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              height: "260px",
              background: currentAnalysis.theme === "dark" ? "#0b0f19" : "#f1f5f9",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {customImageSrc && (
              <img
                src={customImageSrc}
                alt="Source Design"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  opacity: 0.3,
                }}
              />
            )}

            {/* Render Component Bounding Boxes */}
            {currentAnalysis.components.map((c) => {
              const isSelected = selectedNodeId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedNodeId(isSelected ? null : c.id)}
                  style={{
                    position: "absolute",
                    left: `${c.bounds.x}%`,
                    top: `${c.bounds.y}%`,
                    width: `${c.bounds.width}%`,
                    height: `${c.bounds.height}%`,
                    background: isSelected
                      ? "rgba(56, 189, 248, 0.3)"
                      : "rgba(99, 102, 241, 0.15)",
                    border: `2px ${isSelected ? "solid #38bdf8" : "dashed rgba(99, 102, 241, 0.6)"}`,
                    borderRadius: "4px",
                    cursor: "pointer",
                    boxSizing: "border-box",
                    padding: "4px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.15s ease",
                  }}
                  title={`${c.label} (${c.type})`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span
                      style={{
                        fontSize: "0.55rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.3rem",
                        borderRadius: "3px",
                        background: "rgba(0,0,0,0.7)",
                        color: "#38bdf8",
                      }}
                    >
                      {c.type}
                    </span>
                    <span
                      style={{
                        fontSize: "0.55rem",
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.5rem", color: "#94a3b8", textAlign: "right" }}>
                    {(c.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Component Hierarchy & Extracted Tokens */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.75rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            maxHeight: "295px",
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8" }}>
            Reconstructed Component Tree
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {currentAnalysis.components.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedNodeId(selectedNodeId === c.id ? null : c.id)}
                style={{
                  padding: "0.45rem 0.65rem",
                  borderRadius: "6px",
                  background:
                    selectedNodeId === c.id ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.03)",
                  border: `1px solid ${selectedNodeId === c.id ? "#38bdf8" : "rgba(255, 255, 255, 0.06)"}`,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#f8fafc" }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: "0.6rem", color: "#38bdf8" }}>{c.type}</span>
                </div>
                <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  Bounds: [{c.bounds.x}%, {c.bounds.y}%, {c.bounds.width}% × {c.bounds.height}%]
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs navigation for Compiled Architecture */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {(
            [
              { id: "prompt", label: "📝 Verified System Prompt" },
              { id: "components", label: "💻 React / TS Interfaces" },
              { id: "state", label: "⚡ State Machine Reducer" },
              { id: "api", label: "🔌 OpenAPI Contract" },
              { id: "wireframe", label: "📐 ASCII Layout" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                border: "none",
                background: activeTab === t.id ? "rgba(56, 189, 248, 0.2)" : "transparent",
                color: activeTab === t.id ? "#38bdf8" : "#94a3b8",
                fontWeight: activeTab === t.id ? 700 : 500,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={handleCopyCurrent}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.7rem",
              cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied" : "📋 Copy Current Tab"}
          </button>

          {onApplyCompiledPrompt && (
            <button
              type="button"
              onClick={() => onApplyCompiledPrompt(compiled.compiledSystemPrompt)}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "6px",
                background: "#10b981",
                border: "none",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.7rem",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
              }}
            >
              ✨ Apply Compiled Prompt
            </button>
          )}
        </div>
      </div>

      {/* Active Tab Content Viewer */}
      <div>
        <textarea
          readOnly
          value={
            activeTab === "prompt"
              ? compiled.compiledSystemPrompt
              : activeTab === "components"
              ? compiled.componentHierarchyTypeScript
              : activeTab === "state"
              ? compiled.stateMachineModel
              : activeTab === "api"
              ? compiled.apiSchemaEndpoints
              : compiled.wireframeAscii
          }
          style={{
            width: "100%",
            height: "260px",
            background: "rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "8px",
            padding: "0.75rem",
            color: "#f8fafc",
            fontSize: "0.75rem",
            fontFamily: "monospace",
            resize: "none",
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
};
