import React from "react";
export type { InspirationItem } from "./inspirationRecipes.ts";
import type { InspirationItem } from "./inspirationRecipes.ts";

export interface InspirationCardProps {
  item: InspirationItem;
  onSelect?: (item: InspirationItem) => void;
  selected?: boolean;
}

export const InspirationCard: React.FC<InspirationCardProps> = ({
  item,
  onSelect,
  selected = false,
}) => {
  return (
    <div
      className={`inspiration-card ${selected ? "selected" : ""}`}
      style={{
        backgroundColor: "#161922",
        border: selected ? "1px solid #3b82f6" : "1px solid #232736",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "border-color 0.2s ease",
      }}
      data-testid={`inspiration-card-${item.id}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h4 style={{ margin: 0, fontSize: "15px", color: "#f4f5f8" }}>{item.title}</h4>
        <span
          style={{
            fontSize: "11px",
            color: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 600,
          }}
        >
          {item.category}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "#8e95a5", lineHeight: "1.4" }}>
        {item.description}
      </p>
      {item.tags && item.tags.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {item.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "11px",
                color: "#71798e",
                backgroundColor: "#0d0f15",
                padding: "2px 6px",
                borderRadius: "3px",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        className="studio-btn studio-btn-primary"
        onClick={() => onSelect?.(item)}
        style={{
          marginTop: "6px",
          width: "100%",
          cursor: "pointer",
        }}
        aria-label={`Select ${item.title}`}
      >
        Use Recipe
      </button>
    </div>
  );
};
