import { useState, useMemo } from "react";
import type { CategoryId } from "@spe/web-runtime";
import { classifyOutcomeIntent } from "../engine/outcomeIntentClassifier";
import {
  compileDeepSpecification,
  type SpecificationTier,
  type ScaledSpecificationPackage,
} from "../engine/deepSpecificationScaler";
import type { ModelDialect } from "../engine/modelTranscompiler";
import { ARSENAL_CATALOG_ASSETS } from "../engine/arsenal/arsenalCatalogData";
import type { ArsenalPromptAsset, ArsenalTargetPlatform } from "../engine/arsenal/arsenalSchema";
import { transcompilePromptForPlatform } from "../engine/arsenal/modelTranscompiler";
import { getAllModels, getModelAtlasStats } from "../engine/modelAtlas/modelAtlasService";
import type { AiModelEntry } from "../engine/modelAtlas/modelAtlasSchema";
import { resolveBrowserVerifiedEntitlement, verifySignedEntitlementToken } from "../engine/entitlementVerifier";
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
  { id: "claude-code", name: "Claude 3.7 / 3.5 Code", file: "CLAUDE.md", icon: "💻", description: "Anthropic Claude 3.7 & 3.5 Sonnet Code terminal rules, tool limits & build contracts" },
  { id: "cursor-rules", name: "Cursor IDE (.cursorrules)", file: ".cursorrules", icon: "🎯", description: "Cursor Agent & Windsurf JSON agent directives & context ceilings" },
  { id: "windsurf-rules", name: "Windsurf IDE Rules", file: ".windsurfrules", icon: "🌊", description: "Codeium Windsurf cascading AST execution rules and system boundaries" },
  { id: "grok", name: "xAI Grok 3", file: "SYSTEM_POLICY.md", icon: "⚡", description: "Grok 3 truth-maximizing mathematical directives & Colossus DeepSearch grounding" },
  { id: "kimi", name: "Moonshot Kimi K1.5", file: "SYSTEM_POLICY.md", icon: "🌙", description: "Kimi K1.5 200k ultra-long context attention anchors & bilingual structure" },
  { id: "openai-markdown", name: "OpenAI o3-mini / GPT-4o", file: "SYSTEM_POLICY.md", icon: "🤖", description: "OpenAI Developer role markdown schemas with bold non-negotiable invariants" },
  { id: "gemini-agent", name: "Google Gemini 2.0 Flash / Pro", file: "SYSTEM_POLICY.md", icon: "💎", description: "Gemini 2.0 bracketed directive blocks, function calling contracts & grounding" },
  { id: "open-weights", name: "DeepSeek-R1 / Llama 3.3", file: "SYSTEM_POLICY.md", icon: "🧠", description: "DeepSeek-R1 & Llama 3.3 token-level ChatML header framing & proof kernel" },
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

const SPONSORED_ADS = [
  {
    id: "ad-groq",
    tag: "SPONSORED COMPUTE",
    title: "⚡ Groq® LPU™ Inference — 500+ Tokens/Sec",
    desc: "Run Llama 3.3 and DeepSeek at instant speed. Get $5 free developer credits with zero credit card required.",
    cta: "Claim $5 Credit →",
    url: "https://groq.com",
  },
  {
    id: "ad-neon",
    tag: "SPONSORED DATABASE",
    title: "🐘 Neon Serverless Postgres — AI Agent Database",
    desc: "Branch databases like Git branches for agent test runs and prompt evaluation workflows.",
    cta: "Start Free on Neon →",
    url: "https://neon.tech",
  },
  {
    id: "ad-cursor",
    tag: "SPONSORED IDE",
    title: "🎯 Cursor IDE — 1-Click System Prompt Execution",
    desc: "Deploy these SPE .cursorrules and system prompts directly into your IDE agent with one click.",
    cta: "Try Cursor Free →",
    url: "https://cursor.com",
  },
];

