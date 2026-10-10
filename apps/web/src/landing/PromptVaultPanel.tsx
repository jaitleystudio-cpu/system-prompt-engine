import { useState, useMemo } from "react";
import type { CategoryId } from "@spe/web-runtime";
import {
  POWER_PROMPTS_VAULT,
  compilePowerPrompt,
  type PowerPrompt,
} from "../engine/powerPromptsCatalog";
import { classifyOutcomeIntent } from "../engine/outcomeIntentClassifier";
import {
  compileDeepSpecification,
  type SpecificationTier,
  type ScaledSpecificationPackage,
} from "../engine/deepSpecificationScaler";
import type { ModelDialect } from "../engine/modelTranscompiler";
import "./prompt-vault-panel.css";

interface Props {
  onSelectPrompt: (compiledPrompt: string, category: CategoryId) => void;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PLATFORMS: { id: ModelDialect; name: string; file: string; icon: string; description: string }[] = [
  { id: "antigravity-skills", name: "Antigravity Skills", file: "SKILL.md", icon: "🌟", description: "Google DeepMind Skills format with YAML frontmatter & <RULE> invariants" },
  { id: "claude-code", name: "Claude 6.2 Code", file: "CLAUDE.md", icon: "💻", description: "Anthropic Claude 6.1/6.2 Code terminal rules, tool limits & build contracts" },
  { id: "cursor-rules", name: "Cursor 4.9 IDE", file: ".cursorrules", icon: "🎯", description: "Cursor 4.9 & Windsurf 4.9 JSON agent directives & context ceilings" },
  { id: "windsurf-rules", name: "Windsurf 4.9 IDE", file: ".windsurfrules", icon: "🌊", description: "Codeium Windsurf 4.9 AST rules & cascading execution bounds" },
  { id: "grok", name: "xAI Grok 4.9", file: "SYSTEM_POLICY.md", icon: "⚡", description: "Grok 4.9 truth-maximizing mathematical directives & real-time grounding" },
  { id: "kimi", name: "Moonshot Kimi 3.5", file: "SYSTEM_POLICY.md", icon: "🌙", description: "Kimi 3.5 200k ultra-long context attention anchors & bilingual structure" },
  { id: "openai-markdown", name: "OpenAI 6 / o3-Pro", file: "SYSTEM_POLICY.md", icon: "🤖", description: "OpenAI 6 Developer role markdown schemas with bold non-negotiable invariants" },
  { id: "gemini-agent", name: "Google Gemini 3.9 Pro", file: "SYSTEM_POLICY.md", icon: "💎", description: "Gemini 3.9 Pro bracketed directive blocks, function calling contracts & grounding" },
  { id: "open-weights", name: "DeepSeek 4.5 / Llama 4", file: "SYSTEM_POLICY.md", icon: "🧠", description: "DeepSeek 4.5 & Llama 4 token-level ChatML header framing & proof kernel" },
  { id: "ollama-modelfile", name: "Ollama / Local", file: "Modelfile", icon: "🦙", description: "Docker-like local Modelfile with PARAMETER and SYSTEM blocks" },
];

const SPEC_TIERS: { id: SpecificationTier; label: string; badge: string; desc: string }[] = [
  { id: "STANDARD_1_5K", label: "1.5K Standard", badge: "1 Volume", desc: "Core single-file specification" },
  { id: "DEEP_15K", label: "15K Deep", badge: "3 Volumes", desc: "Intent, interfaces & verification" },
  { id: "OMEGA_30K", label: "30K Architecture", badge: "5 Volumes", desc: "State dynamics, tools & proofs" },
  { id: "MASTER_50K", label: "50K Enterprise", badge: "7 Volumes", desc: "Micro-kernels, memory & release gate" },
  { id: "GOD_MODE_100K", label: "100K Planetary", badge: "10 Volumes", desc: "Complete multi-volume enterprise blueprint" },
];

const PLATFORM_PRESETS = [
  { label: "🛡️ Offline Code Auditor", text: "Build an autonomous offline-first AI code auditor with formal verification" },
  { label: "🌐 3D WebGL Canvas", text: "Design a reactive, WebGL 3D design canvas with accessible controls" },
  { label: "💳 Financial Risk & Fraud", text: "Autonomous financial risk analyzer with zero-trust payment safeguards" },
  { label: "🔬 Causal Inference Lab", text: "Empirical causal inference protocol with DAG structural modeling" },
  { label: "⚡ Distributed Sagas Engine", text: "High-throughput zero-copy event streaming cluster with sagas rollbacks" },
];

export function PromptVaultPanel({ onSelectPrompt }: Props) {
  const [panelTab, setPanelTab] = useState<"vault" | "discovery" | "platforms">("vault");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [activeModel, setActiveModel] = useState<string>("claude-6");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, Record<string, string>>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Discovery state
  const [discoveryInput, setDiscoveryInput] = useState("Build me a shopping app");
  const [copiedDiscovery, setCopiedDiscovery] = useState(false);

  // Universal Platform & Deep Scaler state
  const [platformUserRequest, setPlatformUserRequest] = useState(
    "Build an autonomous offline-first AI code auditor with formal verification"
  );
  const [selectedPlatform, setSelectedPlatform] = useState<ModelDialect>("antigravity-skills");
  const [selectedTier, setSelectedTier] = useState<SpecificationTier>("DEEP_15K");
  const [platformCategory, setPlatformCategory] = useState("Coding");
  const [platformToolsInput, setPlatformToolsInput] = useState(
    "file_read, file_write, bash, terminal, web_search, database_read"
  );
  const [activeVolumeIndex, setActiveVolumeIndex] = useState(1);
  const [copiedPlatformSpec, setCopiedPlatformSpec] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

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

  // Deep Specification computation
  const platformSpecPackage: ScaledSpecificationPackage = useMemo(() => {
    return compileDeepSpecification({
      userRequest: platformUserRequest || "Universal Autonomous AI System Specification",
      category: platformCategory,
      tier: selectedTier,
      targetPlatform: selectedPlatform,
      declaredTools: platformToolsInput,
    });
  }, [platformUserRequest, platformCategory, selectedTier, selectedPlatform, platformToolsInput]);

  const safeActiveVol = useMemo(() => {
    const found = platformSpecPackage.volumes.find((v) => v.volumeIndex === activeVolumeIndex);
    return found || platformSpecPackage.volumes[0] || null;
  }, [platformSpecPackage, activeVolumeIndex]);

  const handleDownloadActiveFile = () => {
    if (!safeActiveVol) return;
    downloadTextFile(safeActiveVol.filename, safeActiveVol.content);
    setDownloadNotice(`Downloaded ${safeActiveVol.filename}`);
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  const handleDownloadPlatformPrimary = () => {
    const primary = platformSpecPackage.exportFiles[0];
    if (!primary) return;
    downloadTextFile(primary.filename, primary.content);
    setDownloadNotice(`Downloaded ${primary.filename}`);
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  const handleDownloadManifest = () => {
    const manifest = platformSpecPackage.exportFiles.find((f) => f.filename === "spe_spec_manifest.json");
    if (!manifest) return;
    downloadTextFile(manifest.filename, manifest.content);
    setDownloadNotice("Downloaded spe_spec_manifest.json");
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  const handleCopyPlatformSpec = () => {
    const fullText = platformSpecPackage.volumes.map((v) => v.content).join("\n\n---\n\n");
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedPlatformSpec(true);
      setTimeout(() => setCopiedPlatformSpec(false), 2000);
    });
  };

  const handleLoadPlatformIntoStudio = () => {
    const fullText = platformSpecPackage.volumes.map((v) => v.content).join("\n\n---\n\n");
    let targetCat: CategoryId = "Coding";
    if (platformCategory === "Business") targetCat = "Business";
    if (platformCategory === "Writing") targetCat = "Writing";
    onSelectPrompt(fullText, targetCat);

    const studioEl = document.getElementById("prompt-studio");
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="spe-vault-panel" id="power-prompts-vault" aria-label="Power Prompts and Platform Harness">
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
            <button
              type="button"
              className={`spe-vault-tab-btn ${panelTab === "platforms" ? "active" : ""}`}
              onClick={() => setPanelTab("platforms")}
            >
              🌐 Universal Platforms & 100k Harness
            </button>
          </div>

          <div className="spe-vault-model-pills">
            <span
              className={`spe-vault-model-tag ${activeModel === "claude-6" ? "active" : ""}`}
              onClick={() => setActiveModel("claude-6")}
              style={{ cursor: "pointer" }}
            >
              Claude 6.2 Sonnet
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "gemini-39" ? "active" : ""}`}
              onClick={() => setActiveModel("gemini-39")}
              style={{ cursor: "pointer" }}
            >
              Gemini 3.9 Pro
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "grok-49" ? "active" : ""}`}
              onClick={() => setActiveModel("grok-49")}
              style={{ cursor: "pointer" }}
            >
              Grok 4.9
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "cursor-49" ? "active" : ""}`}
              onClick={() => setActiveModel("cursor-49")}
              style={{ cursor: "pointer" }}
            >
              Cursor 4.9
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "deepseek-45" ? "active" : ""}`}
              onClick={() => setActiveModel("deepseek-45")}
              style={{ cursor: "pointer" }}
            >
              DeepSeek 4.5
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "kimi-35" ? "active" : ""}`}
              onClick={() => setActiveModel("kimi-35")}
              style={{ cursor: "pointer" }}
            >
              Kimi 3.5
            </span>
            <span
              className={`spe-vault-model-tag ${activeModel === "openai-6" ? "active" : ""}`}
              onClick={() => setActiveModel("openai-6")}
              style={{ cursor: "pointer" }}
            >
              OpenAI 6 / o3-Pro
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
        ) : panelTab === "discovery" ? (
          <>
            <h2 className="spe-vault-title">Outcome Specification Lift Engine</h2>
            <p className="spe-vault-subtitle">
              Translating casual requests into verified 2026 specifications. Evaluates positive complex outcomes vs negative direct queries to prevent chat latency.
            </p>
          </>
        ) : (
          <>
            <h2 className="spe-vault-title">Universal Platform & Multi-Volume Specification Harness</h2>
            <p className="spe-vault-subtitle">
              Compile enterprise specifications for Antigravity Skills, Claude Code, Cursor, Grok, Kimi, and ChatGPT up to 100,000 words. 100% offline, zero cloud API fees.
            </p>
          </>
        )}
      </div>

      {panelTab === "vault" && (
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
      )}

      {panelTab === "discovery" && (
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

      {panelTab === "platforms" && (
        <div className="spe-platform-container">
          {/* Platform Selector Grid */}
          <div className="spe-platform-card">
            <div className="spe-platform-section-title">
              <span>🎯 Step 1: Select Target Platform Architecture</span>
            </div>
            <div className="spe-platform-selector-grid">
              {PLATFORMS.map((plat) => (
                <button
                  type="button"
                  key={plat.id}
                  className={`spe-platform-choice-btn ${selectedPlatform === plat.id ? "active" : ""}`}
                  onClick={() => setSelectedPlatform(plat.id)}
                  title={plat.description}
                >
                  <span className="spe-platform-choice-icon" aria-hidden="true">{plat.icon}</span>
                  <div className="spe-platform-choice-text">
                    <span className="spe-platform-choice-name">{plat.name}</span>
                    <span className="spe-platform-choice-file">{plat.file}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Scale & Word Budget Tier */}
          <div className="spe-platform-card">
            <div className="spe-platform-section-title">
              <span>📊 Step 2: Select Specification Depth & Modular Volume Scale</span>
            </div>
            <div className="spe-platform-tier-row">
              {SPEC_TIERS.map((tier) => (
                <button
                  type="button"
                  key={tier.id}
                  className={`spe-platform-tier-btn ${selectedTier === tier.id ? "active" : ""}`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  <span>{tier.label}</span>
                  <span className="spe-platform-tier-badge">{tier.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User Request & Domain Presets */}
          <div className="spe-platform-card">
            <div className="spe-platform-section-title">
              <span>✍️ Step 3: Define System Intent & Capabilities</span>
            </div>
            <div className="spe-discovery-input-wrap" style={{ marginBottom: "0.75rem" }}>
              <input
                type="text"
                value={platformUserRequest}
                onChange={(e) => setPlatformUserRequest(e.target.value)}
                placeholder="Enter system goal, architecture or agent requirements..."
                className="spe-discovery-text-input"
                aria-label="System specification goal"
              />
              <button
                type="button"
                className="spe-btn-secondary"
                onClick={() => setPlatformUserRequest("")}
              >
                Clear
              </button>
            </div>

            <div className="spe-discovery-chips">
              <span className="spe-discovery-chips-label">Architecture Benchmarks:</span>
              <div className="spe-discovery-chips-list">
                {PLATFORM_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    className={`spe-discovery-chip ${platformUserRequest === p.text ? "active" : ""}`}
                    onClick={() => {
                      setPlatformUserRequest(p.text);
                      if (p.label.includes("3D")) setPlatformCategory("3D");
                      else if (p.label.includes("Risk") || p.label.includes("Fraud")) setPlatformCategory("Business");
                      else if (p.label.includes("Causal")) setPlatformCategory("Research");
                      else setPlatformCategory("Coding");
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Plugin & Skill Safety Auditor */}
          <div className="spe-platform-card">
            <div className="spe-platform-section-title">
              <span>🛡️ Step 4: Active Plugin & Tool Safety Auditor</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="tools-audit-input" style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Declared Tools & Plugins (Comma-separated; redundant tools pruned to reduce attention drift):
              </label>
              <input
                id="tools-audit-input"
                type="text"
                value={platformToolsInput}
                onChange={(e) => setPlatformToolsInput(e.target.value)}
                className="spe-discovery-text-input"
                placeholder="e.g. file_read, file_write, bash, terminal, web_search, stripe"
              />
            </div>

            <div className="spe-platform-auditor-stats">
              <div className="spe-platform-stat-card">
                <div className={`spe-platform-stat-value ${platformSpecPackage.pluginAudit.overallSafetyScore >= 75 ? "score-safe" : "score-warning"}`}>
                  {platformSpecPackage.pluginAudit.overallSafetyScore}/100
                </div>
                <div className="spe-platform-stat-label">Safety Score</div>
              </div>
              <div className="spe-platform-stat-card">
                <div className="spe-platform-stat-value">
                  {platformSpecPackage.pluginAudit.approvedCount} / {platformSpecPackage.pluginAudit.totalAudited}
                </div>
                <div className="spe-platform-stat-label">Approved Tools</div>
              </div>
              <div className="spe-platform-stat-card">
                <div className="spe-platform-stat-value">
                  {platformSpecPackage.pluginAudit.redundantCount}
                </div>
                <div className="spe-platform-stat-label">Redundant Pruned</div>
              </div>
              <div className="spe-platform-stat-card">
                <div className="spe-platform-stat-value" style={{ color: "#34d399" }}>
                  +{platformSpecPackage.pluginAudit.tokensSaved}
                </div>
                <div className="spe-platform-stat-label">Tokens Saved</div>
              </div>
              <div className="spe-platform-stat-card">
                <div className="spe-platform-stat-value">
                  {platformSpecPackage.totalWordCount}
                </div>
                <div className="spe-platform-stat-label">Total Words</div>
              </div>
            </div>

            <div className="spe-platform-tools-badges">
              {platformSpecPackage.pluginAudit.auditedTools.map((t) => (
                <span
                  key={t.name}
                  className={`spe-platform-tool-tag risk-${t.riskLevel} verdict-${t.verdict}`}
                  title={`${t.name}: ${t.reason}`}
                >
                  {t.name} • {t.riskLevel} [{t.verdict}]
                </span>
              ))}
            </div>
          </div>

          {/* Multi-Volume Inspector & Live Preview */}
          <div className="spe-platform-card">
            <div className="spe-platform-section-title" style={{ justifyContent: "space-between" }}>
              <span>📑 Step 5: Multi-Volume Specification Preview</span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>
                Digest: {platformSpecPackage.canonicalDigest.slice(0, 16)}...
              </span>
            </div>

            {/* Volume selector tabs */}
            <div className="spe-platform-volumes-nav">
              {platformSpecPackage.volumes.map((v) => (
                <button
                  type="button"
                  key={v.volumeIndex}
                  className={`spe-platform-volume-tab ${activeVolumeIndex === v.volumeIndex ? "active" : ""}`}
                  onClick={() => setActiveVolumeIndex(v.volumeIndex)}
                >
                  Vol {v.volumeIndex}: {v.filename} ({v.wordCount} words)
                </button>
              ))}
            </div>

            {safeActiveVol && (
              <div className="spe-discovery-prompt-preview" style={{ maxHeight: "380px" }}>
                <pre>{safeActiveVol.content}</pre>
              </div>
            )}

            {downloadNotice && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.825rem", color: "#34d399", fontWeight: 600 }}>
                ✓ {downloadNotice}
              </div>
            )}

            <div className="spe-card-actions" style={{ marginTop: "1.25rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="spe-btn-load"
                onClick={handleDownloadPlatformPrimary}
              >
                Download {PLATFORMS.find((p) => p.id === selectedPlatform)?.file || "File"} 📥
              </button>
              <button
                type="button"
                className="spe-btn-secondary"
                onClick={handleDownloadActiveFile}
              >
                Download Current Volume ({safeActiveVol?.filename}) 📥
              </button>
              <button
                type="button"
                className="spe-btn-secondary"
                onClick={handleDownloadManifest}
              >
                Download Manifest JSON 📋
              </button>
              <button
                type="button"
                className="spe-btn-secondary"
                onClick={handleCopyPlatformSpec}
              >
                {copiedPlatformSpec ? "Copied! ✓" : "Copy All Volumes 📋"}
              </button>
              <button
                type="button"
                className="spe-btn-secondary"
                onClick={handleLoadPlatformIntoStudio}
              >
                Load into Studio ⚡
              </button>
            </div>

            <div className="spe-platform-guarantee-banner">
              <div className="spe-platform-guarantee-text">
                <span aria-hidden="true">🔒</span>
                <span>100% Offline Cryptographic Generation • Zero Cloud API Costs • Zero Telemetry Egress</span>
              </div>
              <span className="spe-platform-guarantee-badge">SPE Ω CERTIFIED</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
