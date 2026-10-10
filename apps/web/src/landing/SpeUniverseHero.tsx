import { useState, useId } from "react";
import type { AppView } from "../routing";
import "./spe-universe-deck.css";

interface ModelNode {
  id: string;
  name: string;
  tier: "local" | "frontier";
  badge: string;
  xPercent: number; // Position on orbit canvas
  yPercent: number;
  answeringTitle: string;
  answeringDesc: string;
  tokenWaste: string;
  invariantPass: string;
  costProfile: string;
  latency: string;
}

const ORBIT_MODELS: ModelNode[] = [
  {
    id: "local-engine",
    name: "Local Engine",
    tier: "local",
    badge: "100% Free · 0ms",
    xPercent: 12,
    yPercent: 62,
    answeringTitle: "In-Browser Local Engine",
    answeringDesc: "Instant local compilation. Executes completely on your device with zero cloud bills.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "$0.00 (Air-Gapped)",
    latency: "< 2ms",
  },
  {
    id: "claude-sonnet",
    name: "Claude 3.7 Sonnet",
    tier: "frontier",
    badge: "Deep Reasoning",
    xPercent: 24,
    yPercent: 18,
    answeringTitle: "Claude 3.7 Sonnet",
    answeringDesc: "Autonomous software engineering and long-horizon multi-step planning.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~850ms",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    tier: "frontier",
    badge: "Strict Tools",
    xPercent: 78,
    yPercent: 16,
    answeringTitle: "GPT-4o Enterprise",
    answeringDesc: "Strict JSON schemas, multi-function calling, and broad integration support.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~620ms",
  },
  {
    id: "gemini-flash",
    name: "Gemini 2.0 Flash",
    tier: "frontier",
    badge: "2M Multimodal",
    xPercent: 88,
    yPercent: 54,
    answeringTitle: "Gemini 2.0 Flash",
    answeringDesc: "Massive 2,000,000 token context window with native video and audio processing.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~380ms",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    tier: "frontier",
    badge: "Formal Logic",
    xPercent: 68,
    yPercent: 84,
    answeringTitle: "DeepSeek R1",
    answeringDesc: "Open-weight mathematical reasoning, formal verification, and algorithmic synthesis.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~1.1s",
  },
  {
    id: "llama-local",
    name: "Ollama / llama.cpp",
    tier: "local",
    badge: "Self-Hosted",
    xPercent: 30,
    yPercent: 82,
    answeringTitle: "Local Ollama Gateway",
    answeringDesc: "Run open weights on your local GPU. Zero network requests or telemetry.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "$0.00 (Self-Hosted)",
    latency: "Hardware-Bound",
  },
];

const PROMPT_SUGGESTIONS = [
  "Build a Stripe refund webhook agent with zero hallucinations",
  "Compile universal coding instructions for Claude Code and Cursor",
  "Design a 3D product showcase website with Three.js and WebGL",
  "Audit prompt dependencies for hidden injection vulnerabilities",
];

interface Props {
  onNavigate?: (view: AppView) => void;
}

