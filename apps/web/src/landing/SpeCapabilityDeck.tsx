import { useState, useId, useEffect } from "react";
import type { AppView } from "../routing";
import "./spe-universe-deck.css";

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
  snippetHeader: string;
  snippetCode: string;
}

const CHAMBERS: CapabilityChamber[] = [
  {
    id: "system-studio",
    category: "System Studio",
    title: "Zero-Drift System Prompts",
    tagline: "Compile ambiguous task briefs into deterministic, invariant-hardened prompts for any LLM.",
    badge: "Bounded Horn Logic",
    isLive: true,
    ctaText: "Launch Studio →",
    hashTarget: "prompt-studio",
    snippetHeader: "SPE-COMPILER // VERIFIED_INVARIANTS",
    snippetCode: "ProtectedIntent: preserved\nContradiction scan: 0 errors\nToken bloat pruned: -34%",
  },
  {
    id: "attack-gym",
    category: "Attack Gym",
    title: "In-Browser Jailbreak Gym",
    tagline: "Stress-test prompts against hostile injection, boundary probing, and authority escalation in real time.",
    badge: "Zero-Trust AST Sandbox",
    isLive: true,
    ctaText: "Run Attack Test →",
    hashTarget: "prompt-studio",
    snippetHeader: "HOSTILE_GYM // SIMULATION_LOG",
    snippetCode: "Vector: polyglot bidi override\nDetection: ZERO-WIDTH_PROBE\nResult: ATTACK_HALTED [100% Pass]",
  },
  {
    id: "3d-studio",
    category: "3D Websites",
    title: "Interactive 3D Web Studio",
    tagline: "Generate spatial WebGL and Three.js scenes directly in-browser with live lighting and camera controls.",
    badge: "100% In-Browser Code Export",
    isLive: true,
    ctaText: "Build 3D Site →",
    viewTarget: "website",
    snippetHeader: "THREEJS // SPATIAL_PIPELINE",
    snippetCode: "Geometry: Procedural Icosahedron\nShaders: Custom Fresnel GLSL\nBundle: Zero External Servers",
  },
  {
    id: "multi-export",
    category: "Multi-Agent",
    title: "1-Click Multi-Agent Export",
    tagline: "Instantly lower your prompt architecture into CLAUDE.md, .cursorrules, Windsurf, ChatGPT, and promptfoo.",
    badge: "Universal Formats",
    isLive: true,
    ctaText: "Export Agent Configs →",
    hashTarget: "prompt-studio",
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
    snippetHeader: "VISION_AST // REVERSE_SYNTHESIS",
    snippetCode: "Input: Figma mockup screenshot\nSynthesized: React + Tailwind CSS\nAccessibility: WCAG AA Compliant",
  },
  {
    id: "diff-slider",
    category: "Before & After",
    title: "Interactive Token Burn Diff",
    tagline: "Examine empirical proof showing how unguided agents burn $45.60 in runaway tokens versus SPE's 100% pass rate.",
    badge: "Empirical Receipts",
    isLive: true,
    ctaText: "Inspect Diff Slider →",
    hashTarget: "before-after-diff",
    snippetHeader: "DIFF_PROOF // TOKEN_AUDIT",
    snippetCode: "Unguided: $45.60 / 12 retries / Broken\nSPE Engine: $0.00 / 1 pass / Tests Green\nSavings: 100% API waste eliminated",
  },
  {
    id: "roi-calc",
    category: "ROI Calculator",
    title: "Team Savings Calculator",
    tagline: "Estimate the hours and token budget your team preserves each month.",
    badge: "Interactive Model",
    isLive: true,
    ctaText: "Calculate Your ROI →",
    hashTarget: "developer-roi-calculator",
    snippetHeader: "ECONOMIC_KERNEL // WORKSPACE_SAVINGS",
    snippetCode: "Workflow: Team estimate\nToken waste: Eliminated\nStatus: Instant calculation",
  },
];

interface Props {
  onNavigate?: (view: AppView) => void;
}

