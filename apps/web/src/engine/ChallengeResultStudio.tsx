import React, { useState, useMemo } from "react";
import {
  PERTURBATION_CATALOG,
  PRELOADED_CLAIMS,
  challengeCandidateClaim,
  type ActiveCscReport,
  type CandidateClaim,
} from "./counterfactualSpecificationClosure.ts";

export const ChallengeResultStudio: React.FC = () => {
  const [selectedClaimId, setSelectedClaimId] = useState<string>("claim-stripe-checkout");
  const [activeTab, setActiveTab] = useState<"matrix" | "repairs" | "export" | "trace">("matrix");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Active claim
  const currentClaim: CandidateClaim = useMemo(() => {
    return PRELOADED_CLAIMS.find((c) => c.id === selectedClaimId) || PRELOADED_CLAIMS[0];
  }, [selectedClaimId]);

  // Run report
  const [report, setReport] = useState<ActiveCscReport>(() => challengeCandidateClaim(currentClaim));

  // Re-run challenge on claim change
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setReport(challengeCandidateClaim(currentClaim));
    }, 200);
    return () => clearTimeout(timer);
  }, [currentClaim]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedScenario = useMemo(() => {
    if (!selectedScenarioId) return report.scenarios[0];
    return report.scenarios.find((s) => s.scenarioId === selectedScenarioId) || report.scenarios[0];
  }, [report, selectedScenarioId]);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "2rem 1.5rem", color: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header & Badges */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ display: "inline-flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            ✦ Anti-Lucky-Pass Shield
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", border: "1px solid rgba(14, 165, 233, 0.3)" }}>
            ✦ Active Counterfactual Closure
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            ✦ 100% In-Browser Air-Gap ($0 Compute)
          </span>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 9999, background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
            ✦ SpecBench & AgentLens Grounded
          </span>
        </div>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.75rem 0", background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Challenge This Result
        </h1>
        <p style={{ fontSize: "1.05rem", color: "#94a3b8", maxWidth: 840, margin: "0 auto", lineHeight: 1.6 }}>
          Passing unit tests does not prove your AI solution works. Microsoft AgentLens (2026) revealed that 10.7% of passing SWE tests are accidental "Lucky Passes". SPE actively perturbs execution circumstances across 5 physical axes to expose silent failures before you merge.
        </p>
      </div>

      {/* Preset Selector */}
      <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: 14, padding: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Select Real-World Candidate Claim:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
          {PRELOADED_CLAIMS.map((claim) => {
            const isSelected = claim.id === selectedClaimId;
            return (
              <button
                key={claim.id}
                onClick={() => setSelectedClaimId(claim.id)}
                style={{
                  textAlign: "left",
                  padding: "0.85rem 1rem",
                  borderRadius: 10,
                  border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.5)",
                  background: isSelected ? "rgba(14, 165, 233, 0.12)" : "rgba(30, 41, 59, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 4, background: "rgba(51, 65, 85, 0.8)", color: "#94a3b8" }}>
                    {claim.category}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
                    {claim.baselinePassCount}/{claim.baselineTestCount} Tests Pass
                  </span>
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: isSelected ? "#f8fafc" : "#cbd5e1", marginBottom: "0.25rem" }}>
                  {claim.title}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {claim.claimedCapability}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
        {/* Release Verdict Hero Banner */}
        <div
          style={{
            background:
              report.releaseVerdict === "HOLD_PENDING_REPAIR"
                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)",
            border:
              report.releaseVerdict === "HOLD_PENDING_REPAIR"
                ? "1px solid rgba(239, 68, 68, 0.4)"
                : "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: 16,
            padding: "1.75rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    padding: "0.3rem 0.75rem",
                    borderRadius: 9999,
                    background:
                      report.releaseVerdict === "HOLD_PENDING_REPAIR"
                        ? "#dc2626"
                        : "#059669",
                    color: "#ffffff",
                  }}
                >
                  {report.releaseVerdict === "HOLD_PENDING_REPAIR"
                    ? "RELEASE HOLD: LUCKY PASS DETECTED"
                    : "RELEASE PASS: STRESS TEST CERTIFIED"}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  Air-Gap Simulation Digest: <code style={{ color: "#38bdf8" }}>{report.cryptographicDigest}</code>
                </span>
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0.5rem 0", color: "#f8fafc" }}>
                {report.releaseVerdict === "HOLD_PENDING_REPAIR"
                  ? `Exposed ${report.luckyPassCount} Hidden Failure Mode(s) Masked by Passing Tests`
                  : "All 5 Orthogonal Physical Perturbations Survived with Zero Regressions"}
              </h2>
              <p style={{ margin: 0, fontSize: "0.95rem", color: "#cbd5e1", maxWidth: 740, lineHeight: 1.5 }}>
                {report.releaseVerdict === "HOLD_PENDING_REPAIR"
                  ? `The candidate artifact passed 100% of baseline unit tests, but failed when subjected to realistic counterfactual perturbations. Delta Pass Probability is ${report.deltaPassProbability * 100}% (pass rate dropped from ${(report.baselinePassRate * 100).toFixed(0)}% to ${((1 - report.deltaPassProbability) * 100).toFixed(0)}%).`
                  : `Candidate artifact passed 100% of baseline tests AND survived all 5 active stress scenarios (network disconnects, cache interleaving, boundary inversions, rollback exceptions, and rate limit bursts). Safe for production.`}
              </p>
            </div>

            <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                  Delta Pass Risk (ΔP)
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: report.deltaPassProbability > 0 ? "#f87171" : "#10b981" }}>
                  {report.deltaPassProbability > 0 ? `+${(report.deltaPassProbability * 100).toFixed(0)}%` : "0.0%"}
                </div>
              </div>
              <div style={{ textAlign: "right", borderLeft: "1px solid rgba(51, 65, 85, 0.6)", paddingLeft: "1.25rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                  Stress Confidence
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: report.confidenceScore >= 90 ? "#10b981" : "#fbbf24" }}>
                  {report.confidenceScore}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Studio Tabs */}
        <div>
          <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(51, 65, 85, 0.6)", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
            <button
              onClick={() => setActiveTab("matrix")}
              style={{
                background: activeTab === "matrix" ? "rgba(14, 165, 233, 0.15)" : "transparent",
                color: activeTab === "matrix" ? "#38bdf8" : "#94a3b8",
                border: activeTab === "matrix" ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid transparent",
                borderRadius: 8,
                padding: "0.6rem 1.1rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              1. Perturbation Stress Matrix ({report.scenarios.length})
            </button>
            <button
              onClick={() => setActiveTab("repairs")}
              style={{
                background: activeTab === "repairs" ? "rgba(14, 165, 233, 0.15)" : "transparent",
                color: activeTab === "repairs" ? "#38bdf8" : "#94a3b8",
                border: activeTab === "repairs" ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid transparent",
                borderRadius: 8,
                padding: "0.6rem 1.1rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              2. Causal Minimal-Cut Repairs
              {report.minimalCutRepairs.length > 0 && (
                <span style={{ fontSize: "0.75rem", background: "#ef4444", color: "#fff", padding: "0.1rem 0.4rem", borderRadius: 9999 }}>
                  {report.minimalCutRepairs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("trace")}
              style={{
                background: activeTab === "trace" ? "rgba(14, 165, 233, 0.15)" : "transparent",
                color: activeTab === "trace" ? "#38bdf8" : "#94a3b8",
                border: activeTab === "trace" ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid transparent",
                borderRadius: 8,
                padding: "0.6rem 1.1rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              3. Execution Trace Logs
            </button>
            <button
              onClick={() => setActiveTab("export")}
              style={{
                background: activeTab === "export" ? "rgba(14, 165, 233, 0.15)" : "transparent",
                color: activeTab === "export" ? "#38bdf8" : "#94a3b8",
                border: activeTab === "export" ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid transparent",
                borderRadius: 8,
                padding: "0.6rem 1.1rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              4. Export Invariant Contract
            </button>
          </div>

          {/* TAB 1: STRESS MATRIX */}
          {activeTab === "matrix" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              {/* Scenarios List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {report.scenarios.map((scenario) => {
                  const meta = PERTURBATION_CATALOG[scenario.operator];
                  const isSelected = scenario.scenarioId === selectedScenario.scenarioId;
                  return (
                    <div
                      key={scenario.scenarioId}
                      onClick={() => setSelectedScenarioId(scenario.scenarioId)}
                      style={{
                        padding: "1rem",
                        borderRadius: 12,
                        background: isSelected ? "rgba(30, 41, 59, 0.8)" : "rgba(15, 23, 42, 0.6)",
                        border: isSelected
                          ? "1px solid #38bdf8"
                          : scenario.passed
                          ? "1px solid rgba(16, 185, 129, 0.3)"
                          : "1px solid rgba(239, 68, 68, 0.4)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.5rem",
                              borderRadius: 4,
                              background: scenario.passed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                              color: scenario.passed ? "#34d399" : "#f87171",
                            }}
                          >
                            {scenario.passed ? "✓ PASS" : "✗ LUCKY PASS DETECTED"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                            {meta.category}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {scenario.executionTimeMs.toFixed(0)}ms
                        </span>
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
                        {meta.name}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.4 }}>
                        {scenario.observedFailureDetail
                          ? scenario.observedFailureDetail
                          : meta.description}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scenario Detail Panel */}
              <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                    {selectedScenario.title}
                  </h3>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: 9999,
                      background: selectedScenario.passed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: selectedScenario.passed ? "#34d399" : "#f87171",
                    }}
                  >
                    {selectedScenario.passed ? "SURVIVED STRESS" : "FALSIFIED"}
                  </span>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                    Perturbation Operator:
                  </div>
                  <code style={{ fontSize: "0.82rem", color: "#38bdf8", background: "rgba(14, 165, 233, 0.1)", padding: "0.2rem 0.4rem", borderRadius: 4 }}>
                    {selectedScenario.operator}
                  </code>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                    Real-World Empirical Precedent:
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                    {PERTURBATION_CATALOG[selectedScenario.operator].realWorldPrecedent}
                  </div>
                </div>

                {selectedScenario.observedFailureDetail && (
                  <div style={{ marginBottom: "1rem", padding: "0.85rem", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f87171", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                      Observed Lucky-Pass Root Cause:
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#fca5a5", lineHeight: 1.5 }}>
                      {selectedScenario.observedFailureDetail}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                    Synthesized Metamorphic Stress Test Fixture:
                  </div>
                  <pre style={{ margin: 0, padding: "0.85rem", borderRadius: 8, background: "#0b1329", color: "#94a3b8", fontSize: "0.78rem", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.45, border: "1px solid rgba(51, 65, 85, 0.5)" }}>
                    {selectedScenario.operator === "NETWORK_DISCONNECT_MID_TRANSACTION"
                      ? `// Injected Socket Termination Mid-Transaction
const interceptor = createMockSocketInterceptor({ dropAfterBytes: 128 });
const res1 = await executeOperation(req, { interceptor });
assert(res1.abortedByClient);
const res2 = await executeOperation(req, { clientRetry: true });
assert.equal(getDatabaseTransactionCount(req.orderId), 1);`
                      : `// Metamorphic Invariant Assertions
const stressResult = await runPerturbationProbe({ operator: "${selectedScenario.operator}" });
assert.strictEqual(stressResult.invariantViolated, false);`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REPAIRS */}
          {activeTab === "repairs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {report.minimalCutRepairs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: 12, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🛡️</div>
                  <h3 style={{ fontSize: "1.2rem", color: "#10b981", margin: "0 0 0.5rem 0" }}>Zero Surgical Repairs Needed</h3>
                  <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.95rem" }}>
                    The candidate artifact demonstrated complete specification closure across all 5 physical perturbation operators.
                  </p>
                </div>
              ) : (
                report.minimalCutRepairs.map((repair) => (
                  <div
                    key={repair.id}
                    style={{
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(51, 65, 85, 0.6)",
                      borderRadius: 12,
                      padding: "1.5rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 4, background: "rgba(239, 68, 68, 0.2)", color: "#f87171", marginRight: "0.5rem" }}>
                          CAUSAL MINIMAL CUT
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                          Target: <strong style={{ color: "#cbd5e1" }}>{repair.causalCutLocation}</strong>
                        </span>
                        <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.4rem 0 0.25rem 0", color: "#f8fafc" }}>
                          {repair.title}
                        </h4>
                      </div>
                      <button
                        onClick={() => handleCopy(repair.recommendedPatch, repair.id)}
                        style={{
                          background: copiedKey === repair.id ? "#059669" : "rgba(30, 41, 59, 0.8)",
                          color: "#f8fafc",
                          border: "1px solid rgba(51, 65, 85, 0.8)",
                          borderRadius: 6,
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {copiedKey === repair.id ? "✓ Copied Patch" : "Copy Surgical Fix"}
                      </button>
                    </div>

                    <p style={{ fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
                      {repair.explanation}
                    </p>

                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                        Recommended Code Invariant Injection:
                      </div>
                      <pre style={{ margin: 0, padding: "1rem", borderRadius: 8, background: "#0b1329", color: "#38bdf8", fontSize: "0.82rem", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.5, border: "1px solid rgba(51, 65, 85, 0.5)" }}>
                        {repair.recommendedPatch}
                      </pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: TRACE LOGS */}
          {activeTab === "trace" && (
            <div style={{ background: "rgba(11, 19, 41, 0.9)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                Active CSC Air-Gapped Simulation Trace (Zero Cloud Egress):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontFamily: "monospace", fontSize: "0.82rem" }}>
                {report.scenarios.flatMap((s) => s.traceLog).map((line, idx) => {
                  const isFail = line.includes("[FAIL]");
                  const isPass = line.includes("[PASS]");
                  const isInject = line.includes("[INJECT]");
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: 4,
                        background: isFail
                          ? "rgba(239, 68, 68, 0.15)"
                          : isPass
                          ? "rgba(16, 185, 129, 0.1)"
                          : isInject
                          ? "rgba(14, 165, 233, 0.1)"
                          : "transparent",
                        color: isFail ? "#fca5a5" : isPass ? "#6ee7b7" : isInject ? "#7dd3fc" : "#94a3b8",
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: EXPORT */}
          {activeTab === "export" && (
            <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: 12, padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
                Export Hardened Anti-Lucky-Pass Directive
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: "0 0 1.25rem 0" }}>
                Attach this specification to your agent or repository to enforce continuous counterfactual stress validation during code generation.
              </p>

              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <button
                  onClick={() =>
                    handleCopy(
                      `# ANTI-LUCKY-PASS SPECIFICATION (SPE Ω)\nClaim: ${currentClaim.title}\nInvariants:\n${currentClaim.declaredInvariants.map((i) => `- ${i}`).join("\n")}\n\nRequired Mitigations:\n${report.minimalCutRepairs.map((r) => `## ${r.title}\n${r.recommendedPatch}`).join("\n\n")}`,
                      "export-directive"
                    )
                  }
                  style={{
                    background: copiedKey === "export-directive" ? "#059669" : "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "0.6rem 1.2rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copiedKey === "export-directive" ? "✓ Copied to Clipboard" : "Copy CLAUDE.md / .cursorrules Directive"}
                </button>
                <button
                  onClick={() =>
                    handleDownload(
                      `spe-challenge-${currentClaim.id}.json`,
                      JSON.stringify(report, null, 2)
                    )
                  }
                  style={{
                    background: "rgba(30, 41, 59, 0.8)",
                    color: "#f8fafc",
                    border: "1px solid rgba(51, 65, 85, 0.8)",
                    borderRadius: 6,
                    padding: "0.6rem 1.2rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Download Evidence Passport JSON
                </button>
              </div>

              <pre style={{ margin: 0, padding: "1rem", borderRadius: 8, background: "#0b1329", color: "#cbd5e1", fontSize: "0.8rem", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.5, border: "1px solid rgba(51, 65, 85, 0.5)" }}>
                {`# ANTI-LUCKY-PASS SPECIFICATION (SPE Ω)
Claim ID: ${report.claimId}
Verdict: ${report.releaseVerdict}
Delta Pass Risk: ${report.deltaPassProbability}
Cryptographic Seal: ${report.cryptographicDigest}

// Non-Negotiable Invariants:
${currentClaim.declaredInvariants.map((inv) => `[INVARIANT] ${inv}`).join("\n")}

// Minimal-Cut Surgical Code Injections:
${report.minimalCutRepairs.map((r) => `// ${r.title}\n${r.recommendedPatch}`).join("\n\n")}`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
