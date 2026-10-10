import { useState, useId, useEffect, useRef } from "react";
import type { AppView } from "../routing";
import "./spe-universe-deck.css";

// Official Authentic Vector Brand Logos
function SpeLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L3 7.5L12 13L21 7.5L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3 12L12 17.5L21 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

function AnthropicLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.83 3.5h3.64L24 20.5h-3.64l-1.91-4.32H9.55L7.64 20.5H4L10.36 3.5h3.47zm2.34 9.88l-2.07-4.71-2.07 4.71h4.14z" />
    </svg>
  );
}

function OpenAiLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.28 9.37a5.99 5.99 0 0 0-.52-4.94 6.06 6.06 0 0 0-4.66-2.93 6.01 6.01 0 0 0-5.1 1.63 6.05 6.05 0 0 0-4.04-.38 6.03 6.03 0 0 0-3.8 3.32 6.03 6.03 0 0 0 .75 6.2 6.02 6.02 0 0 0 .52 4.94 6.06 6.06 0 0 0 4.66 2.93 6.01 6.01 0 0 0 5.1-1.63 6.04 6.04 0 0 0 4.04.38 6.03 6.03 0 0 0 3.8-3.32 6.02 6.02 0 0 0-.75-6.2zM12 21.05a4.53 4.53 0 0 1-2.92-1.06l.16-.09 4.84-2.8a.74.74 0 0 0 .37-.64v-6.84l2.06 1.19v5.69a4.55 4.55 0 0 1-4.51 4.55zm-7.7-4.45a4.54 4.54 0 0 1-.55-3.07l.16.1 4.84 2.8c.23.13.37.38.37.64v3.42l-2.06-1.19v-2.7zm-.92-8.52a4.55 4.55 0 0 1 2.37-2.02v5.78a.74.74 0 0 0 .37.64l5.92 3.42-2.06 1.19-4.84-2.8a4.55 4.55 0 0 1-1.76-6.21zm14.33 2.12l-5.92-3.42 2.06-1.19 4.84 2.8a4.55 4.55 0 0 1 1.76 6.21 4.54 4.54 0 0 1-2.37 2.02v-5.78a.74.74 0 0 0-.37-.64zm2.34 6.4a4.54 4.54 0 0 1 .55 3.07l-.16-.1-4.84-2.8a.74.74 0 0 0-.37-.64v-3.42l2.06 1.19v2.7zm-6.66-3.07l-2.6-1.5 2.6-1.5 2.6 1.5-2.6 1.5z" />
    </svg>
  );
}

function GeminiLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24Z" />
    </svg>
  );
}

function DeepSeekLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.2 12.8c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3c0 3.2-1.8 6-4.5 7.4l1.2 2.1h-3.6l-1-1.8c-.1 0-.3.1-.4.1-4.6 0-8.3-3.7-8.3-8.3zm8.3-5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm1.5 3.8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    </svg>
  );
}

function MetaLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.92 5.05c-2.16 0-3.8 1.14-4.92 2.76-1.12-1.62-2.76-2.76-4.92-2.76C3.16 5.05 0 8.27 0 12.3c0 4.03 3.16 7.25 7.08 7.25 2.5 0 4.26-1.37 5.17-2.91.91 1.54 2.67 2.91 5.17 2.91 3.92 0 7.08-3.22 7.08-7.25 0-4.03-3.16-7.25-7.08-7.25zm-9.84 12c-2.58 0-4.6-2.13-4.6-4.75s2.02-4.75 4.6-4.75c1.92 0 3.38 1.25 4.14 2.87-.76 1.62-2.22 2.87-4.14 2.87zm9.84 0c-1.92 0-3.38-1.25-4.14-2.87.76-1.62 2.22-2.87 4.14-2.87 2.58 0 4.6 2.13 4.6 4.75s-2.02 4.75-4.6 4.75z" />
    </svg>
  );
}

