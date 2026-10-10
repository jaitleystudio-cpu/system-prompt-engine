import { useState, useId } from "react";
import type { AppView } from "../routing";
import "./spe-universe-deck.css";
import {
  CompilerBotClipart,
  GuardianShieldClipart,
  SpatialCubeClipart,
  MultiAgentSyncClipart,
  VoiceWaveClipart,
  VisionScannerClipart,
  ResearchCodexClipart,
  RadarSentinelClipart,
} from "./SpeCliparts";

function getChamberClipart(chamberId: string) {
  switch (chamberId) {
    case "system-studio":
      return <CompilerBotClipart size={50} />;
    case "attack-gym":
      return <GuardianShieldClipart size={50} />;
    case "3d-studio":
      return <SpatialCubeClipart size={50} />;
    case "multi-export":
      return <MultiAgentSyncClipart size={50} />;
    case "media-to-prompt":
      return <VoiceWaveClipart size={50} />;
    case "vision-to-code":
      return <VisionScannerClipart size={50} />;
    case "research-to-prompt":
      return <ResearchCodexClipart size={50} />;
    case "drift-sentinel":
      return <RadarSentinelClipart size={50} />;
    default:
      return <CompilerBotClipart size={50} />;
  }
}

interface CapabilityChamber {
  id: string;
  category: string;
  title: string;
  tagline: string;
  badge: string;
  isLive: boolean;
  ctaText: string;
  viewTarget?: AppView;
  hashTarget?: string;
  slabA: string;
  slabB: string;
  snippetHeader: string;
  snippetCode: string;
}

