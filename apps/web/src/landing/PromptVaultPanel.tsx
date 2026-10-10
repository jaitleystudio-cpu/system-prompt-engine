import { useState, useMemo } from "react";
import type { CategoryId } from "@spe/web-runtime";
import {
  POWER_PROMPTS_VAULT,
  compilePowerPrompt,
  type PowerPrompt,
} from "../engine/powerPromptsCatalog";
import "./prompt-vault-panel.css";

interface Props {
  onSelectPrompt: (compiledPrompt: string, category: CategoryId) => void;
}

export function PromptVaultPanel({ onSelectPrompt }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [activeModel, setActiveModel] = useState<string>("claude-6");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, Record<string, string>>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ["All", "SEO", "Marketing", "Coding", "Business", "Writing"];

  const filteredPrompts = useMemo(() => {
    return POWER_PROMPTS_VAULT.filter((p) => {
      const matchCat = selectedCat === "All" || p.category === selectedCat;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.outcome.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [search, selectedCat]);

  const handleVarChange = (promptId: string, varName: string, val: string) => {
    setVarValues((prev) => ({
      ...prev,
      [promptId]: {
        ...(prev[promptId] || {}),
        [varName]: val,
      },
    }));
  };

  const getCompiledText = (p: PowerPrompt) => {
    const vars = varValues[p.id] || {};
    return compilePowerPrompt(p, vars);
  };

  const handleLoad = (p: PowerPrompt) => {
    const text = getCompiledText(p);
    let targetCat: CategoryId = "Writing";
    if (p.category === "SEO" || p.category === "Business" || p.category === "Marketing") {
      targetCat = "Business";
    } else if (p.category === "Coding") {
      targetCat = "Coding";
    }
    onSelectPrompt(text, targetCat);

    // Scroll to prompt studio
    const studioEl = document.getElementById("prompt-studio");
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopy = (p: PowerPrompt) => {
    const text = getCompiledText(p);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSendToExternal = (p: PowerPrompt, url: string) => {
    const text = getCompiledText(p);
    navigator.clipboard.writeText(text).then(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <section className="spe-vault-panel" id="power-prompts-vault" aria-label="1-Click Power Prompts">
      <div className="spe-vault-header">
        <div className="spe-vault-badge-row">
          <span className="spe-vault-pill">
            <span>⚡ 1-Click Power Prompts</span>
          </span>
          <div className="spe-vault-model-pills">
            <span
              className={`spe-vault-model-tag ${activeModel === "claude-6" ? "active" : ""}`}
              onClick={() => setActiveModel("claude-6")}
              style={{ cursor: "pointer" }}
            >
              Claude 6.0
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "openai-6" ? "active" : ""}`}
              onClick={() => setActiveModel("openai-6")}
              style={{ cursor: "pointer" }}
            >
              OpenAI 6 / o3
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "astra-6-1" ? "active" : ""}`}
              onClick={() => setActiveModel("astra-6-1")}
              style={{ cursor: "pointer" }}
            >
              Astra 6.1
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "fable-5" ? "active" : ""}`}
              onClick={() => setActiveModel("fable-5")}
              style={{ cursor: "pointer" }}
            >
              Fable 5.0
            </span>
          </div>
        </div>

        <h2 className="spe-vault-title">The Curated 1-Click AI Vault</h2>
        <p className="spe-vault-subtitle">
          Precision-engineered prompts for modern frontier models. Zero hallucinations, built-in invariants, and instant results.
        </p>
      </div>

      <div className="spe-vault-toolbar">
        <input
          type="search"
          className="spe-vault-search"
          placeholder="Search 1-click prompts (SEO, Copywriting, Full-Stack, Sales)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search power prompts"
        />

        <div className="spe-vault-categories">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              className={`spe-vault-cat-btn ${selectedCat === cat ? "active" : ""}`}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="spe-vault-grid">
        {filteredPrompts.map((p) => {
          const isExpanded = expandedCardId === p.id;
          const currentVars = varValues[p.id] || {};
          const isCopied = copiedId === p.id;

          return (
            <div className="spe-vault-card" key={p.id}>
              <div className="spe-card-header">
                <div className="spe-card-header-left">
                  <span className="spe-card-icon" aria-hidden="true">{p.icon}</span>
                  <div className="spe-card-title-wrap">
                    <span className="spe-card-cat-badge">{p.category}</span>
                    <h3>{p.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  className="spe-btn-secondary"
                  style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                  onClick={() => setExpandedCardId(isExpanded ? null : p.id)}
                >
                  {isExpanded ? "Hide" : "Edit"}
                </button>
              </div>

              <p className="spe-card-tagline">{p.tagline}</p>

              <div className="spe-card-outcome">
                <strong>Outcome:</strong> {p.outcome}
              </div>

              {isExpanded && (
                <div className="spe-card-variables">
                  {p.variables.map((v) => (
                    <div className="spe-var-field" key={v.name}>
                      <label htmlFor={`var-${p.id}-${v.name}`}>{v.label}</label>
                      <input
                        id={`var-${p.id}-${v.name}`}
                        type="text"
                        placeholder={v.placeholder}
                        value={currentVars[v.name] ?? v.default ?? ""}
                        onChange={(e) => handleVarChange(p.id, v.name, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="spe-card-actions">
                <button
                  type="button"
                  className="spe-btn-load"
                  onClick={() => handleLoad(p)}
                >
                  Load into Studio ⚡
                </button>
                <button
                  type="button"
                  className="spe-btn-secondary"
                  onClick={() => handleCopy(p)}
                >
                  {isCopied ? "Copied! ✓" : "Copy 📋"}
                </button>
                <button
                  type="button"
                  className="spe-btn-secondary"
                  title="Copy & Open in ChatGPT"
                  onClick={() => handleSendToExternal(p, "https://chatgpt.com/")}
                >
                  ChatGPT ↗
                </button>
                <button
                  type="button"
                  className="spe-btn-secondary"
                  title="Copy & Open in Claude"
                  onClick={() => handleSendToExternal(p, "https://claude.ai/new")}
                >
                  Claude ↗
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
