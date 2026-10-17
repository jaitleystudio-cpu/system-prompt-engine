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
import { getArsenalCatalogList, getArsenalAssetById } from "../engine/arsenal/arsenalHydrator";
import type { ArsenalPromptAsset, ArsenalTargetPlatform } from "../engine/arsenal/arsenalSchema";
import { transcompilePromptForPlatform } from "../engine/arsenal/modelTranscompiler";
import { getAllModels, getModelAtlasStats } from "../engine/modelAtlas/modelAtlasService";
import type { AiModelEntry } from "../engine/modelAtlas/modelAtlasSchema";
import { resolveBrowserVerifiedEntitlement, verifySignedEntitlementToken } from "../engine/entitlementVerifier";
import { FOUNDER_STRATEGY_PRESETS } from "../engine/benchmarks/feedoughComparison";
import { SpePromptPerformanceStudio } from "../engine/arsenal/SpePromptPerformanceStudio";
import "./prompt-vault-panel.css";

interface Props {
  onSelectPrompt: (compiledPrompt: string, category: CategoryId) => void;
  initialAssetId?: string;
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
  { id: "claude-code", name: "Claude Code 2.1 / Sonnet 5.5", file: "CLAUDE.md", icon: "💻", description: "Anthropic Claude Code 2.1.293, Sonnet 5.5 & Opus 5.5 terminal rules, tool limits & build contracts" },
  { id: "cursor-rules", name: "Cursor IDE (.cursorrules)", file: ".cursorrules", icon: "🎯", description: "Cursor Agent & Windsurf JSON agent directives & context ceilings" },
  { id: "windsurf-rules", name: "Windsurf IDE Rules", file: ".windsurfrules", icon: "🌊", description: "Codeium Windsurf cascading AST execution rules and system boundaries" },
  { id: "grok", name: "xAI Grok 4", file: "SYSTEM_POLICY.md", icon: "⚡", description: "Grok 4 truth-maximizing mathematical directives & Colossus DeepSearch grounding" },
  { id: "kimi", name: "Moonshot Kimi K1.5", file: "SYSTEM_POLICY.md", icon: "🌙", description: "Kimi K1.5 200k ultra-long context attention anchors & bilingual structure" },
  { id: "openai-markdown", name: "OpenAI GPT-6.1-Sol / Astra", file: "SYSTEM_POLICY.md", icon: "🤖", description: "OpenAI GPT-6.1-Sol Codex & GPT-6 Astra Developer role markdown schemas with bold non-negotiable invariants" },
  { id: "gemini-agent", name: "Google Gemini 3 Pro / Flash", file: "SYSTEM_POLICY.md", icon: "💎", description: "Gemini 3 bracketed directive blocks, function calling contracts & grounding" },
  { id: "open-weights", name: "Meta Muse Code 1.3 / DeepSeek", file: "SYSTEM_POLICY.md", icon: "🧠", description: "Meta Muse Code 1.3 & DeepSeek Frontier token-level ChatML header framing & proof kernel" },
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
  { label: "🛡️ Secure Code Auditor", text: "Build an autonomous security-first AI code auditor with formal verification" },
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

export function PromptVaultPanel({ onSelectPrompt, initialAssetId }: Props) {
  const [panelTab, setPanelTab] = useState<"vault" | "discovery" | "platforms">("vault");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  
  // Model Atlas integration & Tier Authorization
  const verifiedEntitlement = useMemo(() => resolveBrowserVerifiedEntitlement(), []);
  const userTier = verifiedEntitlement?.tier ?? null;
  const allAtlasModels = useMemo(() => getAllModels(), []);
  const atlasStats = useMemo(() => getModelAtlasStats(), []);
  void atlasStats;

  const [activeModelId, setActiveModelId] = useState<string>("claude-sonnet-4-5");
  const [showProUpgradeModal, setShowProUpgradeModal] = useState<boolean>(false);
  const [entitlementTokenInput, setEntitlementTokenInput] = useState<string>("");
  const [tokenActivationMessage, setTokenActivationMessage] = useState<string | null>(null);

  const [expandedCardId, setExpandedCardId] = useState<string | null>(initialAssetId ?? null);
  const [varValues, setVarValues] = useState<Record<string, Record<string, string>>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [studioAsset, setStudioAsset] = useState<ArsenalPromptAsset | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [copiedDialect, setCopiedDialect] = useState<{ cardId: string; platform: string } | null>(null);

  // Discovery state
  const [discoveryInput, setDiscoveryInput] = useState("Build me a shopping app");
  const [copiedDiscovery, setCopiedDiscovery] = useState(false);

  // Universal Platform & Deep Scaler state
  const [platformUserRequest, setPlatformUserRequest] = useState(
    "Build an autonomous security-first AI code auditor with formal verification"
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

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);

  const categories = [
    { label: "All", count: "10,000+" },
    { label: "Software & DevOps", count: "1,600" },
    { label: "Digital Marketing & SEO", count: "1,200" },
    { label: "Business & Operations", count: "1,000" },
    { label: "UI/UX & Web Design", count: "850" },
    { label: "Research & Education", count: "850" },
    { label: "Image Generation", count: "900" },
    { label: "Video & Motion", count: "700" },
    { label: "Audio, Speech & Music", count: "600" },
    { label: "Sales & CRM", count: "650" },
    { label: "Finance & Analytics", count: "450" },
    { label: "Customer Support & HR", count: "600" },
    { label: "Legal & Compliance", count: "250" },
    { label: "Writing & Productivity", count: "350" },
  ];

  const allCatalogRecords = useMemo(() => getArsenalCatalogList(), []);

  const filteredCatalogRecords = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allCatalogRecords.filter((p) => {
      const matchCat = selectedCat === "All" || p.domain === selectedCat;
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.subdomain.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allCatalogRecords, search, selectedCat]);

  const totalPages = Math.max(1, Math.ceil(filteredCatalogRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const pageRecords = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredCatalogRecords.slice(start, start + pageSize);
  }, [filteredCatalogRecords, safeCurrentPage, pageSize]);

  const pageArsenalAssets = useMemo(() => {
    let list = pageRecords
      .map((r) => {
        const flagship = ARSENAL_CATALOG_ASSETS.find((a) => a.id === r.id);
        if (flagship) return flagship;
        return getArsenalAssetById(r.id);
      })
      .filter((a): a is ArsenalPromptAsset => Boolean(a));

    if (initialAssetId && !list.some((a) => a.id === initialAssetId)) {
      const deepAsset = getArsenalAssetById(initialAssetId);
      if (deepAsset) {
        list = [deepAsset, ...list];
      }
    }
    return list;
  }, [pageRecords, initialAssetId]);

  const handleCategorySelect = (catLabel: string) => {
    setSelectedCat(catLabel);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

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

  const incrementLocalCopyCount = (id: string) => {
    try {
      const current = parseInt(localStorage.getItem(`spe_local_copy_${id}`) || "0", 10);
      localStorage.setItem(`spe_local_copy_${id}`, String(current + 1));
    } catch {
      // Local storage disabled or restricted
    }
  };

  const handleCopy = (p: ArsenalPromptAsset) => {
    const text = getCompiledText(p);
    navigator.clipboard.writeText(text).then(() => {
      incrementLocalCopyCount(p.id);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSendToExternal = (p: ArsenalPromptAsset, url: string) => {
    const text = getCompiledText(p);
    navigator.clipboard.writeText(text).then(() => {
      incrementLocalCopyCount(p.id);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const handleOpenStudio = (p: ArsenalPromptAsset) => {
    setStudioAsset(p);
    setIsStudioOpen(true);
  };

  const handleQuickDialectCopy = (p: ArsenalPromptAsset, targetPlatform: ArsenalTargetPlatform) => {
    const vars = varValues[p.id] || {};
    const compiled = transcompilePromptForPlatform(p, targetPlatform, vars, {
      tier: userTier,
      isWatermarkSuppressed: userTier === "pro",
    });
    navigator.clipboard.writeText(compiled).then(() => {
      incrementLocalCopyCount(p.id);
      setCopiedDialect({ cardId: p.id, platform: targetPlatform });
      setTimeout(() => setCopiedDialect(null), 2000);
    });
  };

  const getAssetUsageLabel = (id: string) => {
    try {
      const localCount = parseInt(localStorage.getItem(`spe_local_copy_${id}`) || "0", 10);
      return {
        localCount,
        statusLabel: "Structure Validated",
        readinessLabel: localCount > 0 ? `Used ${localCount}x locally` : "Template Ready",
      };
    } catch {
      return {
        localCount: 0,
        statusLabel: "Structure Validated",
        readinessLabel: "Template Ready",
      };
    }
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
              All 10,000+ prompts are 100% free for everyone on the website, supported by developer sponsorships. Browse verified, task-specific prompt assets across 13 professional domains. Dynamically adapted for Claude Sonnet 5.5, Claude Code 2.1, OpenAI GPT-6.1-Sol Codex, OpenAI GPT-6 Astra, Meta Muse Code 1.3, Gemini 3 Pro, and DeepSeek Frontier.
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
              <div className="spe-sponsor-title">Run Prompts with $5 Free Cloud API Credits on OpenRouter &amp; Together AI</div>
              <div className="spe-sponsor-desc">Execute Claude Sonnet 5.5, GPT-6.1-Sol, and Meta Muse Code 1.3 at sub-200ms latency with zero setup.</div>
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
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search power prompts"
            />

            <div className="spe-vault-categories">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.label}
                  className={`spe-vault-cat-btn ${selectedCat === cat.label ? "active" : ""}`}
                  onClick={() => handleCategorySelect(cat.label)}
                >
                  <span>{cat.label} ({cat.count})</span>
                </button>
              ))}
              <button
                type="button"
                className="spe-vault-cat-btn"
                style={{ borderColor: "rgba(245, 158, 11, 0.45)", color: "#fbbf24", background: "rgba(245, 158, 11, 0.1)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                onClick={handleOpenOfflineModal}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Offline Catalog (Pro)
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target AI Model:
              </span>
              {[
                { id: "claude", label: "Claude Sonnet 5.5 / Claude Code 2.1" },
                { id: "chatgpt", label: "OpenAI GPT-6.1-Sol Codex / Astra" },
                { id: "gemini", label: "Gemini 3 Pro / Flash" },
                { id: "grok", label: "xAI Grok 4" },
                { id: "cursor", label: "Cursor IDE (.cursorrules)" },
                { id: "midjourney", label: "Midjourney v7" },
                { id: "flux", label: "FLUX.2 [pro]" },
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

          <div className="spe-vault-results-meta" id="spe-vault-catalog-top">
            <div>
              Showing{" "}
              <span className="spe-results-count-highlight">
                {filteredCatalogRecords.length === 0
                  ? 0
                  : `${(safeCurrentPage - 1) * pageSize + 1}–${Math.min(
                      safeCurrentPage * pageSize,
                      filteredCatalogRecords.length
                    )}`}
              </span>{" "}
              of{" "}
              <span className="spe-results-count-highlight">
                {filteredCatalogRecords.length.toLocaleString()}
              </span>{" "}
              Production Prompts {selectedCat !== "All" ? `in ${selectedCat}` : ""}
            </div>
            <div className="spe-results-page-size-wrap">
              <span>Per page:</span>
              {[24, 48, 96].map((sz) => (
                <button
                  type="button"
                  key={sz}
                  className={`spe-results-size-btn ${pageSize === sz ? "active" : ""}`}
                  onClick={() => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="spe-vault-grid">
            {pageArsenalAssets.flatMap((p, idx) => {
              const isExpanded = expandedCardId === p.id;
              const currentVars = varValues[p.id] || {};
              const isCopied = copiedId === p.id;
              const usage = getAssetUsageLabel(p.id);

              const elements = [
                <div className="spe-vault-card" key={p.id}>
                  <div className="spe-card-header">
                    <div className="spe-card-header-left">
                      <span className="spe-card-icon" aria-hidden="true">
                        {p.modality === "image" ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        ) : p.modality === "video" ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        ) : p.modality === "audio" ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                        )}
                      </span>
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
                      {isExpanded ? "Hide" : "Variables"}
                    </button>
                  </div>

                  {/* Structure Verification & Local Usage Metric Row */}
                  <div className="spe-card-social-row">
                    <span className="spe-card-social-metric highlight">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      {usage.readinessLabel}
                    </span>
                    <span className="spe-card-social-metric verified">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      {usage.statusLabel}
                    </span>
                    <span className="spe-card-social-metric">
                      Air-Gap Offline
                    </span>
                  </div>

                  <p className="spe-card-tagline">{p.tagline}</p>

                  <div className="spe-card-outcome">
                    <strong>Constraints:</strong> {p.constraints.slice(0, 2).join("; ")}
                  </div>

                  {/* Compact In-Card Variable Customizer */}
                  {!isExpanded && p.variables.length > 0 && (
                    <div className="spe-card-inline-vars">
                      <div className="spe-card-inline-field">
                        <label htmlFor={`quick-var-${p.id}-${p.variables[0].name}`}>{p.variables[0].label}:</label>
                        <input
                          id={`quick-var-${p.id}-${p.variables[0].name}`}
                          type="text"
                          placeholder={p.variables[0].placeholder}
                          value={currentVars[p.variables[0].name] ?? p.variables[0].default ?? ""}
                          onChange={(e) => handleVarChange(p.id, p.variables[0].name, e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Full Variables Drawer */}
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

                  {/* Multi-Dialect 1-Click Quick-Copy Bar */}
                  <div className="spe-card-dialect-bar">
                    <span className="spe-card-dialect-label">1-Click:</span>
                    {(p.modality === "image"
                      ? [
                          { id: "midjourney", label: "Midjourney" },
                          { id: "flux", label: "FLUX.2" },
                          { id: "chatgpt", label: "ChatGPT" },
                        ]
                      : [
                          { id: "chatgpt", label: "ChatGPT" },
                          { id: "claude", label: "Claude" },
                          { id: "cursor", label: "Cursor" },
                          { id: "local", label: "Local" },
                        ]
                    ).map((target) => {
                      const isDialectCopied =
                        copiedDialect?.cardId === p.id && copiedDialect?.platform === target.id;
                      return (
                        <button
                          type="button"
                          key={target.id}
                          className={`spe-card-dialect-pill ${isDialectCopied ? "copied" : ""}`}
                          onClick={() => handleQuickDialectCopy(p, target.id as ArsenalTargetPlatform)}
                          title={`Copy transcompiled for ${target.label}`}
                        >
                          {isDialectCopied ? "Copied!" : target.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="spe-card-actions">
                    <button
                      type="button"
                      className="spe-btn-studio"
                      onClick={() => handleOpenStudio(p)}
                      title="Open in Prompt Performance Studio"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Studio
                    </button>
                    <button
                      type="button"
                      className="spe-btn-load"
                      onClick={() => handleLoad(p)}
                    >
                      Load into Studio
                    </button>
                    <button
                      type="button"
                      className="spe-btn-secondary"
                      onClick={() => handleCopy(p)}
                    >
                      {isCopied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      type="button"
                      className="spe-btn-secondary"
                      title="Copy & Open in ChatGPT"
                      onClick={() => handleSendToExternal(p, "https://chatgpt.com/")}
                    >
                      ChatGPT &nearr;
                    </button>
                    <button
                      type="button"
                      className="spe-btn-secondary"
                      title="Copy & Open in Claude"
                      onClick={() => handleSendToExternal(p, "https://claude.ai/new")}
                    >
                      Claude &nearr;
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

          {totalPages > 1 && (
            <nav className="spe-vault-pagination-wrap" aria-label="Catalog pages">
              <button
                type="button"
                className="spe-vault-page-nav-btn"
                disabled={safeCurrentPage === 1}
                onClick={() => {
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                  document.getElementById("spe-vault-catalog-top")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                &laquo; Previous
              </button>

              {(() => {
                const pages: (number | string)[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (safeCurrentPage > 3) pages.push("...");
                  const start = Math.max(2, safeCurrentPage - 1);
                  const end = Math.min(totalPages - 1, safeCurrentPage + 1);
                  for (let i = start; i <= end; i++) {
                    if (!pages.includes(i)) pages.push(i);
                  }
                  if (safeCurrentPage < totalPages - 2) pages.push("...");
                  if (!pages.includes(totalPages)) pages.push(totalPages);
                }

                return pages.map((p, pIdx) => {
                  if (typeof p === "string") {
                    return (
                      <span key={`dots-${pIdx}`} className="spe-vault-page-dots" aria-hidden="true">
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      key={p}
                      className={`spe-vault-page-num-btn ${safeCurrentPage === p ? "active" : ""}`}
                      onClick={() => {
                        setCurrentPage(p);
                        document.getElementById("spe-vault-catalog-top")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      aria-current={safeCurrentPage === p ? "page" : undefined}
                    >
                      {p}
                    </button>
                  );
                });
              })()}

              <button
                type="button"
                className="spe-vault-page-nav-btn"
                disabled={safeCurrentPage === totalPages}
                onClick={() => {
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                  document.getElementById("spe-vault-catalog-top")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Next &raquo;
              </button>
            </nav>
          )}

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
                {FOUNDER_STRATEGY_PRESETS.map((fnd) => (
                  <button
                    type="button"
                    key={fnd.id}
                    className={`spe-discovery-chip ${platformUserRequest === fnd.brief ? "active" : ""}`}
                    onClick={() => {
                      setPlatformUserRequest(fnd.brief);
                      setPlatformCategory("Business");
                    }}
                  >
                    {fnd.title}
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "middle", marginRight: "0.4rem" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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
                <li><span>[JSON]</span> Full 10,000+ Prompt Catalog JSON bundle for private local execution</li>
                <li><span>[LOCAL]</span> Zero network telemetry, local private CLI compiling &amp; validation</li>
                <li><span>[PRO]</span> Clean, unwatermarked exports on web and local desktop</li>
                <li><span>[AD-FREE]</span> Ad-free experience across the entire web interface</li>
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

      <SpePromptPerformanceStudio
        asset={studioAsset}
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        onSelectPrompt={onSelectPrompt}
        initialPlatform={activeArsenalPlatform}
        initialVariables={studioAsset ? varValues[studioAsset.id] : undefined}
        entitlement={verifiedEntitlement}
      />
    </section>
  );
}
