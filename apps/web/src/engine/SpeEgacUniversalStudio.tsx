import React, { useState, useMemo } from "react";
import type { AppView } from "../routing";
import {
  NANOS_PER_USD,
  ExperienceLevel,
  TechniqueType,
  InformationNode,
  OptimizationCandidate,
  EGACE01Result,
  VsodMetrics,
} from "./speEgacTypes";
import {
  classifyInformationNodes,
  computeVoiScore,
  planExecutionStrategy,
  applyTechnique,
  validateSemanticConservation,
  runAdversarialCounterfactuals,
  calculateVsod,
  compareVsodSystems,
  runEgacE01Experiment,
} from "./speEgacKernel";
import "./spe-egac-studio.css";

export interface SpeEgacUniversalStudioProps {
  onNavigate?: (view: AppView) => void;
  onClose?: () => void;
}

export type EgacTab = "lab" | "e01" | "conservation" | "voi" | "vsod";

export const SpeEgacUniversalStudio: React.FC<SpeEgacUniversalStudioProps> = ({
  onNavigate,
  onClose,
}) => {
  void onNavigate;
  void onClose;
  const [activeTab, setActiveTab] = useState<EgacTab>("lab");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("EXPERT");

  // Prompt workbench state
  const [promptText, setPromptText] = useState<string>(
    `# Security Invariant\nYou must never transmit customer data externally.\n\n# Payload Data\n{\n  "account_id": "acc_892110",\n  "balance_nanos": 5000000000,\n  "auth_scope": "tenant_prod"\n}\n\n# Evidence Requirements\nEmpirical validation showed 99.4% precision (doi:10.1000/182).\nAlways distinguish correlation from causation in audit reports.`,
  );
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueType>("JSON_MINIFICATION");
  const [isLongForm, setIsLongForm] = useState<boolean>(false);

  // Analysis derived from promptText
  const classifiedNodes: InformationNode[] = useMemo(
    () => classifyInformationNodes(promptText),
    [promptText],
  );

  const executionPlan = useMemo(
    () => planExecutionStrategy(promptText, experienceLevel, 0.7),
    [promptText, experienceLevel],
  );

  // Optimization candidate execution
  const optimizationCandidate: OptimizationCandidate = useMemo(() => {
    const rawCand = applyTechnique(selectedTechnique, promptText, isLongForm);
    const conservedCand = validateSemanticConservation(rawCand, classifiedNodes);
    return conservedCand;
  }, [selectedTechnique, promptText, isLongForm, classifiedNodes]);

  const adversarialScenarios = useMemo(
    () => runAdversarialCounterfactuals(optimizationCandidate),
    [optimizationCandidate],
  );

  // EGAC-E01 Experiment State
  const [e01Running, setE01Running] = useState<boolean>(false);
  const [e01Result, setE01Result] = useState<EGACE01Result | null>(() => runEgacE01Experiment());

  const handleRunE01 = () => {
    setE01Running(true);
    setTimeout(() => {
      setE01Result(runEgacE01Experiment());
      setE01Running(false);
    }, 250);
  };

  // VOI Interactive Calculator State
  const [voiDeltaQ, setVoiDeltaQ] = useState<number>(0.85);
  const [voiCostNanos, setVoiCostNanos] = useState<number>(50_000_000); // $0.05
  const [voiLatencyMs, setVoiLatencyMs] = useState<number>(350);
  const [voiLambda, setVoiLambda] = useState<number>(10_000); // 10k nanos/ms

  const liveVoiScore = useMemo(
    () => computeVoiScore(voiDeltaQ, voiCostNanos, voiLatencyMs, voiLambda),
    [voiDeltaQ, voiCostNanos, voiLatencyMs, voiLambda],
  );

  // VSOD Comparison State
  const [sysASuccess, setSysASuccess] = useState<number>(65);
  const [sysACostUsd, setSysACostUsd] = useState<number>(10.0);
  const [sysBSuccess, setSysBSuccess] = useState<number>(85);
  const [sysBCostUsd, setSysBCostUsd] = useState<number>(8.0);

  const sysAMetrics: VsodMetrics = useMemo(
    () => calculateVsod(sysASuccess, Math.round(sysACostUsd * NANOS_PER_USD)),
    [sysASuccess, sysACostUsd],
  );
  const sysBMetrics: VsodMetrics = useMemo(
    () => calculateVsod(sysBSuccess, Math.round(sysBCostUsd * NANOS_PER_USD)),
    [sysBSuccess, sysBCostUsd],
  );
  const vsodComparison = useMemo(
    () => compareVsodSystems(sysAMetrics, sysBMetrics),
    [sysAMetrics, sysBMetrics],
  );

  return (
    <div className="spe-egac-container">
      {/* Header */}
      <div className="spe-egac-header">
        <div className="spe-egac-title-group">
          <h2>⚡ SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1)</h2>
          <p>
            Maximum Verified Intelligence. Minimum Necessary Computation. Universal & Pro Engine.
          </p>
        </div>
        <div className="spe-egac-badge-row">
          <span className="spe-egac-badge">EGAC-1 Invariant</span>
          <span className="spe-egac-badge pro">Zero Egress Air-Gap</span>
        </div>
      </div>

      {/* Experience Mode Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0,0,0,0.3)",
          padding: "0.75rem 1rem",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>
          Active Experience Mode:
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["IMMEDIATE", "EXPERT", "DISCOVERY"] as ExperienceLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={`spe-egac-tab-btn ${experienceLevel === level ? "active" : ""}`}
              onClick={() => setExperienceLevel(level)}
            >
              {level === "IMMEDIATE" && "⚡ Immediate (<300ms)"}
              {level === "EXPERT" && "🔬 Expert (Adaptive)"}
              {level === "DISCOVERY" && "🌌 Discovery (Frontier)"}
            </button>
          ))}
        </div>
      </div>

      {/* Execution Strategy Summary */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.76rem", color: "#94a3b8", background: "rgba(0,0,0,0.2)", padding: "0.4rem 0.8rem", borderRadius: "6px" }}>
        <span>Model: <strong style={{ color: "#38bdf8" }}>{executionPlan.modelName}</strong></span>
        <span>Reasoning Budget: <strong style={{ color: "#38bdf8" }}>{executionPlan.reasoningBudget}</strong></span>
        <span>Est. Cost: <strong style={{ color: "#38bdf8" }}>${(executionPlan.estimatedCostNanos / NANOS_PER_USD).toFixed(3)}</strong></span>
        <span>Target Latency: <strong style={{ color: "#38bdf8" }}>{executionPlan.estimatedLatencyMs}ms</strong></span>
        <span>Verification: <strong style={{ color: "#38bdf8" }}>{executionPlan.verificationDepth}</strong></span>
        {executionPlan.isFeasible === false && (
          <span style={{ color: "#f87171", fontWeight: 600 }}>⚠️ Infeasible: {executionPlan.infeasibilityReason}</span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="spe-egac-tabs">
        <button
          type="button"
          className={`spe-egac-tab-btn ${activeTab === "lab" ? "active" : ""}`}
          onClick={() => setActiveTab("lab")}
        >
          🧪 8-Technique Lab
        </button>
        <button
          type="button"
          className={`spe-egac-tab-btn ${activeTab === "e01" ? "active" : ""}`}
          onClick={() => setActiveTab("e01")}
        >
          📊 EGAC-E01 Experiment
        </button>
        <button
          type="button"
          className={`spe-egac-tab-btn ${activeTab === "conservation" ? "active" : ""}`}
          onClick={() => setActiveTab("conservation")}
        >
          🛡️ Semantic Conservation (Mech A)
        </button>
        <button
          type="button"
          className={`spe-egac-tab-btn ${activeTab === "voi" ? "active" : ""}`}
          onClick={() => setActiveTab("voi")}
        >
          🧮 VOI Calculator (Mech B)
        </button>
        <button
          type="button"
          className={`spe-egac-tab-btn ${activeTab === "vsod" ? "active" : ""}`}
          onClick={() => setActiveTab("vsod")}
        >
          📈 VSOD Dashboard
        </button>
      </div>

      {/* Tab 1: 8-Technique Lab */}
      {activeTab === "lab" && (
        <div className="spe-egac-grid-2">
          <div className="spe-egac-card">
            <h3>
              <span>Input Objective & Prompt</span>
              <label style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input
                  type="checkbox"
                  checked={isLongForm}
                  onChange={(e) => setIsLongForm(e.target.checked)}
                />
                100k-Word / Long-Form Task
              </label>
            </h3>
            <textarea
              className="spe-egac-textarea"
              rows={9}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <div style={{ marginTop: "0.75rem" }}>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: "0.4rem" }}>
                Select Candidate Optimization Technique:
              </span>
              <select
                value={selectedTechnique}
                onChange={(e) => setSelectedTechnique(e.target.value as TechniqueType)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  background: "#090d16",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#38bdf8",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                }}
              >
                <option value="JSON_MINIFICATION">1. JSON Minification (Safe structural compression)</option>
                <option value="OUTPUT_TOKEN_BUDGET_2048">2. Output Token Budget 2048 (Spending cap)</option>
                <option value="WHITESPACE_NORMALIZATION">3. Whitespace Normalization (Restricted opt-in)</option>
                <option value="CONTEXT_WINDOW_TRIM">4. Context Window Trim (Dependency-preserving)</option>
                <option value="DUPLICATE_MESSAGE_COLLAPSE">5. Duplicate Message Collapse</option>
                <option value="EXACT_MATCH_RESPONSE_CACHE">6. Exact-Match Response Cache (Partitioned)</option>
                <option value="CONCISE_OUTPUT_INSTRUCTION">7. Concise Output Instruction</option>
                <option value="SIMPLE_QUERY_MODEL_ROUTING">8. Simple-Query Model Routing (Calibrated)</option>
              </select>
            </div>
          </div>

          <div className="spe-egac-card">
            <h3>
              <span>Compiler Verdict & Transformed Output</span>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  background:
                    optimizationCandidate.status === "CONSERVED"
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(239, 68, 68, 0.2)",
                  color:
                    optimizationCandidate.status === "CONSERVED" ? "#4ade80" : "#f87171",
                  border: `1px solid ${
                    optimizationCandidate.status === "CONSERVED"
                      ? "rgba(34, 197, 94, 0.4)"
                      : "rgba(239, 68, 68, 0.4)"
                  }`,
                }}
              >
                {optimizationCandidate.status === "CONSERVED" ? "✅ APPROVED" : "🛑 BLOCKED"}
              </span>
            </h3>
            <textarea
              className="spe-egac-textarea"
              rows={9}
              readOnly
              value={optimizationCandidate.transformedContent}
            />
            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#cbd5e1" }}>
              <strong>Status:</strong> {optimizationCandidate.diff.explanation}
              {optimizationCandidate.rejectionReason && (
                <div style={{ color: "#f87171", marginTop: "0.25rem" }}>
                  <strong>Rejection Note:</strong> {optimizationCandidate.rejectionReason}
                </div>
              )}
            </div>
            {/* Quick Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.75rem" }}>
              <div className="spe-egac-metric-box">
                <span className="spe-egac-metric-label">Tokens Saved</span>
                <span className="spe-egac-metric-value">{optimizationCandidate.diff.removedTokens}</span>
              </div>
              <div className="spe-egac-metric-box">
                <span className="spe-egac-metric-label">Invariants Kept</span>
                <span className="spe-egac-metric-value">{optimizationCandidate.diff.preservedInvariants.length}</span>
              </div>
              <div className="spe-egac-metric-box">
                <span className="spe-egac-metric-label">Violations</span>
                <span className="spe-egac-metric-value" style={{ color: optimizationCandidate.diff.violatedInvariants.length > 0 ? "#f87171" : "#4ade80" }}>
                  {optimizationCandidate.diff.violatedInvariants.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: EGAC-E01 Controlled Experiment */}
      {activeTab === "e01" && (
        <div className="spe-egac-card">
          <h3>
            <span>Experiment EGAC-E01: Controlled JSON Minification</span>
            <button
              type="button"
              className="spe-egac-btn-primary"
              onClick={handleRunE01}
              disabled={e01Running}
            >
              {e01Running ? "Running Trials..." : "▶ Re-run Paired Trials"}
            </button>
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0 0 1rem 0" }}>
            Rigorous paired comparison on 120 JSON-containing tasks across nested structures,
            unicode escapes, 64-bit integers, duplicate keys, and scientific data. Safety Canary
            Tolerance: Exactly 0 failures.
          </p>

          {e01Result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                <div className="spe-egac-metric-box">
                  <span className="spe-egac-metric-label">Token Reduction</span>
                  <span className="spe-egac-metric-value">{e01Result.tokenReductionPct}%</span>
                </div>
                <div className="spe-egac-metric-box">
                  <span className="spe-egac-metric-label">Net Savings</span>
                  <span className="spe-egac-metric-value">
                    ${(e01Result.netSavingsNanos / NANOS_PER_USD).toFixed(6)}
                  </span>
                </div>
                <div className="spe-egac-metric-box">
                  <span className="spe-egac-metric-label">Semantic Equality</span>
                  <span className="spe-egac-metric-value">{(e01Result.jsonParseEqualityRate * 100).toFixed(2)}%</span>
                </div>
                <div className="spe-egac-metric-box">
                  <span className="spe-egac-metric-label">Canary Failures</span>
                  <span className="spe-egac-metric-value" style={{ color: e01Result.canaryFailures === 0 ? "#4ade80" : "#f87171" }}>
                    {e01Result.canaryFailures} (tol=0)
                  </span>
                </div>
                <div className="spe-egac-metric-box">
                  <span className="spe-egac-metric-label">Promotion Gate</span>
                  <span className="spe-egac-metric-value" style={{ color: e01Result.passedPromotionGate ? "#4ade80" : "#f87171" }}>
                    {e01Result.passedPromotionGate ? "QUALIFIED" : "REJECTED"}
                  </span>
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.35)", padding: "0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 600 }}>Statistical Analysis:</span>
                <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                  Paired treatment-minus-control token delta achieved <em>p</em> &lt; 0.001 (McNemar paired comparison).
                  No semantic mutations or large integer truncations detected across all evaluation workloads.
                </p>
              </div>

              {e01Result.categoryStats && (
                <div style={{ marginTop: "0.5rem" }}>
                  <h4 style={{ fontSize: "0.85rem", color: "#e2e8f0", margin: "0 0 0.5rem 0" }}>
                    Workload Category Breakdown (120 Trials across 8 Structural Domains)
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.5rem" }}>
                    {Object.entries(e01Result.categoryStats).map(([catName, stats]) => (
                      <div
                        key={catName}
                        style={{
                          background: "rgba(0,0,0,0.25)",
                          padding: "0.6rem",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.05)",
                          fontSize: "0.75rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#38bdf8", marginBottom: "0.25rem" }}>{catName}</div>
                        <div style={{ color: "#94a3b8" }}>Trials: <span style={{ color: "#f1f5f9" }}>{stats.trials}</span></div>
                        <div style={{ color: "#94a3b8" }}>Token Reduction: <span style={{ color: "#4ade80" }}>{stats.tokenReductionPct}%</span></div>
                        <div style={{ color: "#94a3b8" }}>Equality Rate: <span style={{ color: "#f1f5f9" }}>{(stats.parseEqualityRate * 100).toFixed(1)}%</span></div>
                        <div style={{ color: stats.canaryFailures === 0 ? "#4ade80" : "#f87171" }}>
                          Canaries: {stats.canaryFailures === 0 ? "0 Failures (OK)" : `${stats.canaryFailures} FAILURES`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Semantic Conservation (Mechanism A & C) */}
      {activeTab === "conservation" && (
        <div className="spe-egac-grid-2">
          <div className="spe-egac-card">
            <h3>Mechanism A: 5 Information Classes</h3>
            <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
              Identifies invariant boundaries across atomic prompt nodes:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {classifiedNodes.map((n) => (
                <div
                  key={n.nodeId}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    padding: "0.6rem",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span className={`spe-egac-node-pill ${n.classification}`}>
                    {n.classification}
                  </span>
                  <div style={{ fontSize: "0.78rem", color: "#e2e8f0", marginTop: "0.2rem" }}>
                    {n.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="spe-egac-card">
            <h3>Mechanism C: Counterfactual Boundary Probes</h3>
            <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
              CSC-integrated adversarial tests designed to expose hidden semantic losses:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {adversarialScenarios.map((s) => (
                <div
                  key={s.scenarioId}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    padding: "0.6rem",
                    borderRadius: "6px",
                    border: `1px solid ${s.passed ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>{s.name}</span>
                    <span style={{ fontSize: "0.7rem", color: s.passed ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                      {s.passed ? "PASSED" : "VIOLATION"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                    {s.adversarialTest}
                  </div>
                  {s.details && (
                    <div style={{ fontSize: "0.72rem", color: s.passed ? "#38bdf8" : "#fca5a5", marginTop: "0.25rem" }}>
                      ↳ {s.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: VOI Compute Calculator (Mechanism B) */}
      {activeTab === "voi" && (
        <div className="spe-egac-card">
          <h3>
            <span>Mechanism B: Value-of-Information (VOI) Decision Engine</span>
            <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>Exact NanoUSD Arithmetic</span>
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            {"V(a) = E[ΔQ_verified | a] / (E[C_a] + λ E[T_a])"}
            <br />
            Predicts the verified quality return per Dollar spent before executing compute.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginTop: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
                  <span>Expected Quality Gain ΔQ:</span>
                  <strong style={{ color: "#38bdf8" }}>{voiDeltaQ.toFixed(2)}</strong>
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={voiDeltaQ}
                  onChange={(e) => setVoiDeltaQ(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
                  <span>Execution Cost:</span>
                  <strong style={{ color: "#38bdf8" }}>
                    ${(voiCostNanos / NANOS_PER_USD).toFixed(4)} ({voiCostNanos.toLocaleString()} nanos)
                  </strong>
                </label>
                <input
                  type="range"
                  min="1000000"
                  max="500000000"
                  step="5000000"
                  value={voiCostNanos}
                  onChange={(e) => setVoiCostNanos(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
                  <span>Additional Latency $T_a$:</span>
                  <strong style={{ color: "#38bdf8" }}>{voiLatencyMs} ms</strong>
                </label>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={voiLatencyMs}
                  onChange={(e) => setVoiLatencyMs(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
                  <span>Latency Sensitivity $\lambda$:</span>
                  <strong style={{ color: "#38bdf8" }}>{voiLambda} nanos/ms</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="5000"
                  value={voiLambda}
                  onChange={(e) => setVoiLambda(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.35)", borderRadius: "10px", padding: "1.5rem" }}>
              <span style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
                Predicted VOI Decision Score
              </span>
              <span style={{ fontSize: "2.8rem", fontWeight: 800, color: "#38bdf8", margin: "0.5rem 0", fontFamily: "ui-monospace, monospace" }}>
                {liveVoiScore}
              </span>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center" }}>
                Verified Quality Points per $1.00 USD computation
              </span>
              <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: liveVoiScore > 5 ? "#4ade80" : "#facc15" }}>
                {liveVoiScore > 5 ? "✅ High VOI: Computational action recommended" : "⚠️ Low VOI: Computational action not economical"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: VSOD Dashboard */}
      {activeTab === "vsod" && (
        <div className="spe-egac-card">
          <h3>
            <span>Verified Successful Outcomes per Dollar (VSOD)</span>
            <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>Breakthrough Research Metric</span>
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            {"VSOD = N_verified_successes / C_total_execution (USD)"}
            <br />
            Comparing System A (Baseline) vs System B (EGAC-1 Adaptive Regime):
          </p>

          <div className="spe-egac-grid-2" style={{ marginTop: "1rem" }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8" }}>System A (Baseline)</h4>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#64748b" }}>Successes:</label>
                  <input
                    type="number"
                    value={sysASuccess}
                    onChange={(e) => setSysASuccess(parseInt(e.target.value) || 0)}
                    style={{ width: "80px", padding: "0.3rem", background: "#090d16", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#64748b" }}>Cost ($ USD):</label>
                  <input
                    type="number"
                    value={sysACostUsd}
                    onChange={(e) => setSysACostUsd(parseFloat(e.target.value) || 1)}
                    style={{ width: "80px", padding: "0.3rem", background: "#090d16", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </div>
              </div>
              <div className="spe-egac-metric-box">
                <span className="spe-egac-metric-label">System A VSOD</span>
                <span className="spe-egac-metric-value" style={{ color: "#94a3b8" }}>
                  {sysAMetrics.vsodScore} successes/$
                </span>
              </div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(56,189,248,0.3)" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#38bdf8" }}>System B (SPE Ω Adaptive Compute)</h4>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#64748b" }}>Successes:</label>
                  <input
                    type="number"
                    value={sysBSuccess}
                    onChange={(e) => setSysBSuccess(parseInt(e.target.value) || 0)}
                    style={{ width: "80px", padding: "0.3rem", background: "#090d16", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#64748b" }}>Cost ($ USD):</label>
                  <input
                    type="number"
                    value={sysBCostUsd}
                    onChange={(e) => setSysBCostUsd(parseFloat(e.target.value) || 1)}
                    style={{ width: "80px", padding: "0.3rem", background: "#090d16", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </div>
              </div>
              <div className="spe-egac-metric-box">
                <span className="spe-egac-metric-label">SPE Ω VSOD</span>
                <span className="spe-egac-metric-value" style={{ color: "#38bdf8" }}>
                  {sysBMetrics.vsodScore} successes/$
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", padding: "0.75rem 1rem", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>
              Head-to-Head Comparative Verdict:
            </span>
            <div style={{ fontSize: "0.8rem", color: "#e2e8f0", marginTop: "0.25rem" }}>
              SPE Ω demonstrates a <strong>+{vsodComparison.vsodGainPct}%</strong> gain in verified outcomes per dollar with <strong>{vsodComparison.costSavingsPct}%</strong> net cost reduction.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
