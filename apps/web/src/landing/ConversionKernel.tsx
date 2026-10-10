import { useState } from "react";
import type { AppView } from "../routing";
import "./conversion-kernel.css";

interface ConversionKernelProps {
  onNavigate?: (view: AppView) => void;
}

export function ConversionKernel({ onNavigate }: ConversionKernelProps) {
  const [activeFormula, setActiveFormula] = useState<"A" | "B">("A");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    } catch {
      // Graceful fallback for restricted environments
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    }
  };

  return (
    <section
      className="spe-conversion-kernel"
      data-copy-depth="PROOF"
      aria-labelledby="conversion-kernel-heading"
    >
      <div className="spe-conversion-box">
        {/* Formula Switcher Tabs */}
        <div className="spe-conversion-tabs" role="tablist" aria-label="Positioning Formulas">
          <button
            type="button"
            role="tab"
            aria-selected={activeFormula === "A"}
            className={`spe-conversion-tab ${activeFormula === "A" ? "is-active" : ""}`}
            onClick={() => setActiveFormula("A")}
          >
            Formula A: $20 Subscription Killer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFormula === "B"}
            className={`spe-conversion-tab ${activeFormula === "B" ? "is-active" : ""}`}
            onClick={() => setActiveFormula("B")}
          >
            Formula B: Broken Agent Stopper
          </button>
        </div>

        {/* Formula Showcase */}
        {activeFormula === "A" ? (
          <div className="spe-formula-card">
            <div className="spe-formula-header">
              <span className="spe-formula-tag">The $20 Subscription Killer</span>
              <h2 id="conversion-kernel-heading" className="spe-formula-title">
                Stop paying $20/month just to review AI agent error logs.
              </h2>
              <p className="spe-formula-subtitle">
                SPE is the 100% free, offline CLI and browser workspace that reviews agent reports, catches silent regressions, and compiles the next atomic task contract at $0 cost.
              </p>
            </div>

            <div className="spe-conversion-actions">
              <button
                type="button"
                className="spe-btn-cta-primary"
                onClick={() =>
                  copyToClipboard("npm install -g @systempromptengine/cli", "cta-formula-a")
                }
              >
                {copiedKey === "cta-formula-a" ? (
                  <span>Copied!</span>
                ) : (
                  <span>Install Free CLI: npm install -g @systempromptengine/cli</span>
                )}
              </button>
              <button
                type="button"
                className="spe-btn-cta-secondary"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate("workflows");
                    window.scrollTo(0, 0);
                  }
                }}
              >
                Explore 1-Click Business Workflows →
              </button>
              <a
                href="#comparison-matrix"
                className="spe-btn-cta-secondary"
              >
                Produce Comparison Matrix on Demand ↓
              </a>
            </div>
          </div>
        ) : (
          <div className="spe-formula-card">
            <div className="spe-formula-header">
              <span className="spe-formula-tag">The Broken Agent &amp; Regression Stopper</span>
              <h2 id="conversion-kernel-heading" className="spe-formula-title">
                Tired of your AI coding agent running in circles and breaking working code?
              </h2>
              <p className="spe-formula-subtitle">
                SPE locks your requirements with ProtectedIntent invariants. If an agent hallucinates, skips tests, or touches forbidden files, SPE blocks the regression before it merges.
              </p>
            </div>

            <div className="spe-conversion-actions">
              <button
                type="button"
                className="spe-btn-cta-primary"
                onClick={() =>
                  copyToClipboard("npx @systempromptengine/cli adopt .", "cta-formula-b")
                }
              >
                {copiedKey === "cta-formula-b" ? (
                  <span>Copied!</span>
                ) : (
                  <span>Adopt in Your Repo ($ npx @systempromptengine/cli adopt .)</span>
                )}
              </button>
              <button
                type="button"
                className="spe-btn-cta-secondary"
                onClick={() => copyToClipboard("spe continue -", "cta-continue-pipe")}
              >
                {copiedKey === "cta-continue-pipe" ? (
                  <span>Copied!</span>
                ) : (
                  <span>Review Agent Logs via stdin: spe continue -</span>
                )}
              </button>
              <a
                href="#comparison-matrix"
                className="spe-btn-cta-secondary"
              >
                Produce Comparison Matrix on Demand ↓
              </a>
            </div>
          </div>
        )}

        {/* Developer CLI Ribbon */}
        <div className="spe-cli-ribbon">
          <div className="spe-cli-pill">
            <code>$ npm install -g @systempromptengine/cli</code>
            <button
              type="button"
              className={`spe-cli-copy-btn ${copiedKey === "ribbon-install" ? "is-copied" : ""}`}
              onClick={() =>
                copyToClipboard("npm install -g @systempromptengine/cli", "ribbon-install")
              }
              aria-label="Copy install command"
            >
              {copiedKey === "ribbon-install" ? "Copied!" : "Copy command"}
            </button>
          </div>

          <div className="spe-cli-pill">
            <code>$ spe continue -</code>
            <button
              type="button"
              className={`spe-cli-copy-btn ${copiedKey === "ribbon-continue" ? "is-copied" : ""}`}
              onClick={() => copyToClipboard("spe continue -", "ribbon-continue")}
              aria-label="Copy continue stdin command"
            >
              {copiedKey === "ribbon-continue" ? "Copied!" : "Copy command"}
            </button>
          </div>

          <div className="spe-cli-pill">
            <code>$ npx @systempromptengine/cli adopt .</code>
            <button
              type="button"
              className={`spe-cli-copy-btn ${copiedKey === "ribbon-adopt" ? "is-copied" : ""}`}
              onClick={() =>
                copyToClipboard("npx @systempromptengine/cli adopt .", "ribbon-adopt")
              }
              aria-label="Copy adopt command"
            >
              {copiedKey === "ribbon-adopt" ? "Copied!" : "Copy command"}
            </button>
          </div>
        </div>

        {/* Economic Framing & Loss Aversion */}
        <div className="spe-economic-bar">
          <div className="spe-economic-metric">
            <span className="spe-economic-label">Monthly SaaS Bill</span>
            <span className="spe-economic-value is-green">$0.00 / month</span>
            <span className="spe-economic-desc">Cancel $20/month AI subscription bills</span>
          </div>

          <div className="spe-economic-metric">
            <span className="spe-economic-label">Token Burn Guard</span>
            <span className="spe-economic-value is-amber">Wasted API tokens: $45/month on runaways</span>
            <span className="spe-economic-desc">Halt runaway loops before tokens burn</span>
          </div>

          <div className="spe-economic-metric">
            <span className="spe-economic-label">Production Safety</span>
            <span className="spe-economic-value is-cyan">Embarrassing regressions in production</span>
            <span className="spe-economic-desc">ProtectedIntent invariants block broken code</span>
          </div>

          <div className="spe-economic-metric">
            <span className="spe-economic-label">Air-Gapped Sandbox</span>
            <span className="spe-economic-value is-green">100% browser-local execution, zero server GPU inference bills, zero data tracking, instant speed</span>
            <span className="spe-economic-desc">Tedious manual prompt copy-pasting eliminated</span>
          </div>
        </div>
      </div>
    </section>
  );
}
