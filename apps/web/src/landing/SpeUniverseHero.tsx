import { useState, useId, useEffect, useRef } from "react";
import type { AppView } from "../routing";
import "./spe-universe-deck.css";

// ============================================================
// Authentic Vector Brand Logos for the 6 Heroes + 3D SPE Sun
// ============================================================

/** 1. Google Antigravity Real Vector Logo (Levitating Delta Prism & 4-Point Spark) */
function AntigravityLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="agy-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#A142F4" />
          <stop offset="100%" stopColor="#24C1E0" />
        </linearGradient>
        <linearGradient id="agy-grad-b" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34A853" />
          <stop offset="50%" stopColor="#FBBC04" />
          <stop offset="100%" stopColor="#EA4335" />
        </linearGradient>
      </defs>
      {/* Levitating Antigravity Delta Wings */}
      <path
        d="M12 2.2L3.2 18.2L7.4 20.5L12 11.8L16.6 20.5L20.8 18.2L12 2.2Z"
        fill="url(#agy-grad-a)"
      />
      {/* Inner Anti-Gravity Spark Core */}
      <path
        d="M12 12.8C12 15.2 10.3 16.9 7.9 16.9C10.3 16.9 12 18.6 12 21C12 18.6 13.7 16.9 16.1 16.9C13.7 16.9 12 15.2 12 12.8Z"
        fill="url(#agy-grad-b)"
      />
    </svg>
  );
}

/** 2. Claude Code / Anthropic Real Vector Logo */
function ClaudeCodeLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Official Claude Sunburst / Spark & Anthropic Mark */}
      <path
        d="M12 2.25V7.5M12 16.5V21.75M4.2 6.2L8.4 9.6M15.6 14.4L19.8 17.8M2.25 12H7.5M16.5 12H21.75M4.2 17.8L8.4 14.4M15.6 9.6L19.8 6.2M8.2 3.4L10.6 8.2M13.4 15.8L15.8 20.6M15.8 3.4L13.4 8.2M10.6 15.8L8.2 20.6"
        stroke="#D97757"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="#D97757" />
    </svg>
  );
}

/** 3. ChatGPT / OpenAI Real Vector Logo */
function ChatGptLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#10A37F" aria-hidden="true">
      <path d="M22.28 9.37a5.99 5.99 0 0 0-.52-4.94 6.06 6.06 0 0 0-4.66-2.93 6.01 6.01 0 0 0-5.1 1.63 6.05 6.05 0 0 0-4.04-.38 6.03 6.03 0 0 0-3.8 3.32 6.03 6.03 0 0 0 .75 6.2 6.02 6.02 0 0 0 .52 4.94 6.06 6.06 0 0 0 4.66 2.93 6.01 6.01 0 0 0 5.1-1.63 6.04 6.04 0 0 0 4.04.38 6.03 6.03 0 0 0 3.8-3.32 6.02 6.02 0 0 0-.75-6.2zM12 21.05a4.53 4.53 0 0 1-2.92-1.06l.16-.09 4.84-2.8a.74.74 0 0 0 .37-.64v-6.84l2.06 1.19v5.69a4.55 4.55 0 0 1-4.51 4.55zm-7.7-4.45a4.54 4.54 0 0 1-.55-3.07l.16.1 4.84 2.8c.23.13.37.38.37.64v3.42l-2.06-1.19v-2.7zm-.92-8.52a4.55 4.55 0 0 1 2.37-2.02v5.78a.74.74 0 0 0 .37.64l5.92 3.42-2.06 1.19-4.84-2.8a4.55 4.55 0 0 1-1.76-6.21zm14.33 2.12l-5.92-3.42 2.06-1.19 4.84 2.8a4.55 4.55 0 0 1 1.76 6.21 4.54 4.54 0 0 1-2.37 2.02v-5.78a.74.74 0 0 0-.37-.64zm2.34 6.4a4.54 4.54 0 0 1 .55 3.07l-.16-.1-4.84-2.8a.74.74 0 0 0-.37-.64v-3.42l2.06 1.19v2.7zm-6.66-3.07l-2.6-1.5 2.6-1.5 2.6 1.5-2.6 1.5z" />
    </svg>
  );
}