export function SpeUniverseHero({ onNavigate }: Props) {
  const [activeModelId, setActiveModelId] = useState<string>("local-engine");
  const [promptText, setPromptText] = useState<string>(PROMPT_SUGGESTIONS[0]);
  const [autoRouteLocal, setAutoRouteLocal] = useState<boolean>(true);
  const headingId = useId();

  const activeModel = ORBIT_MODELS.find((m) => m.id === activeModelId) ?? ORBIT_MODELS[0];

  const handleLaunchStudio = () => {
    if (onNavigate) {
      onNavigate("workspace");
    } else {
      const el = document.getElementById("prompt-studio");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="spe-universe-section" aria-labelledby={headingId}>
      <div className="spe-universe-container">
        {/* Storytelling Header: Act 1 */}
        <header className="spe-universe-story-header">
          <div className="spe-universe-kicker">
            <span className="spe-universe-kicker-dot" aria-hidden="true" />
            <span>Chapter 01 // The Celestial Control Plane</span>
          </div>
          <h2 id={headingId} className="spe-universe-title">
            One Human Intent. <em>Every AI in Orbit.</em>
          </h2>
          <p className="spe-universe-subtitle">
            Specify your objective once. System Prompt Engine verifies invariants locally,
            prevents costly prompt drift, and routes execution to your own machine for $0 or to any frontier cloud model.
          </p>
        </header>

        {/* Celestial Orbit Stage */}
        <div className="spe-orbit-stage" role="region" aria-label="Interactive AI model orbital switchboard">
          {/* Background Concentric SVG Orbits & Energy Conduit Beam */}
          <svg className="spe-orbit-svg-canvas" viewBox="0 0 980 520" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="spe-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d1fe17" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#d1fe17" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Outer Frontier Orbit */}
            <ellipse cx="490" cy="260" rx="420" ry="210" className="spe-orbit-ellipse" />
            {/* Inner Local Orbit */}
            <ellipse cx="490" cy="260" rx="300" ry="140" className="spe-orbit-ellipse is-inner" />

            {/* Active Conduit Beam linking selected model to central passport */}
            <path
              d={`M ${activeModel.xPercent * 9.8} ${activeModel.yPercent * 5.2} Q 490 260 490 310`}
              className="spe-beam-path"
            />
          </svg>

          {/* Orbiting Satellite Nodes */}
          {ORBIT_MODELS.map((model) => {
            const isActive = model.id === activeModelId;
            return (
              <button
                key={model.id}
                type="button"
                className={`spe-satellite-node ${isActive ? "is-active" : ""} ${model.tier === "local" ? "is-local-tier" : ""}`}
                style={{
                  left: `${model.xPercent}%`,
                  top: `${model.yPercent}%`,
                }}
                onClick={() => setActiveModelId(model.id)}
                onMouseEnter={() => setActiveModelId(model.id)}
                aria-pressed={isActive}
                aria-label={`Select model ${model.name}`}
              >
                <span className="spe-satellite-icon" aria-hidden="true">✦</span>
                <span>{model.name}</span>
                <span className="spe-satellite-badge">{model.badge}</span>
              </button>
            );
          })}

          {/* Center Interactive Capsule & Execution Passport */}
          <div className="spe-center-capsule">
            <div className="spe-intent-bar-wrapper">
              <span className="spe-intent-icon" aria-hidden="true">✨</span>
              <input
                type="text"
                className="spe-intent-input"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Type your objective or select an example…"
                aria-label="Human objective input for AI execution routing"
              />
              <button
                type="button"
                className="spe-intent-submit-btn"
                onClick={handleLaunchStudio}
                title="Launch System Prompt Studio"
                aria-label="Compile prompt in System Prompt Studio"
              >
                <span aria-hidden="true">↑</span>
              </button>
            </div>

            {/* Active Execution Passport Card */}
            <div className="spe-execution-passport-card" role="status" aria-live="polite">
              <div className="spe-passport-top-row">
                <div className="spe-passport-badge-cluster">
                  <span className="spe-passport-answering-pill">Targeting Now</span>
                  <span className="spe-passport-tier-pill">
                    {activeModel.tier === "local" ? "100% Local Silicon" : "Frontier Cloud"}
                  </span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoRouteLocal}
                    onChange={(e) => setAutoRouteLocal(e.target.checked)}
                    style={{ accentColor: "var(--spe-universe-lime)" }}
                  />
                  <span>Local-First Priority</span>
                </label>
              </div>

              <div>
                <h3 className="spe-passport-model-title">
                  <span aria-hidden="true">✦</span> {activeModel.answeringTitle}
                </h3>
                <p className="spe-passport-model-desc">{activeModel.answeringDesc}</p>
              </div>

              <div className="spe-passport-metrics-grid">
                <div className="spe-passport-metric-cell">
                  <span className="spe-passport-metric-label">Token Waste</span>
                  <span className="spe-passport-metric-value">{activeModel.tokenWaste}</span>
                </div>
                <div className="spe-passport-metric-cell">
                  <span className="spe-passport-metric-label">Invariants</span>
                  <span className="spe-passport-metric-value">{activeModel.invariantPass}</span>
                </div>
                <div className="spe-passport-metric-cell">
                  <span className="spe-passport-metric-label">Cost / Run</span>
                  <span className="spe-passport-metric-value">{activeModel.costProfile}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Orbit Guidance */}
        <div className="spe-orbit-guidance-pill">
          <span aria-hidden="true">👆</span>
          <span>Hover or tap any orbiting model to inspect its execution passport and air-gapped guarantees.</span>
        </div>
      </div>
    </section>
  );
}
