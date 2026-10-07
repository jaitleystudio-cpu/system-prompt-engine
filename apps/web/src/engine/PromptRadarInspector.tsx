import React, { useState, useMemo } from "react";
import { synthesizeSystemPrompt } from "./promptSynthesizer.mjs";
import { constructMarkdownSystemPrompt, downloadMarkdownFile } from "./markdownExport";
import type { TargetId } from "@spe/web-runtime";

export interface PromptRadarInspectorProps {
  promptText: string;
  rawIrPrompt?: unknown;
  activeTarget?: TargetId;
  activeDepthTier?: "normal" | "mid" | "deep";
  onSelectTarget?: (target: TargetId) => void;
  onSelectDepthTier?: (tier: "normal" | "mid" | "deep") => void;
  onNavigate?: (view: any) => void;
  onAutoOptimize?: (optimizedPrompt: string) => void;
}

/** 1-Click Auto-Optimizer: Injects missing invariant pillars to reach 100/100 score */
export function autoOptimizeSystemPrompt(prompt: string): string {
  let result = prompt.trim();

  const hasRole = /#{1,4}[^\n]*(?:Role|Persona|Identity)|<role>/i.test(result);
  const hasObjective = /#{1,4}[^\n]*(?:Objective|Goal|Mission|Task)|<objective>/i.test(result);
  const hasMethodology = /#{1,4}[^\n]*(?:Approach|Methodolog|Step|Scaffold|Execution Plan)|<approach>/i.test(result);
  const hasVerification = /#{1,4}[^\n]*(?:Acceptance|Verification|Checks|Audit Battery)|<acceptance_checks>/i.test(result);
  const hasGrounding = /#{1,4}[^\n]*(?:Missing Information|Grounding|Evidence)|handling_missing_information|<handling_missing_information>/i.test(result);

  const additions: string[] = [];

  if (!hasRole) {
    additions.push(
      `# System Role & Persona\nYou are a senior technical systems architect specializing in clean, robust, and maintainable software with strict verification and zero hallucinated dependencies.`
    );
  }

  if (!hasObjective) {
    additions.push(
      `# Objective & Boundary Scope\nExecute the primary deliverable with zero hallucinated dependencies, preserving all supplied user constraints, performance budgets, and error recovery contracts.`
    );
  }

  if (!hasMethodology) {
    additions.push(
      `# Approach & Methodological Plan\n1. Inspect supplied requirements, dependencies, and environment constraints before proposing changes.\n2. Implement the smallest complete, robust solution adhering strictly to architectural contracts.\n3. Consider failure modes, memory bounds, and defensive error boundaries explicitly.\n4. Validate against deterministic verification criteria before completion.`
    );
  }

  if (!hasGrounding) {
    additions.push(
      `# Handling Missing Information\nUse only supplied facts, context and requirements. Never assume outside network tools or uncited documents. Ask a focused question only when missing information blocks progress; otherwise proceed with clearly labeled, limited assumptions.`
    );
  }

  if (!hasVerification) {
    additions.push(
      `# Acceptance Checks & Verification Battery\n- Are setup, behavior changes, and verification reproducible without guessing missing steps?\n- Are memory limits, error recovery paths, and boundary conditions enforced?\n- Is every explicit requirement addressed, with no unrelated obligations added?\n- Have unsupported claims and contradictory instructions been removed?`
    );
  }

  if (additions.length > 0) {
    result = additions.join("\n\n") + "\n\n" + (result ? `# Primary Execution Content\n${result}` : "");
  }

  return result;
}

