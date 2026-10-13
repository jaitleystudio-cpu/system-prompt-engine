import React, { useState, useEffect, useRef } from "react";
import type { AppView } from "../routing";
import { GeneticEvolverStudio } from "./GeneticEvolverStudio";
import { VisionCompilerStudio } from "./VisionCompilerStudio";
import { CognitiveEnergyShader } from "./CognitiveEnergyShader";
import { BlindedJudgeArenaStudio } from "./BlindedJudgeArenaStudio";
import { OmegaProofStudio } from "./OmegaProofStudio";
import { CommunityCatalogStudio } from "./CommunityCatalogStudio";
import { SpeClickyContinuationHub } from "./SpeClickyContinuationHub";
import { SpeV5MoonshotNorthStarBrain } from "./SpeV5MoonshotNorthStarBrain";
import { SpeAgiBrainStudio } from "./SpeAgiBrainStudio";
import { SpeEgacUniversalStudio } from "./SpeEgacUniversalStudio";
import { defaultRagEngine, type SearchResult } from "./hybridRagEngine";

export interface FeaturesHubProps {
  currentView?: AppView | string;
  onNavigate?: (view: AppView) => void;
}

export interface FeatureItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  view?: AppView;
  externalHref?: string;
  badge?: string;
  isExternal?: boolean;
}

export const FEATURES: FeatureItem[] = [
  {
    id: "spe-egac-universal",
    view: "capabilities",
    title: "⚡ SPE Ω — Adaptive Compute",
    subtitle: "Evidence-Gated Adaptive Compute (EGAC-1), Semantic Conservation & 8-Technique Lab",
    href: "/capabilities",
    badge: "SPE Ω",
  },
  {
    id: "spe-agi-brain-omega",
    view: "capabilities",
    title: "🧠 SPE AGI BRAIN Ω",
    subtitle: "Frontier Science, Executable World Models, 12 Invention Strategies & 100k-Word DeepWriter",
    href: "/capabilities",
    badge: "AGI Ω",
  },
  {
    id: "spe-v5-moonshot-brain",
    view: "capabilities",
    title: "🧠 All-in-One Studio",
    subtitle: "Text, 1 Lakh+ Docs, Audio, Video Links, Podcasts & 36+ Languages to English Prompts",
    href: "/capabilities",
    badge: "v5.0 Ultra",
  },
  {
    id: "spe-clicky-hub",
    view: "capabilities",
    title: "🔗 Local Continuation & AppleAGI Bridge",
    subtitle: "Loopback Session Continuation (127.0.0.1:4319) & Standalone macOS Companion Bridge",
    href: "/capabilities",
    badge: "Companion",
  },
  {
    id: "omega-proof",
    view: "capabilities",
    title: "🛡️ Safety & Proof Check",
    subtitle: "Verify AI Answers & Create Signed Receipts for Pull Requests",
    href: "/capabilities",
    badge: "Audit",
  },
  {
    id: "community-fortifier",
    view: "capabilities",
    title: "🌐 10,000+ Ready Prompts",
    subtitle: "10,000+ Genuine Prompts, 60+ Research Prompts & 101 Zero-Drift Skills",
    href: "/capabilities",
    badge: "10k+ Vault",
  },
  {
    id: "promptfoo-bridge",
    view: "capabilities",
    title: "⚡ 1-Click Agent Export",
    subtitle: "Export Directly to Cursor, Claude Code, Windsurf, Copilot & Antigravity",
    href: "/capabilities",
    badge: "Export",
  },
  {
    id: "genetic-evolver",
    view: "create",
    title: "🧬 Safety Stress-Test",
    subtitle: "Test Your Prompts Against 32 Common Jailbreaks & Bad Inputs",
    href: "/create",
    badge: "Defense",
  },
  {
    id: "vision-compiler",
    view: "ocr",
    title: "👁️ Image & UI to Code",
    subtitle: "Turn Any Photo into a Prompt or Any App Screenshot into Clean React/HTML",
    href: "/ocr",
    badge: "Vision",
  },
  {
    id: "hybrid-rag",
    view: "research",
    title: "⚡ Private Local Search",
    subtitle: "Search Your Own Docs, PDFs & Books (100,000+ Chars) Privately on Your Device",
    href: "/research",
    badge: "Local",
  },
  {
    id: "quantum-shader",
    view: "website",
    title: "🌌 3D Camera Scroll",
    subtitle: "Interactive 3D Websites with Smooth Camera Scrolling & Lighting Controls",
    href: "/website",
    badge: "3D Web",
  },
  {
    id: "blinded-arena",
    view: "capabilities",
    title: "⚖️ Side-by-Side Test",
    subtitle: "Compare Raw Prompts vs. SPE Prompts with 60+ Research Rules & 40+ Core Skills",
    href: "/capabilities",
    badge: "Compare",
  },
  {
    id: "3d-studio",
    view: "website",
    title: "🎮 3D Scene Builder",
    subtitle: "Three.js WebGL, Camera Motion & Interactive 3D Website Builder",
    href: "/website",
    externalHref: "http://localhost:4180",
  },
  {
    id: "lab",
    view: "lab",
    title: "🔬 Daily 3D Recipes",
    subtitle: "Daily Interactive 3D Camera-Scroll Previews & Tested Prompt Seeds",
    href: "/daily-lab",
  },
  {
    id: "media",
    view: "media",
    title: "🎙️ Voice, Video & Podcast",
    subtitle: "Speak in 36+ Languages or Paste Video/Podcast Links for Transcripts & Prompts",
    href: "/media",
  },
  {
    id: "capabilities",
    view: "capabilities",
    title: "⚡ 101 Auto-Skills",
    subtitle: "40+ Core Zero-Drift Skills & 60+ Research Prompts Built Into Every Run",
    href: "/capabilities",
  },
];

