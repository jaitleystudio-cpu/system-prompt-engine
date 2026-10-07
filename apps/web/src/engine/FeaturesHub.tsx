import React, { useState, useEffect, useRef } from "react";
import type { AppView } from "../routing";
import { GeneticEvolverStudio } from "./GeneticEvolverStudio";
import { VisionCompilerStudio } from "./VisionCompilerStudio";
import { CognitiveEnergyShader } from "./CognitiveEnergyShader";
import { BlindedJudgeArenaStudio } from "./BlindedJudgeArenaStudio";
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
    id: "genetic-evolver",
    view: "create",
    title: "🧬 Genetic Evolver",
    subtitle: "32-Attack Hostile Gym & Self-Play",
    href: "/create",
    badge: "v1.4",
  },
  {
    id: "vision-compiler",
    view: "ocr",
    title: "👁️ Vision Compiler",
    subtitle: "Multimodal Layout Inverse-Compiler",
    href: "/ocr",
    badge: "v1.4",
  },
  {
    id: "hybrid-rag",
    view: "research",
    title: "⚡ Hybrid RAG",
    subtitle: "BM25 + 384-d Dense Vector RRF",
    href: "/research",
    badge: "v1.4",
  },
  {
    id: "quantum-shader",
    view: "website",
    title: "🌌 3D Quantum Field",
    subtitle: "GLSL Semantic Entropy Visualizer",
    href: "/website",
    badge: "v1.4",
  },
  {
    id: "blinded-arena",
    view: "capabilities",
    title: "⚖️ Blinded Arena",
    subtitle: "5-Judge Nash Consensus & Proof",
    href: "/capabilities",
    badge: "v1.4",
  },
  {
    id: "3d-studio",
    view: "website",
    title: "🎮 3D Studio v1.2",
    subtitle: "Three.js WebGL & Motion Editor",
    href: "/website",
    externalHref: "http://localhost:4180",
  },
  {
    id: "lab",
    view: "lab",
    title: "🔬 Daily Lab",
    subtitle: "AI Prompts & Interactive Challenges",
    href: "/daily-lab",
  },
  {
    id: "media",
    view: "media",
    title: "🎙️ Media Studio",
    subtitle: "Speech & Audio to Prompt",
    href: "/media",
  },
  {
    id: "capabilities",
    view: "capabilities",
    title: "⚡ Capabilities",
    subtitle: "Integrity, Zero-Egress Proofs",
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
    ["genetic-evolver", "vision-compiler", "hybrid-rag", "quantum-shader", "blinded-arena"].includes(id);

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
          gap: "0.75rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          borderRadius: "12px",
          background: "var(--spe-surface-card, rgba(255, 255, 255, 0.03))",
          border: "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.1))",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--spe-text-muted, #888)",
              }}
            >
              SPE v1.4 OMNIBRAIN AGI SUITE
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                padding: "0.15rem 0.45rem",
                borderRadius: "999px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                fontWeight: 600,
              }}
            >
              v1.4 LIVE
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Jump to feature (⌘K)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.6rem",
                borderRadius: "6px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                outline: "none",
                width: "170px",
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--spe-text-muted, #777)",
              }}
            >
              All 7 Acquisition Pillars & Tools Available on Localhost
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
                  gap: "0.2rem",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "8px",
                  textDecoration: "none",
                  background: isCurrent
                    ? "var(--spe-accent-soft, rgba(99, 102, 241, 0.15))"
                    : "var(--spe-surface-hover, rgba(255, 255, 255, 0.02))",
                  border: isCurrent
                    ? "1px solid var(--spe-accent, #6366f1)"
                    : "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.06))",
                  color: "inherit",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      color: "var(--spe-text-primary, #fff)",
                    }}
                  >
                    {item.title}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.35rem",
                        borderRadius: "4px",
                        background: "linear-gradient(135deg, #6366f1, #a855f7)",
                        color: "#fff",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--spe-text-muted, #888)",
                    lineHeight: "1.2",
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
                  {activeModal === "genetic-evolver" && "🧬 Genetic Prompt Evolver & Hostile Gym"}
                  {activeModal === "vision-compiler" && "👁️ Multimodal Neural Vision Inverse-Compiler"}
                  {activeModal === "hybrid-rag" && "⚡ In-WASM Supersonic Hybrid RAG Fabric"}
                  {activeModal === "quantum-shader" && "🌌 3D GLSL Quantum Cognitive Energy Field"}
                  {activeModal === "blinded-arena" && "⚖️ Game-Theoretic Blinded Multi-Judge Arena"}
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