/** 4. Grok (xAI) Real Vector Logo */
function GrokLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* xAI Grok Orbital Ring & Diagonal Slash */}
      <circle
        cx="12"
        cy="12"
        r="7.4"
        stroke="#F8FAFC"
        strokeWidth="2.1"
        strokeDasharray="34 12"
        transform="rotate(-28 12 12)"
      />
      <path
        d="M4.2 19.8L19.8 4.2"
        stroke="#F8FAFC"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 5. Cursor Real 3D Cube Vector Logo */
function CursorLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Top Cube Face */}
      <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.4" />
      <path d="M12 2L20.66 7L12 12L3.34 7L12 2Z" fill="#E2E8F0" />
      <path d="M12 12L20.66 7V17L12 22V12Z" fill="#64748B" />
      {/* Cursor Pointer Triangle */}
      <path d="M9.5 8.5L16.5 12L12.5 13.5L11 17.5L9.5 8.5Z" fill="#38BDF8" />
    </svg>
  );
}

/** 6. GitHub Real Octocat Vector Logo */
function GitHubLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F8FAFC" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
      />
    </svg>
  );
}

/** Central 3D SPE Sun Logo — Placed at the exact center of the galaxy orbit */
function Spe3DSunLogo() {
  return (
    <div className="spe-3d-sun-core" aria-label="SPE 3D Sun Core">
      <div className="spe-3d-sun-corona" aria-hidden="true" />
      <div className="spe-3d-sun-ring spe-3d-sun-ring--outer" aria-hidden="true" />
      <div className="spe-3d-sun-ring spe-3d-sun-ring--tilted" aria-hidden="true" />
      <img
        className="spe-3d-sun-emblem spe-3d-sun-emblem-img"
        src="/brand/spe-3d-core-logo.png"
        alt=""
        aria-hidden="true"
        width={148}
        height={148}
        draggable={false}
      />
      <span className="spe-3d-sun-caption">SPE Ω 3D CORE</span>
    </div>
  );
}

function renderModelLogo(modelId: string, size = 20) {
  switch (modelId) {
    case "local-engine":
      return <AntigravityLogo size={size} />;
    case "claude-sonnet":
      return <ClaudeCodeLogo size={size} />;
    case "openai-o3":
      return <ChatGptLogo size={size} />;
    case "gemini-flash":
      return <GrokLogo size={size} />;
    case "deepseek-r1":
      return <CursorLogo size={size} />;
    case "llama-local":
      return <GitHubLogo size={size} />;
    default:
      return <AntigravityLogo size={size} />;
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
    company: "Antigravity",
    name: "Google DeepMind",
    tier: "local",
    answeringTitle: "Google Antigravity · Multi-Agent Autonomous Engineering",
    answeringDesc:
      "Compiles role-isolated subagent instructions, tool permissions, and strict workspace invariants for Google DeepMind Antigravity.",
    tokenWaste: "Google AGY",
    invariantPass: "Zero Drift",
    costProfile: "Deterministic",
    latency: "Real-Time",
  },
  {
    id: "claude-sonnet",
    company: "Claude Code",
    name: "Anthropic",
    tier: "frontier",
    answeringTitle: "Claude Code · Deep Architecture & Terminal Craft",
    answeringDesc:
      "Compiles compact CLAUDE.md guidelines, multi-step execution plans, and compositional skill definitions for Anthropic Claude Code.",
    tokenWaste: "Anthropic",
    invariantPass: "Zero Drift",
    costProfile: "Deterministic",
    latency: "Real-Time",
  },
  {
    id: "openai-o3",
    company: "ChatGPT",
    name: "OpenAI",
    tier: "frontier",
    answeringTitle: "ChatGPT / OpenAI · Structured Schema & System Roles",
    answeringDesc:
      "Compiles system prompts with strict JSON schema outputs, reasoning boundaries, and zero-leak prompt defenses for OpenAI models.",
    tokenWaste: "OpenAI GPT-6.1",
    invariantPass: "Zero Drift",
    costProfile: "Deterministic",
    latency: "Real-Time",
  },
  {
    id: "gemini-flash",
    company: "Grok",
    name: "xAI",
    tier: "frontier",
    answeringTitle: "Grok (xAI) · Adversarial Stress-Testing & Truth Discovery",
    answeringDesc:
      "Compiles unvarnished truth-seeking rules, red-team counterexample guards, and real-time knowledge prompts for xAI Grok.",
    tokenWaste: "xAI Grok",
    invariantPass: "Zero Drift",
    costProfile: "Deterministic",
    latency: "Real-Time",
  },
  {
    id: "deepseek-r1",
    company: "Cursor",
    name: "AI Code Editor",
    tier: "frontier",
    answeringTitle: "Cursor · .cursorrules & Multi-File IDE Context",
    answeringDesc:
      "Exports production .cursorrules and agent system instructions optimized for rapid multi-file refactoring and zero hallucinations.",
    tokenWaste: "Cursor IDE",
    invariantPass: "Zero Drift",
    costProfile: "Deterministic",
    latency: "Real-Time",
  },
  {
    id: "llama-local",
    company: "GitHub",
    name: "Octocat & Actions",
    tier: "local",
    answeringTitle: "GitHub · Actions CI/CD Quality Gates & Copilot Rules",
    answeringDesc:
      "Enforces automated repository custody, PR verification workflows, and deterministic prompt tests directly in GitHub Actions.",
    tokenWaste: "GitHub Actions",
    invariantPass: "Zero Drift",
    costProfile: "Deterministic",
    latency: "Real-Time",
  },
];

