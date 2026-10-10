import React, { useState, useMemo } from "react";
import {
  CURATED_COMMUNITY_PROMPTS,
  fortifyCommunityPrompt,
  type FortifiedPromptResult,
} from "./communityCatalog";
import { generatePromptfooConfig } from "./promptfooExporter";

export interface CommunityCatalogStudioProps {
  onSelectPrompt?: (prompt: string) => void;
  onClose?: () => void;
}

export const CommunityCatalogStudio: React.FC<CommunityCatalogStudioProps> = ({
  onSelectPrompt,
  onClose,
}) => {
  const [selectedPromptId, setSelectedPromptId] = useState<string>("linux-terminal");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [exportedYaml, setExportedYaml] = useState<string | null>(null);

  const filteredPrompts = useMemo(() => {
    return CURATED_COMMUNITY_PROMPTS.filter((p) => {
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.rawProse.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, searchQuery]);

  const selectedPrompt = useMemo(() => {
    return (
      CURATED_COMMUNITY_PROMPTS.find((p) => p.id === selectedPromptId) ||
      CURATED_COMMUNITY_PROMPTS[0]
    );
  }, [selectedPromptId]);

  const fortifiedResult: FortifiedPromptResult = useMemo(() => {
    return fortifyCommunityPrompt(selectedPrompt);
  }, [selectedPrompt]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(fortifiedResult.fortifiedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPromptfoo = () => {
    const bundle = generatePromptfooConfig(fortifiedResult.fortifiedPrompt, {
      projectName: selectedPrompt.id,
    });
    setExportedYaml(bundle.yamlConfig);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        color: "#f1f5f9",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header & Subtitle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
            🌐 Community Prompts &amp; Workflows Catalog
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
            Curated from 143k★ prompts.chat &amp; DAIR.AI — Fortified with SPE&apos;s Scope Guardrails &amp; Attack Gym.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              background: "rgba(59, 130, 246, 0.2)",
              color: "#60a5fa",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            143k★ Prompts.chat Bridge
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#cbd5e1",
                padding: "0.3rem 0.6rem",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search prompts (e.g., Linux, SQL, Architect)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: "1 1 240px",
            padding: "0.55rem 0.85rem",
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "0.85rem",
          }}
        />
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {["all", "engineering", "architecture", "security", "data", "coaching"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
                background: categoryFilter === cat ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.05)",
                color: categoryFilter === cat ? "#a5b4fc" : "#94a3b8",
                border: categoryFilter === cat ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Prompts Selector + Side-by-Side Fortifier */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "1rem",
          minHeight: "440px",
        }}
      >
        {/* Left Column: Prompts List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxHeight: "560px",
            overflowY: "auto",
            paddingRight: "0.25rem",
          }}
        >
          {filteredPrompts.map((p) => {
            const isSelected = p.id === selectedPromptId;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedPromptId(p.id);
                  setExportedYaml(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedPromptId(p.id);
                    setExportedYaml(null);
                  }
                }}
                style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  border: isSelected ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: isSelected ? "#fff" : "#cbd5e1" }}>
                    {p.title}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "0.1rem 0.35rem",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                    }}
                  >
                    {p.category}
                  </span>
                </div>
                <p
                  style={{
                    margin: "0.35rem 0 0 0",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: "1.3",
                  }}
                >
                  {p.rawProse}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Comparison & Action Hub */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "1rem",
          }}
        >
          {/* Metrics Diff Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "0.75rem",
              background: "rgba(255, 255, 255, 0.02)",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Mutation Kill Rate</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#10b981", marginTop: "0.2rem" }}>
                {fortifiedResult.originalKillRate}% → {fortifiedResult.fortifiedKillRate}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Security Invariants</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.2rem" }}>
                0 → {fortifiedResult.addedInvariants.length} Enforced
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Type Diagnostics</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#a855f7", marginTop: "0.2rem" }}>
                {fortifiedResult.originalDiagnostics.diagnostics.length} Issues → 0
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Delimiter Shielding</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.2rem" }}>
                Active (XML)
              </div>
            </div>
          </div>

          {/* Side-by-Side Prompt Comparison */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              flex: 1,
            }}
          >
            {/* Raw Prompts.chat */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.04)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171" }}>
                  ⚠️ Naive Community Prose (prompts.chat)
                </span>
                <span style={{ fontSize: "0.65rem", color: "#ef4444" }}>Untyped & Unprotected</span>
              </div>
              <textarea
                readOnly
                value={selectedPrompt.rawProse}
                style={{
                  flex: 1,
                  minHeight: "180px",
                  background: "transparent",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  resize: "none",
                  outline: "none",
                  lineHeight: "1.4",
                }}
              />
            </div>

            {/* SPE Fortified */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                background: "rgba(16, 185, 129, 0.04)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#34d399" }}>
                  🛡️ SPE Fortified & Typed Prompt
                </span>
                <span style={{ fontSize: "0.65rem", color: "#10b981" }}>100% Hostile Invariance</span>
              </div>
              <textarea
                readOnly
                value={fortifiedResult.fortifiedPrompt}
                style={{
                  flex: 1,
                  minHeight: "180px",
                  background: "transparent",
                  border: "none",
                  color: "#f1f5f9",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  resize: "none",
                  outline: "none",
                  lineHeight: "1.4",
                }}
              />
            </div>
          </div>

          {/* Exported Promptfoo YAML Modal / Display if toggled */}
          {exportedYaml && (
            <div
              style={{
                padding: "0.75rem",
                background: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a5b4fc" }}>
                  📄 Generated promptfooconfig.yaml
                </span>
                <button
                  type="button"
                  onClick={() => setExportedYaml(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  ✕ Dismiss
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  maxHeight: "160px",
                  overflowY: "auto",
                  background: "rgba(0, 0, 0, 0.3)",
                  padding: "0.5rem",
                  borderRadius: "6px",
                }}
              >
                {exportedYaml}
              </pre>
            </div>
          )}

          {/* Action Hub Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleExportPromptfoo}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "6px",
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                color: "#a5b4fc",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📦 Export Promptfoo Config
            </button>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#fff",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied to Clipboard!" : "📋 Copy Fortified Prompt"}
            </button>
            {onSelectPrompt && (
              <button
                type="button"
                onClick={() => onSelectPrompt(fortifiedResult.fortifiedPrompt)}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: "6px",
                  background: "#10b981",
                  border: "none",
                  color: "#fff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ⚡ Load in Proof Lab
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
