import { useMemo, useState, useEffect } from "react";
import { parseCustomSentence, type ParsedSentenceResult } from "./plainEnglishParser";
import "./real-prompt-live-hud.css";

export interface RealPromptLiveHudProps {
  value: string;
  busy: boolean;
  onBuild: () => void;
  category?: string;
}

export function RealPromptLiveHud({ value, busy, onBuild }: RealPromptLiveHudProps) {
  const [copiedSlot, setCopiedSlot] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const parsed: ParsedSentenceResult = useMemo(
    () => parseCustomSentence(value),
    [value]
  );

  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 320);
    return () => clearTimeout(timer);
  }, [value]);

  const hasContent = value.trim().length > 0;

  const copySlotText = (label: string, text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedSlot(label);
    setTimeout(() => setCopiedSlot(null), 1800);
  };

  if (!hasContent) {
    return (
      <div className="spe-wow-canvas spe-wow-canvas--idle" role="region" aria-label="Prompt builder guide">
        <div className="spe-wow-topbar">
          <div className="spe-wow-status-pill">
            <span className="spe-wow-idle-dot" />
            <span>HOW IT WORKS</span>
          </div>
          <span className="spe-wow-privacy-tag">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Private · Runs on Device
          </span>
        </div>

        <div className="spe-wow-header">
          <h3 className="spe-wow-title">
            The four pillars of an unbreakable prompt.
          </h3>
          <p className="spe-wow-subtitle">
            Type your idea on the left or select an example. SPE maps your brief into four clear instructions:
          </p>
        </div>

        <div className="spe-wow-bento">
          {/* Slot 1: ROLE */}
          <div className="spe-wow-card is-idle card--role">
            <div className="spe-wow-card-inner">
              <div className="spe-wow-card-head">
                <div className="spe-wow-tag-group">
                  <span className="spe-wow-icon-box role">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="spe-wow-slot-label role">01 · ROLE</span>
                </div>
                <span className="spe-wow-hint">Persona & Authority</span>
              </div>
              <p className="spe-wow-card-body placeholder">
                Establishes the expert domain, voice, and perspective.
              </p>
            </div>
          </div>

          {/* Slot 2: GOAL */}
          <div className="spe-wow-card is-idle card--goal">
            <div className="spe-wow-card-inner">
              <div className="spe-wow-card-head">
                <div className="spe-wow-tag-group">
                  <span className="spe-wow-icon-box goal">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                  </span>
                  <span className="spe-wow-slot-label goal">02 · GOAL</span>
                </div>
                <span className="spe-wow-hint">Primary Objective</span>
              </div>
              <p className="spe-wow-card-body placeholder">
                Locks in the singular outcome the model must accomplish.
              </p>
            </div>
          </div>

          {/* Slot 3: RULES */}
          <div className="spe-wow-card is-idle card--constraint">
            <div className="spe-wow-card-inner">
              <div className="spe-wow-card-head">
                <div className="spe-wow-tag-group">
                  <span className="spe-wow-icon-box constraint">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <span className="spe-wow-slot-label constraint">03 · RULES</span>
                </div>
                <span className="spe-wow-hint">Strict Guardrails</span>
              </div>
              <p className="spe-wow-card-body placeholder">
                Zero hallucinations. Explicit boundaries to eliminate guesswork.
              </p>
            </div>
          </div>

          {/* Slot 4: OUTPUT */}
          <div className="spe-wow-card is-idle card--output">
            <div className="spe-wow-card-inner">
              <div className="spe-wow-card-head">
                <div className="spe-wow-tag-group">
                  <span className="spe-wow-icon-box output">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </span>
                  <span className="spe-wow-slot-label output">04 · OUTPUT</span>
                </div>
                <span className="spe-wow-hint">Contract & Schema</span>
              </div>
              <p className="spe-wow-card-body placeholder">
                The exact format, schema, and steps ready for execution.
              </p>
            </div>
          </div>
        </div>

        <div className="spe-wow-footer idle">
          <span className="spe-wow-spark">✦</span>
          <span>Type your idea or select an example on the left to begin</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`spe-wow-canvas spe-wow-canvas--live ${isUpdating ? "is-updating-all" : ""}`} role="region" aria-label="Live prompt structure">
      {/* Dynamic ambient energy glow */}
      <div className="spe-wow-ambient-glow" aria-hidden="true" />

      {/* Top telemetry bar */}
      <div className="spe-wow-topbar">
        <div className="spe-wow-status-pill live">
          <span className="spe-wow-live-beacon" />
          <span>LIVE BLUEPRINT</span>
        </div>

        <div className="spe-wow-progress-track">
          <div className="spe-wow-progress-bar" />
          <span className="spe-wow-progress-label">4 of 4 Pillars Locked</span>
        </div>

        <span className="spe-wow-privacy-tag">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Private · Runs on Device
        </span>
      </div>

      {/* Clear, magnetic, prestigious headline */}
      <div className="spe-wow-header">
        <h3 className="spe-wow-title">
          Turn your words into an unbreakable prompt.
        </h3>
        <p className="spe-wow-subtitle">
          Structured in real time into four essential pillars any AI follows without drift.
        </p>
      </div>

      {/* 4 Gorgeous Double-Bezel Live Bento Cards */}
      <div className="spe-wow-bento">
        {/* Slot 1: ROLE */}
        <div className={`spe-wow-card is-active card--role ${isUpdating ? "is-updating" : ""}`}>
          <div className="spe-wow-card-inner">
            <div className="spe-wow-card-head">
              <div className="spe-wow-tag-group">
                <span className="spe-wow-icon-box role">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="spe-wow-slot-label role">01 · ROLE</span>
                <span className="spe-wow-status-badge role">● Active Identity</span>
              </div>
              <div className="spe-wow-action-group">
                <span className="spe-wow-hint">Persona & Authority</span>
                <button
                  type="button"
                  className="spe-wow-copy-btn"
                  title="Copy Role"
                  onClick={() => copySlotText("Role", parsed.role)}
                >
                  {copiedSlot === "Role" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="spe-wow-card-body">{parsed.role}</p>
          </div>
        </div>

        {/* Slot 2: GOAL */}
        <div className={`spe-wow-card is-active card--goal ${isUpdating ? "is-updating" : ""}`}>
          <div className="spe-wow-card-inner">
            <div className="spe-wow-card-head">
              <div className="spe-wow-tag-group">
                <span className="spe-wow-icon-box goal">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </span>
                <span className="spe-wow-slot-label goal">02 · GOAL</span>
                <span className="spe-wow-status-badge goal">● Core Mission</span>
              </div>
              <div className="spe-wow-action-group">
                <span className="spe-wow-hint">Primary Objective</span>
                <button
                  type="button"
                  className="spe-wow-copy-btn"
                  title="Copy Goal"
                  onClick={() => copySlotText("Goal", parsed.goal)}
                >
                  {copiedSlot === "Goal" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="spe-wow-card-body">
              {parsed.goal || "The singular outcome the model must accomplish."}
            </p>
          </div>
        </div>

        {/* Slot 3: RULES */}
        <div className={`spe-wow-card is-active card--constraint ${isUpdating ? "is-updating" : ""}`}>
          <div className="spe-wow-card-inner">
            <div className="spe-wow-card-head">
              <div className="spe-wow-tag-group">
                <span className="spe-wow-icon-box constraint">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <span className="spe-wow-slot-label constraint">03 · RULES</span>
                <span className="spe-wow-status-badge constraint">● Zero Drift</span>
              </div>
              <div className="spe-wow-action-group">
                <span className="spe-wow-hint">Strict Guardrails</span>
                <button
                  type="button"
                  className="spe-wow-copy-btn"
                  title="Copy Rules"
                  onClick={() => copySlotText("Rules", parsed.constraint)}
                >
                  {copiedSlot === "Rules" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="spe-wow-card-body">
              {parsed.constraint || "Zero hallucinations. Explicit boundaries to eliminate guesswork."}
            </p>
          </div>
        </div>

        {/* Slot 4: OUTPUT */}
        <div className={`spe-wow-card is-active card--output ${isUpdating ? "is-updating" : ""}`}>
          <div className="spe-wow-card-inner">
            <div className="spe-wow-card-head">
              <div className="spe-wow-tag-group">
                <span className="spe-wow-icon-box output">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </span>
                <span className="spe-wow-slot-label output">04 · OUTPUT</span>
                <span className="spe-wow-status-badge output">● Deliverable</span>
              </div>
              <div className="spe-wow-action-group">
                <span className="spe-wow-hint">Contract & Schema</span>
                <button
                  type="button"
                  className="spe-wow-copy-btn"
                  title="Copy Output"
                  onClick={() => copySlotText("Output", parsed.output)}
                >
                  {copiedSlot === "Output" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="spe-wow-card-body">
              {parsed.output || "The exact format, schema, and steps ready for execution."}
            </p>
          </div>
        </div>
      </div>

      {/* Awwwards Shimmer Island Button */}
      <div className="spe-wow-footer live">
        <button
          type="button"
          className="spe-wow-shimmer-btn"
          disabled={busy}
          onClick={onBuild}
          aria-busy={busy}
        >
          <span className="spe-wow-btn-label">
            {busy ? "Assembling prompt…" : "Generate Production Prompt"}
          </span>
          <span className="spe-wow-btn-orb">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </span>
        </button>

        <div className="spe-wow-shortcut">
          <span>or press</span>
          <kbd>⌘</kbd>
          <span>/</span>
          <kbd>Ctrl</kbd>
          <span>+</span>
          <kbd>Enter</kbd>
        </div>
      </div>
    </div>
  );
}