interface PromptCycle {
  text: string;
  targetModelId: string;
}

const PROMPT_CYCLES: PromptCycle[] = [
  {
    text: "spe compile --target antigravity --invariants strict --zero-leak",
    targetModelId: "local-engine",
  },
  {
    text: "spe compile --target claude-code --skills format --terminal-craft",
    targetModelId: "claude-sonnet",
  },
  {
    text: "spe compile --target openai-gpt6 --schema-strict --reasoning-high",
    targetModelId: "openai-o3",
  },
  {
    text: "spe compile --target xai-grok --counterexamples --adversarial-defense",
    targetModelId: "gemini-flash",
  },
  {
    text: "spe compile --target cursor --export-cursorrules --multi-file",
    targetModelId: "deepseek-r1",
  },
  {
    text: "spe compile --target github-actions --ci-cd-gate --tamper-proof",
    targetModelId: "llama-local",
  },
];

interface Props {
  onNavigate?: (view: AppView) => void;
}

export function SpeUniverseHero({ onNavigate }: Props) {
  const [activeModelId, setActiveModelId] = useState<string>("local-engine");
  const [typedPrompt, setTypedPrompt] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sparkPos, setSparkPos] = useState<{ x: number; y: number; opacity: number }>({ x: 490, y: 280, opacity: 0 });
  const [pulseModelId, setPulseModelId] = useState<string | null>(null);
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
    const spinSpeed = (Math.PI * 2) / 24000;

    const loop = (now: number) => {
      const dt = Math.min(now - lastTimeRef.current, 64);
      lastTimeRef.current = now;

      const speed = isHoverPaused ? spinSpeed * 0.35 : spinSpeed;
      angleRef.current += dt * speed;
      setOrbitAngle(angleRef.current);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isHoverPaused]);

  // Typewriter & Solar Spark Simulation Engine from the central 3D SPE Sun (490, 280)
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
          setTimeout(runTypewriter, 34);
        } else {
          state = "flying";
          setIsSending(true);
          setActiveModelId(current.targetModelId);

          let sparkProgress = 0;
          const sparkStart = performance.now();
          const sparkDuration = 550;

          const animateSpark = (now: number) => {
            if (isCancelled) return;
            const elapsed = now - sparkStart;
            sparkProgress = Math.min(elapsed / sparkDuration, 1);

            const mIdx = ORBIT_MODELS.findIndex((m) => m.id === current.targetModelId);
            const a = angleRef.current + (mIdx / ORBIT_MODELS.length) * Math.PI * 2;
            const tx = 490 + 390 * Math.cos(a);
            const ty = 230 + 165 * Math.sin(a);
            const cx = 490;
            const cy = 230;
            const qx = (cx + tx) / 2;
            const qy = (cy + ty) / 2 - 35;

            const t = sparkProgress;
            const bx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * qx + t * t * tx;
            const by = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * qy + t * t * ty;

            setSparkPos({ x: bx, y: by, opacity: 1 - t * 0.2 });

            if (sparkProgress < 1) {
              requestAnimationFrame(animateSpark);
            } else {
              setSparkPos((p) => ({ ...p, opacity: 0 }));
              setIsSending(false);
              setPulseModelId(current.targetModelId);
              setTimeout(() => setPulseModelId(null), 800);

              state = "hold";
              setTimeout(() => {
                if (isCancelled) return;
                state = "erasing";
                runTypewriter();
              }, 2400);
            }
          };

          requestAnimationFrame(animateSpark);
        }
      } else if (state === "erasing") {
        if (charIdx > 0) {
          setTypedPrompt(current.text.slice(0, charIdx));
          charIdx--;
          setTimeout(runTypewriter, 16);
        } else {
          cycleIdx = (cycleIdx + 1) % PROMPT_CYCLES.length;
          state = "typing";
          setTimeout(runTypewriter, 350);
        }
      }
    };

    const initialTimeout = setTimeout(runTypewriter, 500);

    return () => {
      isCancelled = true;
      clearTimeout(initialTimeout);
    };
  }, []);

  // Compute Hero positions along clean elliptical orbit around the central 3D SPE Sun
  const modelNodesWithPos = ORBIT_MODELS.map((model, i) => {
    const a = orbitAngle + (i / ORBIT_MODELS.length) * Math.PI * 2;
    const cx = 50;
    const cy = 50;
    const rx = 40;
    const ry = 36;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    const depth = (Math.sin(a) + 1) / 2;
    const scale = 0.92 + 0.1 * depth;
    const opacity = 0.8 + 0.2 * depth;
    const zIndex = 10 + Math.round(depth * 20);

    return {
      ...model,
      x,
      y,
      scale,
      opacity,
      zIndex,
      svgX: 490 + 390 * Math.cos(a),
      svgY: 230 + 165 * Math.sin(a),
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
    <section className="spe-universe-section" aria-labelledby={headingId} data-copy-depth="PROOF">
      <div className="spe-universe-container">
        {/* 10/10 Planetary Standard Header */}
        <header className="spe-universe-story-header">
          <div className="spe-universe-kicker">
            <span className="spe-universe-kicker-dot" aria-hidden="true" />
            <span>THE UNIVERSAL OPERATING LAYER FOR AGENTIC AI</span>
          </div>
          <h2 id={headingId} className="spe-universe-title">
            One Engine. <em>Every Frontier Model.</em>
          </h2>
          <p className="spe-universe-subtitle">
            System Prompt Engine compiles mathematically verified system instructions that execute deterministically across Google Antigravity, Claude Code, OpenAI, Grok, Cursor, and GitHub.
          </p>
        </header>

        {/* Celestial Solar System Stage with 3D SPE Sun in the exact middle */}
        <div
          ref={stageRef}
          className="spe-orbit-stage spe-orbit-stage--sun"
          role="region"
          aria-label="SPE 3D Sun and the 6 Frontier AI platforms in orbit"
          onMouseMove={handleMouseMove}
          style={{
            ["--mx" as any]: `${mousePos.x}%`,
            ["--my" as any]: `${mousePos.y}%`,
          }}
        >
          {/* Dynamic Solar Beam & Concentric SVG Orbits centered at (490, 230) */}
          <svg className="spe-orbit-svg-canvas" viewBox="0 0 980 460" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="spe-beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.98" />
                <stop offset="45%" stopColor="#F59E0B" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3D5AFE" stopOpacity="0.85" />
              </linearGradient>

              <filter id="spe-spark-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feFlood floodColor="#FBBF24" result="color" />
                <feComposite in2="blur" in="color" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer Hero Orbit Ellipse */}
            <ellipse cx="490" cy="230" rx="390" ry="165" className="spe-orbit-ellipse" />
            {/* Inner Solar Corona Orbit Ellipse */}
            <ellipse cx="490" cy="230" rx="240" ry="102" className="spe-orbit-ellipse is-inner" />

            {/* Dynamic Solar Beam radiating from the central 3D SPE Sun (490, 230) to active Hero */}
            <path
              d={`M 490 230 Q ${(490 + activeModelWithPos.svgX) / 2} ${(230 + activeModelWithPos.svgY) / 2 - 30} ${activeModelWithPos.svgX} ${activeModelWithPos.svgY}`}
              className={`spe-beam-path ${isSending ? "is-active-pulse" : ""}`}
            />

            {/* Flying Solar Particle Spark along beam */}
            {sparkPos.opacity > 0 && (
              <circle
                cx={sparkPos.x}
                cy={sparkPos.y}
                r="6"
                fill="#FEF3C7"
                filter="url(#spe-spark-glow)"
                opacity={sparkPos.opacity}
                className="spe-spark"
              />
            )}
          </svg>

          {/* CENTRAL 3D SPE SUN LOGO AT THE EXACT MIDDLE OF THE ORBIT */}
          <Spe3DSunLogo />

          {/* 6 Orbiting Hero Nodes with Authentic Vector Logos */}
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
                aria-label={`Select ${model.company} (${model.name})`}
              >
                <span className="spe-satellite-brand-logo" aria-hidden="true">
                  {renderModelLogo(model.id, 20)}
                </span>
                <span className="spe-satellite-label">
                  <strong className="spe-brand-company">{model.company}</strong>
                  <span className="spe-brand-divider">·</span>
                  <span className="spe-brand-model">{model.name}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Docked Compiler Target Switchboard & Live Execution Passport Card */}
        <div className="spe-center-capsule spe-gratitude-dock">
          <div className="spe-starter-chips-cluster" role="group" aria-label="Select an AI runtime target">
            {ORBIT_MODELS.map((hero) => (
              <button
                key={hero.id}
                type="button"
                className={`spe-starter-chip ${hero.id === activeModelId ? "is-selected-chip" : ""}`}
                onClick={() => {
                  setActiveModelId(hero.id);
                  setTypedPrompt(`spe compile --target ${hero.id} --invariants strict`);
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {renderModelLogo(hero.id, 15)}
                  <span>{hero.company}</span>
                </span>
              </button>
            ))}
          </div>

          <div className={`spe-intent-bar-wrapper ${isSending ? "is-sent-flash" : ""}`}>
            <span className="spe-intent-icon" aria-hidden="true">⚡</span>
            <input
              type="text"
              className="spe-intent-input"
              value={typedPrompt}
              onChange={(e) => setTypedPrompt(e.target.value)}
              placeholder="spe compile --target [runtime] --invariants strict"
              aria-label="SPE compile CLI command for runtime targets"
            />
            <button
              type="button"
              className={`spe-intent-submit-btn ${isSending ? "is-scaled-down" : ""}`}
              onClick={handleLaunchStudio}
              title="Open System Prompt Studio"
              aria-label="Open System Prompt Studio"
            >
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className={`spe-execution-passport-card ${isSending ? "is-swapping" : ""}`} role="status" aria-live="polite">
            <div className="spe-passport-top-row">
              <div className="spe-passport-badge-cluster">
                <span className="spe-passport-answering-pill">
                  <span className="spe-passport-dot-pulse" aria-hidden="true" />
                  Frontier Target
                </span>
                <span className="spe-passport-tier-pill">
                  {activeModelWithPos.company} · {activeModelWithPos.name}
                </span>
              </div>
              <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
                Deterministic Execution Contract
              </span>
            </div>

            <div>
              <h3 className="spe-passport-model-title">
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  {renderModelLogo(activeModelWithPos.id, 22)}
                </span>{" "}
                {activeModelWithPos.answeringTitle}
              </h3>
              <p className="spe-passport-model-desc">{activeModelWithPos.answeringDesc}</p>
            </div>

            <div className="spe-passport-metrics-grid">
              <div className="spe-passport-metric-cell">
                <span className="spe-passport-metric-label">Target Runtime</span>
                <span className="spe-passport-metric-value">{activeModelWithPos.tokenWaste}</span>
              </div>
              <div className="spe-passport-metric-cell">
                <span className="spe-passport-metric-label">Execution Guard</span>
                <span className="spe-passport-metric-value">{activeModelWithPos.invariantPass}</span>
              </div>
              <div className="spe-passport-metric-cell">
                <span className="spe-passport-metric-label">Drift Ceiling</span>
                <span className="spe-passport-metric-value">{activeModelWithPos.costProfile}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Orbit Guidance */}
        <div className="spe-orbit-guidance-pill">
          <span aria-hidden="true">☀️</span>
          <span>Select any Frontier AI platform orbiting the 3D SPE Sun — Antigravity, Claude Code, ChatGPT, Grok, Cursor, or GitHub.</span>
        </div>
      </div>
    </section>
  );
}

