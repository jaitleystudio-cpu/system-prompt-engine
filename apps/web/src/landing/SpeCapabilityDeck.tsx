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
    title: "Zero-Drift System Prompts",
    tagline: "Compile ambiguous task briefs into deterministic, invariant-hardened prompts for Claude Code and Cursor.",
    badge: "Bounded Horn Logic",
    isLive: true,
    ctaText: "Launch Studio →",
    hashTarget: "prompt-studio",
    slabA: "YOUR PROMPT.",
    slabB: "NOW A COMPILER.",
    snippetHeader: "SPE-COMPILER // VERIFIED_INVARIANTS",
    snippetCode: "ProtectedIntent: preserved\nContradiction scan: 0 errors\nToken bloat pruned: -34%",
  },
  {
    id: "attack-gym",
    category: "Financial Compliance",
    title: "In-Browser Jailbreak Gym",
    tagline: "Stress-test billing and Stripe agents against hostile injection, boundary probing, and authority escalation.",
    badge: "Zero-Trust AST Sandbox",
    isLive: true,
    ctaText: "Run Attack Test →",
    hashTarget: "prompt-studio",
    slabA: "ZERO-LEAK.",
    slabB: "STRIPE FIREWALL.",
    snippetHeader: "HOSTILE_GYM // SIMULATION_LOG",
    snippetCode: "Vector: polyglot bidi override\nDetection: ZERO-WIDTH_PROBE\nResult: ATTACK_HALTED [100% Pass]",
  },
  {
    id: "3d-studio",
    category: "Spatial WebGL",
    title: "Interactive 3D Web Studio",
    tagline: "Generate spatial Three.js scenes directly in-browser with live lighting, shaders, and camera controls.",
    badge: "100% In-Browser Code Export",
    isLive: true,
    ctaText: "Build 3D Site →",
    viewTarget: "website",
    slabA: "SPATIAL WEB.",
    slabB: "ZERO GPU BILLS.",
    snippetHeader: "THREEJS // SPATIAL_PIPELINE",
    snippetCode: "Geometry: Procedural Icosahedron\nShaders: Custom Fresnel GLSL\nBundle: Zero External Servers",
  },
  {
    id: "multi-export",
    category: "Multi-Agent Formats",
    title: "1-Click Multi-Agent Export",
    tagline: "Instantly lower your prompt architecture into CLAUDE.md, .cursorrules, Windsurf, ChatGPT, and promptfoo.",
    badge: "Universal Formats",
    isLive: true,
    ctaText: "Export Agent Configs →",
    hashTarget: "prompt-studio",
    slabA: "ONE SPEC.",
    slabB: "EVERY AGENT.",
    snippetHeader: "AGENT_ABI // LOWERING_ENGINE",
    snippetCode: "Targets: CLAUDE.md | .cursorrules\nWindsurf: rules_synced\nPromptfoo: test_matrix_generated",
  },
  {
    id: "media-to-prompt",
    category: "Audio & Video",
    title: "Meeting & Video Transcriber",
    tagline: "Turn design recordings, architectural videos, and client calls into clean, actionable AI instructions.",
    badge: "Local Whisper Processing",
    isLive: false,
    ctaText: "Transcribe Media →",
    viewTarget: "media",
    slabA: "VOICE BRIEF.",
    slabB: "ACTIONABLE IR.",
    snippetHeader: "AUDIO_IR // LOCAL_TRANSCRIPTION",
    snippetCode: "Source: Architecture_Review.mp4\nSpeech engine: In-Browser Whisper\nExtracted: 7 hard constraints",
  },
  {
    id: "vision-to-code",
    category: "Vision to Code",
    title: "Screenshot & URL to Site",
    tagline: "Decompile visual screenshots or live web URLs into responsive, accessible Tailwind and React components.",
    badge: "Structural Inverse Compiler",
    isLive: false,
    ctaText: "Convert UI to Code →",
    viewTarget: "code",
    slabA: "SCREENSHOT.",
    slabB: "REACT 19 CODE.",
    snippetHeader: "VISION_AST // REVERSE_SYNTHESIS",
    snippetCode: "Input: Figma mockup screenshot\nSynthesized: React + Tailwind CSS\nAccessibility: WCAG AA Compliant",
  },
  {
    id: "research-to-prompt",
    category: "Research Synthesis",
    title: "Deep Paper & Spec Ingestion",
    tagline: "Distill complex RFCs, API specifications, and research papers into unambiguous instruction constraints.",
    badge: "Spec Knowledge Distiller",
    isLive: false,
    ctaText: "Ingest Research →",
    viewTarget: "research",
    slabA: "RAW SPEC.",
    slabB: "VERIFIED IR.",
    snippetHeader: "RESEARCH // KNOWLEDGE_EXTRACTOR",
    snippetCode: "Input: Stripe Payments RFC v2026\nExtracted: 14 mandatory state invariants\nGenerated: Deterministic Horn clauses",
  },
  {
    id: "drift-sentinel",
    category: "Model Assurance",
    title: "Model Drift & Regression Sentinel",
    tagline: "Continuously audit prompt execution across OpenAI, Anthropic, Gemini, and local models to catch silent regressions.",
    badge: "Continuous Oracle Guard",
    isLive: false,
    ctaText: "Inspect Drift Sentinel →",
    hashTarget: "prompt-studio",
    slabA: "MODEL DRIFT.",
    slabB: "INSTANT DETECT.",
    snippetHeader: "SENTINEL // TELEMETRY_PROBE",
    snippetCode: "Target: Claude 3.7 vs Claude 3.5\nDrift Delta: 0 schema regressions\nStatus: QUALIFIED_FOR_DEPLOYMENT",
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
    name: "Claude 3.7 Sonnet",
    badge: "COMPILER READY",
    tier: "Agent",
    desc: "Autonomous reasoning and long-horizon invariant retention.",
  },
  {
    id: "capsule-2",
    name: "GPT-5 Thinking",
    badge: "AST TAINT",
    tier: "Security",
    desc: "Deep AST taint-tracking and strict JSON schema assurance.",
  },
  {
    id: "capsule-3",
    name: "DeepSeek R1",
    badge: "LOCAL VLLM",
    tier: "Economics",
    desc: "Open-weight mathematical reasoning with zero API spend.",
  },
  {
    id: "capsule-4",
    name: "Cursor Rules",
    badge: "ZERO REGRESSION",
    tier: "Editor",
    desc: "Compile .cursorrules that prevent unwanted codebase drift.",
  },
  {
    id: "capsule-5",
    name: "MCP Firewall",
    badge: "CAPABILITY GATE",
    tier: "Runtime",
    desc: "OS-level tool authority and payment cap enforcement.",
  },
  {
    id: "capsule-6",
    name: "Failure Genome",
    badge: "AUTO-REPAIR",
    tier: "Resilience",
    desc: "Continuous counterexample minimization and repair vaccines.",
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
          <span className="spe-ticker-live-badge">LIVE NOW</span>
          <span className="spe-ticker-text">
            ON SPE Ω — CLAUDE 3.7 SONNET &amp; GPT-5 REASONING COMPILER · 100% AIR-GAPPED &amp; FREE.
          </span>
        </div>

        {/* Monumental Water-Reflective Headline */}
        <header className="spe-deck-story-header">
          <div className="spe-hero-reflective-wrap">
            <h1 id={headingId} className="spe-hero-reflective-h1">
              ONE COMPILER. EVERY AI AGENT &amp; MODEL
            </h1>
            <div className="spe-hero-reflective-mirror" aria-hidden="true">
              ONE COMPILER. EVERY AI AGENT &amp; MODEL
            </div>
          </div>
          <p className="spe-deck-subtitle">
            Cancel your extra $20/month agent subscriptions. SPE is the offline, privacy-first control plane that compiles,
            fuzzes, and proves AI instructions before they are deployed to production.
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
