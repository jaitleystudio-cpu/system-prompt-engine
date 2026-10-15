/**
 * SPE Ω Interactive Before vs After Diff Slider
 * Visual proof demonstrating how SPE eliminates agent hallucinations,
 * enforces invariant boundaries, and saves wasted API spend.
 */

import React, { useState, useRef, useCallback } from "react";
import type { AppView } from "../routing";
import { copyTextSafe } from "../engine/workflows/clipboard";
import {
  setCanvasSplitPct,
  useVerticalDiffScroll,
  recordScrollPosition,
  handleDiffSliderKeyDown,
} from "../engine/landing/diffScrollEngine";
import { SCENARIOS } from "../engine/landing/diffScenarios";
import "./before-after-diff.css";

interface BeforeAfterDiffSliderProps {
  onNavigate?: (view: AppView) => void;
  isMainHero?: boolean;
}

export const BeforeAfterDiffSlider: React.FC<BeforeAfterDiffSliderProps> = ({
  onNavigate,
  isMainHero = true,
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("auth-refactor");
  const [splitPct, setSplitPct] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [cliCopied, setCliCopied] = useState<boolean>(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const lastPctRef = useRef<number>(0);
  const isManualOverrideRef = useRef<boolean>(false);
  const lastScrollYRef = useRef<number>(0);

  const activeScenario =
    SCENARIOS.find((s) => s.id === activeScenarioId) ?? SCENARIOS[0];

  const updateSplitFromClientY = useCallback((clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setSplitPct(pct);
    lastPctRef.current = pct;
    setCanvasSplitPct(canvasRef.current, pct);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    recordScrollPosition(lastScrollYRef, isManualOverrideRef);
    updateSplitFromClientY(e.clientY);
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Fallback gracefully
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateSplitFromClientY(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    isDraggingRef.current = false;
    recordScrollPosition(lastScrollYRef, isManualOverrideRef);
    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Fallback gracefully
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    handleDiffSliderKeyDown(
      e,
      canvasRef.current,
      splitPct,
      setSplitPct,
      lastPctRef,
      isManualOverrideRef,
      lastScrollYRef
    );
  };

  const handlePreset = (pct: number) => {
    recordScrollPosition(lastScrollYRef, isManualOverrideRef);
    setSplitPct(pct);
    lastPctRef.current = pct;
    setCanvasSplitPct(canvasRef.current, pct);
  };

  useVerticalDiffScroll({
    trackRef,
    pinRef,
    canvasRef,
    isDraggingRef,
    isManualOverrideRef,
    lastScrollYRef,
    lastPctRef,
    onProgressChange: setSplitPct,
  });

  const copyCliCommand = async () => {
    await copyTextSafe("npm install -g @systempromptengine/cli");
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 2500);
  };

  return (
    <section
      className={`spe-diff-section ${isMainHero ? "is-main-hero" : ""}`}
      data-copy-depth="PROOF"
      aria-labelledby="diff-slider-heading"
    >
      <div className="spe-diff-container">
        {/* Top ambient glow & light beam */}
        <div className="spe-diff-ambient-glow" aria-hidden="true" />

        {/* Section Heading */}
        <div className="spe-diff-header">
          <div className="spe-diff-eyebrow-wrap">
            <span className="spe-diff-eyebrow">
              <span className="spe-live-pulse-dot" aria-hidden="true" />
              EMPIRICAL RUN DIFF · HALLUCINATION VS DETERMINISM
            </span>
          </div>
          <h2 id="diff-slider-heading" className="spe-diff-title">
            Before vs After: <em>See the Proof in Real Agent Runs</em>
          </h2>
          <p className="spe-diff-subtitle">
            Drag the interactive slider below to compare an unguided AI coding agent run against an SPE Ω Protected Prompt execution.
          </p>
        </div>

        {/* Scenario Selection Tabs */}
        <div
          className="spe-diff-scenarios"
          role="tablist"
          aria-label="Diff comparison scenarios"
        >
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              role="tab"
              aria-selected={activeScenarioId === sc.id}
              className={`spe-diff-scenario-tab ${
                activeScenarioId === sc.id ? "is-active" : ""
              }`}
              onClick={() => setActiveScenarioId(sc.id)}
            >
              <span>{sc.name}</span>
            </button>
          ))}
        </div>

        {/* Bounded Sticky Storytelling Track */}
        <div className="spe-diff-track is-scroll-driven" ref={trackRef}>
          <div className="spe-diff-sticky-pin" ref={pinRef}>
            {/* Scorecard Summary Pill Grid */}
            <div className="spe-diff-scorecard-grid">
          <div
            className={`spe-diff-scorecard is-before ${
              splitPct <= 35 ? "is-emphasized" : splitPct >= 65 ? "is-dimmed" : "is-balanced"
            }`}
          >
            <div className="spe-scorecard-label">
              <div className="spe-scorecard-chip-title">
                <span className="spe-scorecard-indicator" aria-hidden="true" />
                <span>{activeScenario.before.label}</span>
              </div>
              <div className="spe-scorecard-chip-cost">
                <span>{activeScenario.before.cost}</span>
              </div>
            </div>
            <div className="spe-scorecard-stats">
              <div className="spe-stat-item">
                <span className="spe-stat-name">Outcome</span>
                <span className="spe-stat-val">{activeScenario.before.outcome}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Scope Drift</span>
                <span className="spe-stat-val">{activeScenario.before.scope}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Test Status</span>
                <span className="spe-stat-val">{activeScenario.before.tests}</span>
              </div>
            </div>
          </div>

          <div
            className={`spe-diff-scorecard is-after ${
              splitPct >= 65 ? "is-emphasized" : splitPct <= 35 ? "is-dimmed" : "is-balanced"
            }`}
          >
            <div className="spe-scorecard-label">
              <div className="spe-scorecard-chip-title">
                <span className="spe-scorecard-indicator" aria-hidden="true" />
                <span>{activeScenario.after.label}</span>
              </div>
              <div className="spe-scorecard-chip-cost">
                <span>{activeScenario.after.cost}</span>
              </div>
            </div>
            <div className="spe-scorecard-stats">
              <div className="spe-stat-item">
                <span className="spe-stat-name">Outcome</span>
                <span className="spe-stat-val">{activeScenario.after.outcome}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Scope Drift</span>
                <span className="spe-stat-val">{activeScenario.after.scope}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Test Status</span>
                <span className="spe-stat-val">{activeScenario.after.tests}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Diff Viewport */}
        <div className="spe-diff-viewport-wrap">
          {/* Quick Preset Buttons */}
          <div className="spe-diff-quick-controls">
            <span>
              (Drag divider or click presets)
            </span>
            <div className="spe-diff-toggle-btns">
              <button
                type="button"
                className={`spe-diff-toggle-btn ${splitPct === 0 ? "is-active" : ""}`}
                onClick={() => handlePreset(0)}
                aria-label="Show 100% Before unguided run"
              >
                100% Before
              </button>
              <button
                type="button"
                className={`spe-diff-toggle-btn ${splitPct === 50 ? "is-active" : ""}`}
                onClick={() => handlePreset(50)}
                aria-label="Split 50 50 view"
              >
                50 / 50 Split
              </button>
              <button
                type="button"
                className={`spe-diff-toggle-btn ${splitPct === 100 ? "is-active" : ""}`}
                onClick={() => handlePreset(100)}
                aria-label="Show 100% After SPE protected run"
              >
                100% After
              </button>
            </div>
          </div>

          {/* Interactive Split Canvas */}
          <div
            ref={canvasRef}
            className="spe-diff-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* UNDER LAYER: BEFORE (Unguided Run) */}
            <div className="spe-pane-under is-before">
              <div className="spe-terminal-window">
                <div className="spe-terminal-topbar">
                  <div className="spe-terminal-dots">
                    <span className="spe-dot spe-dot-red" />
                    <span className="spe-dot spe-dot-yellow" />
                    <span className="spe-dot spe-dot-green" />
                  </div>
                  <span className="spe-terminal-tag">
                    ❌ Unguided AI Agent Run (Hallucination)
                  </span>
                </div>
                <ul className="spe-terminal-lines">
                  {activeScenario.before.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className={`spe-log-line ${
                        ln.type === "cmd"
                          ? "spe-log-cmd"
                          : ln.type === "warn"
                          ? "spe-log-warn"
                          : ln.type === "fail"
                          ? "spe-log-fail"
                          : "spe-log-muted"
                      }`}
                    >
                      {ln.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* OVER LAYER: AFTER (SPE Protected Run), clipped vertically from top */}
            <div
              className="spe-pane-over is-after"
              style={{
                clipPath: `polygon(0% 0%, 100% 0%, 100% ${splitPct}%, 0% ${splitPct}%)`,
                WebkitClipPath: `polygon(0% 0%, 100% 0%, 100% ${splitPct}%, 0% ${splitPct}%)`,
              }}
            >
              <div className="spe-terminal-window">
                <div className="spe-terminal-topbar">
                  <div className="spe-terminal-dots">
                    <span className="spe-dot spe-dot-red" />
                    <span className="spe-dot spe-dot-yellow" />
                    <span className="spe-dot spe-dot-green" />
                  </div>
                  <span className="spe-terminal-tag">
                    🛡️ SPE Ω Protected Run (Deterministic)
                  </span>
                </div>
                <ul className="spe-terminal-lines">
                  {activeScenario.after.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className={`spe-log-line ${
                        ln.type === "cmd"
                          ? "spe-log-cmd"
                          : ln.type === "pass"
                          ? "spe-log-pass"
                          : ln.type === "receipt"
                          ? "spe-log-receipt"
                          : "spe-log-muted"
                      }`}
                    >
                      {ln.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* HORIZONTAL REVEAL DIVIDER */}
            <div
              className={`spe-slider-divider ${isDragging ? "is-active" : ""}`}
              style={{ top: `${splitPct}%` }}
              role="slider"
              tabIndex={0}
              aria-label="Comparison slider between unguided agent and SPE protected run"
              aria-valuenow={Math.round(splitPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-orientation="vertical"
              onKeyDown={handleKeyDown}
            >
              <div className="spe-slider-handle">
                <span className="spe-handle-icon" aria-hidden="true">
                  ▴ ▾
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Action CTAs Below Slider */}
    <div className="spe-diff-actions">
      <button
        type="button"
        className="spe-diff-cta-primary"
        onClick={() => {
          if (onNavigate) {
            onNavigate("create");
            window.scrollTo(0, 0);
          }
        }}
      >
        <span>Try Protected Prompt Studio Free ↗</span>
      </button>

      <div className="spe-diff-cli-box">
        <code>npm install -g @systempromptengine/cli</code>
        <button
          type="button"
          className="spe-diff-cli-copy"
          onClick={copyCliCommand}
          aria-label="Copy CLI install command"
        >
          {cliCopied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      <button
        type="button"
        className="spe-diff-cta-ghost"
        onClick={() => {
          if (onNavigate) {
            onNavigate("workflows");
            window.scrollTo(0, 0);
          }
        }}
      >
        <span>Explore 1-Click Business Workflows →</span>
      </button>
    </div>
  </div>
</section>
  );
};
