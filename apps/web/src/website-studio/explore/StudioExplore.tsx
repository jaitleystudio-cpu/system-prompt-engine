import React, { useState } from "react";
import { InspirationCard } from "./InspirationCard.tsx";
import {
  CURATED_INSPIRATION_RECIPES,
  type InspirationItem,
} from "./inspirationRecipes.ts";

export { CURATED_INSPIRATION_RECIPES } from "./inspirationRecipes.ts";

export interface StudioExploreProps {
  onSelectRecipe?: (item: InspirationItem) => void;
  selectedId?: string;
}

export const StudioExplore: React.FC<StudioExploreProps> = ({
  onSelectRecipe,
  selectedId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const categories = ["All", "E-Commerce", "Real Estate & Architecture", "Creative & Agency", "Technology"];

  const filtered = CURATED_INSPIRATION_RECIPES.filter((item) => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesQuery =
      query === "" ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div
      className="studio-explore"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
        backgroundColor: "#0f1118",
        borderRadius: "8px",
        border: "1px solid #232736",
      }}
      data-testid="studio-explore"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#f4f5f8" }}>Inspiration Recipes</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8e95a5" }}>
            Curated 3D website recipes with tested camera plans, motion blocks, and behavior graphs.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          className="studio-input"
          placeholder="Filter recipes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: "260px" }}
          aria-label="Filter recipes"
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`studio-btn ${selectedCategory === cat ? "studio-btn-primary" : ""}`}
              onClick={() => setSelectedCategory(cat)}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "14px",
        }}
      >
        {filtered.map((item) => (
          <InspirationCard
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onSelect={onSelectRecipe}
          />
        ))}
      </div>
    </div>
  );
};