function renderModelLogo(modelId: string, size = 18) {
  switch (modelId) {
    case "local-engine":
      return <SpeLogo size={size} />;
    case "claude-sonnet":
      return <AnthropicLogo size={size} />;
    case "openai-o3":
    case "gpt-4o":
      return <OpenAiLogo size={size} />;
    case "gemini-flash":
      return <GeminiLogo size={size} />;
    case "deepseek-r1":
      return <DeepSeekLogo size={size} />;
    case "llama-local":
      return <MetaLogo size={size} />;
    default:
      return <SpeLogo size={size} />;
  }
}

interface ModelNode {
  id: string;
  company: string;
  name: string;
  tier: "local" | "frontier";
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
    company: "SPE",
    name: "Local Engine",
    tier: "local",
    answeringTitle: "In-Browser Local Engine",
    answeringDesc: "Instant local compilation. Executes completely on your device with zero cloud bills.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "$0.00 (Air-Gapped)",
    latency: "< 2ms",
  },
  {
    id: "claude-sonnet",
    company: "Anthropic",
    name: "Claude 3.7",
    tier: "frontier",
    answeringTitle: "Claude 3.7 Sonnet (Hybrid Thinking)",
    answeringDesc: "Autonomous software engineering, hybrid thinking, and long-horizon multi-step planning.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~850ms",
  },
  {
    id: "openai-o3",
    company: "OpenAI",
    name: "o3 / o3-mini",
    tier: "frontier",
    answeringTitle: "OpenAI o3 / o3-mini (High-Compute Reasoning)",
    answeringDesc: "High-compute formal reasoning, strict JSON schemas, and complex algorithmic deduction.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~580ms",
  },
  {
    id: "gemini-flash",
    company: "Google",
    name: "Gemini 2.0",
    tier: "frontier",
    answeringTitle: "Gemini 2.0 Flash Thinking",
    answeringDesc: "Massive 2,000,000 token context window with native multimodal reasoning and video verification.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~380ms",
  },
  {
    id: "deepseek-r1",
    company: "DeepSeek",
    name: "R1 (671B)",
    tier: "frontier",
    answeringTitle: "DeepSeek R1 (Open-Weights 671B Formal Logic)",
    answeringDesc: "Open-weights 671B formal logic reasoning, mathematical proof trees, and algorithmic synthesis.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "API Pass-Through",
    latency: "~1.1s",
  },
  {
    id: "llama-local",
    company: "Meta",
    name: "Llama 3",
    tier: "local",
    answeringTitle: "Local Ollama Gateway",
    answeringDesc: "Run open weights on your local GPU. Zero network requests or telemetry.",
    tokenWaste: "0.0%",
    invariantPass: "100%",
    costProfile: "$0.00 (Self-Hosted)",
    latency: "Hardware-Bound",
  },
];

interface PromptCycle {
  text: string;
  targetModelId: string;
}

const PROMPT_CYCLES: PromptCycle[] = [
  {
    text: "Audit Stripe billing agent: prevent refunds over $500 without manager approval",
    targetModelId: "local-engine",
  },
  {
    text: "Compile universal coding instructions for Claude Code and Cursor IDE",
    targetModelId: "claude-sonnet",
  },
  {
    text: "Lock down MCP Postgres tool: disallow DROP operations with OpenAI o3 high-compute reasoning",
    targetModelId: "openai-o3",
  },
  {
    text: "Synthesize 2,000,000 token context cache with Gemini 2.0 Flash Thinking verification",
    targetModelId: "gemini-flash",
  },
  {
    text: "Formally prove Bounded Horn SAT consistency with DeepSeek R1 671B formal logic",
    targetModelId: "deepseek-r1",
  },
];

interface Props {
  onNavigate?: (view: AppView) => void;
}

