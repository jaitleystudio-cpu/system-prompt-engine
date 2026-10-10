import { useState, useId, useEffect, useRef } from "react";
import type { AppView } from "../routing";
import "./spe-universe-deck.css";

interface ModelNode {
  id: string;
  name: string;
  tier: "local" | "frontier";
  badge: string;
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
    text: "Lock down MCP Postgres tool: disallow DROP and truncate operations",
    targetModelId: "gpt-4o",
  },
  {
    text: "Synthesize 2,000,000 token context cache with zero boundary degradation",
    targetModelId: "gemini-flash",
  },
  {
    text: "Formally prove Bounded Horn SAT consistency for multi-agent delegation",
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
            const tx = 490 + 420 * Math.cos(a);
            const ty = 260 + 200 * Math.sin(a);
            const cx = 490;
            const cy = 310;
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

  // Compute model positions along elliptical orbit
  const modelNodesWithPos = ORBIT_MODELS.map((model, i) => {
    const a = orbitAngle + (i / ORBIT_MODELS.length) * Math.PI * 2;
    // Ellipse center at (50%, 50%), rx = 42%, ry = 36%
    const cx = 50;
    const cy = 50;
    const rx = 42;
    const ry = 36;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    const depth = (Math.sin(a) + 1) / 2; // 0 at top/back, 1 at bottom/front
    const scale = 0.88 + 0.12 * depth;
    const opacity = 0.65 + 0.35 * depth;
    const zIndex = 10 + Math.round(depth * 20);

    return {
      ...model,
      x,
      y,
      scale,
      opacity,
      zIndex,
      svgX: 490 + 420 * Math.cos(a),
      svgY: 260 + 200 * Math.sin(a),
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
          <svg className="spe-orbit-svg-canvas" viewBox="0 0 980 520" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="spe-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d1fe17" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#d1fe17" stopOpacity="0.3" />
              </linearGradient>

              <filter id="spe-spark-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer Frontier Orbit Ellipse */}
            <ellipse cx="490" cy="260" rx="420" ry="200" className="spe-orbit-ellipse" />
            {/* Inner Local Orbit Ellipse */}
            <ellipse cx="490" cy="260" rx="300" ry="140" className="spe-orbit-ellipse is-inner" />

            {/* Dynamic Quadratic Bezier Laser Beam connecting center to active satellite node */}
            <path
              d={`M 490 310 Q 490 200 ${activeModelWithPos.svgX} ${activeModelWithPos.svgY}`}
              className={`spe-beam-path ${isSending ? "is-active-pulse" : ""}`}
            />

            {/* Flying Glowing Particle Spark along bezier path */}
            {sparkPos.opacity > 0 && (
              <circle
                cx={sparkPos.x}
                cy={sparkPos.y}
                r="5.5"
                fill="#d1fe17"
                filter="url(#spe-spark-glow)"
                opacity={sparkPos.opacity}
                className="spe-spark"
              />
            )}
          </svg>

          {/* Continuously Rotating Orbiting Satellite Nodes */}
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
                    style={{ accentColor: "var(--spe-universe-lime)" }}
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