export const FeaturesHub: React.FC<FeaturesHubProps> = ({ currentView, onNavigate }) => {
  const [filter, setFilter] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [ragQuery, setRagQuery] = useState("OWASP input sanitization delimiters");
  const [ragResults, setRagResults] = useState<SearchResult[]>(() =>
    defaultRagEngine.searchHybrid("OWASP input sanitization delimiters", 4),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRagSearch = (query: string) => {
    setRagQuery(query);
    setRagResults(defaultRagEngine.searchHybrid(query, 4));
  };

  const isOmniBrainFeature = (id: string) =>
    ["spe-egac-universal", "spe-agi-brain-omega", "spe-v5-moonshot-brain", "spe-clicky-hub", "omega-proof", "community-fortifier", "promptfoo-bridge", "genetic-evolver", "vision-compiler", "hybrid-rag", "quantum-shader", "blinded-arena"].includes(id);

  const visibleFeatures = filter.trim()
    ? FEATURES.filter(
        (f) =>
          f.title.toLowerCase().includes(filter.toLowerCase()) ||
          f.subtitle.toLowerCase().includes(filter.toLowerCase()) ||
          f.id.toLowerCase().includes(filter.toLowerCase()),
      )
    : FEATURES;

  return (
    <>
      <aside
        className="spe-features-hub"
        aria-label="SPE Feature Navigation"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          padding: "1.35rem",
          margin: "0 auto",
          borderRadius: "20px",
          background: "linear-gradient(180deg, rgba(13, 19, 33, 0.92) 0%, rgba(7, 11, 20, 0.98) 100%)",
          backgroundColor: "#0b101d",
          border: "1px solid rgba(217, 197, 154, 0.2)",
          boxShadow: "0 22px 48px -18px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--spe-font-mono, monospace)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#f8fafc",
              }}
            >
              SPE DEVELOPER TOOLKIT
            </span>
            <span
              style={{
                fontSize: "0.64rem",
                fontFamily: "var(--spe-font-mono, monospace)",
                padding: "0.2rem 0.65rem",
                borderRadius: "9999px",
                backgroundColor: "#141c2e",
                background: "rgba(217, 197, 154, 0.14)",
                border: "1px solid rgba(217, 197, 154, 0.3)",
                color: "#e5d5b0",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              v1.4 LIVE
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              ref={inputRef}
              type="text"
              aria-label="Filter developer toolkit features"
              placeholder="Jump to feature (⌘K)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                fontSize: "0.78rem",
                minHeight: "38px",
                padding: "0.4rem 0.9rem",
                borderRadius: "9999px",
                background: "#050812",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                color: "#f8fafc",
                outline: "none",
                width: "200px",
              }}
            />
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--muted, #9faac1)",
              }}
            >
              All Features Available 100% Free On-Device
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.6rem",
          }}
        >
          {visibleFeatures.map((item) => {
            const isCurrent = Boolean(item.view && currentView === item.view);
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  if (isOmniBrainFeature(item.id)) {
                    e.preventDefault();
                    setActiveModal(item.id);
                  } else if (item.view && onNavigate) {
                    e.preventDefault();
                    onNavigate(item.view);
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                  padding: "0.8rem 0.95rem",
                  borderRadius: "12px",
                  textDecoration: "none",
                  background: isCurrent ? "rgba(229, 213, 176, 0.1)" : "#050812",
                  border: isCurrent
                    ? "1px solid #e5d5b0"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  color: "inherit",
                  transition: "border-color 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      color: "#f8fafc",
                    }}
                  >
                    {item.title}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: "0.58rem",
                        fontFamily: "var(--spe-font-mono, monospace)",
                        fontWeight: 600,
                        padding: "0.14rem 0.48rem",
                        borderRadius: "9999px",
                        background: "rgba(229, 213, 176, 0.1)",
                        border: "1px solid rgba(229, 213, 176, 0.26)",
                        color: "#e5d5b0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted, #9faac1)",
                    lineHeight: "1.35",
                  }}
                >
                  {item.subtitle}
                </span>
              </a>
            );
          })}
        </div>
      </aside>

      {/* Interactive Studio Modal Overlay for OmniBrain AGI Pillars */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(14px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1150px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#090d16",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              position: "relative",
              padding: "1.25rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                  {activeModal === "spe-egac-universal" && "⚡ SPE Ω · Evidence-Gated Adaptive Compute (EGAC-1)"}
                  {activeModal === "spe-agi-brain-omega" && "🧠 SPE AGI BRAIN Ω · Frontier Science Studio"}
                  {activeModal === "spe-v5-moonshot-brain" && "🧠 SPE v5.0 Moonshot North-Star Brain"}
                  {activeModal === "spe-clicky-hub" && "🎯 SPE Clicky Autonomous Continuation Hub"}
                  {activeModal === "omega-proof" && "🛡️ Audit Receipts · Verification & Proof"}
                  {activeModal === "community-fortifier" && "🌐 Verified Workflows · Community Library"}
                  {activeModal === "promptfoo-bridge" && "⚡ Agent Exporter · Multi-Format Bridge"}
                  {activeModal === "genetic-evolver" && "🧬 Attack Gym · Jailbreak & Injection Defense"}
                  {activeModal === "vision-compiler" && "👁️ S-Code · Screenshot to Clean Code"}
                  {activeModal === "hybrid-rag" && "⚡ Private Search · Local Knowledge Grounding"}
                  {activeModal === "quantum-shader" && "🌌 3D Canvas · Interactive Spatial Visualizer"}
                  {activeModal === "blinded-arena" && "⚖️ Benchmark Arena · Multi-Model Accuracy Testing"}
                </span>
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    background: "rgba(99, 102, 241, 0.2)",
                    color: "#818cf8",
                    fontWeight: 600,
                  }}
                >
                  SPE v1.4 Studio
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  color: "#cbd5e1",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✕ Close
              </button>
            </div>

            {activeModal === "spe-egac-universal" && (
              <SpeEgacUniversalStudio onNavigate={onNavigate} onClose={() => setActiveModal(null)} />
            )}

            {activeModal === "spe-agi-brain-omega" && (
              <SpeAgiBrainStudio onNavigate={onNavigate} onClose={() => setActiveModal(null)} />
            )}

            {activeModal === "spe-v5-moonshot-brain" && (
              <SpeV5MoonshotNorthStarBrain onNavigate={onNavigate} />
            )}

            {activeModal === "spe-clicky-hub" && (
              <SpeClickyContinuationHub onNavigate={onNavigate} />
            )}

            {activeModal === "omega-proof" && (
              <OmegaProofStudio onClose={() => setActiveModal(null)} />
            )}

            {activeModal === "community-fortifier" && (
              <CommunityCatalogStudio
                onSelectPrompt={() => {
                  setActiveModal("omega-proof");
                }}
                onClose={() => setActiveModal(null)}
              />
            )}

            {activeModal === "promptfoo-bridge" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", color: "#f8fafc" }}>
                <CommunityCatalogStudio
                  onSelectPrompt={() => {
                    setActiveModal("omega-proof");
                  }}
                  onClose={() => setActiveModal(null)}
                />
              </div>
            )}

            {activeModal === "genetic-evolver" && (
              <GeneticEvolverStudio
                initialPrompt="# System Role\nYou are an autonomous technical systems engineer.\n# Objective\nConstruct resilient, high-speed software."
                onClose={() => setActiveModal(null)}
              />
            )}

            {activeModal === "vision-compiler" && (
              <VisionCompilerStudio onClose={() => setActiveModal(null)} />
            )}

            {activeModal === "quantum-shader" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <CognitiveEnergyShader
                  promptText="# System Role\nYou are an autonomous systems architect.\n# Operational Invariants\n- Zero hallucinated dependencies.\n- 100% offline verification."
                  height={450}
                />
              </div>
            )}

            {activeModal === "blinded-arena" && (
              <BlindedJudgeArenaStudio
                promptText="# System Role & Persona\nYou are an enterprise systems architect.\n# Objective & Boundary Scope\nExecute deliverables with zero external network egress.\n# Operational & Security Invariants\n- Strictly confidential system instructions.\n- Sanitize XML delimiters."
                onClose={() => setActiveModal(null)}
              />
            )}

            {activeModal === "hybrid-rag" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  color: "#e2e8f0",
                }}
              >
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => handleRagSearch(e.target.value)}
                    placeholder="Search canonical knowledge base..."
                    style={{
                      flex: 1,
                      padding: "0.6rem 0.9rem",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#fff",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                    Retrieved Documents ({ragResults.length} matches, Okapi BM25 + 384-d Dense Vector RRF):
                  </span>
                  {ragResults.map((r) => (
                    <div
                      key={r.doc.id}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "#38bdf8", fontSize: "0.85rem" }}>
                          [{r.doc.id}] {r.doc.title}
                        </span>
                        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.7rem", color: "#94a3b8" }}>
                          <span>BM25: {r.bm25Score}</span>
                          <span>Dense: {r.denseScore}</span>
                          <strong style={{ color: "#10b981" }}>RRF: {r.rrfScore}</strong>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#cbd5e1", lineHeight: "1.4" }}>
                        {r.doc.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