export function SpeUniverseHero({ onNavigate }: Props) {
  const [activeModelId, setActiveModelId] = useState<string>("local-engine");
  const [typedPrompt, setTypedPrompt] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sparkPos, setSparkPos] = useState<{ x: number; y: number; opacity: number }>({ x: 490, y: 310, opacity: 0 });
  const [pulseModelId, setPulseModelId] = useState<string | null>(null);
  const [autoRouteLocal, setAutoRouteLocal] = useState<boolean>(true);
  const [isHoverPaused, setIsHoverPaused] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [orbitAngle, setOrbitAngle] = useState<number>(0);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const headingId = useId();

  // Continuous Orbital Physics Loop using requestAnimationFrame (~24 seconds per full revolution)
  useEffect(() => {
    let animId: number;
    const spinSpeed = (Math.PI * 2) / 24000; // Visible, fluid celestial planetary revolution

    const loop = (now: number) => {
      const dt = Math.min(now - lastTimeRef.current, 64);
      lastTimeRef.current = now;

      // Gracefully slow down by 65% when hovering a specific node so user can click, but NEVER freeze completely
      const speed = isHoverPaused ? spinSpeed * 0.35 : spinSpeed;
      angleRef.current += dt * speed;
      setOrbitAngle(angleRef.current);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isHoverPaused]);

  // Typewriter & Spark Simulation Engine
  useEffect(() => {
    let cycleIdx = 0;
    let charIdx = 0;
    let state: "typing" | "hold" | "erasing" | "flying" = "typing";
    let isCancelled = false;

    const runTypewriter = () => {
      if (isCancelled) return;
      const current = PROMPT_CYCLES[cycleIdx];

      if (state === "typing") {
        if (charIdx <= current.text.length) {
          setTypedPrompt(current.text.slice(0, charIdx));
          charIdx++;
          setTimeout(runTypewriter, 38);
        } else {
          // Finished typing -> trigger send
          state = "flying";
          setIsSending(true);
          setActiveModelId(current.targetModelId);

          // Animate spark projectile flight along quadratic bezier
          let sparkProgress = 0;
          const sparkStart = performance.now();
          const sparkDuration = 550; // ms

          const animateSpark = (now: number) => {
            if (isCancelled) return;
            const elapsed = now - sparkStart;
            sparkProgress = Math.min(elapsed / sparkDuration, 1);

            // Compute target position of target model
            const mIdx = ORBIT_MODELS.findIndex((m) => m.id === current.targetModelId);
            const a = angleRef.current + (mIdx / ORBIT_MODELS.length) * Math.PI * 2;
            const tx = 490 + 440 * Math.cos(a);
            const ty = 280 + 195 * Math.sin(a);
            const cx = 490;
            const cy = 320;
            const qx = 490;
            const qy = 200;

            // Quadratic bezier calculation B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
            const t = sparkProgress;
            const bx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * qx + t * t * tx;
            const by = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * qy + t * t * ty;

            setSparkPos({ x: bx, y: by, opacity: 1 - t * 0.2 });

            if (sparkProgress < 1) {
              requestAnimationFrame(animateSpark);
            } else {
              // Spark hit target chip!
              setSparkPos((p) => ({ ...p, opacity: 0 }));
              setIsSending(false);
              setPulseModelId(current.targetModelId);
              setTimeout(() => setPulseModelId(null), 800);

              // Switch to hold
              state = "hold";
              setTimeout(() => {
                if (isCancelled) return;
                state = "erasing";
                runTypewriter();
              }, 2600);
            }
          };

          requestAnimationFrame(animateSpark);
        }
      } else if (state === "erasing") {
        if (charIdx > 0) {
          setTypedPrompt(current.text.slice(0, charIdx));
          charIdx--;
          setTimeout(runTypewriter, 18);
        } else {
          // Erased -> move to next prompt
          cycleIdx = (cycleIdx + 1) % PROMPT_CYCLES.length;
          state = "typing";
          setTimeout(runTypewriter, 400);
        }
      }
    };

    const initialTimeout = setTimeout(runTypewriter, 600);

    return () => {
      isCancelled = true;
      clearTimeout(initialTimeout);
    };
  }, []);

  // Compute model positions along elliptical orbit (expanded rx=46%, ry=34% for zero-collision clearance)
  const modelNodesWithPos = ORBIT_MODELS.map((model, i) => {
    const a = orbitAngle + (i / ORBIT_MODELS.length) * Math.PI * 2;
    // Ellipse center at (50%, 50%), rx = 46%, ry = 34%
    const cx = 50;
    const cy = 50;
    const rx = 46;
    const ry = 34;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    const depth = (Math.sin(a) + 1) / 2; // 0 at top/back, 1 at bottom/front
    const scale = 0.9 + 0.1 * depth;
    const opacity = 0.72 + 0.28 * depth;
    const zIndex = 10 + Math.round(depth * 20);

    return {
      ...model,
      x,
      y,
      scale,
      opacity,
      zIndex,
      svgX: 490 + 440 * Math.cos(a),
      svgY: 280 + 195 * Math.sin(a),
    };
  });

  const activeModelWithPos = modelNodesWithPos.find((m) => m.id === activeModelId) ?? modelNodesWithPos[0];

  const handleLaunchStudio = () => {
    if (onNavigate) {
      onNavigate("workspace");
    } else {
      const el = document.getElementById("prompt-studio");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
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

        {/* Celestial Orbit Stage with Cursor Flashlight */}
        <div
          ref={stageRef}
          className="spe-orbit-stage"
          role="region"
          aria-label="Interactive AI model orbital switchboard"
          onMouseMove={handleMouseMove}
          style={{
            ["--mx" as any]: `${mousePos.x}%`,
            ["--my" as any]: `${mousePos.y}%`,
          }}
        >
          {/* Dynamic Laser Beam & Concentric SVG Orbits */}
          <svg className="spe-orbit-svg-canvas" viewBox="0 0 980 560" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="spe-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5F7FF" stopOpacity="0.95" />
                <stop offset="40%" stopColor="#3D5AFE" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#536DFE" stopOpacity="0.8" />
              </linearGradient>

              <filter id="spe-spark-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feFlood floodColor="#3D5AFE" result="color" />
                <feComposite in2="blur" in="color" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer Frontier Orbit Ellipse */}
            <ellipse cx="490" cy="280" rx="440" ry="195" className="spe-orbit-ellipse" />
            {/* Inner Local Orbit Ellipse */}
            <ellipse cx="490" cy="280" rx="310" ry="135" className="spe-orbit-ellipse is-inner" />

            {/* Dynamic Quadratic Bezier Laser Beam connecting center to active satellite node */}
            <path
              d={`M 490 320 Q 490 200 ${activeModelWithPos.svgX} ${activeModelWithPos.svgY}`}
              className={`spe-beam-path ${isSending ? "is-active-pulse" : ""}`}
            />

            {/* Flying Glowing Particle Spark along bezier path */}
            {sparkPos.opacity > 0 && (
              <circle
                cx={sparkPos.x}
                cy={sparkPos.y}
                r="6"
                fill="#F5F7FF"
                filter="url(#spe-spark-glow)"
                opacity={sparkPos.opacity}
                className="spe-spark"
              />
            )}
          </svg>

          {/* Continuously Rotating Orbiting Satellite Nodes — Logos & Company Names Only */}
          {modelNodesWithPos.map((model) => {
            const isActive = model.id === activeModelId;
            const isPulsing = model.id === pulseModelId;
            return (
              <button
                key={model.id}
                type="button"
                className={`spe-satellite-node ${isActive ? "is-active" : ""} ${isPulsing ? "is-shockwave-pulse" : ""} ${model.tier === "local" ? "is-local-tier" : ""}`}
                style={{
                  left: `${model.x}%`,
                  top: `${model.y}%`,
                  transform: `translate(-50%, -50%) scale(${model.scale})`,
                  opacity: model.opacity,
                  zIndex: model.zIndex,
                }}
                onClick={() => setActiveModelId(model.id)}
                onMouseEnter={() => {
                  setActiveModelId(model.id);
                  setIsHoverPaused(true);
                }}
                onMouseLeave={() => setIsHoverPaused(false)}
                aria-pressed={isActive}
                aria-label={`Select ${model.company} ${model.name}`}
              >
                <span className="spe-satellite-brand-logo" aria-hidden="true">
                  {renderModelLogo(model.id)}
                </span>
                <span className="spe-satellite-label">
                  <strong className="spe-brand-company">{model.company}</strong>
                  <span className="spe-brand-divider">·</span>
                  <span className="spe-brand-model">{model.name}</span>
                </span>
              </button>
            );
          })}

          {/* Center Interactive Capsule & Execution Passport */}
          <div className="spe-center-capsule">
            <div className={`spe-intent-bar-wrapper ${isSending ? "is-sent-flash" : ""}`}>
              <span className="spe-intent-icon" aria-hidden="true">✨</span>
              <input
                type="text"
                className="spe-intent-input"
                value={typedPrompt}
                onChange={(e) => setTypedPrompt(e.target.value)}
                placeholder="Type your objective or select an example…"
                aria-label="Human objective input for AI execution routing"
              />
              <button
                type="button"
                className={`spe-intent-submit-btn ${isSending ? "is-scaled-down" : ""}`}
                onClick={handleLaunchStudio}
                title="Launch System Prompt Studio"
                aria-label="Compile prompt in System Prompt Studio"
              >
                <span aria-hidden="true">↑</span>
              </button>
            </div>

            {/* Active Execution Passport Card with Bobbing Dots */}
            <div className={`spe-execution-passport-card ${isSending ? "is-swapping" : ""}`} role="status" aria-live="polite">
              <div className="spe-passport-top-row">
                <div className="spe-passport-badge-cluster">
                  <span className="spe-passport-answering-pill">
                    <span className="spe-passport-dot-pulse" aria-hidden="true" />
                    Targeting Now
                  </span>
                  <span className="spe-passport-tier-pill">
                    {activeModelWithPos.tier === "local" ? "100% Local Silicon" : "Frontier Cloud"}
                  </span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoRouteLocal}
                    onChange={(e) => setAutoRouteLocal(e.target.checked)}
                    style={{ accentColor: "var(--spe-universe-silver)" }}
                  />
                  <span>Local-First Priority</span>
                </label>
              </div>

              <div>
                <h3 className="spe-passport-model-title">
                  <span aria-hidden="true">✦</span> {activeModelWithPos.answeringTitle}
                </h3>
                <p className="spe-passport-model-desc">{activeModelWithPos.answeringDesc}</p>
              </div>

              <div className="spe-passport-metrics-grid">
                <div className="spe-passport-metric-cell">
                  <span className="spe-passport-metric-label">Token Waste</span>
                  <span className="spe-passport-metric-value">{activeModelWithPos.tokenWaste}</span>
                </div>
                <div className="spe-passport-metric-cell">
                  <span className="spe-passport-metric-label">Invariants</span>
                  <span className="spe-passport-metric-value">{activeModelWithPos.invariantPass}</span>
                </div>
                <div className="spe-passport-metric-cell">
                  <span className="spe-passport-metric-label">Cost / Run</span>
                  <span className="spe-passport-metric-value">{activeModelWithPos.costProfile}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Orbit Guidance */}
        <div className="spe-orbit-guidance-pill">
          <span aria-hidden="true">👆</span>
          <span>Hover or tap any orbiting model to freeze orbit rotation, lock laser beam, and inspect live air-gapped guarantees.</span>
        </div>
      </div>
    </section>
  );
}
