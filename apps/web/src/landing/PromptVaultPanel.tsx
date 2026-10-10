import { useState, useMemo } from "react";
import type { CategoryId } from "@spe/web-runtime";
import {
  POWER_PROMPTS_VAULT,
  compilePowerPrompt,
  type PowerPrompt,
} from "../engine/powerPromptsCatalog";
import { classifyOutcomeIntent } from "../engine/outcomeIntentClassifier";
import "./prompt-vault-panel.css";

interface Props {
  onSelectPrompt: (compiledPrompt: string, category: CategoryId) => void;
}

export function PromptVaultPanel({ onSelectPrompt }: Props) {
  const [panelTab, setPanelTab] = useState<"vault" | "discovery">("vault");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [activeModel, setActiveModel] = useState<string>("claude-6");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, Record<string, string>>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Discovery state
  const [discoveryInput, setDiscoveryInput] = useState("Build me a shopping app");
  const [copiedDiscovery, setCopiedDiscovery] = useState(false);

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

  // Discovery outcome classification
  const discoveryResult = useMemo(() => {
    return classifyOutcomeIntent(discoveryInput);
  }, [discoveryInput]);

  const handleLoadDiscovery = () => {
    if (!discoveryResult.liftedSpecificationPrompt) return;
    let targetCat: CategoryId = "Coding";
    if (discoveryResult.capabilityId === "MARKETING_CAMPAIGN_BRIEF" || discoveryResult.capabilityId === "BUSINESS_PLANNING_SPECIFICATION") {
      targetCat = "Business";
    } else if (discoveryResult.capabilityId === "WRITING_QUALITY_AUDIT" || discoveryResult.capabilityId === "TUTORING_INSTRUCTION_FRAMEWORK") {
      targetCat = "Writing";
    }
    onSelectPrompt(discoveryResult.liftedSpecificationPrompt, targetCat);

    const studioEl = document.getElementById("prompt-studio");
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopyDiscovery = () => {
    if (!discoveryResult.liftedSpecificationPrompt) return;
    navigator.clipboard.writeText(discoveryResult.liftedSpecificationPrompt).then(() => {
      setCopiedDiscovery(true);
      setTimeout(() => setCopiedDiscovery(false), 2000);
    });
  };

  const handleSendDiscoveryExternal = (url: string) => {
    if (!discoveryResult.liftedSpecificationPrompt) return;
    navigator.clipboard.writeText(discoveryResult.liftedSpecificationPrompt).then(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const quickChips = [
    { label: "🛍️ Shopping App", text: "Build me a shopping app" },
    { label: "🌐 3D Website", text: "Design a cinematic 3D website" },
    { label: "🔬 Research Protocol", text: "Research this scientific hypothesis" },
    { label: "🚀 Marketing Campaign", text: "Create a marketing campaign" },
    { label: "📐 Math Tutoring", text: "Help me learn mathematics" },
    { label: "🤖 AI Agent", text: "Create an AI agent" },
    { label: "✍️ Improve Document", text: "Improve this document" },
    { label: "📊 Business Plan", text: "Turn this business idea into a plan" },
    { label: "⚡ Automate Workflow", text: "Make this workflow automatic" },
    { label: "🔢 2 + 2 (Pass-Through)", text: "What is 2 + 2?" },
    { label: "🌍 Trivia (Pass-Through)", text: "What is the capital of France?" },
    { label: "👋 Greeting (Pass-Through)", text: "Good morning" },
  ];

  return (
    <section className="spe-vault-panel" id="power-prompts-vault" aria-label="Power Prompts and Discovery Lift">
      <div className="spe-vault-header">
        <div className="spe-vault-badge-row">
          <div className="spe-vault-tab-switch">
            <button
              type="button"
              className={`spe-vault-tab-btn ${panelTab === "vault" ? "active" : ""}`}
              onClick={() => setPanelTab("vault")}
            >
              ⚡ 1-Click Power Vault
            </button>
            <button
              type="button"
              className={`spe-vault-tab-btn ${panelTab === "discovery" ? "active" : ""}`}
              onClick={() => setPanelTab("discovery")}
            >
              🎯 Smart Outcome Lift
            </button>
          </div>

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

        {panelTab === "vault" ? (
          <>
            <h2 className="spe-vault-title">The Curated 1-Click AI Vault</h2>
            <p className="spe-vault-subtitle">
              Precision-engineered prompts for modern frontier models. Zero hallucinations, built-in invariants, and instant results.
            </p>
          </>
        ) : (
          <>
            <h2 className="spe-vault-title">Outcome Specification Lift Engine</h2>
            <p className="spe-vault-subtitle">
              Translating casual requests into verified 2026 specifications. Evaluates positive complex outcomes vs negative direct queries to prevent chat latency.
            </p>
          </>
        )}
      </div>

      {panelTab === "vault" ? (
        <>
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
        </>
      ) : (
        <div className="spe-discovery-container">
          <div className="spe-discovery-input-box">
            <label htmlFor="discovery-query-input">
              Enter User Request to Evaluate Intent & Specification Lift:
            </label>
            <div className="spe-discovery-input-wrap">
              <input
                id="discovery-query-input"
                type="text"
                value={discoveryInput}
                onChange={(e) => setDiscoveryInput(e.target.value)}
                placeholder="Type request (e.g. 'Build me a shopping app' or 'What is 2+2?')..."
                className="spe-discovery-text-input"
              />
              <button
                type="button"
                className="spe-btn-secondary"
                onClick={() => setDiscoveryInput("")}
              >
                Clear
              </button>
            </div>

            <div className="spe-discovery-chips">
              <span className="spe-discovery-chips-label">Benchmark Scenarios:</span>
              <div className="spe-discovery-chips-list">
                {quickChips.map((qc) => (
                  <button
                    type="button"
                    key={qc.label}
                    className={`spe-discovery-chip ${discoveryInput === qc.text ? "active" : ""}`}
                    onClick={() => setDiscoveryInput(qc.text)}
                  >
                    {qc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`spe-discovery-result-card ${discoveryResult.decision === "SPECIFICATION_LIFT_AVAILABLE" ? "lift-active" : "lift-pass"}`}>
            <div className="spe-discovery-result-header">
              <div className="spe-discovery-status-wrap">
                {discoveryResult.decision === "SPECIFICATION_LIFT_AVAILABLE" ? (
                  <>
                    <span className="spe-discovery-badge-lift">
                      ⚡ SPECIFICATION LIFT TRIGGERED
                    </span>
                    <span className="spe-discovery-capability-title">
                      {discoveryResult.capabilityName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="spe-discovery-badge-pass">
                      🛡️ PASS-THROUGH (TOOL SUPPRESSED)
                    </span>
                    <span className="spe-discovery-capability-title">
                      Direct Answer Query
                    </span>
                  </>
                )}
              </div>

              <div className="spe-discovery-meta-metrics">
                <span>Confidence: <strong>{(discoveryResult.confidence * 100).toFixed(0)}%</strong></span>
                <span>•</span>
                <span>Tool Status: <strong>{discoveryResult.triggered ? "Invoked" : "Zero Overhead"}</strong></span>
              </div>
            </div>

            {discoveryResult.decision === "SPECIFICATION_LIFT_AVAILABLE" ? (
              <div className="spe-discovery-lift-content">
                <p className="spe-discovery-reason">
                  {discoveryResult.suggestedAction}. Engineered for {activeModel.toUpperCase()}.
                </p>
                <div className="spe-discovery-prompt-preview">
                  <pre>{discoveryResult.liftedSpecificationPrompt}</pre>
                </div>
                <div className="spe-card-actions" style={{ marginTop: "1rem" }}>
                  <button
                    type="button"
                    className="spe-btn-load"
                    onClick={handleLoadDiscovery}
                  >
                    Load into Studio ⚡
                  </button>
                  <button
                    type="button"
                    className="spe-btn-secondary"
                    onClick={handleCopyDiscovery}
                  >
                    {copiedDiscovery ? "Copied! ✓" : "Copy 📋"}
                  </button>
                  <button
                    type="button"
                    className="spe-btn-secondary"
                    onClick={() => handleSendDiscoveryExternal("https://chatgpt.com/")}
                  >
                    ChatGPT ↗
                  </button>
                  <button
                    type="button"
                    className="spe-btn-secondary"
                    onClick={() => handleSendDiscoveryExternal("https://claude.ai/new")}
                  >
                    Claude ↗
                  </button>
                </div>
              </div>
            ) : (
              <div className="spe-discovery-pass-content">
                <p className="spe-discovery-pass-text">
                  This query requires a direct conversational or factual answer ({discoveryResult.reason}). SPE intentionally suppresses specification synthesis to preserve native ChatGPT/Claude execution speed.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
