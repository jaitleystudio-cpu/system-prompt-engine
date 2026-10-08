/**
 * Beginner-friendly card UI for displaying a single BehaviorRule:
 * WHEN (Trigger) -> IF (Conditions) -> DO (Actions) -> ELSE (Fallback).
 */
import React from "react";
import type { BehaviorRule } from "../model/behaviorGraph.ts";

interface Props {
  rule: BehaviorRule;
  onDelete?: (id: string) => void;
}

export const BehaviorRuleCard: React.FC<Props> = ({ rule, onDelete }) => {
  return (
    <div
      style={{
        backgroundColor: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "14px",
        marginBottom: "10px",
        color: "#f4f4f5",
        fontSize: "13px"
      }}
      data-testid={`behavior-rule-${rule.id}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontWeight: 600, color: "#60a5fa" }}>RULE: {rule.id}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(rule.id)}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Remove
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div>
          <span style={{ color: "#a1a1aa", fontWeight: 600, marginRight: "6px" }}>WHEN:</span>
          <span>{rule.trigger.type} ({JSON.stringify(rule.trigger)})</span>
        </div>

        {rule.conditions && rule.conditions.length > 0 && (
          <div>
            <span style={{ color: "#fbbf24", fontWeight: 600, marginRight: "6px" }}>IF:</span>
            <span>{rule.conditions.map(c => `${c.type}`).join(", ")}</span>
          </div>
        )}

        <div>
          <span style={{ color: "#4ade80", fontWeight: 600, marginRight: "6px" }}>DO:</span>
          <span>{rule.actions.map(a => a.type).join(" → ")}</span>
        </div>

        {rule.fallback && rule.fallback.length > 0 && (
          <div>
            <span style={{ color: "#f87171", fontWeight: 600, marginRight: "6px" }}>FALLBACK (Mobile):</span>
            <span>{rule.fallback.map(f => f.type).join(" → ")}</span>
          </div>
        )}
      </div>
    </div>
  );
};