export function PromptVaultPanel({ onSelectPrompt }: Props) {
  const [panelTab, setPanelTab] = useState<"vault" | "discovery" | "platforms">("vault");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  
  // Model Atlas integration & Tier Authorization
  const verifiedEntitlement = useMemo(() => resolveBrowserVerifiedEntitlement(), []);
  const userTier = verifiedEntitlement?.tier ?? null;
  const allAtlasModels = useMemo(() => getAllModels(), []);
  const atlasStats = useMemo(() => getModelAtlasStats(), []);
  void atlasStats;

  const [activeModelId, setActiveModelId] = useState<string>("claude-3-7-sonnet");
  const [showProUpgradeModal, setShowProUpgradeModal] = useState<boolean>(false);
  const [entitlementTokenInput, setEntitlementTokenInput] = useState<string>("");
  const [tokenActivationMessage, setTokenActivationMessage] = useState<string | null>(null);

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

  const [activeArsenalPlatform, setActiveArsenalPlatform] = useState<ArsenalTargetPlatform>("claude");

  const handleSelectModel = (model: AiModelEntry) => {
    setActiveModelId(model.id);
    setActiveArsenalPlatform(model.dialectTemplateKey as ArsenalTargetPlatform);
  };

  const handleOpenOfflineModal = () => {
    setShowProUpgradeModal(true);
  };

  const handleVerifyToken = () => {
    if (!entitlementTokenInput.trim()) return;
    const res = verifySignedEntitlementToken(entitlementTokenInput.trim());
    if (res.verified) {
      localStorage.setItem("spe_browser_entitlement_v1", entitlementTokenInput.trim());
      setTokenActivationMessage("Entitlement activated successfully! Pro capabilities unlocked.");
      setTimeout(() => {
        setShowProUpgradeModal(false);
        setTokenActivationMessage(null);
        window.location.reload();
      }, 1000);
    } else {
      setTokenActivationMessage(`Verification failed: ${res.rejectionReason || "Invalid signature"}`);
    }
  };

  const categories = [
    "All",
    "Software & DevOps",
    "Digital Marketing & SEO",
    "Business & Operations",
    "UI/UX & Web Design",
    "Research & Education",
    "Image Generation",
    "Video & Motion",
    "Audio, Speech & Music",
    "Sales & CRM",
    "Finance & Analytics",
    "Customer Support & HR",
    "Legal & Compliance",
    "Writing & Productivity",
  ];

  const filteredArsenalAssets = useMemo(() => {
    return ARSENAL_CATALOG_ASSETS.filter((p) => {
      const matchCat = selectedCat === "All" || p.domain === selectedCat;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.subdomain.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q);
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

  const getCompiledText = (p: ArsenalPromptAsset) => {
    const vars = varValues[p.id] || {};
    return transcompilePromptForPlatform(p, activeArsenalPlatform, vars, {
      specificModelId: activeModelId,
      tier: userTier,
    });
  };

  const handleLoad = (p: ArsenalPromptAsset) => {
    const text = getCompiledText(p);
    let targetCat: CategoryId = "Writing";
    if (
      p.domain === "Digital Marketing & SEO" ||
      p.domain === "Business & Operations" ||
      p.domain === "Sales & CRM" ||
      p.domain === "Finance & Analytics"
    ) {
      targetCat = "Business";
    } else if (p.domain === "Software & DevOps" || p.domain === "UI/UX & Web Design") {
      targetCat = "Coding";
    }
    onSelectPrompt(text, targetCat);

    const studioEl = document.getElementById("prompt-studio");
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopy = (p: ArsenalPromptAsset) => {
    const text = getCompiledText(p);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSendToExternal = (p: ArsenalPromptAsset, url: string) => {
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
    <section className="spe-vault-panel" id="power-prompts-vault" data-copy-depth="PROOF" aria-label="Power Prompts and Platform Harness">
      <div className="spe-vault-header">
        <div className="spe-vault-badge-row">
          <div className="spe-vault-tab-switch">
            <button
              type="button"
              className={`spe-vault-tab-btn ${panelTab === "vault" ? "active" : ""}`}
              onClick={() => setPanelTab("vault")}
            >
              ⚡ Universal Prompt Arsenal (10,000+)
            </button>
            <button
              type="button"
              className={`spe-vault-tab-btn ${panelTab === "discovery" ? "active" : ""}`}
              onClick={() => setPanelTab("discovery")}
            >
              🎯 Simple Idea to Pro Prompt
            </button>
            <button
              type="button"
              className={`spe-vault-tab-btn ${panelTab === "platforms" ? "active" : ""}`}
              onClick={() => setPanelTab("platforms")}
            >
              🌐 100,000+ Char (1 Lakh+) Blueprints &amp; 101 Skills
            </button>
          </div>

          <div className="spe-vault-model-pills">
            {allAtlasModels.slice(0, 8).map((m) => {
              const isActive = activeModelId === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  className={`spe-vault-model-tag ${isActive ? "active" : ""}`}
                  onClick={() => handleSelectModel(m)}
                  style={{ cursor: "pointer", border: "none" }}
                  title={`${m.name} (${m.category})`}
                >
                  <span>{m.name.split(" (")[0]}</span>
                  {m.capabilities.supportsThinking ? (
                    <span className="spe-model-thinking-badge" aria-label="Reasoning model">
                      🧠 REASONING
                    </span>
                  ) : m.capabilities.supportsVision ? (
                    <span className="spe-model-vision-badge" aria-label="Vision model">
                      👁️ VISION
                    </span>
                  ) : (
                    <span className="spe-model-free-badge">⚡ FAST</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {panelTab === "vault" ? (
          <>
            <h2 className="spe-vault-title">Universal Prompt Arsenal — 10,000+ Production Prompts (100% Free on the Web)</h2>
            <p className="spe-vault-subtitle">
              All 10,000+ prompts are 100% free for everyone on the website, supported by developer sponsorships. Browse verified, task-specific prompt assets across 13 professional domains. Dynamically adapted for Claude 3.7 Sonnet, OpenAI o3-mini, Gemini 2.0, Grok 3, DeepSeek-R1, and Midjourney.
            </p>
          </>
        ) : panelTab === "discovery" ? (
          <>
            <h2 className="spe-vault-title">Turn Any Simple Idea Into a Clear Step-by-Step Prompt</h2>
            <p className="spe-vault-subtitle">
              Type a short request in plain English (or speak in 36+ languages). SPE turns complex tasks into structured instructions while letting simple questions pass through without delay.
            </p>
          </>
        ) : (
          <>
            <h2 className="spe-vault-title">100,000+ Character (1 Lakh+) Blueprints &amp; 1-Click Agent Rules</h2>
            <p className="spe-vault-subtitle">
              Build up to 100,000+ characters (1 Lakh+) of clean instructions for Antigravity Skills, Claude Code, Cursor, Windsurf, Grok, Kimi, and ChatGPT — 100% free on your device.
            </p>
          </>
        )}
      </div>

      {panelTab === "vault" && (
        <>
          <div className="spe-vault-sponsored-banner">
            <div className="spe-sponsor-badge">SPONSORED PARTNER COMPUTE</div>
            <div className="spe-sponsor-info">
              <div className="spe-sponsor-title">⚡ Run Prompts with $5 Free Cloud API Credits on OpenRouter &amp; Together AI</div>
              <div className="spe-sponsor-desc">Execute Claude 3.7, o3-mini, and DeepSeek-R1 at sub-200ms latency with zero setup.</div>
            </div>
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="spe-sponsor-cta"
            >
              Claim $5 Free Compute &rarr;
            </a>
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
              <button
                type="button"
                className="spe-vault-cat-btn"
                style={{ borderColor: "rgba(245, 158, 11, 0.45)", color: "#fbbf24", background: "rgba(245, 158, 11, 0.1)" }}
                onClick={handleOpenOfflineModal}
              >
                📥 Download Offline Catalog (Pro)
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target AI Model:
              </span>
              {[
                { id: "claude", label: "Claude 3.7 Sonnet (Thinking)" },
                { id: "chatgpt", label: "OpenAI o3-mini / GPT-4o" },
                { id: "gemini", label: "Gemini 2.0 Flash / Pro" },
                { id: "grok", label: "xAI Grok 3" },
                { id: "cursor", label: "Cursor IDE (.cursorrules)" },
                { id: "midjourney", label: "Midjourney v6.1" },
                { id: "flux", label: "FLUX.1 [pro]" },
                { id: "runway", label: "Runway Gen-3" },
                { id: "suno", label: "Suno v4" },
              ].map((plat) => (
                <button
                  type="button"
                  key={plat.id}
                  className={`spe-vault-cat-btn ${activeArsenalPlatform === plat.id ? "active" : ""}`}
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                  onClick={() => setActiveArsenalPlatform(plat.id as ArsenalTargetPlatform)}
                >
                  {plat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="spe-vault-grid">
            {filteredArsenalAssets.flatMap((p, idx) => {
              const isExpanded = expandedCardId === p.id;
              const currentVars = varValues[p.id] || {};
              const isCopied = copiedId === p.id;

              const elements = [
                <div className="spe-vault-card" key={p.id}>
                  <div className="spe-card-header">
                    <div className="spe-card-header-left">
                      <span className="spe-card-icon" aria-hidden="true">{p.icon}</span>
                      <div className="spe-card-title-wrap">
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span className="spe-card-cat-badge">{p.domain}</span>
                          <span style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase" }}>{p.subdomain}</span>
                        </div>
                        <h3>{p.title}</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="spe-btn-secondary"
                      style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                      onClick={() => setExpandedCardId(isExpanded ? null : p.id)}
                    >
                      {isExpanded ? "Hide" : "Edit / Variables"}
                    </button>
                  </div>

                  <p className="spe-card-tagline">{p.tagline}</p>

                  <div className="spe-card-outcome">
                    <strong>Constraints:</strong> {p.constraints.slice(0, 2).join("; ")}
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
              ];

              if ((idx + 1) % 6 === 0) {
                const ad = SPONSORED_ADS[(Math.floor(idx / 6)) % SPONSORED_ADS.length];
                elements.push(
                  <div className="spe-vault-card spe-vault-infeed-ad-card spe-vault-card-ad" key={`infeed-ad-${idx}`}>
                    <div className="spe-card-header">
                      <div className="spe-card-header-left">
                        <span className="spe-card-icon" aria-hidden="true">🚀</span>
                        <div className="spe-card-title-wrap">
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <span className="spe-sponsor-badge">{ad.tag}</span>
                          </div>
                          <h3>{ad.title}</h3>
                        </div>
                      </div>
                    </div>
                    <p className="spe-card-tagline">{ad.desc}</p>
                    <div className="spe-card-outcome" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Monetization partner supporting 100% free prompt access for all web users.
                    </div>
                    <div className="spe-card-actions" style={{ marginTop: "1rem" }}>
                      <a
                        href={ad.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="spe-sponsor-cta"
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        {ad.cta}
                      </a>
                    </div>
                  </div>
                );
              }

              return elements;
            })}
          </div>

          <div className="spe-vault-ad-slot-wrap" aria-label="Advertisement">
            <div className="spe-ad-label">ADVERTISEMENT • SUPPORTING FREE WEB ACCESS FOR ALL</div>
            <div className="spe-ad-display-box">
              <div className="spe-ad-content">
                <span className="spe-ad-logo" aria-hidden="true">⚡</span>
                <div>
                  <strong style={{ color: "#ffffff", fontSize: "0.95rem" }}>Groq® LPU™ Inference — Run Prompts at 500+ Tokens/Sec</strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>Deploy Llama 3.3 and DeepSeek-R1 with zero credit card required. Free developer credits included.</p>
                </div>
              </div>
              <a
                href="https://groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="spe-btn-ad-visit"
              >
                Claim Free Inference &rarr;
              </a>
            </div>
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
                  {discoveryResult.suggestedAction}. Engineered for {activeModelId.toUpperCase()}.
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
                <span>Cryptographic Local Verification • Commercial IP Protection • Zero Unauthorized Data Egress</span>
              </div>
              <span className="spe-platform-guarantee-badge">SPE Ω CERTIFIED</span>
            </div>
          </div>
        </div>
      )}

      {showProUpgradeModal && (
        <div className="spe-pro-modal-backdrop" onClick={() => setShowProUpgradeModal(false)}>
          <div className="spe-pro-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="spe-pro-modal-header">
              <h3 className="spe-pro-modal-title">
                <span aria-hidden="true">🔒</span>
                Offline Air-Gapped Catalog — SPE Pro
              </h3>
              <button
                type="button"
                className="spe-pro-modal-close"
                onClick={() => setShowProUpgradeModal(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div className="spe-pro-modal-body">
              <p>
                <strong>Web access is 100% free and ad-supported for all 10,000+ prompts across all models.</strong> Offline air-gapped downloads, bulk JSON database bundles, and offline CLI compiler engines require an active SPE Pro entitlement.
              </p>

              <ul className="spe-pro-perks-list">
                <li><span>📥</span> Full 10,000+ Prompt Catalog JSON bundle for air-gapped local execution</li>
                <li><span>🛡️</span> Zero network telemetry, local offline CLI compiling &amp; validation</li>
                <li><span>💎</span> 100% clean, unwatermarked exports on web and local desktop</li>
                <li><span>🚫</span> 100% ad-free experience across the entire web interface</li>
              </ul>

              <div className="spe-pro-modal-actions">
                <a
                  href="#pricing"
                  className="spe-pro-upgrade-btn"
                  onClick={() => setShowProUpgradeModal(false)}
                >
                  Upgrade to Pro ($9/mo) &rarr;
                </a>

                <div className="spe-pro-token-section">
                  <label htmlFor="spe-token-input" className="spe-pro-token-label">
                    Already have a signed license token?
                  </label>
                  <div className="spe-pro-token-input-row">
                    <input
                      id="spe-token-input"
                      type="text"
                      className="spe-pro-token-input"
                      placeholder="spe_entitlement.v1..."
                      value={entitlementTokenInput}
                      onChange={(e) => setEntitlementTokenInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="spe-pro-token-verify-btn"
                      onClick={handleVerifyToken}
                    >
                      Verify
                    </button>
                  </div>
                  {tokenActivationMessage && (
                    <p style={{ fontSize: "0.75rem", marginTop: "0.4rem", color: tokenActivationMessage.includes("success") ? "#34d399" : "#f87171" }}>
                      {tokenActivationMessage}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="spe-pro-modal-dismiss-btn"
                  onClick={() => setShowProUpgradeModal(false)}
                >
                  Continue Free Online (Ad-Supported)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
