import React, { useState } from "react";
import type { BehaviorGraph, BehaviorRule } from "../model/behaviorGraph.ts";
import { validateBehaviorGraphAdvanced } from "./validateBehaviorGraph.ts";

export interface BehaviorGraphEditorProps {
  graph: BehaviorGraph;
  onChange?: (graph: BehaviorGraph) => void;
}

export const BehaviorGraphEditor: React.FC<BehaviorGraphEditorProps> = ({
  graph,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState<"visual" | "json">("visual");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleDeleteRule = (id: string) => {
    if (!onChange) return;
    const nextRules = graph.rules.filter((r) => r.id !== id);
    const updated: BehaviorGraph = { ...graph, rules: nextRules };
    try {
      validateBehaviorGraphAdvanced(updated);
      setValidationError(null);
      onChange(updated);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddRule = () => {
    if (!onChange) return;
    const newRule: BehaviorRule = {
      id: `rule-${Date.now().toString(36)}`,
      trigger: { type: "scroll", targetId: "section-hero" },
      conditions: [{ type: "viewport-min", value: 768 }],
      actions: [{ type: "scene-rotate", targetId: "mesh-main", value: 90 }],
      fallback: [{ type: "dom-show", targetId: "hero-static" }],
    };
    const updated: BehaviorGraph = {
      ...graph,
      rules: [...graph.rules, newRule],
    };
    try {
      validateBehaviorGraphAdvanced(updated);
      setValidationError(null);
      onChange(updated);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="behavior-graph-editor"
      style={{
        backgroundColor: "#12151e",
        border: "1px solid #242938",
        borderRadius: "8px",
        padding: "16px",
        color: "#f4f5f8",
        fontSize: "13px",
      }}
      data-testid="behavior-graph-editor"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: "14px" }}>Behavior Graph Editor</h4>
          <span style={{ fontSize: "11px", color: "#8e95a5" }}>
            {graph.rules.length} rule{graph.rules.length === 1 ? "" : "s"} defined
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`studio-btn ${activeTab === "visual" ? "studio-btn-primary" : ""}`}
            onClick={() => setActiveTab("visual")}
            style={{ padding: "4px 10px", fontSize: "12px", minHeight: "36px" }}
          >
            Visual Rules
          </button>
          <button
            type="button"
            className={`studio-btn ${activeTab === "json" ? "studio-btn-primary" : ""}`}
            onClick={() => setActiveTab("json")}
            style={{ padding: "4px 10px", fontSize: "12px", minHeight: "36px" }}
          >
            Graph JSON
          </button>
        </div>
      </div>

      {validationError && (
        <div
          style={{
            backgroundColor: "#7f1d1d",
            color: "#fca5a5",
            padding: "8px 12px",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          {validationError}
        </div>
      )}

      {activeTab === "visual" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {graph.rules.length === 0 ? (
            <div style={{ color: "#71798e", padding: "16px 0", textAlign: "center" }}>
              No behavior rules configured. Add a rule to connect user interactions to 3D reactions.
            </div>
          ) : (
            graph.rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  backgroundColor: "#1a1e2b",
                  border: "1px solid #282e3f",
                  borderRadius: "6px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#60a5fa" }}>{rule.id}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "2px 6px",
                    }}
                    aria-label={`Delete rule ${rule.id}`}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
                  <div>
                    <strong style={{ color: "#a1a1aa" }}>Trigger:</strong> {rule.trigger.type}
                    {rule.trigger.targetId ? ` on #${rule.trigger.targetId}` : ""}
                  </div>
                  <div>
                    <strong style={{ color: "#a1a1aa" }}>Actions:</strong>{" "}
                    {rule.actions.map((a) => `${a.type}${a.targetId ? ` (${a.targetId})` : ""}`).join(", ")}
                  </div>
                  {rule.fallback && rule.fallback.length > 0 && (
                    <div>
                      <strong style={{ color: "#facc15" }}>Fallback:</strong>{" "}
                      {rule.fallback.map((f) => f.type).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            className="studio-btn"
            onClick={handleAddRule}
            style={{ width: "100%", marginTop: "6px" }}
          >
            + Add Interaction Rule
          </button>
        </div>
      ) : (
        <pre
          style={{
            backgroundColor: "#0d0f15",
            padding: "12px",
            borderRadius: "6px",
            fontSize: "11px",
            overflowX: "auto",
            color: "#e2e8f0",
            maxHeight: "300px",
          }}
        >
          {JSON.stringify(graph, null, 2)}
        </pre>
      )}
    </div>
  );
};
