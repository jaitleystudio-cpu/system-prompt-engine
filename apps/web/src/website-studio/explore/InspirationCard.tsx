import React from "react";

export interface InspirationItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags?: string[];
  features?: string[];
}

export interface InspirationCardProps {
  item: InspirationItem;
  onSelect?: (item: InspirationItem) => void;
  onAnalyze?: (item: InspirationItem) => void;
  onBlend?: (item: InspirationItem) => void;
  selected?: boolean;
}

export const InspirationCard: React.FC<InspirationCardProps> = ({
  item,
  onSelect,
  onAnalyze,
  onBlend,
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
      <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => onSelect?.(item)}
          style={{
            flex: "1 1 auto",
            fontSize: "11px",
            padding: "6px 10px",
            minHeight: "34px",
          }}
          data-testid={`use-${item.id}`}
          aria-label={`Use ${item.title}`}
        >
          Use Recipe
        </button>
        <button
          type="button"
          className="studio-btn"
          onClick={() => onAnalyze?.(item)}
          style={{
            fontSize: "11px",
            padding: "6px 10px",
            minHeight: "34px",
          }}
          data-testid={`analyze-${item.id}`}
          aria-label={`Analyze ${item.title}`}
        >
          Analyze
        </button>
        <button
          type="button"
          className="studio-btn"
          onClick={() => onBlend?.(item)}
          style={{
            fontSize: "11px",
            padding: "6px 10px",
            minHeight: "34px",
          }}
          data-testid={`blend-${item.id}`}
          aria-label={`Blend ${item.title}`}
        >
          Blend DNA
        </button>
      </div>
    </div>
  );
};