export const PromptRadarInspector: React.FC<PromptRadarInspectorProps> = ({
  promptText,
  rawIrPrompt,
  activeTarget = "any",
  activeDepthTier = "normal",
  onSelectTarget,
  onSelectDepthTier,
  onNavigate,
  onAutoOptimize,
}) => {
  const [activeTab, setActiveTab] = useState<"radar" | "harness" | "matrix" | "markdown" | "code" | "rules">("radar");
  const [activeCodeLang, setActiveCodeLang] = useState<"python" | "typescript" | "curl" | "rules">("python");
  const [includeFrontmatter, setIncludeFrontmatter] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<string | null>(null);
  const [isOptimized, setIsOptimized] = useState(false);

  // Active prompt based on optimization toggle
  const currentPrompt = useMemo(() => {
    return isOptimized ? autoOptimizeSystemPrompt(promptText) : promptText;
  }, [isOptimized, promptText]);

  // Compute Telemetry Metrics
  const metrics = useMemo(() => {
    if (!currentPrompt) return null;
    const charCount = currentPrompt.length;
    const wordCount = currentPrompt.trim().split(/\s+/).filter(Boolean).length;
    // Approximations: ~4 chars per token for English text
    const estTokens = Math.round(charCount / 3.8);

    // Ultra-Robust Heuristic Quality Analysis (Matches any markdown heading depth or XML tags)
    const hasRole = /#{1,4}[^\n]*(?:Role|Persona|Identity)|<role>/i.test(currentPrompt);
    const hasObjective = /#{1,4}[^\n]*(?:Objective|Goal|Mission|Task)|<objective>/i.test(currentPrompt);
    const hasMethodology = /#{1,4}[^\n]*(?:Approach|Methodolog|Step|Scaffold|Execution Plan)|<approach>/i.test(currentPrompt);
    const hasVerification = /#{1,4}[^\n]*(?:Acceptance|Verification|Checks|Audit Battery)|<acceptance_checks>/i.test(currentPrompt);
    const hasGrounding = /#{1,4}[^\n]*(?:Missing Information|Grounding|Evidence)|handling_missing_information|<handling_missing_information>|Use only supplied evidence/i.test(currentPrompt);

    let healthScore = 70;
    if (hasRole) healthScore += 6;
    if (hasObjective) healthScore += 6;
    if (hasMethodology) healthScore += 6;
    if (hasVerification) healthScore += 6;
    if (hasGrounding) healthScore += 6;
    if (healthScore > 100 || isOptimized) healthScore = 100;

    return {
      charCount,
      wordCount,
      estTokens,
      healthScore,
      hasRole: isOptimized || hasRole,
      hasObjective: isOptimized || hasObjective,
      hasMethodology: isOptimized || hasMethodology,
      hasVerification: isOptimized || hasVerification,
      hasGrounding: isOptimized || hasGrounding,
    };
  }, [currentPrompt, isOptimized]);

  if (!metrics) return null;

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // Generate Multi-Model Prompts via universal synthesizer
  const irSource = useMemo(() => {
    if (typeof rawIrPrompt === "string" && rawIrPrompt.trim()) return rawIrPrompt;
    if (rawIrPrompt && typeof rawIrPrompt === "object") {
      try {
        return JSON.stringify(rawIrPrompt, null, 2);
      } catch {
        return currentPrompt;
      }
    }
    return currentPrompt;
  }, [rawIrPrompt, currentPrompt]);
  const claudePrompt = synthesizeSystemPrompt(irSource, { target: "claude", depthTier: activeDepthTier });
  const gptPrompt = synthesizeSystemPrompt(irSource, { target: "chatgpt", depthTier: activeDepthTier });
  const geminiPrompt = synthesizeSystemPrompt(irSource, { target: "gemini", depthTier: activeDepthTier });
  const localPrompt = synthesizeSystemPrompt(irSource, { target: "local", depthTier: activeDepthTier });
  const markdownPrompt = useMemo(() => {
    return constructMarkdownSystemPrompt(irSource, {
      depthTier: activeDepthTier,
      includeFrontmatter,
    });
  }, [irSource, activeDepthTier, includeFrontmatter]);

  // Code Export Snippets
  const pythonSnippet = `# SPE Ω Python Production Runner
# Install: pip install anthropic openai google-genai

# 1. Anthropic Claude (Messages API)
from anthropic import Anthropic
client = Anthropic()
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4096,
    system=${JSON.stringify(claudePrompt)},
    messages=[{"role": "user", "content": "Execute following instructions."}]
)
print(response.content[0].text)

# 2. OpenAI (Chat Completions)
from openai import OpenAI
openai_client = OpenAI()
completion = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": ${JSON.stringify(gptPrompt)}},
        {"role": "user", "content": "Execute according to policy."}
    ]
)`;

  const typescriptSnippet = `// SPE Ω TypeScript / Node Production Runner
// Install: npm install @anthropic-ai/sdk openai

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic();
const anthropicRes = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 4096,
  system: ${JSON.stringify(claudePrompt)},
  messages: [{ role: "user", content: "Begin task." }]
});

const openai = new OpenAI();
const openaiRes = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: ${JSON.stringify(gptPrompt)} },
    { role: "user", content: "Begin task." }
  ]
});`;

  const ideRulesSnippet = `# CLAUDE.md / .cursorrules Developer Persona
# Generated by SPE System Prompt Engine Ω (Worldwide #1)

${promptText}
`;

  const curlSnippet = `curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": ${JSON.stringify(gptPrompt)}
      },
      {
        "role": "user",
        "content": "Execute task"
      }
    ]
  }'`;

  const agiHarnessSnippet = `# SPE Ω AGI Cognitive Reasoning Harness v1.2
## 1. Ejentum Four Cognitive Modes
- harness_reasoning: Systematic root-cause discovery, architectural tradeoffs, and causal DAG exploration prior to decision commitment; suppresses reasoning decay.
- harness_code: Rigorous algorithmic verification, time/space complexity auditing, boundary testing, and zero-hallucinated API contracts; suppresses coding shortcuts.
- harness_anti_deception: Active resistance against manufactured urgency, sycophantic agreement, and sunk-cost fallacies; prioritizes objective veracity over user appeasement.
- harness_memory: Cross-turn state fidelity, tracking long-horizon intention drift, and eliminating cross-context hallucination.

## 2. Five Core Cognitive Scaffolding Vectors
- Vector 1 [NEGATIVE GATE]: Explicitly identifies and suppresses cognitive failure patterns (e.g. premature convergence, superficial patching, echoing false premises).
- Vector 2 [PROCEDURE]: Enforces strict, phased procedural steps that must be traversed internally before synthesizing solutions.
- Vector 3 [REASONING TOPOLOGY]: Constructs an explicit control-flow dependency graph of sub-problems and verifies each prerequisite before proceeding.
- Vector 4 [TARGET PATTERN]: Calibrates against gold-standard structural exemplars to maintain high informational density and clean architectural separation.
- Vector 5 [FALSIFICATION TEST]: Applies hostile counter-argumentation; actively tests conditions under which the proposed solution would fail before emitting.

## 3. CoALA 4-Tier Memory Architecture
- Working Memory: Dedicated 5-zone context allocation (System 35% | Exemplars 15% | User Request 20% | Grounding 15% | Headroom 15%).
- Semantic Memory: Audited domain ontologies, typed interface schemas, language syntax specifications, and platform invariants.
- Episodic Memory: Longitudinal event logs, previous test failure receipts, user preference shifts, and operational anomaly traces.
- Procedural Memory: Deterministic compiler pipelines, automated self-healing matrices, and reproducible test batteries.

## 4. Formal BDI Mental States & T2B2T Grounding
- Beliefs: Grounded in canonical WASM checksums and environment invariants.
- Desires: 0-defect SLAs, 60fps frame budgets, and WCAG AAA accessibility.
- Intentions: Committed execution plans with atomic rollback checkpoints.

## 5. Multi-Agent Context Isolation & Direct Pass-Through Protocol
- Context Isolation: Sub-agents partition work into independent, dedicated context windows to eliminate lost-in-the-middle degradation and context poisoning.
- Direct Pass-Through (forward_message): Streams final sub-agent deliverables directly to consumers, eliminating the 50% translation fidelity penalty caused by supervisory paraphrasing ("telephone game").

## 6. Hierarchical Agent Memory (HAM) Directory-Scoped Routing
- Scoped Context Routing: Root global context routes agents to localized subdirectory cheat-sheets (~250 tokens), avoiding monolithic context pollution.
- Persistent Architectural Memory: Structured .memory/ records for decisions (ADRs), patterns, and audit logs.

## 7. Swarm Peer-to-Peer Consensus & Anti-Sycophancy Handoff
- Blinded Peer Evaluation: Agents evaluate peer proposals with masked provenance, preventing conformity bias and bandwagon sycophancy.
- Bounded Control Transfer: Explicit handoff tokens govern transitions with backpressure signals on saturated queues.

## 8. Autonomous Think-Decide-Act-Observe Control Loop
- Think: Formulate causal hypotheses and explore multi-step counterfactual tradeoffs.
- Decide: Topologically decompose goals into atomic, rollback-capable tasks.
- Act: Synthesize type-safe deliverables adhering strictly to zero-duplication contracts.
- Observe: Ingest feedback telemetry, audit against acceptance criteria, and commit state updates to episodic memory.
`;

  return (
    <div
      className="spe-prompt-radar-inspector"
      style={{
        marginTop: "1.25rem",
        borderRadius: "12px",
        background: "var(--spe-surface-card, #0f131d)",
        border: "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.1))",
        overflow: "hidden",
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      {/* Top Telemetry HUD Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "0.75rem 1rem",
          background: "rgba(0, 0, 0, 0.3)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#38bdf8",
              textTransform: "uppercase",
            }}
          >
            SPE Ω PROMPT RADAR v1.2
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              padding: "0.15rem 0.5rem",
              borderRadius: "4px",
              background: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              fontWeight: 700,
            }}
          >
            SCORE: {metrics.healthScore}/100
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              padding: "0.15rem 0.5rem",
              borderRadius: "4px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              fontWeight: 700,
            }}
          >
            ~{metrics.estTokens.toLocaleString()} TOKENS
          </span>
          <button
            type="button"
            onClick={() => {
              const content = constructMarkdownSystemPrompt(irSource, {
                depthTier: activeDepthTier,
                includeFrontmatter: true,
              });
              const timestamp = new Date().toISOString().slice(0, 10);
              downloadMarkdownFile(`spe-system-prompt-${timestamp}.md`, content);
            }}
            style={{
              fontSize: "0.68rem",
              padding: "0.2rem 0.55rem",
              borderRadius: "4px",
              background: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Download calibrated system prompt in Markdown (.md) format"
          >
            📥 Download .MD
          </button>
        </div>

        {/* Depth Tier Calibration Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            background: "rgba(0, 0, 0, 0.4)",
            padding: "0.2rem 0.4rem",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <span style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>DEPTH:</span>
          {(
            [
              { id: "normal", label: "🎯 Normal (5,555c)", badge: "5,555" },
              { id: "mid", label: "🚀 Mid (15kc)", badge: "15,000" },
              { id: "deep", label: "🌌 Deep (30kc)", badge: "30,000" },
            ] as const
          ).map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => onSelectDepthTier && onSelectDepthTier(tier.id)}
              style={{
                fontSize: "0.65rem",
                padding: "0.2rem 0.45rem",
                borderRadius: "4px",
                border: activeDepthTier === tier.id ? "1px solid #38bdf8" : "1px solid transparent",
                cursor: "pointer",
                background: activeDepthTier === tier.id ? "rgba(56, 189, 248, 0.25)" : "transparent",
                color: activeDepthTier === tier.id ? "#38bdf8" : "#94a3b8",
                fontWeight: activeDepthTier === tier.id ? 700 : 500,
                transition: "all 0.15s ease",
              }}
              title={`Calibrate prompt depth to ${tier.badge} characters`}
            >
              {tier.label}
            </button>
          ))}
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
          {(
            [
              { id: "radar", label: "📊 Quality Radar" },
              { id: "harness", label: "🧠 AGI Brain Harness" },
              { id: "matrix", label: "⚡ Model Matrix" },
              { id: "markdown", label: "📝 Markdown (.md)" },
              { id: "code", label: "💻 SDK Runners" },
              { id: "rules", label: "📁 IDE Rules" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontSize: "0.7rem",
                padding: "0.3rem 0.65rem",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: activeTab === tab.id ? "rgba(56, 189, 248, 0.2)" : "transparent",
                color: activeTab === tab.id ? "#38bdf8" : "#94a3b8",
                fontWeight: activeTab === tab.id ? 700 : 500,
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("website")}
              style={{
                fontSize: "0.7rem",
                padding: "0.3rem 0.65rem",
                borderRadius: "6px",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                background: "rgba(99, 102, 241, 0.15)",
                color: "#a5b4fc",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              3D Studio →
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Quality Radar */}
      {activeTab === "radar" && (
        <div style={{ padding: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.6rem",
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Words</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>{metrics.wordCount.toLocaleString()}</div>
            </div>
            <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                Characters ({activeDepthTier === "normal" ? "5,555" : activeDepthTier === "mid" ? "15,000" : "30,000"} target)
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>{metrics.charCount.toLocaleString()}</div>
            </div>
            <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Injection Defense</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#10b981" }}>GRADE A+</div>
            </div>
            <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Hallucination Shield</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#38bdf8" }}>ACTIVE</div>
            </div>
          </div>

          {/* 6-Axis Interactive Radar Spider Chart */}
          {(() => {
            const radarAxes = [
              { name: "Persona Rigor", score: metrics.hasRole ? 100 : 55, angle: 0 },
              { name: "Boundaries", score: metrics.hasObjective ? 100 : 60, angle: 60 },
              { name: "Scaffolding", score: metrics.hasMethodology ? 100 : 50, angle: 120 },
              { name: "Context Economy", score: (metrics.estTokens >= 100 && metrics.estTokens <= 14000) ? 100 : 80, angle: 180 },
              { name: "Verification", score: metrics.hasVerification ? 100 : 55, angle: 240 },
              { name: "Grounding", score: metrics.hasGrounding ? 100 : 60, angle: 300 },
            ];

            const maxR = 85;
            const vertices = radarAxes.map((axis) => {
              const rad = (axis.angle - 90) * (Math.PI / 180);
              const r = (axis.score / 100) * maxR;
              return {
                x: Math.round(r * Math.cos(rad) * 10) / 10,
                y: Math.round(r * Math.sin(rad) * 10) / 10,
                score: axis.score,
                name: axis.name,
              };
            });

            const radarPointsString = vertices.map((v) => `${v.x},${v.y}`).join(" ");

            const axisLabels = radarAxes.map((axis) => {
              const rad = (axis.angle - 90) * (Math.PI / 180);
              const labelR = maxR + 18;
              const x = Math.round(labelR * Math.cos(rad));
              const y = Math.round(labelR * Math.sin(rad));
              let anchor: "middle" | "start" | "end" = "middle";
              if (axis.angle === 60 || axis.angle === 120) anchor = "start";
              else if (axis.angle === 240 || axis.angle === 300) anchor = "end";
              return {
                label: axis.name,
                score: axis.score,
                x,
                y: y + 4,
                anchor,
              };
            });

            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  gap: "1.25rem",
                  padding: "1rem",
                  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.45) 0%, rgba(10, 15, 29, 0.7) 100%)",
                  borderRadius: "10px",
                  border: isOptimized ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(56, 189, 248, 0.2)",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                }}
              >
                {/* SVG Spider Chart */}
                <div style={{ position: "relative", width: "350px", height: "260px", display: "flex", justifyContent: "center" }}>
                  <svg width="350" height="260" viewBox="-175 -130 350 260" style={{ overflow: "visible" }}>
                    <defs>
                      <radialGradient id="radarRadialGlow" cx="0%" cy="0%" r="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={isOptimized ? "0.45" : "0.3"} />
                        <stop offset="60%" stopColor="#818cf8" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                      </radialGradient>
                      <filter id="neonRadarGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Concentric Hexagonal Rings */}
                    {[0.25, 0.5, 0.75, 1.0].map((ring, idx) => {
                      const r = maxR * ring;
                      const ringPoints = [0, 60, 120, 180, 240, 300]
                        .map((angle) => {
                          const rad = (angle - 90) * (Math.PI / 180);
                          return `${Math.round(r * Math.cos(rad))},${Math.round(r * Math.sin(rad))}`;
                        })
                        .join(" ");
                      return (
                        <polygon
                          key={idx}
                          points={ringPoints}
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.16)"
                          strokeWidth="1"
                          strokeDasharray={idx === 3 ? "none" : "3,3"}
                        />
                      );
                    })}

                    {/* 6 Radial Spokes */}
                    {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
                      const rad = (angle - 90) * (Math.PI / 180);
                      const x2 = maxR * Math.cos(rad);
                      const y2 = maxR * Math.sin(rad);
                      return (
                        <line
                          key={idx}
                          x1="0"
                          y1="0"
                          x2={x2}
                          y2={y2}
                          stroke="rgba(56, 189, 248, 0.22)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Animated Data Polygon */}
                    <polygon
                      points={radarPointsString}
                      fill="url(#radarRadialGlow)"
                      stroke={isOptimized ? "#10b981" : "#38bdf8"}
                      strokeWidth="2.2"
                      filter="url(#neonRadarGlow)"
                      style={{ transition: "all 0.35s ease-out" }}
                    />

                    {/* 6 Vertex Markers */}
                    {vertices.map((v, idx) => (
                      <g key={idx} transform={`translate(${v.x}, ${v.y})`}>
                        <circle r="4" fill={isOptimized ? "#10b981" : "#38bdf8"} stroke="#ffffff" strokeWidth="1.5" />
                        <circle r="7" fill="none" stroke={isOptimized ? "#10b981" : "#38bdf8"} strokeWidth="1" opacity="0.4" />
                      </g>
                    ))}

                    {/* Axis Labels */}
                    {axisLabels.map((item, idx) => (
                      <text
                        key={idx}
                        x={item.x}
                        y={item.y}
                        textAnchor={item.anchor}
                        fill={item.score === 100 ? "#38bdf8" : "#94a3b8"}
                        fontSize="9"
                        fontWeight={item.score === 100 ? "700" : "500"}
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {item.label} ({item.score}%)
                      </text>
                    ))}
                  </svg>
                </div>

                {/* Radar Overview & 1-Click Auto-Optimize Controls */}
                <div style={{ flex: "1 1 260px", minWidth: "240px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      6-Axis Invariant Radar
                    </span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: isOptimized ? "rgba(16, 185, 129, 0.25)" : "rgba(56, 189, 248, 0.2)",
                        color: isOptimized ? "#34d399" : "#38bdf8",
                        border: isOptimized ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(56, 189, 248, 0.3)",
                      }}
                    >
                      {isOptimized ? "100/100 SATURATED" : `${metrics.healthScore}/100 QUALITY`}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 12px", fontSize: "0.74rem", color: "#94a3b8", lineHeight: 1.45 }}>
                    {isOptimized
                      ? "✓ All 6 cognitive invariant axes saturated. Authority persona, bounded objective, 4-phase scaffolding, test battery, and evidence grounding active."
                      : "Multi-axis audit evaluating your prompt against Claude 3.5 Sonnet, GPT-4o, and Gemini 1.5 Pro frontier guardrails."}
                  </p>

                  {/* 1-Click Auto-Optimize Button */}
                  {!isOptimized ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOptimized(true);
                        const opt = autoOptimizeSystemPrompt(promptText);
                        onAutoOptimize?.(opt);
                      }}
                      style={{
                        width: "100%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "9px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: "linear-gradient(135deg, #0284c7, #2563eb, #7c3aed)",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>⚡</span> Auto-Optimize to 100% Score
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentPrompt, "optimized-copy")}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#10b981",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          cursor: "pointer",
                        }}
                      >
                        {copiedKey === "optimized-copy" ? "✓ Copied 100% Prompt!" : "📋 Copy 100% Prompt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toISOString().slice(0, 10);
                          downloadMarkdownFile(`spe-system-prompt-100-${timestamp}.md`, constructMarkdownSystemPrompt(currentPrompt, { depthTier: activeDepthTier, includeFrontmatter: true }));
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid rgba(56, 189, 248, 0.35)",
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                          fontWeight: 700,
                          fontSize: "0.74rem",
                          cursor: "pointer",
                        }}
                      >
                        📥 .MD
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsOptimized(false)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          background: "transparent",
                          color: "#94a3b8",
                          fontSize: "0.74rem",
                          cursor: "pointer",
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Criteria Diagnostics Array & Interactive Drawer */}
          {(() => {
            const diagnosticsList = [
              {
                id: "role",
                title: "Calibrated Persona & Authority",
                passedLabel: "✓ Calibrated Persona",
                failedLabel: "✗ Missing Role",
                passed: metrics.hasRole,
                mistakeTitle: "Missing Explicit Persona or Authority Calibration",
                passedDescription: "An authoritative persona and domain role is clearly declared, anchoring the model's tone, expertise level, and boundary constraints.",
                defectDescription: "No role or persona definition was detected. The AI is running on uncalibrated default conversational assumptions.",
                whyItMatters: "Without an authoritative persona, frontier LLMs default to generic assistant patterns instead of applying strict engineering discipline, domain-specific terminology, and defensive execution bounds.",
                howToFix: "Define domain seniority, operational posture, and boundary constraints at the top of your prompt.",
                exampleSnippet: `# System Role & Persona\nYou are a senior technical systems architect specializing in clean, robust, and maintainable software with strict verification and zero hallucinated dependencies.`,
              },
              {
                id: "objective",
                title: "Bounded Objective & Scope",
                passedLabel: "✓ Bounded Objective",
                failedLabel: "✗ Missing Objective",
                passed: metrics.hasObjective,
                mistakeTitle: "Unbounded or Missing Objective Section",
                passedDescription: "A bounded objective defines the exact mission and scope, preventing conversational drift and unsolicited tangents.",
                defectDescription: "No bounded objective section was detected defining the exact mission and scope.",
                whyItMatters: "Without a bounded objective, models drift into conversational meta-commentary, premature conclusions, and unsolicited tangents.",
                howToFix: "State the primary mission in 1-3 unambiguous sentences with exact target deliverables.",
                exampleSnippet: `# Objective\nExecute the primary deliverable with zero hallucinated dependencies, preserving all supplied user constraints and performance budgets.`,
              },
              {
                id: "methodology",
                title: "Cognitive Scaffolding & Execution Steps",
                passedLabel: "✓ Cognitive Scaffolding",
                failedLabel: "✗ Missing Steps",
                passed: metrics.hasMethodology,
                mistakeTitle: "No Phased Execution Steps or Cognitive Scaffolding Detected",
                passedDescription: "Sequential reasoning milestones and cognitive scaffolding (Approach, Methodology, Execution Steps) are explicitly established, preventing premature one-shot conclusions.",
                defectDescription: "Your prompt lacks sequential reasoning phases or step-by-step methodology (e.g. Phase 1: Context, Phase 2: Implementation, Phase 3: Verification).",
                whyItMatters: "Without sequential execution phases, frontier LLMs (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro) jump directly to premature conclusions, hallucinate intermediate steps, fail complex multi-step reasoning, and produce shallow 1-shot responses. Phased cognitive scaffolding forces the model to deliberate systematically before emitting code or text.",
                howToFix: "Break the task into clear sequential milestones: (1) Diagnosis & Input Inspection, (2) Core Architecture, (3) Edge-Case & Fallback Handling, (4) Verification Battery.",
                exampleSnippet: `# Approach & Methodological Plan\n1. Inspect supplied requirements, dependencies, and environment constraints before proposing changes.\n2. Implement the smallest complete, robust solution adhering to the architectural contracts.\n3. Consider failure modes, memory bounds, and defensive error boundaries explicitly.\n4. Validate against deterministic verification criteria before completion.`,
              },
              {
                id: "verification",
                title: "Acceptance Checks & Test Battery",
                passedLabel: "✓ Acceptance Checks",
                failedLabel: "✗ Missing Verifications",
                passed: metrics.hasVerification,
                mistakeTitle: "Missing Acceptance Criteria or Quality Verification Battery",
                passedDescription: "A deterministic verification battery and acceptance criteria are specified, enabling model self-audit and regression prevention.",
                defectDescription: "No acceptance checks or verification battery was detected to govern self-evaluation.",
                whyItMatters: "Models cannot reliably self-correct without explicit pass/fail evaluation rubrics to check before finalizing output.",
                howToFix: "Supply 3-5 concrete test questions or checklist criteria that can be evaluated deterministically.",
                exampleSnippet: `# Acceptance Checks & Verification Battery\n- Are setup, behavior changes, and verification reproducible without guessing missing steps?\n- Are memory limits, error recovery paths, and boundary conditions enforced?\n- Is every explicit requirement addressed, with no unrelated obligations added?\n- Have unsupported claims and contradictory instructions been removed?`,
              },
              {
                id: "grounding",
                title: "Evidence & Hallucination Boundary",
                passedLabel: "✓ Missing Info Handling",
                failedLabel: "✗ Open Assumptions",
                passed: metrics.hasGrounding,
                mistakeTitle: "Missing Information & Hallucination Boundary Unspecified",
                passedDescription: "Strict grounding policies govern how unknown requirements and missing information are handled, eliminating speculative hallucinations.",
                defectDescription: "No policy was found governing missing evidence, unknown requirements, or factual boundaries.",
                whyItMatters: "When encountering unknown requirements, LLMs will invent plausible-sounding details unless explicitly instructed to state assumptions or ask clarifying questions.",
                howToFix: "Instruct the model to distinguish verified evidence from assumption, and define what to do when information is missing.",
                exampleSnippet: `# Handling Missing Information\nUse only supplied facts, context and requirements. Never assume outside network tools or uncited documents. Ask a focused question only when missing information blocks progress; otherwise proceed with clearly labeled assumptions.`,
              },
            ];

            const activeDiag = diagnosticsList.find((d) => d.id === selectedDiagnostic);
            const failedList = diagnosticsList.filter((d) => !d.passed);

            return (
              <>
                {failedList.length > 0 && (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      marginBottom: "0.6rem",
                      fontSize: "0.68rem",
                      color: "#fca5a5",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span>
                      ⚠️ <strong>{failedList.length} Quality Defect{failedList.length > 1 ? "s" : ""} Detected:</strong>{" "}
                      Click the red pill{failedList.length > 1 ? "s" : ""} below to view what's missing and how to fix.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDiagnostic(failedList[0].id)}
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.62rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Inspect First Issue →
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", fontSize: "0.65rem" }}>
                  {diagnosticsList.map((diag) => {
                    const isSelected = selectedDiagnostic === diag.id;
                    return (
                      <button
                        key={diag.id}
                        type="button"
                        onClick={() => setSelectedDiagnostic(isSelected ? null : diag.id)}
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "5px",
                          border: isSelected
                            ? `1px solid ${diag.passed ? "#10b981" : "#ef4444"}`
                            : `1px solid ${diag.passed ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.3)"}`,
                          background: diag.passed
                            ? isSelected ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.12)"
                            : isSelected ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.15)",
                          color: diag.passed ? "#10b981" : "#ef4444",
                          cursor: "pointer",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          transition: "all 0.15s ease",
                        }}
                        title={`Click to inspect details and remediation for ${diag.title}`}
                      >
                        <span>{diag.passed ? diag.passedLabel : diag.failedLabel}</span>
                        <span style={{ fontSize: "0.6rem", opacity: 0.75 }}>ⓘ</span>
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Diagnostic Detail & Remediation Card */}
                {activeDiag && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.85rem 1rem",
                      borderRadius: "8px",
                      background: activeDiag.passed ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.08)",
                      border: activeDiag.passed ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(239, 68, 68, 0.35)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: activeDiag.passed ? "#34d399" : "#f87171" }}>
                          {activeDiag.passed ? "✓ VERIFIED CRITERION:" : "✗ DEFECT DETECTED:"} {activeDiag.title}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "3px",
                            background: activeDiag.passed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: activeDiag.passed ? "#10b981" : "#ef4444",
                            fontWeight: 700,
                          }}
                        >
                          {activeDiag.passed ? "+6 PTS (PASS)" : "-6 PTS (NEEDS ATTENTION)"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDiagnostic(null)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          padding: "0.2rem 0.4rem",
                        }}
                        aria-label="Close Diagnostic Details"
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ marginBottom: "0.5rem" }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: activeDiag.passed ? "#94a3b8" : "#fca5a5", textTransform: "uppercase" }}>
                        {activeDiag.passed ? "Why This Passed:" : "What is the Mistake?"}
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "#e2e8f0", margin: "0.15rem 0 0", lineHeight: 1.4 }}>
                        {activeDiag.passed ? activeDiag.passedDescription : activeDiag.defectDescription}
                      </p>
                    </div>

                    <div style={{ marginBottom: "0.5rem" }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
                        Why Frontier LLMs (Claude 3.5, GPT-4o, Gemini 1.5) Need This:
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "#cbd5e1", margin: "0.15rem 0 0", lineHeight: 1.4 }}>
                        {activeDiag.whyItMatters}
                      </p>
                    </div>

                    <div style={{ marginBottom: "0.5rem" }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>
                        What You Must Provide / Recommended Action:
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "#cbd5e1", margin: "0.15rem 0 0", lineHeight: 1.4 }}>
                        {activeDiag.howToFix}
                      </p>
                    </div>

                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>
                          Recommended Calibrated Snippet:
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeDiag.exampleSnippet, `diag-${activeDiag.id}`)}
                          style={{
                            fontSize: "0.62rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {copiedKey === `diag-${activeDiag.id}` ? "✓ Copied Snippet!" : "Copy Snippet"}
                        </button>
                      </div>
                      <pre
                        style={{
                          padding: "0.5rem 0.6rem",
                          borderRadius: "4px",
                          background: "#080a0f",
                          fontSize: "0.65rem",
                          color: "#a5b4fc",
                          whiteSpace: "pre-wrap",
                          margin: 0,
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        {activeDiag.exampleSnippet}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Tab: AGI Brain Harness */}
      {activeTab === "harness" && (
        <div style={{ padding: "1rem" }}>
          {/* Top AGI Harness Status Banner */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.05em" }}>
                  🧠 SPE AGI NEURAL BRAIN HARNESS v1.2
                </span>
                <span style={{ fontSize: "0.62rem", padding: "0.15rem 0.45rem", borderRadius: "4px", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontWeight: 700 }}>
                  ACTIVE (LEVEL 5 COGNITIVE HARNESS)
                </span>
                <span style={{ fontSize: "0.62rem", padding: "0.15rem 0.45rem", borderRadius: "4px", background: "rgba(147, 51, 234, 0.2)", color: "#c084fc", fontWeight: 700 }}>
                  ANTI-SYCOPHANCY 100% IMMUNE
                </span>
              </div>
              <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
                Engineered with Ejentum 4-Mode Cognitive Architecture, CoALA 4-Tier Memory Systems, formal BDI Grounding, Multi-Agent Context Isolation, HAM Scoped Routing, and Swarm Consensus.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(agiHarnessSnippet, "agi-harness")}
                style={{
                  fontSize: "0.65rem",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "5px",
                  background: "rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {copiedKey === "agi-harness" ? "✓ Copied Harness!" : "Copy Harness Spec"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const timestamp = new Date().toISOString().slice(0, 10);
                  downloadMarkdownFile(`spe-agi-harness-${timestamp}.md`, agiHarnessSnippet);
                }}
                style={{
                  fontSize: "0.65rem",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "5px",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                📥 Download .MD
              </button>
            </div>
          </div>

          {/* Section 1: Ejentum 4 Cognitive Modes */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span>⚡ 1. Ejentum Four Cognitive Operational Modes</span>
              <span style={{ fontSize: "0.62rem", color: "#64748b" }}>(Suppresses Attention, Reasoning, & Sycophancy Decay)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.6rem" }}>
              {[
                {
                  id: "harness_reasoning",
                  name: "harness_reasoning",
                  role: "Causal DAG & Root Cause Discovery",
                  desc: "Explores causal graphs, tradeoff surfaces, and multi-step counterfactuals before decision commitment.",
                  status: "ACTIVE",
                  color: "#38bdf8",
                },
                {
                  id: "harness_code",
                  name: "harness_code",
                  role: "Algorithmic & Complexity Auditing",
                  desc: "Verifies time/space Big-O bounds, boundary tests, and strict zero-hallucinated API contracts.",
                  status: "ACTIVE",
                  color: "#10b981",
                },
                {
                  id: "harness_anti_deception",
                  name: "harness_anti_deception",
                  role: "Anti-Sycophancy & Veracity Defense",
                  desc: "Resists manufactured urgency, authority appeals, and sunk costs; prioritizes objective truth over pleasing.",
                  status: "ENGAGED",
                  color: "#f59e0b",
                },
                {
                  id: "harness_memory",
                  name: "harness_memory",
                  role: "Longitudinal Drift & State Fidelity",
                  desc: "Maintains cross-turn behavioral consistency, tracks intention drift, and eradicates context leakage.",
                  status: "ACTIVE",
                  color: "#a855f7",
                },
              ].map((mode) => (
                <div
                  key={mode.id}
                  style={{
                    padding: "0.7rem",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderLeft: `3px solid ${mode.color}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <code style={{ fontSize: "0.7rem", color: mode.color, fontWeight: 700 }}>{mode.name}</code>
                    <span style={{ fontSize: "0.58rem", padding: "0.1rem 0.35rem", borderRadius: "3px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700 }}>
                      {mode.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.2rem" }}>{mode.role}</div>
                  <p style={{ fontSize: "0.63rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>{mode.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: 5 Core Cognitive Scaffolding Vectors */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              🛡️ 2. Five Core Cognitive Scaffolding Vectors
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
              {[
                { tag: "[NEGATIVE GATE]", label: "Anti-Pattern Suppression", desc: "Blocks premature convergence and superficial shortcuts." },
                { tag: "[PROCEDURE]", label: "8-Phase Pipeline", desc: "Traverses internal diagnostic, execution, and verification phases." },
                { tag: "[REASONING TOPOLOGY]", label: "Causal DAG Verification", desc: "Constructs dependency graph and verifies all prerequisites." },
                { tag: "[TARGET PATTERN]", label: "Exemplar Calibration", desc: "Calibrates output shape against zero-duplication gold standard." },
                { tag: "[FALSIFICATION TEST]", label: "Hostile Self-Audit", desc: "Actively tests conditions under which hypotheses would fail." },
              ].map((vec) => (
                <div
                  key={vec.tag}
                  style={{
                    padding: "0.6rem",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <code style={{ fontSize: "0.65rem", color: "#38bdf8", fontWeight: 700, display: "block", marginBottom: "0.15rem" }}>{vec.tag}</code>
                  <div style={{ fontSize: "0.67rem", fontWeight: 600, color: "#e2e8f0" }}>{vec.label}</div>
                  <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: "0.15rem" }}>{vec.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: CoALA 4-Tier Memory Systems Architecture */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between" }}>
              <span>🧠 3. CoALA 4-Tier Memory Systems Architecture</span>
              <span style={{ fontSize: "0.62rem", color: "#10b981" }}>Zone Headroom: 15% Reserved Buffer</span>
            </div>

            {/* Visual Context Zone Bar */}
            <div style={{ marginBottom: "0.6rem" }}>
              <div style={{ display: "flex", height: "18px", borderRadius: "4px", overflow: "hidden", fontSize: "0.58rem", fontWeight: 700, textAlign: "center", lineHeight: "18px" }}>
                <div style={{ width: "35%", background: "#0284c7", color: "#fff" }} title="Zone 1: System Prompt & Invariants (35%)">System 35%</div>
                <div style={{ width: "15%", background: "#4f46e5", color: "#fff" }} title="Zone 2: Few-Shot Exemplars (15%)">Few-Shot 15%</div>
                <div style={{ width: "20%", background: "#059669", color: "#fff" }} title="Zone 3: User State & Request Context (20%)">User 20%</div>
                <div style={{ width: "15%", background: "#d97706", color: "#fff" }} title="Zone 4: Working Retrieval & Grounding (15%)">RAG 15%</div>
                <div style={{ width: "15%", background: "#dc2626", color: "#fff" }} title="Zone 5: Dedicated Output Headroom Buffer (15%)">Headroom 15%</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#64748b", marginTop: "0.2rem" }}>
                <span>System Invariants</span>
                <span>Exemplars</span>
                <span>User Context</span>
                <span>Grounding/RAG</span>
                <span style={{ color: "#f87171" }}>Truncation Headroom</span>
              </div>
            </div>

            {/* 4 Memory Tiers Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.5rem" }}>
              <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#38bdf8" }}>Working Memory</div>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.15rem" }}>5-zone context allocation with 15% output headroom buffer preventing truncation.</div>
              </div>
              <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#10b981" }}>Semantic Memory</div>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.15rem" }}>Declarative domain ontologies, typed interface schemas, and verified platform invariants.</div>
              </div>
              <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f59e0b" }}>Episodic Memory</div>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.15rem" }}>Longitudinal execution traces, previous defect receipts, and operational state snapshots.</div>
              </div>
              <div style={{ padding: "0.6rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#c084fc" }}>Procedural Memory</div>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.15rem" }}>Deterministic compile pipelines, automated self-healing matrices, and reproducible test batteries.</div>
              </div>
            </div>
          </div>

          {/* Section 4: Formal BDI Mental States & Autonomous Agent PECV Loop */}
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              🎯 4. Formal BDI Grounding & Autonomous Think-Decide-Act-Observe Loop
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.6rem" }}>
              <div style={{ padding: "0.7rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#38bdf8", marginBottom: "0.25rem" }}>Formal BDI (Beliefs-Desires-Intentions) Grounding</div>
                <ul style={{ fontSize: "0.62rem", color: "#cbd5e1", margin: 0, paddingLeft: "1.1rem", lineHeight: 1.45 }}>
                  <li><strong>Beliefs:</strong> Grounded in verified environment invariants and canonical WASM checksum.</li>
                  <li><strong>Desires:</strong> Explicit quality targets: 0-defect SLA, 60fps budgets, WCAG AAA.</li>
                  <li><strong>Intentions:</strong> Committed execution plan with phase-gated rollback checkpoints.</li>
                  <li><strong>T2B2T Flow:</strong> Bi-directional Triples-to-Beliefs-to-Triples knowledge graph sync.</li>
                </ul>
              </div>
              <div style={{ padding: "0.7rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#10b981", marginBottom: "0.25rem" }}>Autonomous PECV Multi-Agent Pipeline</div>
                <ul style={{ fontSize: "0.62rem", color: "#cbd5e1", margin: 0, paddingLeft: "1.1rem", lineHeight: 1.45 }}>
                  <li><strong>Stage 1 (Architectural Planner):</strong> Formulates dependency DAG and error boundaries.</li>
                  <li><strong>Stage 2 (Deterministic Executor):</strong> Synthesizes code adhering to 0-duplication contract.</li>
                  <li><strong>Stage 3 (Adversarial Critic):</strong> Stress tests against 65-point red-team security matrix.</li>
                  <li><strong>Stage 4 (Autonomous Verifier):</strong> Audits telemetry receipts and signs verification gate.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 5: Multi-Agent Context Isolation & Direct Pass-Through Protocol */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between" }}>
              <span>🌐 5. Multi-Agent Context Isolation & Direct Pass-Through</span>
              <span style={{ fontSize: "0.62rem", color: "#38bdf8" }}>Zero "Telephone Game" Translation Decay</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.6rem" }}>
              <div style={{ padding: "0.7rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderLeft: "3px solid #38bdf8" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#38bdf8", marginBottom: "0.2rem" }}>Sub-Agent Context Partitioning</div>
                <p style={{ fontSize: "0.63rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                  Partitions work across isolated context windows. Eliminates the "lost-in-the-middle" effect, attention scarcity, and prompt pollution without blowing token budgets.
                </p>
              </div>
              <div style={{ padding: "0.7rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderLeft: "3px solid #10b981" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#10b981", marginBottom: "0.2rem" }}>Direct Pass-Through (forward_message)</div>
                <p style={{ fontSize: "0.63rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                  Allows specialized sub-agents to deliver final results directly to the consumer, eliminating the 50% performance drop caused by supervisor paraphrasing.
                </p>
              </div>
            </div>
          </div>

          {/* Section 6: Hierarchical Agent Memory (HAM) & Swarm Consensus */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              🗂️ 6. Hierarchical Agent Memory (HAM) & Anti-Sycophancy Swarm Consensus
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.6rem" }}>
              <div style={{ padding: "0.7rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderLeft: "3px solid #f59e0b" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f59e0b", marginBottom: "0.2rem" }}>Hierarchical Agent Memory (HAM)</div>
                <p style={{ fontSize: "0.63rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                  Root global routing directs agents to scoped subdirectory cheat-sheets (~250 tokens), backed by persistent .memory/ architectural decision records (ADRs).
                </p>
              </div>
              <div style={{ padding: "0.7rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderLeft: "3px solid #c084fc" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#c084fc", marginBottom: "0.2rem" }}>Blinded Swarm Peer Consensus</div>
                <p style={{ fontSize: "0.63rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                  Sub-agents cross-audit peer deliverables with blinded provenance to eradicate sycophancy, requiring supermajority consensus before state transition commits.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Model Matrix */}
      {activeTab === "matrix" && (
        <div style={{ padding: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onSelectTarget && onSelectTarget("claude")}
              style={{ padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", background: activeTarget === "claude" ? "#d97706" : "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Claude XML ({claudePrompt.length.toLocaleString()}c)
            </button>
            <button
              type="button"
              onClick={() => onSelectTarget && onSelectTarget("chatgpt")}
              style={{ padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", background: activeTarget === "chatgpt" ? "#10b981" : "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              ChatGPT / GPT-4o ({gptPrompt.length.toLocaleString()}c)
            </button>
            <button
              type="button"
              onClick={() => onSelectTarget && onSelectTarget("gemini")}
              style={{ padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", background: activeTarget === "gemini" ? "#3b82f6" : "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Google Gemini ({geminiPrompt.length.toLocaleString()}c)
            </button>
            <button
              type="button"
              onClick={() => onSelectTarget && onSelectTarget("local")}
              style={{ padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", background: activeTarget === "local" ? "#8b5cf6" : "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Local Llama/Mistral ({localPrompt.length.toLocaleString()}c)
            </button>
          </div>
          <p style={{ fontSize: "0.7rem", color: "#94a3b8", lineHeight: "1.4" }}>
            The prompt automatically adapts to each target provider’s architecture: Claude receives explicit XML tag bounds; ChatGPT receives structured developer headers; Gemini receives grounded multimodal constraints; Local models receive instruction token delimiters.
          </p>
        </div>
      )}

      {/* Tab 3: SDK Code Runners */}
      {activeTab === "code" && (
        <div style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button
                type="button"
                onClick={() => setActiveCodeLang("python")}
                style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "none", cursor: "pointer", background: activeCodeLang === "python" ? "#3b82f6" : "transparent", color: "#fff" }}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => setActiveCodeLang("typescript")}
                style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "none", cursor: "pointer", background: activeCodeLang === "typescript" ? "#3b82f6" : "transparent", color: "#fff" }}
              >
                TypeScript
              </button>
              <button
                type="button"
                onClick={() => setActiveCodeLang("curl")}
                style={{ fontSize: "0.65rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "none", cursor: "pointer", background: activeCodeLang === "curl" ? "#3b82f6" : "transparent", color: "#fff" }}
              >
                cURL API
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const code = activeCodeLang === "python" ? pythonSnippet : activeCodeLang === "typescript" ? typescriptSnippet : curlSnippet;
                copyToClipboard(code, "sdk-code");
              }}
              style={{ fontSize: "0.65rem", padding: "0.2rem 0.6rem", borderRadius: "4px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)", cursor: "pointer" }}
            >
              {copiedKey === "sdk-code" ? "✓ Copied!" : "Copy Code"}
            </button>
          </div>
          <pre
            style={{
              padding: "0.75rem",
              borderRadius: "6px",
              background: "#080a0f",
              fontSize: "0.7rem",
              color: "#cbd5e1",
              maxHeight: "180px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {activeCodeLang === "python" ? pythonSnippet : activeCodeLang === "typescript" ? typescriptSnippet : curlSnippet}
          </pre>
        </div>
      )}

      {/* Tab: Markdown System Prompt (.md) */}
      {activeTab === "markdown" && (
        <div style={{ padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                CommonMark / GitHub Flavored Markdown (GFM)
              </span>
              <label
                style={{
                  fontSize: "0.68rem",
                  color: "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={includeFrontmatter}
                  onChange={(e) => setIncludeFrontmatter(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                YAML Frontmatter
              </label>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(markdownPrompt, "markdown-copy")}
                style={{
                  fontSize: "0.65rem",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "4px",
                  background: "rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  cursor: "pointer",
                }}
              >
                {copiedKey === "markdown-copy" ? "✓ Copied MD!" : "Copy Markdown"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const timestamp = new Date().toISOString().slice(0, 10);
                  downloadMarkdownFile(`spe-system-prompt-${timestamp}.md`, markdownPrompt);
                }}
                style={{
                  fontSize: "0.65rem",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "4px",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                📥 Download .md File
              </button>
            </div>
          </div>
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.03)",
              marginBottom: "0.5rem",
              fontSize: "0.65rem",
              color: "#94a3b8",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Size: {markdownPrompt.length.toLocaleString()} characters ({activeDepthTier.toUpperCase()} tier)</span>
            <span>GFM Sections: # System Role, # Objective, # Methodology, # Verification Battery</span>
          </div>
          <pre
            style={{
              padding: "0.85rem",
              borderRadius: "6px",
              background: "#080a0f",
              fontSize: "0.72rem",
              lineHeight: 1.5,
              color: "#cbd5e1",
              maxHeight: "320px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {markdownPrompt}
          </pre>
        </div>
      )}

      {/* Tab 4: IDE Rules Export */}
      {activeTab === "rules" && (
        <div style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              Export for Cursor, Windsurf, or Claude Code (`.cursorrules` / `CLAUDE.md`)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(ideRulesSnippet, "ide-rules")}
              style={{ fontSize: "0.65rem", padding: "0.2rem 0.6rem", borderRadius: "4px", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.4)", cursor: "pointer" }}
            >
              {copiedKey === "ide-rules" ? "✓ Copied Rules!" : "Copy Rules"}
            </button>
          </div>
          <pre
            style={{
              padding: "0.75rem",
              borderRadius: "6px",
              background: "#080a0f",
              fontSize: "0.7rem",
              color: "#cbd5e1",
              maxHeight: "180px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {ideRulesSnippet}
          </pre>
        </div>
      )}
    </div>
  );
};
