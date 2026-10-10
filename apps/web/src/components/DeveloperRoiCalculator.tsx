import React, { useState } from "react";
import type { AppView } from "../routing";

export interface DeveloperRoiCalculatorProps {
  onNavigate?: (view: AppView) => void;
}

export const DeveloperRoiCalculator: React.FC<DeveloperRoiCalculatorProps> = ({ onNavigate }) => {
  const [weeklyHours, setWeeklyHours] = useState<number>(15);

  // Conservative realistic metrics:
  // Developers spend ~25% of AI coding time debugging hallucinated imports, broken tests, and prompt drift.
  // SPE eliminates ~70% of those hallucination loops.
  const hoursSavedWeekly = ((weeklyHours * 0.25 * 0.70)).toFixed(1);
  const hoursSavedMonthly = (parseFloat(hoursSavedWeekly) * 4.2).toFixed(1);

  // Typical API spend on Claude 3.5 Sonnet / GPT-4o loops: ~$2.50 per hour of active coding.
  // Wasted prompt drift and retry loops account for ~25% of tokens.
  const tokenDollarsSavedMonthly = Math.round(weeklyHours * 2.5 * 0.25 * 4.2);

  // Return on Investment against $9/month Developer Pro
  const monthlySavingsValue = Math.round(parseFloat(hoursSavedMonthly) * 50 + tokenDollarsSavedMonthly); // assuming modest $50/hr dev rate
  const roiMultiplier = Math.round(monthlySavingsValue / 9);

  return (
    <section
      className="spe-roi-calculator-section"
      style={{
        maxWidth: "1100px",
        margin: "3rem auto",
        padding: "2rem 1.5rem",
        borderRadius: "12px",
        backgroundColor: "#070c18",
        border: "1px solid #1e293b",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      }}
      aria-label="Developer ROI Calculator"
    >
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <span
          style={{
            fontSize: "0.8125rem",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#38bdf8",
          }}
        >
          Instant Value Calculator
        </span>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0.5rem 0", color: "#f8fafc" }}>
          Calculate Your Time &amp; Token Savings
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.9375rem", maxWidth: "600px", margin: "0 auto" }}>
          See exactly how much debugging time and wasted API budget you preserve with SPE guardrails.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "2rem",
          alignItems: "center",
        }}
      >
        {/* Slider Box */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#0d1424",
            borderRadius: "8px",
            border: "1px solid #1e293b",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
            <label htmlFor="hours-slider" style={{ color: "#cbd5e1", fontSize: "0.9375rem", fontWeight: 600 }}>
              AI Coding Usage:
            </label>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>
              {weeklyHours} hrs / week
            </span>
          </div>

          <input
            id="hours-slider"
            type="range"
            min={3}
            max={40}
            step={1}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(parseInt(e.target.value, 10))}
            style={{
              width: "100%",
              cursor: "pointer",
              accentColor: "#38bdf8",
              marginBottom: "1rem",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
            <span>Casual (3h)</span>
            <span>Regular (15h)</span>
            <span>Power Dev (40h)</span>
          </div>

          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #1e293b" }}>
            <p style={{ fontSize: "0.8125rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
              💡 Based on real benchmarks across Claude Code, Cursor, and ChatGPT. Scope Guardrails prevent prompt drift and eliminate out-of-scope code refactors.
            </p>
          </div>
        </div>

        {/* Results Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "#0d1527",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>
              Debugging Time Saved
            </span>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#34d399", margin: "0.4rem 0" }}>
              ~{hoursSavedMonthly} hrs
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>per month preserved</span>
          </div>

          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "#0d1527",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>
              Wasted Tokens Saved
            </span>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#38bdf8", margin: "0.4rem 0" }}>
              ${tokenDollarsSavedMonthly}
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>avoided API retries</span>
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              padding: "1.25rem",
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(14, 165, 233, 0.15) 100%)",
              borderRadius: "8px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.875rem", color: "#f8fafc", fontWeight: 700 }}>
                Developer Pro ($9/mo) Return on Investment:
              </div>
              <div style={{ fontSize: "1.125rem", color: "#38bdf8", fontWeight: 800 }}>
                {roiMultiplier}x ROI · Estimated ${monthlySavingsValue}/mo in preserved engineering value
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => onNavigate?.("pricing")}
                style={{
                  padding: "0.6rem 1.1rem",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Get Developer Pro ($9/mo) →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
