import React, { useState, useCallback, useMemo } from "react";
import {
  evolvePrompt,
  calculateFitness,
  runAdversarialGym,
  type EvolutionResult,
  type FitnessMetrics,
  type AttackResult,
} from "./geneticEvolver";

export interface GeneticEvolverStudioProps {
  initialPrompt: string;
  onApplyOptimizedPrompt?: (prompt: string) => void;
  onClose?: () => void;
}

export const GeneticEvolverStudio: React.FC<GeneticEvolverStudioProps> = ({
  initialPrompt,
  onApplyOptimizedPrompt,
  onClose,
}) => {
  const [generationsCount, setGenerationsCount] = useState<number>(10);
  const [isEvolving, setIsEvolving] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [progressGen, setProgressGen] = useState<number>(0);
  const [result, setResult] = useState<EvolutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "attacks" | "diff" | "chromosome">("overview");
  const [attackFilter, setAttackFilter] = useState<string>("all");
  const [copied, setCopied] = useState<boolean>(false);

  // Baseline fitness on mount or prompt change
  const baselineFitness: FitnessMetrics = useMemo(() => {
    return calculateFitness(initialPrompt || "");
  }, [initialPrompt]);

  const baselineAttacks: AttackResult[] = useMemo(() => {
    return runAdversarialGym(initialPrompt || "");
  }, [initialPrompt]);

  const handleEvolve = useCallback(async () => {
    setIsEvolving(true);
    setProgressGen(0);
    setProgressMsg("Booting local WebWorker Neuro-Genetic Gym...");

    try {
      const res = await evolvePrompt(
        initialPrompt || "Create an autonomous AI coding assistant.",
        {
          generations: generationsCount,
          populationSize: 6,
        },
        ({ currentGen, message }) => {
          setProgressGen(currentGen);
          setProgressMsg(message);
        },
      );
      setResult(res);
      setProgressMsg("Evolution completed! Reached Pareto-optimal fitness peak.");
    } catch (err) {
      setProgressMsg(`Evolution error: ${String(err)}`);
    } finally {
      setIsEvolving(false);
    }
  }, [initialPrompt, generationsCount]);

  const activeFitness = result ? result.finalFitness : baselineFitness;
  const activeAttacks = result ? result.attackMatrix : baselineAttacks;

  const filteredAttacks = useMemo(() => {
    if (attackFilter === "defended") return activeAttacks.filter((a) => a.defended);
    if (attackFilter === "breached") return activeAttacks.filter((a) => !a.defended);
    if (attackFilter !== "all") return activeAttacks.filter((a) => a.category === attackFilter);
    return activeAttacks;
  }, [activeAttacks, attackFilter]);

  const handleCopy = () => {
    const textToCopy = result ? result.optimizedPrompt : initialPrompt;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="genetic-evolver-studio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        padding: "1.25rem",
        borderRadius: "12px",
        background: "var(--spe-surface-card, rgba(15, 23, 42, 0.7))",
        border: "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.1))",
        color: "#f8fafc",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            🧬
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                Attack Gym · Adversarial Jailbreak Defense
              </h3>
              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "rgba(236, 72, 153, 0.2)",
                  color: "#f472b6",
                  fontWeight: 600,
                  border: "1px solid rgba(236, 72, 153, 0.4)",
                }}
              >
                Security Defense • Red-Team
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
              Runs 32-attack hostile red-team tests to stress-test your prompts 100% locally on-device.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Generations:</span>
            <select
              value={generationsCount}
              onChange={(e) => setGenerationsCount(Number(e.target.value))}
              disabled={isEvolving}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "6px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
              }}
            >
              <option value={5}>5 Generations (~400ms)</option>
              <option value={10}>10 Generations (~800ms)</option>
              <option value={15}>15 Generations (~1.2s)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleEvolve}
            disabled={isEvolving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 1rem",
              borderRadius: "8px",
              background: isEvolving
                ? "rgba(139, 92, 246, 0.4)"
                : "linear-gradient(135deg, #ec4899, #8b5cf6)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.8rem",
              border: "none",
              cursor: isEvolving ? "wait" : "pointer",
              boxShadow: "0 0 16px rgba(236, 72, 153, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            {isEvolving ? `⚡ Evolving Gen ${progressGen}/${generationsCount}...` : "⚡ Evolve to Peak Fitness"}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "1.1rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Progress / Status Banner */}
      {isEvolving && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: "rgba(139, 92, 246, 0.15)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              border: "2px solid #a855f7",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#d8b4fe" }}>
              {progressMsg}
            </div>
            <div
              style={{
                height: "4px",
                width: "100%",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "2px",
                marginTop: "0.4rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(progressGen / generationsCount) * 100}%`,
                  background: "linear-gradient(90deg, #ec4899, #8b5cf6)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Overall Fitness</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.25rem" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: activeFitness.overallScore >= 90 ? "#10b981" : "#38bdf8" }}>
              {activeFitness.overallScore}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/ 100</span>
            {result && (
              <span style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 700 }}>
                +{result.finalFitness.overallScore - result.initialFitness.overallScore} pts
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Invariant Rigor (40%)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.25rem" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#a855f7" }}>
              {activeFitness.invariantRigor}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/ 100</span>
          </div>
        </div>

        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Gym Defense (30%)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.25rem" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ec4899" }}>
              {activeFitness.adversarialDefense}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/ 100</span>
          </div>
        </div>

        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Hostile Attacks Defended</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.25rem" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: activeFitness.defendedAttacksCount === activeFitness.totalAttacksCount ? "#10b981" : "#f59e0b" }}>
              {activeFitness.defendedAttacksCount} / {activeFitness.totalAttacksCount}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>({activeFitness.attackSuccessRate}%)</span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: "flex", gap: "0.3rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "0.5rem" }}>
        {(
          [
            { id: "overview", label: "📈 Evolution Trajectory" },
            { id: "attacks", label: `🛡️ Hostile Gym Matrix (${activeFitness.defendedAttacksCount}/${activeFitness.totalAttacksCount})` },
            { id: "diff", label: "🧬 Chromosome Diff" },
            { id: "chromosome", label: "🔍 Full Evolved Prompt" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "6px",
              border: "none",
              background: activeTab === t.id ? "rgba(236, 72, 153, 0.2)" : "transparent",
              color: activeTab === t.id ? "#f472b6" : "#94a3b8",
              fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Evolution Trajectory */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {result ? (
            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.35)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e2e8f0" }}>
                  Generation-by-Generation Fitness Convergence ({result.generations.length} Gens in {result.totalEvolutionTimeMs}ms)
                </span>
                <span style={{ fontSize: "0.7rem", color: "#10b981" }}>
                  Pareto-Optimal Convergence Achieved
                </span>
              </div>

              {/* Live SVG Fitness Chart */}
              <svg width="100%" height="160" viewBox="0 0 600 160" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="fitnessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                <line x1="40" y1="20" x2="580" y2="20" stroke="rgba(255,255,255,0.06)" />
                <line x1="40" y1="60" x2="580" y2="60" stroke="rgba(255,255,255,0.06)" />
                <line x1="40" y1="100" x2="580" y2="100" stroke="rgba(255,255,255,0.06)" />
                <line x1="40" y1="140" x2="580" y2="140" stroke="rgba(255,255,255,0.1)" />

                {/* Y-axis labels */}
                <text x="32" y="24" fill="#64748b" fontSize="10" textAnchor="end">100</text>
                <text x="32" y="64" fill="#64748b" fontSize="10" textAnchor="end">75</text>
                <text x="32" y="104" fill="#64748b" fontSize="10" textAnchor="end">50</text>
                <text x="32" y="144" fill="#64748b" fontSize="10" textAnchor="end">25</text>

                {/* Path calculation */}
                {(() => {
                  const gens = [
                    { generation: 0, score: result.initialFitness.overallScore },
                    ...result.generations.map((g) => ({ generation: g.generation, score: g.bestFitness.overallScore })),
                  ];
                  const stepX = (580 - 50) / Math.max(1, gens.length - 1);
                  const points = gens.map((g, i) => {
                    const x = 50 + i * stepX;
                    const y = 140 - ((g.score - 25) / 75) * 120;
                    return { x, y, score: g.score, gen: g.generation };
                  });

                  const d = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");
                  const areaD = `${d} L ${points[points.length - 1].x} 140 L ${points[0].x} 140 Z`;

                  return (
                    <>
                      <path d={areaD} fill="url(#fitnessGrad)" />
                      <path d={d} fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="4" fill="#8b5cf6" stroke="#fff" strokeWidth="2" />
                          <text x={p.x} y={p.y - 8} fill="#e2e8f0" fontSize="9" fontWeight="700" textAnchor="middle">
                            {p.score}
                          </text>
                          <text x={p.x} y="154" fill="#64748b" fontSize="9" textAnchor="middle">
                            G{p.gen}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          ) : (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px dashed rgba(255, 255, 255, 0.15)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🧬</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Ready for Neuro-Genetic Evolution</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", maxWidth: "450px", margin: "0.5rem auto 1rem" }}>
                Click "⚡ Evolve to Peak Fitness" above to synthesize chromosome mutations, run the 32-attack hostile adversary gym, and converge to 100/100 invariant rigor.
              </div>
              <button
                type="button"
                onClick={handleEvolve}
                style={{
                  padding: "0.45rem 1.25rem",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Run Autonomous Evolution (10 Generations)
              </button>
            </div>
          )}

          {/* Quick Actions */}
          {result && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Copied to Clipboard" : "📋 Copy Evolved Prompt"}
              </button>

              {onApplyOptimizedPrompt && (
                <button
                  type="button"
                  onClick={() => onApplyOptimizedPrompt(result.optimizedPrompt)}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: "6px",
                    background: "#10b981",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  ✨ Apply Evolved Prompt to Workspace
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Hostile Gym Matrix */}
      {activeTab === "attacks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              Adversarial Red-Team Gym Battery (32 Attacks)
            </span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {["all", "defended", "breached", "injection", "jailbreak", "role_hijack"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAttackFilter(f)}
                  style={{
                    fontSize: "0.65rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    background: attackFilter === f ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              maxHeight: "360px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              paddingRight: "0.3rem",
            }}
          >
            {filteredAttacks.map((att) => (
              <div
                key={att.attackId}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "6px",
                  background: att.defended ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.12)",
                  border: `1px solid ${att.defended ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.3)"}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: att.defended ? "#34d399" : "#f87171" }}>
                      {att.attackId}: {att.attackName}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "4px",
                        background: "rgba(0,0,0,0.3)",
                        color: "#94a3b8",
                      }}
                    >
                      {att.category}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "4px",
                        background: att.severity === "critical" ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.2)",
                        color: att.severity === "critical" ? "#fca5a5" : "#fcd34d",
                      }}
                    >
                      {att.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#cbd5e1", marginTop: "0.2rem" }}>
                    {att.reasoning}
                  </div>
                  {att.mitigationRule && (
                    <div style={{ fontSize: "0.65rem", color: "#818cf8", marginTop: "0.2rem" }}>
                      💡 Mitigation: {att.mitigationRule}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      color: att.defended ? "#10b981" : "#ef4444",
                    }}
                  >
                    {att.defended ? "🛡️ DEFENDED" : "⚠️ BREACHED"}
                  </span>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{att.score}/100</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Chromosome Diff View */}
      {activeTab === "diff" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.4rem" }}>
              Original Input Chromosome
            </div>
            <textarea
              readOnly
              value={initialPrompt}
              style={{
                width: "100%",
                height: "260px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "0.6rem",
                color: "#94a3b8",
                fontSize: "0.7rem",
                fontFamily: "monospace",
                resize: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f472b6", marginBottom: "0.4rem" }}>
              Evolved Pareto Chromosome (Reinforced)
            </div>
            <textarea
              readOnly
              value={result ? result.optimizedPrompt : ""}
              style={{
                width: "100%",
                height: "260px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(236, 72, 153, 0.3)",
                borderRadius: "6px",
                padding: "0.6rem",
                color: "#e2e8f0",
                fontSize: "0.7rem",
                fontFamily: "monospace",
                resize: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Full Evolved Prompt */}
      {activeTab === "chromosome" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#e2e8f0" }}>
              Complete Synthesized System Prompt
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#fff",
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={result ? result.optimizedPrompt : initialPrompt}
            style={{
              width: "100%",
              height: "280px",
              background: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "0.75rem",
              color: "#f8fafc",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              resize: "none",
              lineHeight: 1.5,
            }}
          />
        </div>
      )}
    </div>
  );
};
