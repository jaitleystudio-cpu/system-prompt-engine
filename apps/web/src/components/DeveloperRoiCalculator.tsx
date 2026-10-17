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

  // Typical API spend on Claude 6.2 Sonnet / GPT-6.1 loops: ~$2.50 per hour of active coding.
  // Wasted prompt drift and retry loops account for ~25% of tokens.
  const tokenDollarsSavedMonthly = Math.round(weeklyHours * 2.5 * 0.25 * 4.2);

  // Return on Investment against $9/month Developer Pro
  const monthlySavingsValue = Math.round(parseFloat(hoursSavedMonthly) * 50 + tokenDollarsSavedMonthly); // assuming modest $50/hr dev rate
  const roiMultiplier = Math.round(monthlySavingsValue / 9);

  return (
    <section
      className="spe-roi-calculator-section"
      style={{
        maxWidth: "1200px",
        margin: "3rem auto",
        padding: "2.5rem 2.25rem",
        borderRadius: "24px",
        background: "radial-gradient(120% 100% at 50% 0%, #0f172a 0%, #070b14 65%, #04060c 100%)",
        border: "1px solid rgba(226, 232, 240, 0.14)",
        boxShadow: "0 32px 80px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
      }}
      aria-label="Developer ROI Calculator"
    >
      <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
        <span
          style={{
            display: "inline-block",
            padding: "0.3rem 0.85rem",
            borderRadius: "9999px",
            background: "rgba(217, 197, 154, 0.1)",
            border: "1px solid rgba(217, 197, 154, 0.28)",
            fontSize: "0.72rem",
            fontFamily: "var(--spe-font-mono, monospace)",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "#d9c59a",
            marginBottom: "0.65rem",
          }}
        >
          Instant Value Calculator
        </span>
        <h2
          style={{
            fontSize: "clamp(1.75rem, 3vw, 2.35rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "0.35rem 0 0.6rem",
            color: "#f8fafc",
          }}
        >
          Calculate Your Time &amp;{" "}
          <em
            style={{
              fontFamily: "var(--spe-font-display, 'Instrument Serif', Georgia, serif)",
              fontWeight: 400,
              fontStyle: "italic",
              color: "#d9c59a",
            }}
          >
            Token Savings.
          </em>
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "1rem", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
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
            padding: "1.75rem",
            backgroundColor: "rgba(10, 15, 28, 0.85)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
            <label htmlFor="hours-slider" style={{ color: "#cbd5e1", fontSize: "0.9375rem", fontWeight: 600 }}>
              AI Coding Usage:
            </label>
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8", fontFamily: "var(--spe-font-mono, monospace)" }}>
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

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b", fontFamily: "var(--spe-font-mono, monospace)" }}>
            <span>Casual (3h)</span>
            <span>Regular (15h)</span>
            <span>Power Dev (40h)</span>
          </div>

          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>
              Based on empirical benchmarks across Antigravity, Claude Code, Cursor, and ChatGPT. Scope Guardrails prevent prompt drift and eliminate out-of-scope code refactors.
            </p>
          </div>
        </div>

        {/* Results Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div
            style={{
              padding: "1.35rem",
              backgroundColor: "rgba(10, 15, 28, 0.85)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", fontWeight: 700 }}>
              Debugging Time Saved
            </span>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#34d399", margin: "0.4rem 0", fontFamily: "var(--spe-font-mono, monospace)" }}>
              ~{hoursSavedMonthly} hrs
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>per month preserved</span>
          </div>

          <div
            style={{
              padding: "1.35rem",
              backgroundColor: "rgba(10, 15, 28, 0.85)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", fontWeight: 700 }}>
              Wasted Tokens Saved
            </span>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#38bdf8", margin: "0.4rem 0", fontFamily: "var(--spe-font-mono, monospace)" }}>
              ${tokenDollarsSavedMonthly}
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>avoided API retries</span>
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              padding: "1.35rem 1.5rem",
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(217, 197, 154, 0.08) 100%)",
              borderRadius: "16px",
              border: "1px solid rgba(217, 197, 154, 0.28)",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 600 }}>
                Developer Pro ($9/mo) Return on Investment:
              </div>
              <div style={{ fontSize: "1.125rem", color: "#d9c59a", fontWeight: 800, marginTop: "0.2rem" }}>
                {roiMultiplier}x ROI · Estimated ${monthlySavingsValue}/mo in preserved engineering value
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => onNavigate?.("pricing")}
                style={{
                  minHeight: "44px",
                  minWidth: "220px",
                  padding: "10px 24px",
                  backgroundImage: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
                  backgroundColor: "#e2e8f0",
                  color: "#090d16",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
