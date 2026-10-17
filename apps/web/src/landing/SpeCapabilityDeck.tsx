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
    title: "60+ Research Prompts & 101 Skills",
    tagline: "Turn any plain-English idea (up to 100,000+ characters / 1 Lakh+) into a clear prompt paired with 60+ research-paper prompts and 40+ core zero-drift skills.",
    badge: "Zero Drift · 101 Skills",
    isLive: true,
    ctaText: "Open Prompt Studio →",
    hashTarget: "prompt-studio",
    slabA: "YOUR IDEA.",
    slabB: "ZERO DRIFT.",
    snippetHeader: "SPE-STUDIO // 60_RESEARCH_PROMPTS_40_SKILLS",
    snippetCode: "Context input: 100,000+ chars (1 Lakh+)\nPrompt output: 30,000 Free / 100,000 Pro\nProjected retry savings: ~42% (est.)",
  },
  {
    id: "attack-gym",
    category: "Financial Compliance",
    title: "Safety & Error Check Before You Run",
    tagline: "Check your prompts and agent plans locally in your browser before running them so missing scope rules, secret leaks, or test omissions are caught early.",
    badge: "In-Browser Safety Gate",
    isLive: true,
    ctaText: "Run Safety Check →",
    hashTarget: "prompt-studio",
    slabA: "ZERO LEAKS.",
    slabB: "SAFE CODE.",
    snippetHeader: "SAFETY_GATE // PRE_FLIGHT_CHECK",
    snippetCode: "Secret key check: Protected\nForbidden file edits: Blocked\nResult: SAFE_TO_RUN [Verified]",
  },
  {
    id: "3d-studio",
    category: "Spatial WebGL",
    title: "Daily 3D Websites with Camera Scrolling",
    tagline: "Explore new interactive 3D websites every day with smooth Noorly-style camera scrolling, lighting controls, and 1-click rebuild prompts.",
    badge: "Daily 3D Camera Scroll",
    isLive: true,
    ctaText: "Explore 3D Websites →",
    viewTarget: "lab",
    slabA: "3D CAMERA.",
    slabB: "SMOOTH SCROLL.",
    snippetHeader: "3D_STUDIO // CAMERA_SCROLL_SCENE",
    snippetCode: "Camera path: Smooth scroll keyframes\n3D Stage: Interactive WebGL @ 60fps\nRebuild prompt: 1-Click Copy & Export",
  },
  {
    id: "multi-export",
    category: "Multi-Agent Formats",
    title: "One-Click Export for Every AI Tool",
    tagline: "Export your compiled prompt, skill constraints, and receipt-gated eval bundles for Claude Code, Cursor, Windsurf, ChatGPT, and Promptfoo in one click.",
    badge: "All Coding & AI Models",
    isLive: true,
    ctaText: "Export Agent Rules →",
    hashTarget: "prompt-studio",
    slabA: "ONE CLICK.",
    slabB: "EVERY AI.",
    snippetHeader: "EXPORTER // ALL_AI_MODELS",
    snippetCode: "Targets: CLAUDE.md | .cursorrules | promptfooconfig.yaml\nReady-made vault: Curated prompt templates\nCompanion bridge: Local 127.0.0.1:4319 ready",
  },
  {
    id: "media-to-prompt",
    category: "Audio & Video",
    title: "Voice, Video Links & Podcasts to Text",
    tagline: "Speak in 36+ native languages, upload audio/video, or paste a transcript/link to get clean structured summaries, storytelling, and English pro prompts.",
    badge: "36+ Languages + Links",
    isLive: true,
    ctaText: "Open Voice & Media →",
    viewTarget: "media",
    slabA: "ANY VOICE/LINK.",
    slabB: "ENGLISH PROMPT.",
    snippetHeader: "MEDIA_ENGINE // VOICE_VIDEO_PODCAST",
    snippetCode: "Input: Native voice, video file, or podcast link\nOutput 1: Native language transcript & story\nOutput 2: English Pro Prompt for any AI",
  },
  {
    id: "vision-to-code",
    category: "Vision to Code",
    title: "Image to Prompt & Screenshot to Code",
    tagline: "Drop any UI screenshot, photo, or website link to generate starter code for React, Next.js, SwiftUI, Jetpack Compose, Flutter, or HTML/CSS.",
    badge: "6 Code Frameworks",
    isLive: true,
    ctaText: "Convert Screenshot →",
    viewTarget: "code",
    slabA: "SCREENSHOT.",
    slabB: "CLEAN CODE.",
    snippetHeader: "VISION // SCREENSHOT_AND_IMAGE",
    snippetCode: "Input: UI screenshot or reference photo\nTargets: React, SwiftUI, Compose, HTML/CSS\nOutput: Implementation prompt + starter code",
  },
  {
    id: "research-to-prompt",
    category: "Research Synthesis",
    title: "Docs, PDFs & Books (1 Lakh+ Chars)",
    tagline: "Paste long documents, books, or technical guides up to 100,000+ characters (1 Lakh+) and turn them into clear, step-by-step instructions.",
    badge: "100,000+ Char Capacity",
    isLive: true,
    ctaText: "Open Docs & Research →",
    viewTarget: "research",
    slabA: "LONG DOCS.",
    slabB: "CLEAR STEPS.",
    snippetHeader: "DOCS // 100K_CHAR_INGESTION",
    snippetCode: "Capacity: 100,000+ characters (1 Lakh+)\nExtracted: Key rules, summary & story\nOutput: Ready-to-run system prompt",
  },
  {
    id: "drift-sentinel",
    category: "Model Assurance",
    title: "Zero-Drift Verification & Companion Bridge",
    tagline: "Verify prompt contracts with RFC 8785 + Ed25519 receipts in SPE, or bridge to our separate AppleAGI macOS companion app — Public Beta intro starting at $1 first month.",
    badge: "Intro: $1 (Pro) / $9 (Team)",
    isLive: true,
    ctaText: "See Public Beta Pricing →",
    viewTarget: "pricing",
    slabA: "SIGNED PROOF.",
    slabB: "ZERO DRIFT.",
    snippetHeader: "SPE_OMEGA // PUBLIC_BETA_PRICING",
    snippetCode: "Developer Pro: $1 first mo (then $9/mo)\nCompany Gate: $9 first mo (then $99/mo)\n95% of SPE Web Tools: $0 Forever",
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
    name: "Curated Prompt Vault",
    badge: "READY-MADE",
    tier: "All Models",
    desc: "Structured, ready-to-use prompt templates for coding, 3D sites, SEO, and technical writing.",
  },
  {
    id: "capsule-2",
    name: "60+ Research Prompts",
    badge: "PAPER-BACKED",
    tier: "Zero Drift",
    desc: "Built from 60+ peer-reviewed AI research techniques for structured, verifiable outputs.",
  },
  {
    id: "capsule-3",
    name: "40+ Core / 101 Skills",
    badge: "AUTO-APPLIED",
    tier: "12 Categories",
    desc: "Attaches coding, UI, mobile, or SEO skill rules to help reduce scope drift.",
  },
  {
    id: "capsule-4",
    name: "36+ Languages Voice",
    badge: "SPEAK NATIVE",
    tier: "Global",
    desc: "Speak in your native language via browser speech APIs and compile an English pro prompt.",
  },
  {
    id: "capsule-5",
    name: "100,000+ Char Input",
    badge: "1 LAKH+ INPUT",
    tier: "High Capacity",
    desc: "Paste up to 100,000+ characters of context input locally (up to 30,000-char prompt output in Free; 100,000 in Pro).",
  },
  {
    id: "capsule-6",
    name: "$1 First-Month Intro",
    badge: "THEN $9/MO",
    tier: "95% Free",
    desc: "95% of SPE is $0 forever. Developer Pro is $1 first month ($9/mo renewal); Team Gate is $9 first month ($99/mo renewal).",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Features", icon: "✦" },
  { id: "Autonomous Coding", label: "Prompts & Skills", icon: "⚡" },
  { id: "Spatial WebGL", label: "Daily 3D Sites", icon: "🪐" },
  { id: "Audio & Video", label: "Voice & Video Links", icon: "🎙️" },
  { id: "Vision to Code", label: "Image & Screenshot", icon: "👁️" },
  { id: "Research Synthesis", label: "100k+ Docs", icon: "📚" },
  { id: "Multi-Agent Formats", label: "1-Click Export", icon: "🔄" },
  { id: "Financial Compliance", label: "Safety Check", icon: "🛡️" },
  { id: "Model Assurance", label: "Proof & Pricing ($1)", icon: "🔒" },
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
    <section className="spe-deck-section" data-copy-depth="PROOF" aria-labelledby={headingId}>
      <div className="spe-deck-container">
        {/* Top Ticker: Live Now */}
        <div className="spe-hero-live-ticker" role="status" aria-live="polite">
          <span className="spe-ticker-live-badge">PUBLIC BETA · ENGINE BY PRAWIN JAITLEY</span>
          <span className="spe-ticker-text">
            95% FREE · $1 FIRST MONTH PRO (RENEWS $9/MO) · 60+ RESEARCH PROMPTS · 101 SKILLS · 1.3 MB LOCAL WASM
          </span>
        </div>

        {/* Clean Header */}
        <header className="spe-deck-story-header">
          <div className="spe-hero-reflective-wrap">
            <h2 id={headingId} className="spe-hero-reflective-h1">
              Everything You Need for AI, <em>in Simple English.</em>
            </h2>
          </div>
          <p className="spe-deck-subtitle">
            <strong>SPE — System Prompt Engine</strong> (Engine powered by <strong>Prawin Jaitley</strong>): Speak or type in 36+ languages, paste up to 100,000+ characters (1 Lakh+), structure transcripts, explore interactive 3D web templates, and verify prompts locally in WebAssembly — 95% free forever, with Developer Pro at $1 for your first month (renews at $9/month).
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