export function SpeCapabilityDeck({ onNavigate }: Props) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const headingId = useId();

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : CHAMBERS.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < CHAMBERS.length - 1 ? prev + 1 : 0));
  };

  // Keyboard arrow navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleAction = (chamber: CapabilityChamber) => {
    if (chamber.viewTarget && onNavigate) {
      onNavigate(chamber.viewTarget);
      window.scrollTo(0, 0);
    } else if (chamber.hashTarget) {
      const el = document.getElementById(chamber.hashTarget);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="spe-deck-section" aria-labelledby={headingId}>
      <div className="spe-deck-container">
        {/* Storytelling Header: Act 2 */}
        <div className="spe-deck-header-row">
          <div>
            <div className="spe-deck-kicker">
              <span>Chapter 02 // Everything SPE Forges</span>
            </div>
            <h2 id={headingId} className="spe-deck-title">
              From Clear Ideas to Working Systems in <em>8 Tactile Chambers.</em>
            </h2>
          </div>

          <div className="spe-deck-nav-cluster">
            <span className="spe-deck-counter" aria-live="polite">
              <strong>{String(activeIndex + 1).padStart(2, "0")}</strong> / {String(CHAMBERS.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              className="spe-deck-arrow-btn"
              onClick={handlePrev}
              aria-label="Previous capability chamber"
            >
              ←
            </button>
            <button
              type="button"
              className="spe-deck-arrow-btn"
              onClick={handleNext}
              aria-label="Next capability chamber"
            >
              →
            </button>
          </div>
        </div>

        {/* 3D Cover Flow Viewport */}
        <div className="spe-deck-viewport" role="region" aria-label="3D capability cover flow deck">
          {CHAMBERS.map((chamber, idx) => {
            const offset = idx - activeIndex;
            const isActive = offset === 0;

            // 3D Perspective calculation
            let transform = "translateX(0) translateZ(0) rotateY(0deg) scale(1)";
            let zIndex = 10;
            let opacity = 1;
            let filter = "none";

            if (offset > 0) {
              const distance = Math.min(offset, 3);
              transform = `translateX(${distance * 220}px) translateZ(-${distance * 140}px) rotateY(-${Math.min(distance * 24, 38)}deg) scale(${1 - distance * 0.1})`;
              zIndex = 10 - distance;
              opacity = Math.max(0.2, 1 - distance * 0.35);
              filter = `blur(${distance * 1.5}px)`;
            } else if (offset < 0) {
              const distance = Math.min(Math.abs(offset), 3);
              transform = `translateX(-${distance * 220}px) translateZ(-${distance * 140}px) rotateY(${Math.min(distance * 24, 38)}deg) scale(${1 - distance * 0.1})`;
              zIndex = 10 - distance;
              opacity = Math.max(0.2, 1 - distance * 0.35);
              filter = `blur(${distance * 1.5}px)`;
            }

            return (
              <article
                key={chamber.id}
                className={`spe-deck-card ${isActive ? "is-active" : ""}`}
                style={{
                  transform,
                  zIndex,
                  opacity,
                  filter,
                }}
                onClick={() => setActiveIndex(idx)}
                aria-hidden={!isActive}
              >
                <div className="spe-card-top-row">
                  <span className="spe-card-category-pill">{chamber.category}</span>
                  {chamber.isLive ? (
                    <div className="spe-card-live-indicator">
                      <span className="spe-card-live-dot" aria-hidden="true" />
                      <span>Live</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>Integrated</span>
                  )}
                </div>

                <div className="spe-card-preview-art">
                  <span className="spe-card-art-kicker">{chamber.snippetHeader}</span>
                  <pre className="spe-card-art-snippet">{chamber.snippetCode}</pre>
                  <span className="spe-card-highlight-badge">{chamber.badge}</span>
                </div>

                <div className="spe-card-info-cluster">
                  <div>
                    <h3 className="spe-card-heading">{chamber.title}</h3>
                    <p className="spe-card-subtext">{chamber.tagline}</p>
                  </div>

                  <button
                    type="button"
                    className="spe-card-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(chamber);
                    }}
                    tabIndex={isActive ? 0 : -1}
                  >
                    <span>{chamber.ctaText}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Floating Tactile Command Dock */}
        <div className="spe-dock-wrapper">
          <nav className="spe-dock-shelf" aria-label="Quick jump to capability chamber">
            {CHAMBERS.map((chamber, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={chamber.id}
                  type="button"
                  className={`spe-dock-tab-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveIndex(idx)}
                  aria-pressed={isActive}
                >
                  <span className="spe-dock-tab-icon" aria-hidden="true">
                    {idx === 0 ? "⚡" : idx === 1 ? "🛡️" : idx === 2 ? "🌐" : idx === 3 ? "📦" : idx === 4 ? "🎙️" : idx === 5 ? "📸" : idx === 6 ? "⚖️" : "💰"}
                  </span>
                  <span>{chamber.category}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </section>
  );
}
