import React from "react";
import type { DataBinding, PrivacyBoundary } from "../model/dataBinding.ts";

export interface DataBindingInspectorProps {
  bindings: DataBinding[];
  onRemoveBinding?: (id: string) => void;
  onAddBinding?: () => void;
}

export const DataBindingInspector: React.FC<DataBindingInspectorProps> = ({
  bindings,
  onRemoveBinding,
  onAddBinding,
}) => {
  const getBoundaryBadge = (boundary: PrivacyBoundary) => {
    switch (boundary) {
      case "LOCAL":
        return {
          label: "LOCAL",
          bg: "#064e3b",
          color: "#34d399",
          desc: "Never leaves the browser sandbox. 100% on-device.",
        };
      case "PUBLIC_FETCH":
        return {
          label: "PUBLIC WEB FETCH",
          bg: "#78350f",
          color: "#fcd34d",
          desc: "Public read-only GET fetch. Disclosed public URL.",
        };
      case "EXTERNAL_PROVIDER":
        return {
          label: "EXTERNAL PROVIDER",
          bg: "#7f1d1d",
          color: "#fca5a5",
          desc: "External API provider with mandatory privacy disclosure.",
        };
    }
  };

  return (
    <div
      className="data-binding-inspector"
      style={{
        backgroundColor: "#12151e",
        border: "1px solid #242938",
        borderRadius: "8px",
        padding: "16px",
        color: "#f4f5f8",
        fontSize: "13px",
      }}
      data-testid="data-binding-inspector"
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
          <h4 style={{ margin: 0, fontSize: "14px" }}>Data Binding & Privacy Inspector</h4>
          <span style={{ fontSize: "11px", color: "#8e95a5" }}>
            {bindings.length} variable{bindings.length === 1 ? "" : "s"} bound
          </span>
        </div>
      </div>

      <div style={{ marginBottom: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "10px",
            backgroundColor: "#064e3b",
            color: "#34d399",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          LOCAL
        </span>
        <span
          style={{
            fontSize: "10px",
            backgroundColor: "#78350f",
            color: "#fcd34d",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          PUBLIC WEB FETCH
        </span>
        <span
          style={{
            fontSize: "10px",
            backgroundColor: "#7f1d1d",
            color: "#fca5a5",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          EXTERNAL PROVIDER
        </span>
      </div>

      {bindings.length === 0 ? (
        <div style={{ color: "#71798e", padding: "16px 0", textAlign: "center" }}>
          No data bindings connected. Dynamic variables bind safely without code execution.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {bindings.map((binding) => {
            const badge = getBoundaryBadge(binding.privacyBoundary);
            return (
              <div
                key={binding.id}
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
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#60a5fa" }}>${binding.variable}</span>
                  <span
                    style={{
                      backgroundColor: badge.bg,
                      color: badge.color,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#8e95a5", marginBottom: "4px" }}>
                  Source: {binding.source.type}
                </div>
                {binding.transform && (
                  <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
                    Transform: {binding.transform.type}
                  </div>
                )}
                {onRemoveBinding && (
                  <button
                    type="button"
                    onClick={() => onRemoveBinding(binding.id)}
                    style={{
                      marginTop: "6px",
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "11px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {onAddBinding && (
        <button
          type="button"
          className="studio-btn"
          onClick={onAddBinding}
          style={{ width: "100%", marginTop: "10px" }}
        >
          + Bind Variable
        </button>
      )}
    </div>
  );
};