const CHAMBERS: CapabilityChamber[] = [
  {
    id: "system-studio",
    category: "Autonomous Coding",
    title: "Reliable System Prompts",
    tagline: "Turn everyday instructions into clear, rock-solid prompts for Claude Code, Cursor, and ChatGPT.",
    badge: "Logic Verification",
    isLive: true,
    ctaText: "Launch Studio →",
    hashTarget: "prompt-studio",
    slabA: "YOUR TASK.",
    slabB: "SOLID PROMPT.",
    snippetHeader: "SPE-STUDIO // SAFETY_CHECK",
    snippetCode: "Core intent: preserved\nContradiction check: 0 conflicts\nPrompt size optimized: -34%",
  },
  {
    id: "attack-gym",
    category: "Financial Compliance",
    title: "Prompt Stress Testing",
    tagline: "Test customer service and billing agents against prompt injections, trick messages, and unauthorized actions.",
    badge: "In-Browser Sandbox",
    isLive: true,
    ctaText: "Run Attack Test →",
    hashTarget: "prompt-studio",
    slabA: "ZERO LEAKS.",
    slabB: "SAFETY GUARD.",
    snippetHeader: "STRESS_TEST // SIMULATION_LOG",
    snippetCode: "Test: Fake manager override\nCheck: Spending limit validation\nResult: ACTION_STOPPED [100% Safe]",
  },
  {
    id: "3d-studio",
    category: "Spatial WebGL",
    title: "Interactive 3D Web Studio",
    tagline: "Create interactive 3D web scenes directly in your browser with live lighting and camera controls.",
    badge: "In-Browser 3D Export",
    isLive: true,
    ctaText: "Build 3D Site →",
    viewTarget: "website",
    slabA: "SPATIAL 3D.",
    slabB: "ZERO GPU COST.",
    snippetHeader: "3D_STUDIO // SPATIAL_SCENE",
    snippetCode: "Geometry: Smooth Icosahedron\nLighting: Natural Studio Environment\nHosting: 100% Free & Private",
  },
  {
    id: "multi-export",
    category: "Multi-Agent Formats",
    title: "One-Click Agent Export",
    tagline: "Export your prompt for Claude Code, Cursor, Windsurf, ChatGPT, and automated test runners with a single click.",
    badge: "Universal Formats",
    isLive: true,
    ctaText: "Export Agent Configs →",
    hashTarget: "prompt-studio",
    slabA: "ONE PROMPT.",
    slabB: "EVERY AGENT.",
    snippetHeader: "EXPORTER // UNIVERSAL_CONFIG",
    snippetCode: "Targets: CLAUDE.md | .cursorrules\nWindsurf: rules_synced\nAutomated tests: ready_to_run",
  },
  {
    id: "media-to-prompt",
    category: "Audio & Video",
    title: "Meeting & Video Transcriber",
    tagline: "Turn meeting recordings, product walkthroughs, and audio notes into crisp, actionable AI instructions.",
    badge: "Private Audio Engine",
    isLive: false,
    ctaText: "Transcribe Media →",
    viewTarget: "media",
    slabA: "VOICE NOTE.",
    slabB: "CLEAR PROMPT.",
    snippetHeader: "AUDIO // PRIVATE_TRANSCRIPT",
    snippetCode: "Source: Product_Planning.mp4\nTranscription: On-Device Speech Engine\nExtracted: 7 key action items",
  },
  {
    id: "vision-to-code",
    category: "Vision to Code",
    title: "Screenshot & URL to Site",
    tagline: "Turn design screenshots or web pages into responsive, accessible React and Tailwind CSS components.",
    badge: "Design to Code",
    isLive: false,
    ctaText: "Convert UI to Code →",
    viewTarget: "code",
    slabA: "SCREENSHOT.",
    slabB: "REACT CODE.",
    snippetHeader: "VISION // UI_TRANSLATION",
    snippetCode: "Input: Design mockup screenshot\nOutput: React + Tailwind CSS\nAccessibility: Fully Keyboard Navigable",
  },
  {
    id: "research-to-prompt",
    category: "Research Synthesis",
    title: "Research & Document Ingestion",
    tagline: "Summarize technical manuals, API guides, and policy documents into clear, step-by-step AI instructions.",
    badge: "Document Extractor",
    isLive: false,
    ctaText: "Ingest Research →",
    viewTarget: "research",
    slabA: "PDF MANUAL.",
    slabB: "ACTION STEPS.",
    snippetHeader: "DOCS // KNOWLEDGE_SUMMARY",
    snippetCode: "Input: Payment System Guide 2026\nExtracted: 14 business rules\nOutput: Clean instruction set",
  },
  {
    id: "drift-sentinel",
    category: "Model Assurance",
    title: "Model Drift & Accuracy Sentinel",
    tagline: "Continuously check your prompts across OpenAI, Anthropic, Google, and local models to catch unexpected changes.",
    badge: "Accuracy Sentinel",
    isLive: false,
    ctaText: "Inspect Drift Sentinel →",
    hashTarget: "prompt-studio",
    slabA: "MODEL DRIFT.",
    slabB: "INSTANT DETECT.",
    snippetHeader: "SENTINEL // ACCURACY_CHECK",
    snippetCode: "Comparison: Claude 6.2 vs Claude 6.1\nFormat changes: 0 errors detected\nStatus: VERIFIED_SAFE",
  },
];

interface CommandCapsule {
  id: string;
  name: string;
  badge: string;
  tier: string;
  desc: string;
}

const COMMAND_CAPSULES: CommandCapsule[] = [
  {
    id: "capsule-1",
    name: "Claude 6",
    badge: "AGENTIC WORKFLOWS",
    tier: "Anthropic",
    desc: "Multi-step reasoning and deep autonomous coding.",
  },
  {
    id: "capsule-2",
    name: "OpenAI 6",
    badge: "DEEP REASONING",
    tier: "OpenAI",
    desc: "Rigorous logical problem solving and strict structured output.",
  },
  {
    id: "capsule-3",
    name: "Google Astra 6.1",
    badge: "MULTIMODAL",
    tier: "Google",
    desc: "Real-time visual and audio understanding with massive context.",
  },
  {
    id: "capsule-4",
    name: "DeepSeek Frontier",
    badge: "OPEN WEIGHTS",
    tier: "DeepSeek",
    desc: "Efficient mathematical reasoning with zero subscription fees.",
  },
  {
    id: "capsule-5",
    name: "Safety Guard",
    badge: "ACTION GATE",
    tier: "Runtime",
    desc: "Stops unauthorized spending or file access before it occurs.",
  },
  {
    id: "capsule-6",
    name: "Self-Healing Prompts",
    badge: "AUTO REPAIR",
    tier: "Reliability",
    desc: "Detects prompt failures and suggests fixes automatically.",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Systems", icon: "✦" },
  { id: "Autonomous Coding", label: "Coding", icon: "⚡" },
  { id: "Financial Compliance", label: "Security", icon: "🛡️" },
  { id: "Spatial WebGL", label: "Spatial 3D", icon: "🪐" },
  { id: "Multi-Agent Formats", label: "Multi-Agent", icon: "🔄" },
  { id: "Audio & Video", label: "Media", icon: "🎙️" },
  { id: "Vision to Code", label: "Vision", icon: "👁️" },
  { id: "Research Synthesis", label: "Research", icon: "📚" },
  { id: "Model Assurance", label: "Assurance", icon: "📊" },
];

interface Props {
  onNavigate?: (view: AppView) => void;
}

export function SpeCapabilityDeck({ onNavigate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeChamberIndex, setActiveChamberIndex] = useState<number>(0);
  const headingId = useId();

  const filteredChambers = selectedCategory === "all"
    ? CHAMBERS
    : CHAMBERS.filter((c) => c.category === selectedCategory);
  const activeChamber = filteredChambers[activeChamberIndex] ?? filteredChambers[0] ?? CHAMBERS[0];

  const handleNext = () => {
    setActiveChamberIndex((prev) => (prev + 1) % filteredChambers.length);
  };

  const handlePrev = () => {
    setActiveChamberIndex((prev) => (prev - 1 + filteredChambers.length) % filteredChambers.length);
  };

  const handleCtaClick = (chamber: CapabilityChamber) => {
    if (chamber.viewTarget && onNavigate) {
      onNavigate(chamber.viewTarget);
    } else if (chamber.hashTarget) {
      const el = document.getElementById(chamber.hashTarget);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="spe-deck-section" aria-labelledby={headingId}>
      <div className="spe-deck-container">
        {/* Top Ticker: Live Now */}
        <div className="spe-hero-live-ticker" role="status" aria-live="polite">
          <span className="spe-ticker-live-badge">FREE &amp; PRIVATE</span>
          <span className="spe-ticker-text">
            SUPPORTS CLAUDE 6, OPENAI 6, ASTRA 6.1, DEEPSEEK &amp; ON-DEVICE SILICON · 100% PRIVATE
          </span>
        </div>

        {/* Clean Header */}
        <header className="spe-deck-story-header">
          <div className="spe-hero-reflective-wrap">
            <h2 id={headingId} className="spe-hero-reflective-h1">
              ONE SYSTEM. EVERY AI AGENT &amp; MODEL
            </h2>
          </div>
          <p className="spe-deck-subtitle">
            Create reliable instructions for your AI in seconds. Test for hallucinations, stop data leaks, and build safe prompts that work across every model — without spending a dollar.
          </p>
        </header>

        {/* Floating Command Category Dock Shelf */}
        <div className="spe-dock-wrapper" role="region" aria-label="Capability category navigation">
          <div className="spe-dock-shelf" role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat.id}
                className={`spe-dock-tab-btn ${selectedCategory === cat.id ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setActiveChamberIndex(0);
                }}
              >
                <span className="spe-dock-tab-icon" aria-hidden="true">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Higgsfield-Style 3D Developer Cards Carousel */}
        <div className="spe-higgs-cards-viewport" role="region" aria-label="Interactive 3D capability cards">
          <div className="spe-higgs-cards-row">
            {filteredChambers.map((chamber, idx) => {
              const isCurrent = idx === activeChamberIndex;
              return (
                <div
                  key={chamber.id}
                  className={`spe-higgs-card ${isCurrent ? "is-focused" : ""}`}
                  style={{
                    transform: isCurrent
                      ? "perspective(1000px) rotateY(0deg) scale(1.02)"
                      : "perspective(1000px) rotateY(-3deg)",
                  }}
                  onClick={() => setActiveChamberIndex(idx)}
                >
                  {/* Viewfinder crosshairs and REC indicator */}
                  <div className="spe-higgs-card-vf" aria-hidden="true">
                    <span className="vf-tl">+</span>
                    <span className="vf-tr">+</span>
                    <span className="vf-bl">+</span>
                    <span className="vf-br">+</span>
                  </div>

                  <div className="spe-higgs-card-topbar">
                    <span className="spe-higgs-rec-pill">
                      <span className="rec-dot" aria-hidden="true" />
                      REC ● {chamber.category.toUpperCase()}
                    </span>
                    <span className="spe-higgs-badge">{chamber.badge}</span>
                  </div>

                  {/* Clipart Icon + 3D Angled Typography Slabs */}
                  <div className="spe-higgs-hero-row">
                    <div className="spe-higgs-clipart-box" aria-hidden="true">
                      {getChamberClipart(chamber.id)}
                    </div>
                    <div className="spe-higgs-slabs" aria-hidden="true">
                      <div className="spe-slab-row slab-a">{chamber.slabA}</div>
                      <div className="spe-slab-row slab-b">{chamber.slabB}</div>
                    </div>
                  </div>

                  {/* Terminal Simulation Body */}
                  <div className="spe-higgs-terminal-body">
                    <div className="spe-higgs-term-header">
                      <span className="spe-higgs-term-title">{chamber.snippetHeader}</span>
                    </div>
                    <pre className="spe-higgs-term-code">
                      <code>{chamber.snippetCode}</code>
                    </pre>
                  </div>

                  {/* Bottom Metadata & Action */}
                  <div className="spe-higgs-card-footer">
                    <div>
                      <h3 className="spe-higgs-footer-title">{chamber.title}</h3>
                      <p className="spe-higgs-footer-tagline">{chamber.tagline}</p>
                    </div>
                    <button
                      type="button"
                      className="spe-higgs-cta-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCtaClick(chamber);
                      }}
                    >
                      {chamber.ctaText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Carousel Arrows */}
          <div className="spe-deck-nav-controls">
            <button
              type="button"
              className="spe-deck-arrow-btn"
              onClick={handlePrev}
              aria-label="Previous capability card"
            >
              ←
            </button>
            <span className="spe-deck-counter">
              {String(activeChamberIndex + 1).padStart(2, "0")} / {String(filteredChambers.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              className="spe-deck-arrow-btn"
              onClick={handleNext}
              aria-label="Next capability card"
            >
              →
            </button>
          </div>
        </div>

        {/* Command Quick-Matrix (Split Hero + 2x3 Capsules) */}
        <div className="spe-command-matrix-wrap">
          {/* Left Hero Card */}
          <div className="spe-command-hero-card">
            <div className="spe-command-hero-glow" aria-hidden="true" />
            <div className="spe-command-hero-content">
              <span className="spe-command-free-pill">100% AIR-GAPPED &amp; FREE</span>
              <h2 className="spe-command-hero-title">START COMPILING FOR FREE</h2>
              <ul className="spe-command-feature-list">
                <li><span aria-hidden="true">✓</span> Free local compilation on your own silicon</li>
                <li><span aria-hidden="true">✓</span> Zero server inference bills or tracking</li>
                <li><span aria-hidden="true">✓</span> Every top AI model format in one export</li>
              </ul>
              <button
                type="button"
                className="spe-command-launch-btn"
                onClick={() => handleCtaClick(activeChamber)}
              >
                <span>Start Compiling for Free</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          {/* Right 2x3 Grid of Interactive Tool Capsules */}
          <div className="spe-command-grid">
            {COMMAND_CAPSULES.map((capsule) => (
              <div key={capsule.id} className="spe-command-capsule-card">
                <div className="spe-capsule-top">
                  <span className="spe-capsule-name">{capsule.name}</span>
                  <div className="spe-capsule-badges">
                    <span className="spe-capsule-badge">{capsule.badge}</span>
                    <span className="spe-capsule-tier">{capsule.tier}</span>
                  </div>
                </div>
                <p className="spe-capsule-desc">{capsule.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
